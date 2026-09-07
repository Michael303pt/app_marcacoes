// lib/email.js
//
// Envio de emails transacionais via Brevo (API REST direta, sem SDK extra —
// funciona com "fetch" nativo, disponível no runtime Node das funções da Vercel).
//
// Docs: https://developers.brevo.com/reference/send-transac-email
//
// Variáveis de ambiente necessárias (definir no projeto na Vercel):
//   BREVO_API_KEY       -> gerada em Brevo: Definições > SMTP & API > API Keys
//   BREVO_SENDER_EMAIL   -> email remetente, tem de estar verificado na Brevo
//   BREVO_SENDER_NOME    -> opcional, nome a mostrar como remetente

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function enviarEmail({ para, nomeDestinatario, assunto, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const remetenteEmail = process.env.BREVO_SENDER_EMAIL;
  const remetenteNome = process.env.BREVO_SENDER_NOME || "Olimpo Barbershop";

  if (!apiKey || !remetenteEmail) {
    throw new Error(
      "BREVO_API_KEY ou BREVO_SENDER_EMAIL não estão configurados nas variáveis de ambiente."
    );
  }

  const resposta = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: remetenteNome, email: remetenteEmail },
      to: [{ email: para, name: nomeDestinatario }],
      subject: assunto,
      htmlContent: html,
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Brevo devolveu ${resposta.status}: ${corpo}`);
  }

  return resposta.json();
}
