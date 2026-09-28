// lib/duracao.js
//
// Regra de negócio: quantos horários (de 30 em 30 minutos) uma marcação
// ocupa, consoante a duração do serviço. Usado por api/disponibilidade.js
// e api/reservar.js — se a regra mudar, muda-se só aqui.

export const INTERVALO_SLOT_MINUTOS = 30;

// "até X minutos (inclusive) ocupa N horários"
const ESCALOES = [
    { ateMinutos: 30, slots: 1 },
    { ateMinutos: 120, slots: 2 },
    { ateMinutos: 210, slots: 3 },
    { ateMinutos: 300, slots: 4 },
];

// acima do último escalão: +1 horário por cada bloco de 90 minutos a mais
const PASSO_ACIMA_DO_ULTIMO = 90;

export function slotsNecessarios(duracaoMinutos) {
    const duracao = Number(duracaoMinutos);
    if (!Number.isFinite(duracao) || duracao <= 0) return 1; // serviço sem duração definida

    for (const escalao of ESCALOES) {
        if (duracao <= escalao.ateMinutos) return escalao.slots;
    }
    const ultimo = ESCALOES[ESCALOES.length - 1];
    return ultimo.slots + Math.ceil((duracao - ultimo.ateMinutos) / PASSO_ACIMA_DO_ULTIMO);
}

// "HH:MM" -> minutos desde as 00:00
export function paraMinutos(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

// minutos desde as 00:00 -> "HH:MM"
export function deMinutos(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    return `${h}:${m}`;
}

// ex.: subHorarios("10:00", 3) -> ["10:00", "10:30", "11:00"]
export function subHorarios(horaInicio, slots) {
    const inicio = paraMinutos(horaInicio);
    return Array.from({ length: slots }, (_, i) => deMinutos(inicio + i * INTERVALO_SLOT_MINUTOS));
}
