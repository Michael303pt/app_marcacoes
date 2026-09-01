// lib/db.js
//
// Ligação partilhada à base de dados (Neon). Se já tiveres um ficheiro
// equivalente no projeto (ex.: usado dentro de api/reservar.js), usa esse
// e apaga este — o objetivo é haver só UMA instância de `sql` reutilizada
// por todas as funções /api.

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

export const sql = neon(process.env.DATABASE_URL);
