

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// eventos que consideramos prova de que o email não é entregável
const EVENTOS_INVALIDOS = new Set(['hardBounce', 'blocked', 'invalid']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  if (process.env.BREVO_WEBHOOK_SECRET) {
    if (req.query.secret !== process.env.BREVO_WEBHOOK_SECRET) {
      return res.status(401).json({ erro: 'Não autorizado.' });
    }
  }

  // a Brevo pode enviar um único evento ou um array de eventos (webhooks em lote)
  const eventos = Array.isArray(req.body) ? req.body : [req.body];

  try {
    for (const evento of eventos) {
      if (!evento || !EVENTOS_INVALIDOS.has(evento.event)) continue;

      const marcacaoId = extrairMarcacaoId(evento.tags);
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

function extrairMarcacaoId(tags) {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    const match = /^marcacao-(\d+)$/.exec(tag);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}