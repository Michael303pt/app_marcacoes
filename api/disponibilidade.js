//disponibilidade.js

import { neon } from '@neondatabase/serverless';

import { slotsNecessarios, subHorarios, paraMinutos, INTERVALO_SLOT_MINUTOS } from '../lib/duracao.js';

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

    const { profissional, data, servico_id } = req.query;

    if (!profissional || !data || !servico_id) {
        return res.status(400).json({ erro: 'Faltam os parâmetros "profissional", "data" e "servico_id".' });
    }

    if (!/^\d+$/.test(servico_id)) {
        return res.status(400).json({ erro: 'Serviço inválido.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ erro: 'Formato de data inválido. Exemplo: 2026-01-28.' });
    }

    try {
        // duração do serviço -> quantos horários seguidos precisa
        const servico = await sql`
            SELECT duracao FROM servicos WHERE id = ${parseInt(servico_id, 10)} AND ativo = true
        `;
        if (servico.length === 0) {
            return res.status(400).json({ erro: 'Serviço inválido.' });
        }
        const slots = slotsNecessarios(servico[0].duracao);

        //horários que um profissional trabalha, no dia da semana correspondente a "data"
        const horariosDefinidos = await sql`
            SELECT hora
            FROM horarios
            WHERE profissional = ${profissional}
              AND dia_semana = EXTRACT(DOW FROM ${data}::date)
            ORDER BY hora
        `;

        //marcações ativas nesse dia, como intervalos [hora, hora_fim) (canceladas não contam)
        const reservados = await sql`
            SELECT hora, hora_fim
            FROM marcacoes
            WHERE profissional = ${profissional}
              AND data = ${data}::date
              AND status != 'cancelada'
        `;

        const intervalosOcupados = reservados.map((linha) => ({
            inicio: paraMinutos(linha.hora.slice(0, 5)),
            fim: paraMinutos(linha.hora_fim.slice(0, 5)),
        }));

        const horasDefinidas = horariosDefinidos.map((linha) => linha.hora.slice(0, 5));
        const setDefinidas = new Set(horasDefinidas);

        // uma hora só está disponível se TODOS os horários que o serviço ocupa
        // existem no horário de trabalho e nenhum colide com uma marcação existente
        const cabe = (hora) => {
            if (!subHorarios(hora, slots).every((h) => setDefinidas.has(h))) return false;
            const inicio = paraMinutos(hora);
            const fim = inicio + slots * INTERVALO_SLOT_MINUTOS;
            return !intervalosOcupados.some((o) => inicio < o.fim && fim > o.inicio);
        };

        let disponiveis = horasDefinidas.filter(cabe);

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