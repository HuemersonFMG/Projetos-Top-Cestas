document.addEventListener("DOMContentLoaded", iniciarBolao);

let participanteAtual = null;
let jogosBolao = [];
let rankingBolao = [];

const API_BOLAO = "/api/bolao";

async function iniciarBolao() {
    console.log("bolao.js carregado com sucesso");

    configurarFormularioParticipante();

    configurarBotaoVoltarTopo();

    await carregarJogos();
    await carregarRanking();
}

function configurarFormularioParticipante() {
    const form = document.getElementById("formParticipante");

    if (!form) {
        console.warn("Formulário #formParticipante não encontrado.");
        return;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        await salvarParticipante();
    });
}

async function salvarParticipante() {
    const nome = document.getElementById("nome")?.value?.trim();
    const telefone = document.getElementById("telefone")?.value?.trim();
    const email = document.getElementById("email")?.value?.trim();
    const aceite = document.getElementById("aceite")?.checked;

    if (!nome || !telefone) {
        alert("Informe nome e telefone.");
        return;
    }

    if (!aceite) {
        alert("Você precisa aceitar as regras do bolão.");
        return;
    }

    try {
        const resposta = await fetch(`${API_BOLAO}/participante`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                nome,
                telefone,
                email
            })
        });

        const retorno = await resposta.json();

        if (!resposta.ok || retorno.erro) {
            throw new Error(retorno.mensagem || "Erro ao salvar participante.");
        }

        participanteAtual = retorno.participante;

        alert(`Participante salvo: ${participanteAtual.nome}`);

        destacarParticipanteLogado();

        await carregarJogos();
        await carregarRanking();

    } catch (erro) {
        console.error("Erro ao salvar participante:", erro);
        alert(erro.message || "Erro ao salvar participante.");
    }
}

function destacarParticipanteLogado() {
    const sectionParticipar = document.getElementById("participar");

    if (!sectionParticipar || !participanteAtual) return;

    let aviso = document.getElementById("participanteAtualAviso");

    if (!aviso) {
        aviso = document.createElement("div");
        aviso.id = "participanteAtualAviso";
        aviso.className = "aviso participante-atual";
        sectionParticipar.appendChild(aviso);
    }

    aviso.innerHTML = `
        ✅ Participante ativo:
        <strong>${textoSeguro(participanteAtual.nome)}</strong>
    `;
}

async function carregarJogos() {
    const container = document.getElementById("listaJogos");

    if (!container) return;

    container.innerHTML = `
        <div class="aviso">
            Carregando jogos do bolão...
        </div>
    `;

    try {
        const resposta = await fetch(`${API_BOLAO}/jogos?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        const retorno = await resposta.json();

        if (!resposta.ok || retorno.erro) {
            throw new Error(retorno.mensagem || "Erro ao buscar jogos.");
        }

        jogosBolao = Array.isArray(retorno.jogos) ? retorno.jogos : [];

        renderizarJogos(jogosBolao);

    } catch (erro) {
        console.error("Erro ao carregar jogos:", erro);

        container.innerHTML = `
            <div class="aviso erro">
                Não foi possível carregar os jogos.
                Verifique se o projeto da Copa está rodando na porta 5051.
            </div>
        `;
    }
}

function renderizarJogos(jogos) {
    const container = document.getElementById("listaJogos");

    if (!container) return;

    if (!Array.isArray(jogos) || jogos.length === 0) {
        container.innerHTML = `
            <div class="aviso">
                Nenhum jogo disponível para palpite no momento.
            </div>
        `;
        return;
    }

    const jogosDisponiveis = jogos
        .filter(jogo => deveExibirJogoParaPalpite(jogo))
        .slice(0, 20);

    if (jogosDisponiveis.length === 0) {
        container.innerHTML = `
            <div class="aviso">
                Nenhum jogo aberto para palpite no momento.
            </div>
        `;
        return;
    }

    container.innerHTML = jogosDisponiveis
        .map(jogo => montarCardJogo(jogo))
        .join("");

    configurarBotoesPalpite();
}

function deveExibirJogoParaPalpite(jogo) {
    if (!jogo) return false;

    const status = textoSeguro(jogo.status).toLowerCase();

    if (
        status.includes("finalizado") ||
        status.includes("encerrado") ||
        status.includes("finished") ||
        status.includes("complete")
    ) {
        return false;
    }

    const dataJogo = obterDataDoJogo(jogo);

    if (!dataJogo) {
        return true;
    }

    return dataJogo.getTime() > new Date().getTime();
}

function montarCardJogo(jogo) {
    const jogoId = textoSeguro(jogo.id);
    const bloqueado = palpiteBloqueado(jogo);
    const classeBloqueado = bloqueado ? " jogo-bloqueado" : "";

    return `
        <article class="card-jogo-bolao${classeBloqueado}" data-jogo-id="${jogoId}">
            <div class="jogo-topo">
                <span class="fase-jogo">${textoSeguro(jogo.fase || "Jogo")}</span>
                <span class="data-jogo">${montarDataHora(jogo)}</span>
            </div>

            <div class="confronto-bolao">
                <div class="time-bolao">
                    <span class="bandeira">${textoSeguro(jogo.bandeiraCasa)}</span>
                    <strong>${textoSeguro(jogo.casa)}</strong>
                </div>

                <div class="versus-bolao">x</div>

                <div class="time-bolao">
                    <span class="bandeira">${textoSeguro(jogo.bandeiraFora)}</span>
                    <strong>${textoSeguro(jogo.fora)}</strong>
                </div>
            </div>

            <div class="palpite-area">
                <label>
                    ${textoSeguro(jogo.casa)}
                    <input
                        type="number"
                        min="0"
                        max="30"
                        class="input-gol"
                        data-campo="golsCasa"
                        ${bloqueado ? "disabled" : ""}
                        value="0">
                </label>

                <span class="separador-palpite">x</span>

                <label>
                    ${textoSeguro(jogo.fora)}
                    <input
                        type="number"
                        min="0"
                        max="30"
                        class="input-gol"
                        data-campo="golsFora"
                        ${bloqueado ? "disabled" : ""}
                        value="0">
                </label>
            </div>

            <button
                type="button"
                class="btn-principal btn-palpite"
                data-jogo-id="${jogoId}"
                ${bloqueado ? "disabled" : ""}>
                ${bloqueado ? "Palpite encerrado" : "Salvar Palpite"}
            </button>

            <div class="status-palpite" aria-live="polite"></div>
        </article>
    `;
}

function configurarBotoesPalpite() {
    const botoes = document.querySelectorAll(".btn-palpite");

    botoes.forEach(botao => {
        botao.addEventListener("click", async () => {
            const jogoId = botao.dataset.jogoId;
            await salvarPalpite(jogoId);
        });
    });
}

async function salvarPalpite(jogoId) {
    if (!participanteAtual) {
        alert("Cadastre o participante antes de salvar o palpite.");
        document.getElementById("participar")?.scrollIntoView({
            behavior: "smooth"
        });
        return;
    }

    const jogo = jogosBolao.find(item => textoSeguro(item.id) === textoSeguro(jogoId));

    if (!jogo) {
        alert("Jogo não encontrado.");
        return;
    }

    if (palpiteBloqueado(jogo)) {
        alert("Palpites encerrados para este jogo.");
        return;
    }

    const card = document.querySelector(`[data-jogo-id="${CSS.escape(textoSeguro(jogoId))}"]`);

    if (!card) {
        alert("Card do jogo não encontrado.");
        return;
    }

    const inputCasa = card.querySelector('[data-campo="golsCasa"]');
    const inputFora = card.querySelector('[data-campo="golsFora"]');
    const status = card.querySelector(".status-palpite");

    const golsCasa = Number(inputCasa?.value);
    const golsFora = Number(inputFora?.value);

    if (!Number.isInteger(golsCasa) || !Number.isInteger(golsFora) || golsCasa < 0 || golsFora < 0) {
        alert("Informe um placar válido.");
        return;
    }

    try {
        if (status) status.innerHTML = "⏳ Salvando palpite...";

        const resposta = await fetch(`${API_BOLAO}/palpite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                participanteId: participanteAtual.id,
                jogoId: jogo.id,
                casa: jogo.casa,
                fora: jogo.fora,
                golsCasa,
                golsFora
            })
        });

        const retorno = await resposta.json();

        if (!resposta.ok || retorno.erro) {
            throw new Error(retorno.mensagem || "Erro ao salvar palpite.");
        }

        if (status) {
            status.innerHTML = `
                ✅ Palpite salvo:
                <strong>${golsCasa} x ${golsFora}</strong>
            `;
        }

        await carregarRanking();

    } catch (erro) {
        console.error("Erro ao salvar palpite:", erro);

        if (status) {
            status.innerHTML = `❌ ${textoSeguro(erro.message)}`;
        } else {
            alert(erro.message || "Erro ao salvar palpite.");
        }
    }
}

async function carregarRanking() {
    const tbody = document.getElementById("tbodyRanking");

    if (!tbody) return;

    try {
        const resposta = await fetch(`${API_BOLAO}/ranking?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        const retorno = await resposta.json();

        if (!resposta.ok || retorno.erro) {
            throw new Error(retorno.mensagem || "Erro ao carregar ranking.");
        }

        rankingBolao = Array.isArray(retorno.ranking) ? retorno.ranking : [];

        renderizarRanking(rankingBolao);

    } catch (erro) {
        console.error("Erro ao carregar ranking:", erro);

        tbody.innerHTML = `
            <tr>
                <td colspan="6">Não foi possível carregar o ranking.</td>
            </tr>
        `;
    }
}

function renderizarRanking(ranking) {
    const tbody = document.getElementById("tbodyRanking");

    if (!tbody) return;

    if (!Array.isArray(ranking) || ranking.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">Nenhum participante cadastrado ainda.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ranking
        .map((item, index) => {
            const medalha = obterMedalha(index);

            return `
                <tr>
                    <td>${medalha} ${index + 1}</td>
                    <td>${textoSeguro(item.nome)}</td>
                    <td>${numeroSeguro(item.totalPalpites)}</td>
                    <td>${numeroSeguro(item.acertos)}</td>
                    <td>${numeroSeguro(item.placaresExatos)}</td>
                    <td><strong>${numeroSeguro(item.pontos)}</strong></td>
                </tr>
            `;
        })
        .join("");
}

function obterMedalha(index) {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "";
}

function palpiteBloqueado(jogo) {
    const status = textoSeguro(jogo.status).toLowerCase();

    if (
        status.includes("em andamento") ||
        status.includes("ao vivo") ||
        status.includes("finalizado") ||
        status.includes("encerrado") ||
        status.includes("finished") ||
        status.includes("complete")
    ) {
        return true;
    }

    const dataJogo = obterDataDoJogo(jogo);

    if (!dataJogo) {
        return false;
    }

    return dataJogo.getTime() <= new Date().getTime();
}

function obterDataDoJogo(jogo) {
    if (!jogo) return null;

    if (jogo.dataISO) {
        const data = new Date(jogo.dataISO);

        if (!isNaN(data.getTime())) {
            return data;
        }
    }

    return null;
}

function montarDataHora(jogo) {
    const data = textoSeguro(jogo.data);
    const hora = textoSeguro(jogo.hora);

    if (data && hora) return `${data} às ${hora}`;
    if (data) return data;
    if (hora) return hora;

    const dataJogo = obterDataDoJogo(jogo);

    if (dataJogo) {
        return dataJogo.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    return "Data a definir";
}

function configurarBotaoVoltarTopo() {
    const botao = document.getElementById("btnVoltarTopo");

    if (!botao) return;

    botao.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}

function textoSeguro(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor);
}

function numeroSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    return valor;
}