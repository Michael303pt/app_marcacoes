//profissionais.js

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        // só o nome é exposto — nunca email nem password_hash.
        // O nome tem de coincidir com o texto guardado em horarios.profissional
        // e marcacoes.profissional (é assim que as duas tabelas se ligam).
        const profissionais = await sql`
            SELECT COALESCE(NULLIF(TRIM(full_name), ''), username) AS nome
            FROM users
            ORDER BY nome
        `;

        return res.status(200).json({ profissionais });
    } catch (erro) {
        console.error('Erro em /api/profissionais:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os profissionais.' });
    }
}
