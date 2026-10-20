// lib/skincare.js
//
// Coisas partilhadas pelos endpoints de skincare (api/skincare/*, lib/skincare-handlers/*, cron e webhook).

import { neon } from '@neondatabase/serverless';

// o driver da Neon fala por HTTP, por isso não há pool de ligações para gerir
const sql = neon(process.env.DATABASE_URL);

export const NOME_NEGOCIO_SKINCARE = 'Olimpo Skincare';

// A profissional de skincare é o utilizador com users.skincare = true.
// O nome devolvido (full_name, ou username se estiver vazio) tem de coincidir
// com o texto guardado em horarios_skincare.profissional e
// marcacoes_skincare.profissional — é assim que as tabelas se ligam.
// O frontend nunca envia o profissional: é sempre resolvido aqui, no servidor.
export async function obterProfissionalSkincare() {
    const linhas = await sql`
        SELECT COALESCE(NULLIF(TRIM(full_name), ''), username) AS nome
        FROM users
        WHERE skincare = true
        ORDER BY id
        LIMIT 1
    `;
    return linhas[0]?.nome ?? null;
}

// devolve { data: "AAAA-MM-DD", hora: "HH:MM" } em Lisboa, independentemente do
// fuso horário do servidor da Vercel.
export function hojeDataHora() {
    const formatador = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const partes = formatador.formatToParts(new Date());
    const obter = (tipo) => partes.find((p) => p.type === tipo).value;
    // alguns runtimes devolvem "24" à meia-noite com hour12:false
    const hora = obter('hour') === '24' ? '00' : obter('hour');

    return {
        data: `${obter('year')}-${obter('month')}-${obter('day')}`,
        hora: `${hora}:${obter('minute')}`,
    };
}

// "2026-02-31" passa o regex mas não existe — valida mesmo o calendário
export function dataISOValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    const d = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

export function escapeHtml(valor) {
    return String(valor ?? '')
        // o & tem de ser o primeiro, senão escapava outra vez os & dos códigos que vêm a seguir
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
