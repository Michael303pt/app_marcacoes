// lib/duracao.js
//
// Regra de negócio: quantos horários (de 30 em 30 minutos) uma marcação
// ocupa, consoante a duração do serviço (duracao_minutos). Usado por api/disponibilidade.js
// e api/reservar.js — se a regra mudar, muda-se só aqui.

export const INTERVALO_SLOT_MINUTOS = 30;

// nº de horários = duração / 30, arredondado para cima
// (30 min -> 1, 50 -> 2, 120 -> 4, 121 -> 5)
export function slotsNecessarios(duracaoMinutos) {
    const duracao = Number(duracaoMinutos);
    if (!Number.isFinite(duracao) || duracao <= 0) return 1; // serviço sem duração definida
    return Math.ceil(duracao / INTERVALO_SLOT_MINUTOS);
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