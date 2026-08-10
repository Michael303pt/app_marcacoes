// js/calendario.js
const profissional = document.getElementById("profi");
const inputData = document.getElementById("dataMarcacao");
const calendario = document.getElementById("calendario");
const listaHorariosEL = document.getElementById("listaHorarios");
const horariosContainerEL = document.getElementById("horariosContainer");
const formReservaEL = document.getElementById("formReserva");
const resumoReservaEL = document.getElementById("resumoReserva");
const clienteNomeEL = document.getElementById("clienteNome");
const clienteContactoEL = document.getElementById("clienteContacto");
const msgReservaEL = document.getElementById("msgReserva");
const btnConfirmarEL = document.getElementById("btnConfirmar");
const btnCancelarEL = document.getElementById("btnCancelar");

let horaSelecionada = null;
let dataSelecionadaISO = null; // formato AAAA-MM-DD, usado na API

inputData.addEventListener("click", () => {
    calendario.classList.toggle("ativo");
});

// input do calendario desativado até sér selecionado um profissional no dropdown
profissional.addEventListener("change", () => {
    if (profissional.value === "") {
        inputData.disabled = true;
        inputData.value = "";
    } else {
        inputData.disabled = false;
    }

    // ao trocar de profissional, esconde qualquer lista de horários antiga
    esconderHorarios();
});

const dias_EL = document.querySelector(".dias");
const btn_EL = document.querySelectorAll(".calendar_headings .fa-solid");
const dias_meses_EL = document.querySelector(".month_year");
const btnPrevEL = document.getElementById("prev");

let dias_meses_obj = {
    dias: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    meses: [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
};

// objetos de data
let date_obj = new Date();
let mes = date_obj.getMonth();
let ano = date_obj.getFullYear();
let data = date_obj.getDate();

// data de hoje "limpa" (sem horas), usada para comparar dias passados
const hoje_sem_horas = new Date();
hoje_sem_horas.setHours(0, 0, 0, 0);

const mostrar_calendario = () => {
    let primeiro_dia_do_mes = new Date(ano, mes, 1).getDay();
    let ultima_data_do_mes = new Date(ano, mes + 1, 0).getDate();
    let ultimo_dia_do_mes = new Date(ano, mes, ultima_data_do_mes).getDay();
    let ultimo_data_do_ultimo_mes = new Date(ano, mes, 0).getDate();
    let dias = "";

    // dias do mês anterior
    for (let x = primeiro_dia_do_mes; x > 0; x--) {
        dias += `<li class="desativo">${ultimo_data_do_ultimo_mes - x + 1}</li>`;
    }

    for (let x = 1; x <= ultima_data_do_mes; x++) {
        const data_do_dia = new Date(ano, mes, x);

        const check_hoje =
            x === date_obj.getDate() &&
            mes === new Date().getMonth() &&
            ano === new Date().getFullYear()
                ? "hoje"
                : "";

        // dia já passou? fica desativado e não clicável
        const ja_passou = data_do_dia < hoje_sem_horas;

        const classe = ja_passou ? "desativo passado" : check_hoje;

        dias += `<li class="${classe}" data-dia="${x}">${x}</li>`;
    }

    // primeiros dias do próximo mês
    for (let x = ultimo_dia_do_mes; x < 6; x++) {
        dias += `<li class="desativo">${x - ultimo_dia_do_mes + 1}</li>`;
    }

    dias_EL.innerHTML = dias;

    const diasSelecionaveis = dias_EL.querySelectorAll("li:not(.desativo)");

    diasSelecionaveis.forEach((dia) => {
        dia.addEventListener("click", () => {
            const diaSelecionado = parseInt(dia.textContent, 10);

            inputData.value = `${diaSelecionado}/${mes + 1}/${ano}`;
            dataSelecionadaISO = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaSelecionado).padStart(2, "0")}`;

            calendario.classList.remove("ativo");

            carregarHorariosDisponiveis();
        });
    });

    dias_meses_EL.innerHTML = `${dias_meses_obj.meses[mes]}, ${ano}`;

    // impede recuar para meses totalmente no passado
    const estamos_no_mes_atual =
        mes === new Date().getMonth() && ano === new Date().getFullYear();
    btnPrevEL.classList.toggle("desativo", estamos_no_mes_atual);
};

mostrar_calendario();

// mês anterior/seguinte
btn_EL.forEach((btns) => {
    btns.addEventListener("click", () => {
        // não deixa recuar antes do mês atual
        if (btns.id === "prev" && mes === new Date().getMonth() && ano === new Date().getFullYear()) {
            return;
        }

        mes = btns.id === "prev" ? mes - 1 : mes + 1;

        if (mes < 0 || mes > 11) {
            data = new Date(ano, mes, new Date().getDate());
            mes = data.getMonth();
            ano = data.getFullYear();
        } else {
            data = new Date();
        }

        mostrar_calendario();
    });
});

// ---------------------------------------------------------------
// horários disponíveis
// ---------------------------------------------------------------

async function carregarHorariosDisponiveis() {
    if (!profissional.value || !dataSelecionadaISO) return;

    horariosContainerEL.classList.add("ativo");
    listaHorariosEL.innerHTML = `<li class="a_carregar">A carregar horários…</li>`;

    try {
        const url = `/api/disponibilidade?profissional=${encodeURIComponent(profissional.value)}&data=${dataSelecionadaISO}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();

        if (!resposta.ok) {
            listaHorariosEL.innerHTML = `<li class="erro">${dados.erro || "Erro ao carregar horários."}</li>`;
            return;
        }

        if (dados.horarios.length === 0) {
            listaHorariosEL.innerHTML = `<li class="vazio">Sem horários disponíveis neste dia.</li>`;
            return;
        }

        listaHorariosEL.innerHTML = "";
        dados.horarios.forEach((hora) => {
            const item = document.createElement("li");
            item.className = "horario_item";
            item.textContent = hora;
            item.addEventListener("click", () => abrirFormReserva(hora));
            listaHorariosEL.appendChild(item);
        });
    } catch (erro) {
        console.error(erro);
        listaHorariosEL.innerHTML = `<li class="erro">Não foi possível ligar ao servidor.</li>`;
    }
}

function esconderHorarios() {
    horariosContainerEL.classList.remove("ativo");
    listaHorariosEL.innerHTML = "";
    dataSelecionadaISO = null;
    inputData.value = "";
}

// ---------------------------------------------------------------
// formulário de reserva
// ---------------------------------------------------------------

function abrirFormReserva(hora) {
    horaSelecionada = hora;
    msgReservaEL.textContent = "";
    clienteNomeEL.value = "";
    clienteContactoEL.value = "";
    resumoReservaEL.textContent = `${profissional.value} — ${inputData.value} às ${hora}`;
    formReservaEL.classList.add("ativo");
}

btnCancelarEL.addEventListener("click", () => {
    formReservaEL.classList.remove("ativo");
});

btnConfirmarEL.addEventListener("click", async () => {
    const nome = clienteNomeEL.value.trim();

    if (!nome) {
        msgReservaEL.textContent = "Indica o teu nome, por favor.";
        return;
    }

    btnConfirmarEL.disabled = true;
    msgReservaEL.textContent = "A confirmar…";

    try {
        const resposta = await fetch("/api/reservar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                profissional: profissional.value,
                data: dataSelecionadaISO,
                hora: horaSelecionada,
                cliente_nome: nome,
                cliente_contacto: clienteContactoEL.value.trim(),
            }),
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            msgReservaEL.textContent = dados.erro || "Não foi possível concluir a marcação.";
            btnConfirmarEL.disabled = false;
            // se o horário já foi reservado por outra pessoa, atualiza a lista
            if (resposta.status === 409) {
                carregarHorariosDisponiveis();
            }
            return;
        }

        msgReservaEL.textContent = "Marcação confirmada!";
        setTimeout(() => {
            formReservaEL.classList.remove("ativo");
            btnConfirmarEL.disabled = false;
            carregarHorariosDisponiveis();
        }, 1200);
    } catch (erro) {
        console.error(erro);
        msgReservaEL.textContent = "Não foi possível ligar ao servidor.";
        btnConfirmarEL.disabled = false;
    }
});
