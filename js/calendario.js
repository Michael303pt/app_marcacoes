//calendario.js

const profissional = document.getElementById("profi");
const inputData = document.getElementById("dataMarcacao");
const calendario = document.getElementById("calendario");
const listaHorariosEL = document.getElementById("listaHorarios");
const horariosContainerEL = document.getElementById("horariosContainer");
const formReservaEL = document.getElementById("formReserva");
const servicoSelecionadoEL = document.getElementById("servicoSelecionado");
const produtoSelecionadoEL = document.getElementById("produtoSelecionado");
const resumoReservaEL = document.getElementById("resumoReserva");
const clienteNomeEL = document.getElementById("clienteNome");
const clienteContactoEL = document.getElementById("clienteContacto");
const msgReservaEL = document.getElementById("msgReserva");
const btnConfirmarEL = document.getElementById("btnConfirmar");
const btnCancelarEL = document.getElementById("btnCancelar");

const carrinhoListaEL = document.getElementById("lista-carrinho");

let horaSelecionada = null;
let dataSelecionadaISO = null; // formato AAAA-MM-DD, usado na API
let carrinho = [];
/*
Exemplo de carrinho
let carrinho = [
    { id: 3, nome: "Shampoo", preco: 9.5, quantidade: 2 },
    { id: 7, nome: "Cera", preco: 12, quantidade: 1 }
];
*/

// telefone: só dígitos, no máximo 9
clienteContactoEL.addEventListener("input", () => {
    clienteContactoEL.value = clienteContactoEL.value.replace(/\D/g, "").slice(0, 9);
});

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

produtoSelecionadoEL.addEventListener("change", () =>{
    if (produtoSelecionadoEL.value === ""){
        return
    }

    let id = parseInt(produtoSelecionadoEL.value);
    let nome = produtoSelecionadoEL.selectedOptions[0].dataset.nome;
    let preco = Number(produtoSelecionadoEL.selectedOptions[0].dataset.preco);
    
    /*
    para quando um item já existe no carrinho não duplicar, mas sim fazer quantidade +1
    Ou seja procura no carrinho por id igual ao que foi selecionado e caso encontrado inseriu
    na variavel igual, que por sua vez aumenta a quantidade +1
    se não insere um novo valor no carrinho
    */
    produtoSelecionadoEL.value = "";
    const igual = carrinho.find(item => item.id === id);
    if (igual)
        igual.quantidade++;
    else{
        carrinho.push({id, nome, preco, quantidade:1});
    }
    renderCarrinho();
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

//data de hoje (sem horas), usada para comparar dias passados
const hoje_sem_horas = new Date();
hoje_sem_horas.setHours(0, 0, 0, 0);

const mostrar_calendario = () => {
    let primeiro_dia_do_mes = new Date(ano, mes, 1).getDay();
    let ultima_data_do_mes = new Date(ano, mes + 1, 0).getDate();
    let ultimo_dia_do_mes = new Date(ano, mes, ultima_data_do_mes).getDay();
    let ultimo_data_do_ultimo_mes = new Date(ano, mes, 0).getDate();
    let dias = "";

    //dias do mês anterior
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

    //impede recuar para meses passados (não faz sentido querer marcar no passado afinal de contas xD)
    const estamos_no_mes_atual =
        mes === new Date().getMonth() && ano === new Date().getFullYear();
    btnPrevEL.classList.toggle("desativo", estamos_no_mes_atual);
};

mostrar_calendario();

//btns do mês anterior/seguinte
btn_EL.forEach((btns) => {
    btns.addEventListener("click", () => {
        //não deixa recuar, antes do mês atual
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

//horários disponíveis
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
    formReservaEL.classList.remove("ativo");
}

// formulário de reserva
function abrirFormReserva(hora) {
    horaSelecionada = hora;
    msgReservaEL.textContent = "";
    clienteNomeEL.value = "";
    clienteContactoEL.value = "";
    servicoSelecionadoEL.innerHTML = `<option value="">A carregar serviços…</option>`;
    produtoSelecionadoEL.innerHTML = `<option value="">Nenhum</option>`;
    esconderResumo();
    formReservaEL.classList.add("ativo");
    carregarServicos();
    carregarProdutos();
}

async function carregarServicos() {
    try {
        const resposta = await fetch("/api/servicos");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.servicos || dados.servicos.length === 0) {
            servicoSelecionadoEL.innerHTML = `<option value="">Sem serviços disponíveis</option>`;
            return;
        }

        servicoSelecionadoEL.innerHTML = `<option value="" hidden>Escolhe um serviço</option>`;
        dados.servicos.forEach((servico) => {
            const opcao = document.createElement("option");
            opcao.value = servico.id;
            opcao.textContent = servico.preco
                ? `${servico.nome} — ${Number(servico.preco).toFixed(2)}€`
                : servico.nome;
            opcao.dataset.nome = servico.nome;
            opcao.dataset.preco = servico.preco;
            servicoSelecionadoEL.appendChild(opcao);
        });
    } catch (erro) {
        console.error(erro);
        servicoSelecionadoEL.innerHTML = `<option value="">Erro ao carregar serviços</option>`;
    }
}

async function carregarProdutos() {
    try {
        const resposta = await fetch("/api/produtos");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.produtos || dados.produtos.length === 0) {
            produtoSelecionadoEL.innerHTML = `<option value="">Nenhum</option>`;
            return;
        }

        produtoSelecionadoEL.innerHTML = `<option value="" hidden>Escolha um produto</option>`;
        dados.produtos.forEach((produto) => {
            const opcao = document.createElement("option");
            opcao.value = produto.id;
            opcao.textContent = produto.preco
                ? `${produto.nome} — ${Number(produto.preco).toFixed(2)}€`
                : produto.nome;
            opcao.dataset.nome = produto.nome;
            opcao.dataset.preco = produto.preco;
            produtoSelecionadoEL.appendChild(opcao);
        });
    } catch (erro) {
        console.error(erro);
        produtoSelecionadoEL.innerHTML = `<option value="">Erro ao carregar produtos</option>`;
    }
}

//render carrinho
function renderCarrinho() {
    if (carrinho.length === 0) {
        carrinhoListaEL.hidden = true;
        carrinhoListaEL.innerHTML = "";
        return;
    }

    carrinhoListaEL.hidden = false;

    carrinhoListaEL.innerHTML = carrinho.map((item) => {
        const subtotal = (Number(item.preco) * item.quantidade).toFixed(2);
        if(item.quantidade > 1){
            return `
                <li class="item-produto" data-id="${item.id}">
                    <span class="nome-produto">${item.nome} — ${Number(item.preco).toFixed(2)}€ x ${item.quantidade} = ${subtotal}€</span>
                    <button type="button" class="btnRemover">-</button>
                </li>
            `;
        }
        else{
            return `
                <li class="item-produto" data-id="${item.id}">
                    <span class="nome-produto">${item.nome} — ${Number(item.preco).toFixed(2)}€</span>
                    <button type="button" class="btnRemover">-</button>
                </li>
            `;
        }
    }).join("");
}

carrinhoListaEL.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".btnRemover");
    if (!botao) return;

    const li = botao.closest(".item-produto");
    const id = parseInt(li.dataset.id);

    const remover = carrinho.find(item => item.id === id);
    if (remover.quantidade>1)
        remover.quantidade--;
    else
        carrinho = carrinho.filter((item) => item != remover);

    renderCarrinho();
});

function formularioValido() {
    return (
        servicoSelecionadoEL.value !== "" &&
        clienteNomeEL.value.trim() !== "" &&
        /^\d{9}$/.test(clienteContactoEL.value.trim())
    );
}

function esconderResumo() {
    resumoReservaEL.hidden = true;
    resumoReservaEL.innerHTML = "";
    btnConfirmarEL.hidden = true;
}

//o resumo só aparece depois de tudo estar preenchido corretamente -> nada de popups antes disto
function atualizarResumo() {
    if (!formularioValido()) {
        esconderResumo();
        return;
    }

    const nomeServico = servicoSelecionadoEL.selectedOptions[0]?.dataset.nome;
    const nomeProduto = produtoSelecionadoEL.selectedOptions[0]?.dataset.nome;

    resumoReservaEL.innerHTML = `
        <p><strong>Profissional:</strong> ${profissional.value}</p>
        <p><strong>Data:</strong> ${inputData.value}</p>
        <p><strong>Hora:</strong> ${horaSelecionada}</p>
        <p><strong>Serviço:</strong> ${nomeServico}</p>
        <p><strong>Produto:</strong> ${nomeProduto || "Nenhum"}</p>
        <p><strong>Nome:</strong> ${clienteNomeEL.value.trim()}</p>
        <p><strong>Telefone:</strong> ${clienteContactoEL.value.trim()}</p>
    `;
    resumoReservaEL.hidden = false;
    btnConfirmarEL.hidden = false;
}

[servicoSelecionadoEL, produtoSelecionadoEL, clienteNomeEL, clienteContactoEL].forEach((campo) => {
    campo.addEventListener("input", atualizarResumo);
});

btnCancelarEL.addEventListener("click", () => {
    formReservaEL.classList.remove("ativo");
});

btnConfirmarEL.addEventListener("click", async () => {
    if (!formularioValido()) {
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
                servico_id: parseInt(servicoSelecionadoEL.value, 10),
                produto_id: produtoSelecionadoEL.value ? parseInt(produtoSelecionadoEL.value, 10) : null,
                cliente_nome: clienteNomeEL.value.trim(),
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
