// api/servicos.js
// GET /api/servicos
// Devolve a lista de serviços ativos (corte, barba, etc.) — escolha obrigatória na marcação.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        const servicos = await sql`
            SELECT id, nome, preco
            FROM servicos
            WHERE ativo = true
            ORDER BY nome
        `;

        return res.status(200).json({ servicos });
    } catch (erro) {
        console.error('Erro em /api/servicos:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os serviços.' });
    }
}
