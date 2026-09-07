// api/cron/lembrete-marcacoes.js
//
// Disparado automaticamente pela Vercel Cron (ver vercel.json), uma vez por
// dia. Procura marcações que caem daqui a exatamente 3 dias, ainda por
// confirmar, e envia um email ao cliente com um link para confirmar ou
// cancelar a marcação.
//
// Podes também testar isto manualmente (fora do horário do cron) fazendo
// um pedido GET à rota com o cabeçalho Authorization correto — ver README.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

import { enviarEmail } from "../../lib/email.js";
import crypto from "node:crypto";

export default async function handler(req, res) {
  // protege o endpoint: só aceita pedidos da Vercel Cron (ou com o segredo certo)
  if (process.env.CRON_SECRET) {
    const autorizacao = req.headers["authorization"];
    if (autorizacao !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ erro: "Não autorizado." });
    }
  }

  try {
    // marcações agendadas para daqui a 3 dias, ainda sem lembrete enviado
    const marcacoes = await sql`
      SELECT
        m.id,
        m.profissional,
        m.data,
        m.hora,
        m.cliente_nome,
        m.cliente_email,
        s.nome AS servico_nome,
        m.produtos
      FROM marcacoes m
      LEFT JOIN servicos s ON s.id = m.servico_id
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
          UPDATE marcacoes
          SET token_confirmacao = ${token},
              token_criado_em = now()
          WHERE id = ${marcacao.id}
        `;

        const linkConfirmar = `${baseUrl}/api/confirmar-marcacao?token=${token}&acao=confirmar`;
        const linkCancelar = `${baseUrl}/api/confirmar-marcacao?token=${token}&acao=cancelar`;

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
          assunto: "Confirma a tua marcação — Olimpo Barbershop",
          html: montarHtmlLembrete({
            nome: marcacao.cliente_nome,
            dataFormatada,
            hora: marcacao.hora,
            profissional: marcacao.profissional,
            servico: marcacao.servico_nome,
            produtos: marcacao.produtos,
            linkConfirmar,
            linkCancelar,
          }),
        });

        // só marca como enviado se o email foi mesmo entregue à Brevo com sucesso
        await sql`
          UPDATE marcacoes SET lembrete_enviado_em = now() WHERE id = ${marcacao.id}
        `;

        resultados.push({ id: marcacao.id, enviado: true });
      } catch (erroEnvio) {
        console.error(`Falha ao enviar lembrete da marcação ${marcacao.id}:`, erroEnvio);
        resultados.push({ id: marcacao.id, enviado: false, erro: String(erroEnvio) });
      }
    }

    return res.status(200).json({ processadas: marcacoes.length, resultados });
  } catch (erro) {
    console.error("Erro no cron de lembretes:", erro);
    return res.status(500).json({ erro: "Falha ao processar lembretes." });
  }
}

function montarHtmlLembrete({ nome, dataFormatada, hora, profissional, servico, produtos, linkConfirmar, linkCancelar }) {

  const listaProdutos = Array.isArray(produtos) ? produtos : [];
  const produtosHtml = listaProdutos.length
    ? listaProdutos.map((item) => `${item.nome}${item.quantidade > 1 ? ` x${item.quantidade}` : ""}`).join(", "): null;



  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#1b1714;">
      <h2 style="color:#8b2e2e; margin-bottom: 4px;">Olimpo Barbershop</h2>
      <p>Olá ${nome},</p>
      <p>Tens uma marcação daqui a 3 dias:</p>
      <div style="background:#f4f1ec; padding:14px 18px; border-radius:6px; margin: 16px 0;">
        <strong>Data:</strong> ${dataFormatada}<br>
        <strong>Hora:</strong> ${hora}<br>
        <strong>Profissional:</strong> ${profissional}<br>
        <strong>Serviço:</strong> ${servico || "—"}${produtosHtml ? `<br>
        <strong>Produtos:</strong> ${produtosHtml}` : ""}        
      </div>
      <p>Por favor confirma a tua presença. Se não puderes vir, cancela para libertarmos o horário a outro cliente.</p>
      <p style="margin: 28px 0;">
        <a href="${linkConfirmar}"
           style="background:#b08d57; color:#1b1714; padding:12px 22px; text-decoration:none; border-radius:4px; font-weight:bold; margin-right:12px; display:inline-block;">
          Confirmar marcação
        </a>
        <a href="${linkCancelar}"
           style="background:transparent; color:#8b2e2e; padding:11px 21px; text-decoration:none; border-radius:4px; border:1px solid #8b2e2e; display:inline-block; margin-top:8px;">
          Cancelar marcação
        </a>
      </p>
      <p style="font-size:12px; color:#888;">Se não reconheces esta marcação, podes ignorar este email.</p>
    </div>
  `;
}
