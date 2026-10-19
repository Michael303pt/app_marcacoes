// api/webhooks/brevo.js
//
// Recebe as notificações de eventos de entrega da Brevo (configurado no
// painel da Brevo: Transactional > Settings > Webhooks). Quando um email de
// lembrete falha a entrega de forma definitiva (hardBounce, blocked, invalid),
// marcamos a marcação correspondente como tendo um email inválido — útil
// para o painel de administração sinalizar isto ao dono do negócio.
//
// A Brevo identifica a marcação através da "tag" que enviámos ao criar o
// email (ver lib/email.js e os crons em api/cron/), no formato "marcacao-<id>"
// (barbershop) ou "skincare-<id>" (skincare).
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

      // { origem: 'barbershop' | 'skincare', id } — a tag diz de que negócio é o email
      let alvo = extrairMarcacao(evento);

      // fallback: alguns eventos (ex. invalid_email) não trazem a tag —
      // nesse caso tentamos associar pelo email, à marcação mais recente
      // (barbershop ou skincare) que teve um lembrete enviado para esse endereço
      if (!alvo && evento.email) {
        const [barbershop, skincare] = await Promise.all([
          sql`
            SELECT id, lembrete_enviado_em FROM marcacoes
            WHERE cliente_email = ${evento.email}
              AND status != 'cancelada'
              AND lembrete_enviado_em IS NOT NULL
            ORDER BY lembrete_enviado_em DESC
            LIMIT 1
          `,
          sql`
            SELECT id, lembrete_enviado_em FROM marcacoes_skincare
            WHERE cliente_email = ${evento.email}
              AND status != 'cancelada'
              AND lembrete_enviado_em IS NOT NULL
            ORDER BY lembrete_enviado_em DESC
            LIMIT 1
          `,
        ]);
        const b = barbershop[0];
        const s = skincare[0];
        if (b && (!s || b.lembrete_enviado_em >= s.lembrete_enviado_em)) {
          alvo = { origem: 'barbershop', id: b.id };
        } else if (s) {
          alvo = { origem: 'skincare', id: s.id };
        }
      }

      if (!alvo) continue;

      if (alvo.origem === 'skincare') {
        await sql`
          UPDATE marcacoes_skincare
          SET email_invalido = true,
              email_bounce_evento = ${evento.event},
              email_bounce_em = now()
          WHERE id = ${alvo.id}
        `;
      } else {
        await sql`
          UPDATE marcacoes
          SET email_invalido = true,
              email_bounce_evento = ${evento.event},
              email_bounce_em = now()
          WHERE id = ${alvo.id}
        `;
      }
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

function extrairMarcacao(evento) {
  // formato documentado: array de strings
  if (Array.isArray(evento.tags)) {
    for (const tag of evento.tags) {
      const encontrada = interpretarTag(tag, true);
      if (encontrada) return encontrada;
    }
  }
  // formato observado em alguns payloads: string única no campo "tag"
  if (typeof evento.tag === 'string') {
    return interpretarTag(evento.tag, false);
  }
  return null;
}

// "marcacao-12" -> barbershop #12; "skincare-7" -> skincare #7
function interpretarTag(tag, exata) {
  if (typeof tag !== 'string') return null;
  const regexBarbershop = exata ? /^marcacao-(\d+)$/ : /marcacao-(\d+)/;
  const regexSkincare = exata ? /^skincare-(\d+)$/ : /skincare-(\d+)/;

  const barbershop = regexBarbershop.exec(tag);
  if (barbershop) return { origem: 'barbershop', id: parseInt(barbershop[1], 10) };

  const skincare = regexSkincare.exec(tag);
  if (skincare) return { origem: 'skincare', id: parseInt(skincare[1], 10) };

  return null;
}
