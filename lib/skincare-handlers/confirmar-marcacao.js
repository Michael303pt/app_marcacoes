// lib/skincare-handlers/confirmar-marcacao.js
//
// Aberto no browser quando a cliente clica num dos dois links do email de
// lembrete (gerado em api/cron/lembrete-skincare.js).

import { neon } from '@neondatabase/serverless';
import { NOME_NEGOCIO_SKINCARE, escapeHtml } from '../skincare.js';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // chega por query string porque a cliente vem de um link no email (GET)
  const { token, acao } = req.query;

  if (!token || !["confirmar", "cancelar"].includes(acao)) {
    return paginaResposta(res, 400, "Pedido inválido", "O link que usou não é válido.");
  }

  try {
    // o token é um UUID aleatório criado no cron — funciona como "senha" da marcação
    const linhas = await sql`
      SELECT id, cliente_nome, status
      FROM marcacoes_skincare
      WHERE token_confirmacao = ${token}
    `;
    const marcacao = linhas[0];

    if (!marcacao) {
      return paginaResposta(
        res, 404, "Marcação não encontrada",
        "Este link já não é válido — pode já ter sido usado, ou a marcação já não existe."
      );
    }

    // já cancelada: não deixa "ressuscitar" a marcação com o link de confirmar
    if (marcacao.status === "cancelada") {
      return paginaResposta(res, 200, "Marcação já cancelada", "Esta marcação já tinha sido cancelada anteriormente.");
    }

    // escapa o nome porque vai direto para o HTML da página
    const nome = escapeHtml(marcacao.cliente_nome);

    if (acao === "confirmar") {
      await sql`UPDATE marcacoes_skincare SET status = 'confirmada' WHERE id = ${marcacao.id}`;
      return paginaResposta(
        res, 200, "Marcação confirmada ✓",
        `Obrigada, ${nome}! A sua marcação está confirmada. Até breve.`
      );
    }

    // acao === "cancelar"
    await sql`UPDATE marcacoes_skincare SET status = 'cancelada' WHERE id = ${marcacao.id}`;
    return paginaResposta(
      res, 200, "Marcação cancelada",
      `A sua marcação foi cancelada, ${nome}. Se mudar de ideias, faça uma nova marcação no site.`
    );
  } catch (erro) {
    console.error("Erro em /api/skincare/marcacoes:", erro);
    return paginaResposta(
      res, 500, "Ocorreu um erro",
      "Não foi possível processar o seu pedido. Tente novamente mais tarde ou contacte-nos diretamente."
    );
  }
}

// página HTML simples, para a cliente não ver JSON ao clicar no link do email
function paginaResposta(res, statusCode, titulo, mensagem) {
  res.status(statusCode).setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} · ${NOME_NEGOCIO_SKINCARE}</title>
<style>
  body{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
        background:#f0f2ec; color:#2e3428; font-family: Arial, sans-serif; padding:2rem; }
  .card{ max-width:420px; text-align:center; background:#ffffff; border:1px solid rgba(46,52,40,.1);
         border-radius:10px; padding:2.4rem 2rem; }
  h1{ color:#5c6753; font-size:1.4rem; margin:0 0 1rem; font-weight:500; }
  p{ line-height:1.6; color:#78806e; margin:0; }
  a{ display:inline-block; margin-top:1.6rem; color:#5c6753; text-decoration:none; border:1px solid #7c8b6f;
     padding:.6rem 1.2rem; border-radius:3px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${titulo}</h1>
    <p>${mensagem}</p>
    <a href="/skincare.html">← Voltar ao site</a>
  </div>
</body>
</html>`);
}
