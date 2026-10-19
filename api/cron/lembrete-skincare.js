// api/cron/lembrete-skincare.js
//
// Cron diário (ver vercel.json) — equivalente a lembrete-marcacoes.js, mas para
// marcacoes_skincare. Envia à cliente um email com links para confirmar ou
// cancelar a marcação (lib/skincare-handlers/confirmar-marcacao.js).
//
// A tag enviada à Brevo é "skincare-<id>" (e não "marcacao-<id>") para o webhook
// (api/webhooks/brevo.js) saber em que tabela marcar o email como inválido.

import { neon } from '@neondatabase/serverless';
import crypto from "node:crypto";

import { enviarEmail } from "../../lib/email.js";
import { NOME_NEGOCIO_SKINCARE, escapeHtml } from "../../lib/skincare.js";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // protege o endpoint: só aceita pedidos da Vercel Cron (ou com o segredo certo)
  if (process.env.CRON_SECRET) {
    const autorizacao = req.headers["authorization"];
    if (autorizacao !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ erro: "Não autorizado." });
    }
  }

  try {
    // marcações próximas (até 3 dias), ainda sem lembrete enviado
    const marcacoes = await sql`
      SELECT
        m.id,
        m.data,
        m.hora,
        m.cliente_nome,
        m.cliente_email,
        s.nome AS servico_nome,
        m.produtos
      FROM marcacoes_skincare m
      LEFT JOIN servicos_skincare s ON s.id = m.servico_id
      WHERE m.status = 'agendada'
        AND m.lembrete_enviado_em IS NULL
        AND m.cliente_email IS NOT NULL
        AND m.data BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
    `;

    const baseUrl = process.env.SITE_URL || `https://${req.headers.host}`;
    const resultados = [];

    for (const marcacao of marcacoes) {
      const token = crypto.randomUUID();

      try {
        // gera e guarda o token ANTES de enviar, para o link no email ser válido
        await sql`
          UPDATE marcacoes_skincare
          SET token_confirmacao = ${token},
              token_criado_em = now()
          WHERE id = ${marcacao.id}
        `;

        const linkConfirmar = `${baseUrl}/api/skincare/marcacoes?token=${token}&acao=confirmar`;
        const linkCancelar = `${baseUrl}/api/skincare/marcacoes?token=${token}&acao=cancelar`;

        const data = marcacao.data instanceof Date
          ? marcacao.data
          : new Date(`${marcacao.data}T00:00:00`);

        const dataFormatada = data.toLocaleDateString("pt-PT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        await enviarEmail({
          para: marcacao.cliente_email,
          nomeDestinatario: marcacao.cliente_nome,
          remetenteNome: NOME_NEGOCIO_SKINCARE,
          assunto: `Confirme a sua marcação — ${NOME_NEGOCIO_SKINCARE}`,
          tags: [`skincare-${marcacao.id}`],
          html: montarHtmlLembrete({
            nome: marcacao.cliente_nome,
            dataFormatada,
            hora: String(marcacao.hora).slice(0, 5),
            servico: marcacao.servico_nome,
            produtos: marcacao.produtos,
            linkConfirmar,
            linkCancelar,
          }),
        });

        // só marca como enviado se o email foi mesmo entregue à Brevo com sucesso
        await sql`
          UPDATE marcacoes_skincare SET lembrete_enviado_em = now() WHERE id = ${marcacao.id}
        `;

        resultados.push({ id: marcacao.id, enviado: true });
      } catch (erroEnvio) {
        console.error(`Falha ao enviar lembrete da marcação skincare ${marcacao.id}:`, erroEnvio);
        resultados.push({ id: marcacao.id, enviado: false, erro: String(erroEnvio) });
      }
    }

    return res.status(200).json({ processadas: marcacoes.length, resultados });
  } catch (erro) {
    console.error("Erro no cron de lembretes skincare:", erro);
    return res.status(500).json({ erro: "Falha ao processar lembretes." });
  }
}

function montarHtmlLembrete({ nome, dataFormatada, hora, servico, produtos, linkConfirmar, linkCancelar }) {
  const listaProdutos = Array.isArray(produtos) ? produtos : [];
  const produtosHtml = listaProdutos.length
    ? listaProdutos
        .map((item) => `${escapeHtml(item.nome)}${item.quantidade > 1 ? ` x${item.quantidade}` : ""}`)
        .join(", ")
    : null;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#2e3428;">
      <h2 style="color:#5c6753; margin-bottom: 4px; font-weight:500;">${NOME_NEGOCIO_SKINCARE}</h2>
      <p>Olá ${escapeHtml(nome)},</p>
      <p>Lembramos a sua marcação:</p>
      <div style="background:#f0f2ec; padding:14px 18px; border-radius:6px; margin: 16px 0;">
        <strong>Data:</strong> ${dataFormatada}<br>
        <strong>Hora:</strong> ${hora}<br>
        <strong>Tratamento:</strong> ${escapeHtml(servico) || "—"}${produtosHtml ? `<br>
        <strong>Produtos:</strong> ${produtosHtml}` : ""}
      </div>
      <p>Por favor confirme a sua presença. Se não puder vir, cancele para libertarmos o horário a outra cliente.</p>
      <p style="margin: 28px 0;">
        <a href="${linkConfirmar}"
           style="background:#5c6753; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:3px; font-weight:bold; margin-right:12px; display:inline-block;">
          Confirmar marcação
        </a>
        <a href="${linkCancelar}"
           style="background:transparent; color:#5c6753; padding:11px 21px; text-decoration:none; border-radius:3px; border:1px solid #5c6753; display:inline-block; margin-top:8px;">
          Cancelar marcação
        </a>
      </p>
      <p style="font-size:12px; color:#888;">Se não reconhece esta marcação, pode ignorar este email.</p>
    </div>
  `;
}
