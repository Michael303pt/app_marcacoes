// api/skincare/marcacoes.js
/*
GET  ?data=AAAA-MM-DD&servico_id=N  -> horários disponíveis
POST { data, hora, servico_id, ... } -> criar marcação
GET  ?token=...&acao=confirmar|cancelar -> link do email de lembrete
*/

import disponibilidade from '../../lib/skincare-handlers/disponibilidade.js';
import reservar from '../../lib/skincare-handlers/reservar.js';
import confirmarMarcacao from '../../lib/skincare-handlers/confirmar-marcacao.js';

export default async function handler(req, res) {
    if (req.method === 'POST') return reservar(req, res);

    if (req.method === 'GET') {
        if (req.query?.token) return confirmarMarcacao(req, res);
        return disponibilidade(req, res);
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}
