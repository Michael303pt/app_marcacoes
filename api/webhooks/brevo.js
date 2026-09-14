// api/webhooks/brevo.js
//
// Recebe as notificações de eventos de entrega da Brevo (configurado no
// painel da Brevo: Transactional > Settings > Webhooks). Quando um email de
// lembrete falha a entrega de forma definitiva (hardBounce, blocked, invalid),
// marcamos a marcação correspondente como tendo um email inválido — útil
// para o painel de administração sinalizar isto ao dono do negócio.
//
// A Brevo identifica a marcação através da "tag" que enviámos ao criar o
// email (ver lib/email.js e api/cron/lembrete-marcacoes.js), no formato
// "marcacao-<id>".
//
// Autenticação: no painel da Brevo, escolhe o método "Token" ao criar o
// webhook e cola aí o mesmo valor que definires na variável de ambiente
// BREVO_WEBHOOK_SECRET. A Brevo envia esse valor no cabeçalho Authorization,
// no formato "Bearer <token>".
//
// Eventos a subscrever na Brevo: hardBounce, blocked, invalid
// (não subscrevas softBounce — é normalmente temporário, não significa que
// o email não existe).

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// eventos que consideramos prova de que o email não é entregável — a Brevo
// usa nomes ligeiramente diferentes consoante o contexto (documentação vs.
// payload real), por isso aceitamos todas as variantes conhecidas
const EVENTOS_INVALIDOS = new Set([
  'hardBounce', 'hard_bounce',
  'blocked',
  'invalid', 'invalid_email',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  if (process.env.BREVO_WEBHOOK_SECRET) {
    const autorizacao = req.headers['authorization'];
    if (autorizacao !== `Bearer ${process.env.BREVO_WEBHOOK_SECRET}`) {
      return res.status(401).json({ erro: 'Não autorizado.' });
    }
  }

  // a Brevo pode enviar um único evento ou um array de eventos (webhooks em lote)
  const eventos = Array.isArray(req.body) ? req.body : [req.body];

  try {
    for (const evento of eventos) {
      if (!evento || !EVENTOS_INVALIDOS.has(evento.event)) continue;

      let marcacaoId = extrairMarcacaoId(evento);

      // fallback: alguns eventos (ex. invalid_email) não trazem a tag —
      // nesse caso tentamos associar pelo email, à marcação mais recente
      // que teve um lembrete enviado para esse endereço
      if (!marcacaoId && evento.email) {
        const porEmail = await sql`
          SELECT id FROM marcacoes
          WHERE cliente_email = ${evento.email}
            AND status != 'cancelada'
            AND lembrete_enviado_em IS NOT NULL
          ORDER BY lembrete_enviado_em DESC
          LIMIT 1
        `;
        if (porEmail[0]) {
          marcacaoId = porEmail[0].id;
        }
      }

      if (!marcacaoId) continue;

      await sql`
        UPDATE marcacoes
        SET email_invalido = true,
            email_bounce_evento = ${evento.event},
            email_bounce_em = now()
        WHERE id = ${marcacaoId}
      `;
    }

    // responder sempre 200 rapidamente — a Brevo tem mecanismo de retry se falhar
    return res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro no webhook da Brevo:', erro);
    // devolvemos 200 mesmo assim para a Brevo não continuar a tentar reenviar
    // indefinidamente por um erro do nosso lado; o erro fica registado nos logs
    return res.status(200).json({ ok: false });
  }
}

function extrairMarcacaoId(evento) {
  // formato documentado: array de strings
  if (Array.isArray(evento.tags)) {
    for (const tag of evento.tags) {
      const match = /^marcacao-(\d+)$/.exec(tag);
      if (match) return parseInt(match[1], 10);
    }
  }
  // formato observado em alguns payloads: string única no campo "tag"
  if (typeof evento.tag === 'string') {
    const match = /marcacao-(\d+)/.exec(evento.tag);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}