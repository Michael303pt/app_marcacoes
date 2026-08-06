//marcacoes.js

const dias_EL = document.querySelector(".dias");
const btn_EL = document.querySelectorAll(".calendar_headings .fa-solid");
const dias_meses_EL = document.querySelector(".month_year")

let dias_meses_obj = {
    dias: [
        "Domingo",
        "Segunda",
        "Terça",
        "Quarta",
        "Quinta",
        "Sexta",
        "Sábado"
    ],

    meses: [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro"
    ]
};

//obejetos de data
let date_obj = new Date();
let mes = date_obj.getMonth();
let ano = date_obj.getFullYear();
let data = date_obj.getDate();

const mostrar_calendario = () =>{
    let primeiro_dia_do_mes = new Date(ano, mes, 1).getDay();
    let ultima_data_do_mes = new Date(ano, mes + 1, 0).getDate();
    let ultimo_dia_do_mes = new Date(ano, mes, ultima_data_do_mes).getDay();
    let ultimo_data_do_ultimo_mes = new Date(ano, mes, 0).getDate();
    let dias = "";

    //previous months last days
    for(let x=primeiro_dia_do_mes; x>0; x--){
        dias += `<li class="desativo">${ultimo_data_do_ultimo_mes - x + 1}</li>`;
    }

    for(let x=1; x<=ultima_data_do_mes; x++){
        let check_hoje = 
            x === date_obj.getDate() && 
            mes === new Date().getMonth() &&
            ano === new Date().getFullYear() 
            ? "hoje" : "";

        dias += `<li class="${check_hoje}">${x}</li>`;
    }

    //próximo mês primeiros dias
    for(let x = ultimo_dia_do_mes; x<6; x++){
        dias += `<li class="desativo">${x - ultimo_dia_do_mes + 1}</li>`;
    }

    //mostra todos os dias daquele mes no calendario
    dias_EL.innerHTML = dias;

    //mostrar mês e ano
    dias_meses_EL.innerHTML = `${dias_meses_obj.meses[mes]}, ${ano}`;
}

mostrar_calendario();

//mês anterior/seguinte
btn_EL.forEach((btns)=>{
    btns.addEventListener("click", () =>{
        mes = btns.id === "prev" ? mes-1 : mes+1;

        if(mes<0 || mes>11){
            data = new Date(ano, mes, new Date().getDate());
            mes = data.getMonth();
            ano = data.getFullYear();
        }else{
            data = new Date();
        }

        mostrar_calendario();
    });
});