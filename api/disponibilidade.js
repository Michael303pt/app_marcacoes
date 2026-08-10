// api/disponibilidade.js
// GET /api/disponibilidade?profissional=Robert%20Simon&data=2026-08-15
// Devolve os horários desse profissional, nesse dia da semana, que ainda não
// estão reservados nessa data.

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { profissional, data } = req.query;

    if (!profissional || !data) {
        return res.status(400).json({ erro: 'Faltam os parâmetros "profissional" e "data".' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ erro: 'Formato de data inválido. Usa AAAA-MM-DD.' });
    }

    try {
        // horários que este profissional trabalha no dia da semana correspondente a "data"
        const horariosDefinidos = await sql`
            SELECT hora
            FROM horarios
            WHERE profissional = ${profissional}
              AND dia_semana = EXTRACT(DOW FROM ${data}::date)
            ORDER BY hora
        `;

        // horários já reservados nesse dia exato
        const reservados = await sql`
            SELECT hora
            FROM marcacoes
            WHERE profissional = ${profissional}
              AND data = ${data}::date
        `;

        const horasReservadas = new Set(reservados.map((linha) => linha.hora.slice(0, 5)));

        const disponiveis = horariosDefinidos
            .map((linha) => linha.hora.slice(0, 5))
            .filter((hora) => !horasReservadas.has(hora));

        return res.status(200).json({ horarios: disponiveis });
    } catch (erro) {
        console.error('Erro em /api/disponibilidade:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os horários disponíveis.' });
    }
}
