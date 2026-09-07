// api/confirmar-marcacao.js
//
// Endpoint aberto no browser quando o cliente clica num dos dois links do
// email de lembrete. Não é chamado pelo frontend (calendario.js) — é acedido
// diretamente pelo cliente a partir do email.


import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);


export default async function handler(req, res) {
  const { token, acao } = req.query;

  if (!token || !["confirmar", "cancelar"].includes(acao)) {
    return paginaResposta(res, 400, "Pedido inválido", "O link que usaste não é válido.");
  }

  try {
  const linhas = await sql`
    SELECT id, cliente_nome, status
    FROM marcacoes
    WHERE token_confirmacao = ${token}
  `;
  const marcacao = linhas[0];

  if (!marcacao) {
    return paginaResposta(
      res, 404, "Marcação não encontrada",
      "Este link já não é válido — pode já ter sido usado, ou a marcação já não existe."
    );
  }

  if (marcacao.status === "cancelada") {
    return paginaResposta(res, 200, "Marcação já cancelada", "Esta marcação já tinha sido cancelada anteriormente.");
  }

  if (acao === "confirmar") {
    await sql`UPDATE marcacoes SET status = 'confirmada' WHERE id = ${marcacao.id}`;
    return paginaResposta(
      res, 200, "Marcação confirmada ✓",
      `Obrigado, ${marcacao.cliente_nome}! A tua marcação está confirmada. Até breve.`
    );
  }

  // acao === "cancelar"
  await sql`UPDATE marcacoes SET status = 'cancelada' WHERE id = ${marcacao.id}`;
  return paginaResposta(
    res, 200, "Marcação cancelada",
    `A tua marcação foi cancelada, ${marcacao.cliente_nome}. Se mudares de ideias, faz uma nova marcação no site.`
  );
} catch (erro) {
  console.error("Erro em /api/confirmar-marcacao:", erro);
  return paginaResposta(
    res, 500, "Ocorreu um erro",
    "Não foi possível processar o teu pedido. Tenta novamente mais tarde ou contacta-nos diretamente."
  );
}
}

function paginaResposta(res, statusCode, titulo, mensagem) {
  res.status(statusCode).setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} · Olimpo Barbershop</title>
<style>
  body{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
        background:#1b1714; color:#ede6da; font-family: Arial, sans-serif; padding:2rem; }
  .card{ max-width:420px; text-align:center; background:#221c18; border:1px solid rgba(176,141,87,.25);
         border-radius:10px; padding:2.4rem 2rem; }
  h1{ color:#b08d57; font-size:1.4rem; margin-bottom:1rem; }
  p{ line-height:1.6; color:#cfc6b8; }
  a{ display:inline-block; margin-top:1.6rem; color:#b08d57; text-decoration:none; border:1px solid #b08d57;
     padding:.6rem 1.2rem; border-radius:5px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${titulo}</h1>
    <p>${mensagem}</p>
    <a href="/barbershop.html">← Voltar ao site</a>
  </div>
</body>
</html>`);
}
