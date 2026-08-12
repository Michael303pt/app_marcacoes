// api/produtos.js
// GET /api/produtos
// Devolve a lista de produtos/serviços ativos, para o cliente escolher na marcação.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        const produtos = await sql`
            SELECT id, nome, preco
            FROM produtos
            WHERE ativo = true
            ORDER BY nome
        `;

        return res.status(200).json({ produtos });
    } catch (erro) {
        console.error('Erro em /api/produtos:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os produtos.' });
    }
}
