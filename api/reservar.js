//reservar.js

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { profissional, data, hora, servico_id, produtos, cliente_nome, cliente_contacto, cliente_email } = req.body || {};

    if (!profissional || !data || !hora || !servico_id || !cliente_nome || !cliente_contacto || !cliente_email) {
        return res.status(400).json({ erro: 'Faltam dados obrigatórios (profissional, data, hora, serviço, nome, telefone e email).' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
        return res.status(400).json({ erro: 'Data ou hora em formato inválido. Exemplo: 2026-01-28.' });
    }

    if (!Number.isInteger(servico_id)) {
        return res.status(400).json({ erro: 'Serviço inválido.' });
    }

    // produtos é opcional — array de { id, nome, preco, quantidade }
    const produtosFinal = Array.isArray(produtos) ? produtos : [];
    const produtosValidos = produtosFinal.every((item) =>
        item &&
        Number.isInteger(item.id) &&
        typeof item.nome === 'string' && item.nome.trim() !== '' &&
        typeof item.preco === 'number' && item.preco >= 0 &&
        Number.isInteger(item.quantidade) && item.quantidade > 0
        );
    if (!produtosValidos) {
        return res.status(400).json({ erro: 'Lista de produtos inválida.' });
    }

    if (!/^\d{9}$/.test(cliente_contacto)) {
        return res.status(400).json({ erro: 'O telefone deve ter exatamente 9 dígitos.' });
    }

    const clienteEmailFinal = String(cliente_email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmailFinal)) {
        return res.status(400).json({ erro: 'O email introduzido não é válido.' });
    }

    try {
        const jaExiste = await sql`
            SELECT id FROM marcacoes
            WHERE profissional = ${profissional}
              AND data = ${data}::date
              AND hora = ${hora}::time
              AND status != 'cancelada'
        `;

        if (jaExiste.length > 0) {
            return res.status(409).json({ erro: 'Esse horário acabou de ser reservado por outra pessoa. Escolhe outro horário.' });
        }

        await sql`
            INSERT INTO marcacoes (profissional, data, hora, servico_id, produtos, cliente_nome, cliente_contacto, cliente_email)
            VALUES (${profissional}, ${data}::date, ${hora}::time, ${servico_id}, ${JSON.stringify(produtosFinal)}::jsonb, 
            ${cliente_nome}, ${cliente_contacto}, ${clienteEmailFinal})
        `;

        return res.status(201).json({ sucesso: true });
    } catch (erro) {
        // 23505 = violação de UNIQUE (proteção extra contra corridas em simultâneo)
        if (erro && erro.code === '23505') {
            return res.status(409).json({ erro: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.' });
        }
        console.error('Erro em /api/reservar:', erro);
        return res.status(500).json({ erro: 'Não foi possível concluir a marcação.' });
    }
}
