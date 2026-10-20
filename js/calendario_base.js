// calendario_base.js

/* Toda a lógica da página de marcações (calendário, horários, carrinho, resumo e envio),
partilhada pela barbershop e pela skincare.
Cada uma só chama iniciarCalendario({...}) com as diferenças — ver as opções abaixo.
*/

function iniciarCalendario(cfg) {
    const profissionalEL = cfg.comProfissional ? document.getElementById("profi") : null;
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
    const clienteEmailEL = document.getElementById("clienteEmail");
    const msgReservaEL = document.getElementById("msgReserva");
    const btnConfirmarEL = document.getElementById("btnConfirmar");
    const btnCancelarEL = document.getElementById("btnCancelar");
    const carrinhoListaEL = document.getElementById("lista-carrinho");

    // estado da marcação que está a ser feita
    let horaSelecionada = null;
    let dataSelecionadaISO = null; // AAAA-MM-DD, usado na API
    let dataSelecionada = null; // { dia, mes, ano }
    let carrinho = []; // [{ id, nome, preco, quantidade }]
    let produtosCatalogo = [];

    const profissionalAtual = () => (profissionalEL ? profissionalEL.value : "");

    function escapeHtml(valor) {
        return String(valor ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function textoPreco(preco) {
        return `${Number(preco).toFixed(2)}€`;
    }

    //só dígitos, no máximo 9 -> telefone/telemóvel
    clienteContactoEL.addEventListener("input", () => {
        clienteContactoEL.value = clienteContactoEL.value.replace(/\D/g, "").slice(0, 9);
    });

    inputData.addEventListener("click", () => {
        calendario.classList.toggle("ativo");
    });

    //o calendário só abre depois de escolhido o serviço (e o profissional, se houver)
    function atualizarEstadoData() {
        const pronto = (!profissionalEL || profissionalEL.value !== "") && servicoSelecionadoEL.value !== "";
        inputData.disabled = !pronto;
        if (!pronto) {
            inputData.value = "";
            calendario.classList.remove("ativo");
        }
    }

    //ao trocar de profissional ou de serviço, esconde qualquer lista de horários antiga
    [profissionalEL, servicoSelecionadoEL].filter(Boolean).forEach((campo) => {
        campo.addEventListener("change", () => {
            atualizarEstadoData();
            esconderHorarios();
        });
    });

    produtoSelecionadoEL.addEventListener("change", () => {
        if (produtoSelecionadoEL.value === "") return;

        const id = parseInt(produtoSelecionadoEL.value, 10);
        const opcao = produtoSelecionadoEL.selectedOptions[0];
        const nome = opcao.dataset.nome;
        const preco = Number(opcao.dataset.preco);

        produtoSelecionadoEL.value = "";

        const igual = carrinho.find((item) => item.id === id);
        if (igual) igual.quantidade++;
        else carrinho.push({ id, nome, preco, quantidade: 1 });

        renderCarrinho();
        atualizarResumo();
    });

    const dias_EL = document.querySelector(".dias");
    const btn_EL = document.querySelectorAll(".calendar_headings .fa-solid");
    const dias_meses_EL = document.querySelector(".month_year");
    const btnPrevEL = document.getElementById("prev");

    const MESES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const agora = new Date();
    let mes = agora.getMonth();
    let ano = agora.getFullYear();

    //hoje (sem horas), para comparar dias passados
    const hoje_sem_horas = new Date();
    hoje_sem_horas.setHours(0, 0, 0, 0);

    // desenha o mês (mes/ano) na grelha: dias do mês anterior a preencher a 1ª semana,
    // os dias do mês, e dias do seguinte para fechar a última semana
    const mostrar_calendario = () => {
        // getDay(): 0 = domingo ... 6 = sábado
        const primeiro_dia_do_mes = new Date(ano, mes, 1).getDay();
        const ultima_data_do_mes = new Date(ano, mes + 1, 0).getDate();
        const ultimo_dia_do_mes = new Date(ano, mes, ultima_data_do_mes).getDay();
        const ultimo_data_do_ultimo_mes = new Date(ano, mes, 0).getDate();
        let dias = "";

        // dias do mês anterior
        for (let x = primeiro_dia_do_mes; x > 0; x--) {
            dias += `<li class="desativo">${ultimo_data_do_ultimo_mes - x + 1}</li>`;
        }

        for (let x = 1; x <= ultima_data_do_mes; x++) {
            const data_do_dia = new Date(ano, mes, x);
            // compara timestamps
            const e_hoje = data_do_dia.getTime() === hoje_sem_horas.getTime();
            const ja_passou = data_do_dia < hoje_sem_horas;
            const classe = ja_passou ? "desativo passado" : e_hoje ? "hoje" : "";

            dias += `<li class="${classe}">${x}</li>`;
        }

        // primeiros dias do próximo mês
        for (let x = ultimo_dia_do_mes; x < 6; x++) {
            dias += `<li class="desativo">${x - ultimo_dia_do_mes + 1}</li>`;
        }

        dias_EL.innerHTML = dias;

        dias_EL.querySelectorAll("li:not(.desativo)").forEach((dia) => {
            dia.addEventListener("click", () => {
                const diaSelecionado = parseInt(dia.textContent, 10);

                dataSelecionada = { dia: diaSelecionado, mes, ano };
                marcarDiaSelecionado();

                // o input mostra D/M/AAAA (para a pessoa)
                inputData.value = `${diaSelecionado}/${mes + 1}/${ano}`;
                dataSelecionadaISO = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaSelecionado).padStart(2, "0")}`;

                calendario.classList.remove("ativo");

                formReservaEL.classList.remove("ativo");
                carregarHorariosDisponiveis();
            });
        });

        marcarDiaSelecionado();

        dias_meses_EL.textContent = `${MESES[mes]}, ${ano}`;

        //não deixa recuar para meses passados
        const estamos_no_mes_atual = mes === agora.getMonth() && ano === agora.getFullYear();
        btnPrevEL.classList.toggle("desativo", estamos_no_mes_atual);
    };

    // marca o dia escolhido
    function marcarDiaSelecionado() {
        dias_EL.querySelectorAll("li.selecionado").forEach((el) => el.classList.remove("selecionado"));

        if (!dataSelecionada || dataSelecionada.mes !== mes || dataSelecionada.ano !== ano) return;

        const alvo = [...dias_EL.querySelectorAll("li:not(.desativo)")].find(
            (li) => parseInt(li.textContent, 10) === dataSelecionada.dia
        );
        if (alvo) alvo.classList.add("selecionado");
    }

    mostrar_calendario();

    //botões mês anterior/seguinte
    btn_EL.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (btn.id === "prev" && mes === agora.getMonth() && ano === agora.getFullYear()) return;

            // dia 1 de propósito. Com o dia de hoje (ex. 31) um mês mais curto saltava para o seguinte.
            // O Date trata de mudar o ano em dezembro/janeiro
            const novo = new Date(ano, mes + (btn.id === "prev" ? -1 : 1), 1);
            mes = novo.getMonth();
            ano = novo.getFullYear();

            mostrar_calendario();
        });
    });

    //horários disponíveis
    async function carregarHorariosDisponiveis() {
        if (!servicoSelecionadoEL.value || !dataSelecionadaISO) return;
        if (cfg.comProfissional && !profissionalAtual()) return;

        // guarda o que foi pedido
        const dataPedida = dataSelecionadaISO;
        const servicoPedido = servicoSelecionadoEL.value;
        const profissionalPedido = profissionalAtual();

        horariosContainerEL.classList.add("ativo");
        listaHorariosEL.innerHTML = `<li class="a_carregar">A carregar horários…</li>`;

        setTimeout(() => {
            horariosContainerEL.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);

        try {
            const resposta = await fetch(cfg.urlDisponibilidade(dataPedida, servicoPedido, profissionalPedido));
            const dados = await resposta.json();

            if (
                dataPedida !== dataSelecionadaISO ||
                servicoPedido !== servicoSelecionadoEL.value ||
                profissionalPedido !== profissionalAtual()
            ) return;

            if (!resposta.ok) {
                listaHorariosEL.innerHTML = `<li class="erro">${escapeHtml(dados.erro || "Erro ao carregar horários.")}</li>`;
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
                item.tabIndex = 0;
                item.addEventListener("click", () => abrirFormReserva(hora, item));
                item.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        abrirFormReserva(hora, item);
                    }
                });
                listaHorariosEL.appendChild(item);
            });
        } catch (erro) {
            console.error(erro);
            listaHorariosEL.innerHTML = `<li class="erro">Não foi possível ligar ao servidor.</li>`;
        }
    }

    // repõe tudo o que depende da data (lista, dia selecionado, formulário)
    function esconderHorarios() {
        horariosContainerEL.classList.remove("ativo");
        listaHorariosEL.innerHTML = "";
        dataSelecionadaISO = null;
        dataSelecionada = null;
        marcarDiaSelecionado();
        inputData.value = "";
        formReservaEL.classList.remove("ativo");
    }

    //formulário de marcação
    function abrirFormReserva(hora, elementoSelecionado) {
        listaHorariosEL.querySelectorAll(".horario_item.selecionado").forEach((el) => {
            el.classList.remove("selecionado");
        });
        elementoSelecionado.classList.add("selecionado");

        horaSelecionada = hora;
        mostrarMensagem("");
        clienteNomeEL.value = "";
        clienteContactoEL.value = "";
        clienteEmailEL.value = "";
        if (cfg.limparCarrinhoAoAbrir) {
            carrinho = [];
            renderCarrinho();
        }
        produtoSelecionadoEL.innerHTML = `<option value="">Nenhum</option>`;
        esconderResumo();
        formReservaEL.classList.add("ativo");
        carregarProdutos();

        setTimeout(() => {
            formReservaEL.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
    }

    function mostrarMensagem(texto, erro = false) {
        msgReservaEL.textContent = texto;
        msgReservaEL.classList.toggle("erro", erro);
    }

    function criarOpcaoProduto(produto) {
        const opcao = document.createElement("option");
        opcao.value = produto.id;
        opcao.textContent = produto.preco
            ? `${produto.nome} — ${textoPreco(produto.preco)}`
            : produto.nome;
        opcao.dataset.nome = produto.nome;
        opcao.dataset.preco = produto.preco;
        return opcao;
    }

    async function carregarServicos() {
        try {
            const resposta = await fetch(cfg.urlServicos);
            const dados = await resposta.json();
            if (!cfg.urlProdutos) produtosCatalogo = (resposta.ok && dados.produtos) || [];

            if (!resposta.ok || !dados.servicos || dados.servicos.length === 0) {
                servicoSelecionadoEL.innerHTML = `<option value="">${cfg.textos.semServicos}</option>`;
                return;
            }

            servicoSelecionadoEL.innerHTML = `<option value="" hidden>${cfg.textos.escolheServico}</option>`;
            dados.servicos.forEach((servico) => {
                const opcao = document.createElement("option");
                opcao.value = servico.id;
                const duracao = cfg.mostrarDuracao && servico.duracao_minutos ? ` · ${servico.duracao_minutos} min` : "";
                opcao.textContent = servico.preco
                    ? `${servico.nome} — ${textoPreco(servico.preco)}${duracao}`
                    : `${servico.nome}${duracao}`;
                opcao.dataset.nome = servico.nome;
                opcao.dataset.preco = servico.preco;
                servicoSelecionadoEL.appendChild(opcao);
            });
        } catch (erro) {
            console.error(erro);
            servicoSelecionadoEL.innerHTML = `<option value="">${cfg.textos.erroServicos}</option>`;
        }
    }

    //só a barbershop tem profissionais para escolher
    async function carregarProfissionais() {
        try {
            const resposta = await fetch("/api/profissionais");
            const dados = await resposta.json();

            if (!resposta.ok || !dados.profissionais || dados.profissionais.length === 0) {
                profissionalEL.innerHTML = `<option value="" disabled selected hidden>Sem profissionais disponíveis</option>`;
                return;
            }

            profissionalEL.innerHTML = `<option value="" disabled selected hidden>escolha o profissional</option>`;
            dados.profissionais.forEach((p) => {
                const opcao = document.createElement("option");
                opcao.value = p.nome;
                opcao.textContent = p.nome;
                profissionalEL.appendChild(opcao);
            });
        } catch (erro) {
            console.error(erro);
            profissionalEL.innerHTML = `<option value="" disabled selected hidden>Erro ao carregar profissionais</option>`;
        }
    }

    async function carregarProdutos() {
        let lista = produtosCatalogo;

        if (cfg.urlProdutos) {
            try {
                const resposta = await fetch(cfg.urlProdutos);
                const dados = await resposta.json();
                lista = (resposta.ok && dados.produtos) || [];
            } catch (erro) {
                console.error(erro);
                produtoSelecionadoEL.innerHTML = `<option value="">Erro ao carregar produtos</option>`;
                return;
            }
        }

        if (lista.length === 0) {
            produtoSelecionadoEL.innerHTML = `<option value="">Nenhum</option>`;
            return;
        }

        produtoSelecionadoEL.innerHTML = `<option value="" hidden>Escolha um produto</option>`;
        lista.forEach((produto) => produtoSelecionadoEL.appendChild(criarOpcaoProduto(produto)));
    }

    carregarServicos();
    if (cfg.comProfissional) carregarProfissionais();

    //o subtotal só aparece no carrinho, quando quantidade > 1
    function linhaProduto(item, comSubtotal) {
        const base = `${escapeHtml(item.nome)} — ${textoPreco(item.preco)}`;
        if (item.quantidade > 1) {
            return comSubtotal
                ? `${base} x ${item.quantidade} = ${textoPreco(item.preco * item.quantidade)}`
                : `${base} x ${item.quantidade}`;
        }
        return base;
    }

    function renderCarrinho() {
        if (carrinho.length === 0) {
            carrinhoListaEL.hidden = true;
            carrinhoListaEL.innerHTML = "";
            return;
        }

        carrinhoListaEL.hidden = false;
        carrinhoListaEL.innerHTML = carrinho.map((item) => `
            <li class="item-produto" data-id="${item.id}">
                <span class="nome-produto">${linhaProduto(item, true)}</span>
                <button type="button" class="btnRemover" aria-label="Remover ${escapeHtml(item.nome)}">-</button>
            </li>
        `).join("");
    }

    //um só listener serve todos os botões "-", mesmo os que o renderCarrinho criar depois
    carrinhoListaEL.addEventListener("click", (evento) => {
        const botao = evento.target.closest(".btnRemover");
        if (!botao) return;

        const id = parseInt(botao.closest(".item-produto").dataset.id, 10);
        const item = carrinho.find((i) => i.id === id);
        if (!item) return;

        // "-" tira uma unidade
        if (item.quantidade > 1) item.quantidade--;
        else carrinho = carrinho.filter((i) => i !== item);

        renderCarrinho();
        atualizarResumo();
    });

    //resumo e confirmação
    function formularioValido() {
        return (
            servicoSelecionadoEL.value !== "" &&
            clienteNomeEL.value.trim() !== "" &&
            /^\d{9}$/.test(clienteContactoEL.value.trim()) &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmailEL.value.trim())
        );
    }

    function esconderResumo() {
        resumoReservaEL.hidden = true;
        resumoReservaEL.innerHTML = "";
        btnConfirmarEL.hidden = true;
    }

    // o resumo só aparece depois de tudo estar preenchido corretamente
    function atualizarResumo() {
        if (!formularioValido()) {
            esconderResumo();
            return;
        }

        // para só fazer scroll na primeira vez que o resumo aparece
        const resumoJaVisivel = !resumoReservaEL.hidden;

        const opcaoServico = servicoSelecionadoEL.selectedOptions[0];
        const nomeServico = opcaoServico?.dataset.nome;
        const precoServico = Number(opcaoServico?.dataset.preco) || 0;

        const produtos = carrinho.map((item) => linhaProduto(item, false)).join("<br>");
        const totalProdutos = carrinho.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
        const total = precoServico + totalProdutos;

        const linhaProfissional = cfg.comProfissional
            ? `<p><strong>Profissional:</strong> ${escapeHtml(profissionalAtual())}</p>`
            : "";

        resumoReservaEL.innerHTML = `
            <div class="resumo_datahora">
                <span><i class="fa-solid fa-calendar-days"></i>${escapeHtml(inputData.value)}</span>
                <span><i class="fa-solid fa-clock"></i>${escapeHtml(horaSelecionada)}</span>
            </div>
            ${linhaProfissional}
            <p><strong>${cfg.textos.labelServico}:</strong> ${escapeHtml(nomeServico)} — ${textoPreco(precoServico)}</p>
            <p><strong>Produto:</strong> ${produtos || "Nenhum"}</p>
            <p><strong>Total:</strong> ${textoPreco(total)}</p>
            <p><strong>Nome:</strong> ${escapeHtml(clienteNomeEL.value.trim())}</p>
            <p><strong>Telefone:</strong> ${escapeHtml(clienteContactoEL.value.trim())}</p>
            <p><strong>Email:</strong> ${escapeHtml(clienteEmailEL.value.trim())}</p>
        `;
        resumoReservaEL.hidden = false;
        btnConfirmarEL.hidden = false;

        if (!resumoJaVisivel) {
            setTimeout(() => {
                resumoReservaEL.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
        }
    }

    // qualquer alteração refaz o resumo (que só aparece com tudo válido).
    [produtoSelecionadoEL, clienteNomeEL, clienteContactoEL, clienteEmailEL].forEach((campo) => {
        campo.addEventListener("input", atualizarResumo);
    });

    btnCancelarEL.addEventListener("click", () => {
        formReservaEL.classList.remove("ativo");
    });

    btnConfirmarEL.addEventListener("click", async () => {
        if (!formularioValido()) return;

        //desativa o botão para um duplo clique não criar duas marcações
        btnConfirmarEL.disabled = true;
        mostrarMensagem("A confirmar…");

        //o profissional só vai no pedido se esta página o tiver (na skincare é o servidor que o decide)
        const corpo = {
            ...(cfg.comProfissional ? { profissional: profissionalAtual() } : {}),
            data: dataSelecionadaISO,
            hora: horaSelecionada,
            servico_id: parseInt(servicoSelecionadoEL.value, 10),
            produtos: cfg.produtosParaEnviar(carrinho),
            cliente_nome: clienteNomeEL.value.trim(),
            cliente_contacto: clienteContactoEL.value.trim(),
            cliente_email: clienteEmailEL.value.trim().toLowerCase(),
        };

        try {
            const resposta = await fetch(cfg.urlReservar, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(corpo),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarMensagem(dados.erro || "Não foi possível concluir a marcação.", true);
                btnConfirmarEL.disabled = false;
                //horário já ocupado por outra pessoa -> atualiza a lista
                if (resposta.status === 409) carregarHorariosDisponiveis();
                return;
            }
            mostrarMensagem(cfg.textos.confirmada);
            setTimeout(() => {
                formReservaEL.classList.remove("ativo");
                btnConfirmarEL.disabled = false;
                carregarHorariosDisponiveis();
            }, cfg.atrasoFechoMs);
        } catch (erro) {
            console.error(erro);
            mostrarMensagem("Não foi possível ligar ao servidor.", true);
            btnConfirmarEL.disabled = false;
        }
    });
}
