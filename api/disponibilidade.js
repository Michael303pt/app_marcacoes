//disponibilidade.js

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/* 
devolve {data: "AAAA-MM-DD", hora: "HH:MM" } correspondentes à data e hora em Lisboa,
para funcionar corretamente independentemente do fuso horário do servidor da Vercel.
hour12: false -> sistema de horas 0 - 24.
*/
function HojeDataHora() {
    const formatador = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const partes = formatador.formatToParts(new Date());
    const obter = (tipo) => partes.find((p) => p.type === tipo).value;

    return {
        data: `${obter('year')}-${obter('month')}-${obter('day')}`,
        hora: `${obter('hour')}:${obter('minute')}`,
    };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { profissional, data } = req.query;

    if (!profissional || !data) {
        return res.status(400).json({ erro: 'Faltam os parâmetros "profissional" e "data".' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ erro: 'Formato de data inválido. Exemplo: 2026-01-28.' });
    }

    try {
        //horários que um profissional trabalha, no dia da semana correspondente a "data"
        const horariosDefinidos = await sql`
            SELECT hora
            FROM horarios
            WHERE profissional = ${profissional}
              AND dia_semana = EXTRACT(DOW FROM ${data}::date)
            ORDER BY hora
        `;

        //horários reservados nesse dia (marcações canceladas não contam como ocupadas)
        const reservados = await sql`
            SELECT hora
            FROM marcacoes
            WHERE profissional = ${profissional}
              AND data = ${data}::date
              AND status != 'cancelada'
        `;

        const horasReservadas = new Set(reservados.map((linha) => linha.hora.slice(0, 5)));

        let disponiveis = horariosDefinidos
            .map((linha) => linha.hora.slice(0, 5))
            .filter((hora) => !horasReservadas.has(hora));

        // se a data escolhida for hoje, remove horários que já passaram
        const { data: hojeISO, hora: horaAgora } = HojeDataHora();
        if (data === hojeISO) {
            disponiveis = disponiveis.filter((hora) => hora > horaAgora);
        } else if (data < hojeISO) {
            // segurança extra: dia já passado, não há nada disponível
            disponiveis = [];
        }

        return res.status(200).json({ horarios: disponiveis });
    } catch (erro) {
        console.error('Erro em /api/disponibilidade:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os horários disponíveis.' });
    }
}
