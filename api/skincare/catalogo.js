// api/skincare/catalogo.js
//
// GET /api/skincare/catalogo -> { servicos, produtos } (só os ativos).
// Juntar os dois numa função poupa uma Serverless Function (limite de 12 na Hobby).

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        const [servicos, produtos] = await Promise.all([
            sql`SELECT id, nome, preco, duracao_minutos FROM servicos_skincare WHERE ativo = true ORDER BY nome`,
            sql`SELECT id, nome, preco FROM produtos_skincare WHERE ativo = true ORDER BY nome`,
        ]);

        return res.status(200).json({ servicos, produtos });
    } catch (erro) {
        console.error('Erro em /api/skincare/catalogo:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os tratamentos e produtos.' });
    }
}
