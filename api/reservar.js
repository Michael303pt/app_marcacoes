// api/reservar.js
// POST /api/reservar  { profissional, data, hora, cliente_nome, cliente_contacto }
// Cria uma marcação, se o horário ainda estiver livre.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { profissional, data, hora, cliente_nome, cliente_contacto } = req.body || {};

    if (!profissional || !data || !hora || !cliente_nome) {
        return res.status(400).json({ erro: 'Faltam dados obrigatórios (profissional, data, hora, cliente_nome).' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
        return res.status(400).json({ erro: 'Data ou hora em formato inválido.' });
    }

    try {
        const jaExiste = await sql`
            SELECT id FROM marcacoes
            WHERE profissional = ${profissional}
              AND data = ${data}::date
              AND hora = ${hora}::time
        `;

        if (jaExiste.length > 0) {
            return res.status(409).json({ erro: 'Esse horário acabou de ser reservado por outra pessoa. Escolhe outro horário.' });
        }

        await sql`
            INSERT INTO marcacoes (profissional, data, hora, cliente_nome, cliente_contacto)
            VALUES (${profissional}, ${data}::date, ${hora}::time, ${cliente_nome}, ${cliente_contacto || null})
        `;

        return res.status(201).json({ sucesso: true });
    } catch (erro) {
        // 23505 = violação de UNIQUE (proteção extra contra corridas em simultâneo)
        if (erro && erro.code === '23505') {
            return res.status(409).json({ erro: 'Esse horário acabou de ser reservado por outra pessoa. Escolhe outro horário.' });
        }
        console.error('Erro em /api/reservar:', erro);
        return res.status(500).json({ erro: 'Não foi possível concluir a marcação.' });
    }
}
