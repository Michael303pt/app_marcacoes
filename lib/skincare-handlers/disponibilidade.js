// lib/skincare-handlers/disponibilidade.js
//
// Igual à da barbershop, mas sem parâmetro "profissional": só há uma
// profissional de skincare, resolvida no servidor (lib/skincare.js).
// GET /api/skincare/marcacoes?data=AAAA-MM-DD&servico_id=N

import { neon } from '@neondatabase/serverless';

import { slotsNecessarios, subHorarios, paraMinutos, INTERVALO_SLOT_MINUTOS } from '../duracao.js';
import { obterProfissionalSkincare, hojeDataHora, dataISOValida } from '../skincare.js';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { data, servico_id } = req.query;

    if (!data || !servico_id) {
        return res.status(400).json({ erro: 'Faltam os parâmetros "data" e "servico_id".' });
    }

    // só dígitos, para o parseInt mais abaixo não receber lixo
    if (!/^\d+$/.test(servico_id)) {
        return res.status(400).json({ erro: 'Tratamento inválido.' });
    }

    if (!dataISOValida(data)) {
        return res.status(400).json({ erro: 'Formato de data inválido. Exemplo: 2026-01-28.' });
    }

    try {
        // a profissional nunca vem do pedido: sai da tabela users (skincare = true)
        const profissional = await obterProfissionalSkincare();
        if (!profissional) {
            return res.status(500).json({ erro: 'Profissional de skincare não configurada.' });
        }

        // duração do tratamento -> quantos horários seguidos precisa
        const servico = await sql`
            SELECT duracao_minutos FROM servicos_skincare WHERE id = ${parseInt(servico_id, 10)} AND ativo = true
        `;
        if (servico.length === 0) {
            return res.status(400).json({ erro: 'Tratamento inválido.' });
        }
        const slots = slotsNecessarios(servico[0].duracao_minutos);

        // horários em que a profissional trabalha, no dia da semana de "data"
        const horariosDefinidos = await sql`
            SELECT hora
            FROM horarios_skincare
            WHERE profissional = ${profissional}
              AND dia_semana = EXTRACT(DOW FROM ${data}::date)
            ORDER BY hora
        `;

        // marcações ativas nesse dia, como intervalos [hora, hora_fim) (canceladas não contam)
        const reservados = await sql`
            SELECT hora, hora_fim
            FROM marcacoes_skincare
            WHERE profissional = ${profissional}
              AND data = ${data}::date
              AND status != 'cancelada'
        `;

        const intervalosOcupados = reservados.map((linha) => ({
            // o Postgres devolve a hora como "HH:MM:SS" — cortamos os segundos
            inicio: paraMinutos(linha.hora.slice(0, 5)),
            fim: paraMinutos(linha.hora_fim.slice(0, 5)),
        }));

        const horasDefinidas = horariosDefinidos.map((linha) => linha.hora.slice(0, 5));
        const setDefinidas = new Set(horasDefinidas);

        // uma hora só está disponível se TODOS os horários que o tratamento ocupa
        // existem no horário de trabalho e nenhum colide com uma marcação existente
        const cabe = (hora) => {
            if (!subHorarios(hora, slots).every((h) => setDefinidas.has(h))) return false;
            // dois intervalos [a, b) e [c, d) sobrepõem-se quando a < d e b > c
            const inicio = paraMinutos(hora);
            const fim = inicio + slots * INTERVALO_SLOT_MINUTOS;
            return !intervalosOcupados.some((o) => inicio < o.fim && fim > o.inicio);
        };

        let disponiveis = horasDefinidas.filter(cabe);

        // se a data escolhida for hoje, remove horários que já passaram
        const { data: hojeISO, hora: horaAgora } = hojeDataHora();
        if (data === hojeISO) {
            // comparar "HH:MM" como texto funciona porque têm sempre 2 dígitos
            disponiveis = disponiveis.filter((hora) => hora > horaAgora);
        } else if (data < hojeISO) {
            // dia que já passou
            disponiveis = [];
        }

        return res.status(200).json({ horarios: disponiveis });
    } catch (erro) {
        console.error('Erro em /api/skincare/disponibilidade:', erro);
        return res.status(500).json({ erro: 'Não foi possível obter os horários disponíveis.' });
    }
}
