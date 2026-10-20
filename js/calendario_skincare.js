// calendario_skincare.js

iniciarCalendario({
    comProfissional: false,
    urlServicos: "/api/skincare/catalogo",
    urlProdutos: null,
    urlDisponibilidade: (data, servicoId) =>
        `/api/skincare/marcacoes?data=${data}&servico_id=${encodeURIComponent(servicoId)}`,
    urlReservar: "/api/skincare/marcacoes",
    // o servidor só usa id e quantidade (nome/preço vêm da base de dados)
    produtosParaEnviar: (carrinho) => carrinho.map(({ id, quantidade }) => ({ id, quantidade })),
    limparCarrinhoAoAbrir: true,
    mostrarDuracao: true,
    atrasoFechoMs: 1500,
    textos: {
        semServicos: "Sem tratamentos disponíveis",
        erroServicos: "Erro ao carregar tratamentos",
        escolheServico: "Escolha um tratamento",
        labelServico: "Tratamento",
        confirmada: "Marcação confirmada! Obrigada.",
    },
});
