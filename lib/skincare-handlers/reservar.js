// lib/skincare-handlers/reservar.js
//
// POST /api/skincare/marcacoes
// body: { data, hora, servico_id, produtos: [{ id, quantidade }], cliente_nome, cliente_contacto, cliente_email }
//
// Sem "profissional" no body: é sempre a profissional de skincare (lib/skincare.js).
// Os produtos são relidos da base de dados (nome e preço nunca vêm do cliente).

import { neon } from '@neondatabase/serverless';

import { slotsNecessarios, subHorarios, paraMinutos, deMinutos, INTERVALO_SLOT_MINUTOS } from '../duracao.js';
import { obterProfissionalSkincare, hojeDataHora, dataISOValida } from '../skincare.js';

const sql = neon(process.env.DATABASE_URL);

// limite para ninguém pedir 9999 frascos
const MAX_QUANTIDADE_POR_PRODUTO = 20;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    // o profissional não vem no body de propósito (ver lib/skincare.js)
    const { data, hora, servico_id, produtos, cliente_nome, cliente_contacto, cliente_email } = req.body || {};

    if (!data || !hora || !servico_id || !cliente_nome || !cliente_contacto || !cliente_email) {
        return res.status(400).json({ erro: 'Faltam dados obrigatórios (data, hora, tratamento, nome, telefone e email).' });
    }

    if (!dataISOValida(data) || !/^\d{2}:\d{2}$/.test(hora)) {
        return res.status(400).json({ erro: 'Data ou hora em formato inválido. Exemplo: 2026-01-28.' });
    }

    if (!Number.isInteger(servico_id)) {
        return res.status(400).json({ erro: 'Tratamento inválido.' });
    }

    // produtos é opcional — array de { id, quantidade }
    const pedidoProdutos = Array.isArray(produtos) ? produtos : [];
    const produtosValidos = pedidoProdutos.every((item) =>
        item &&
        Number.isInteger(item.id) &&
        Number.isInteger(item.quantidade) && item.quantidade > 0 && item.quantidade <= MAX_QUANTIDADE_POR_PRODUTO
    );
    if (!produtosValidos) {
        return res.status(400).json({ erro: 'Lista de produtos inválida.' });
    }

    // limite de 100 caracteres para não guardar textos gigantes na base de dados
    const nomeFinal = String(cliente_nome).trim();
    if (nomeFinal === '' || nomeFinal.length > 100) {
        return res.status(400).json({ erro: 'O nome introduzido não é válido.' });
    }

    if (!/^\d{9}$/.test(String(cliente_contacto))) {
        return res.status(400).json({ erro: 'O telefone deve ter exatamente 9 dígitos.' });
    }

    const clienteEmailFinal = String(cliente_email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmailFinal)) {
        return res.status(400).json({ erro: 'O email introduzido não é válido.' });
    }

    // não aceita marcações no passado (hora de Lisboa)
    const { data: hojeISO, hora: horaAgora } = hojeDataHora();
    if (data < hojeISO || (data === hojeISO && hora <= horaAgora)) {
        return res.status(400).json({ erro: 'Esse horário já passou. Escolha outro horário.' });
    }

    try {
        const profissional = await obterProfissionalSkincare();
        if (!profissional) {
            return res.status(500).json({ erro: 'Profissional de skincare não configurada.' });
        }

        // duração do tratamento (vem sempre da base de dados, nunca do cliente)
        const servico = await sql`
            SELECT duracao_minutos FROM servicos_skincare WHERE id = ${servico_id} AND ativo = true
        `;
        if (servico.length === 0) {
            return res.status(400).json({ erro: 'Tratamento inválido.' });
        }
        const slots = slotsNecessarios(servico[0].duracao_minutos);

        // produtos: junta quantidades repetidas e vai buscar nome/preço reais
        const quantidades = new Map();
        for (const item of pedidoProdutos) {
            quantidades.set(item.id, (quantidades.get(item.id) || 0) + item.quantidade);
        }
        let produtosFinal = [];
        if (quantidades.size > 0) {
            const ids = [...quantidades.keys()];
            const encontrados = await sql`
                SELECT id, nome, preco FROM produtos_skincare
                WHERE ativo = true AND id = ANY(${ids}::int[])
            `;
            // se faltar algum, está inativo ou não existe — recusa tudo em vez de ignorar em silêncio
            if (encontrados.length !== ids.length) {
                return res.status(400).json({ erro: 'Um dos produtos escolhidos já não está disponível.' });
            }
            // nome e preço ficam guardados como estavam hoje: se o preço mudar, as marcações antigas não mudam
            produtosFinal = encontrados.map((p) => ({
                id: p.id,
                nome: p.nome,
                preco: Number(p.preco),
                quantidade: quantidades.get(p.id),
            }));
        }

        // todos os horários que o tratamento ocupa têm de existir no horário de trabalho desse dia
        const horariosDia = await sql`
            SELECT hora FROM horarios_skincare
            WHERE profissional = ${profissional}
              AND dia_semana = EXTRACT(DOW FROM ${data}::date)
        `;
        const definidos = new Set(horariosDia.map((linha) => linha.hora.slice(0, 5)));
        if (!subHorarios(hora, slots).every((h) => definidos.has(h))) {
            return res.status(409).json({ erro: 'Este tratamento não cabe nesse horário. Escolha outro horário.' });
        }

        const horaFim = deMinutos(paraMinutos(hora) + slots * INTERVALO_SLOT_MINUTOS);

        // sobreposição com marcações ativas: [hora, horaFim) vs [hora, hora_fim)
        const jaExiste = await sql`
            SELECT id FROM marcacoes_skincare
            WHERE profissional = ${profissional}
              AND data = ${data}::date
              AND status != 'cancelada'
              AND hora < ${horaFim}::time
              AND hora_fim > ${hora}::time
        `;

        if (jaExiste.length > 0) {
            return res.status(409).json({ erro: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.' });
        }

        // entre o SELECT de cima e este INSERT outra pessoa pode reservar o mesmo horário —
        // é aí que entra a constraint da base de dados (ver o catch no fim)
        await sql`
            INSERT INTO marcacoes_skincare (profissional, data, hora, hora_fim, servico_id, produtos, cliente_nome, cliente_contacto, cliente_email)
            VALUES (${profissional}, ${data}::date, ${hora}::time, ${horaFim}::time, ${servico_id}, ${JSON.stringify(produtosFinal)}::jsonb,
            ${nomeFinal}, ${String(cliente_contacto)}, ${clienteEmailFinal})
        `;

        return res.status(201).json({ sucesso: true });
    } catch (erro) {
        // 23505 = violação de UNIQUE, 23P01 = violação da constraint de sobreposição
        // (proteção extra contra corridas em simultâneo)
        if (erro && (erro.code === '23505' || erro.code === '23P01')) {
            return res.status(409).json({ erro: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.' });
        }
        console.error('Erro em /api/skincare/reservar:', erro);
        return res.status(500).json({ erro: 'Não foi possível concluir a marcação.' });
    }
}
