const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");
const ARQ_USUARIOS = path.join(DATA_DIR, "usuarios.json");
const ARQ_PALPITES = path.join(DATA_DIR, "palpites.json");

garantirArquivos();

/**
 * GET /api/bolao/status
 */
router.get("/status", (req, res) => {
    res.json({
        online: true,
        modulo: "Top Bolão Copa 2026",
        mensagem: "API do bolão funcionando",
        dataHora: new Date().toLocaleString("pt-BR")
    });
});

/**
 * GET /api/bolao/jogos
 */
router.get("/jogos", async (req, res) => {
    try {
        const COPA_API_URL = process.env.COPA_API_URL || "http://localhost:5051/api/copa/home";

        const resposta = await axios.get(COPA_API_URL, {
            timeout: 15000,
            validateStatus: () => true
        });

        if (resposta.status < 200 || resposta.status >= 300) {
            return res.status(502).json({
                erro: true,
                mensagem: `Erro ao consultar API da Copa. HTTP ${resposta.status}`
            });
        }

        const dadosCopa = resposta.data;

        const jogos = extrairJogosDaCopa(dadosCopa);

        res.json({
            sucesso: true,
            origem: COPA_API_URL,
            total: jogos.length,
            jogos
        });

    } catch (erro) {
        console.error("Erro ao buscar jogos da Copa:", erro.message);

        res.status(500).json({
            erro: true,
            mensagem: "Erro ao buscar jogos da Copa."
        });
    }
});

/**
 * POST /api/bolao/participante
 */
router.post("/participante", (req, res) => {
    try {
        const { nome, telefone, email } = req.body;

        if (!nome || !telefone) {
            return res.status(400).json({
                erro: true,
                mensagem: "Nome e telefone são obrigatórios."
            });
        }

        const usuarios = lerJson(ARQ_USUARIOS, []);

        const telefoneLimpo = limparTexto(telefone);

        const usuarioExistente = usuarios.find(usuario =>
            limparTexto(usuario.telefone) === telefoneLimpo
        );

        if (usuarioExistente) {
            return res.json({
                sucesso: true,
                mensagem: "Participante já cadastrado.",
                participante: usuarioExistente
            });
        }

        const novoUsuario = {
            id: gerarId(),
            nome: String(nome).trim(),
            telefone: String(telefone).trim(),
            email: email ? String(email).trim() : "",
            criadoEm: new Date().toISOString()
        };

        usuarios.push(novoUsuario);
        salvarJson(ARQ_USUARIOS, usuarios);

        res.status(201).json({
            sucesso: true,
            mensagem: "Participante cadastrado com sucesso.",
            participante: novoUsuario
        });

    } catch (erro) {
        console.error("Erro ao cadastrar participante:", erro);

        res.status(500).json({
            erro: true,
            mensagem: "Erro ao cadastrar participante."
        });
    }
});

/**
 * GET /api/bolao/participantes
 */
router.get("/participantes", (req, res) => {
    const usuarios = lerJson(ARQ_USUARIOS, []);

    res.json({
        sucesso: true,
        total: usuarios.length,
        participantes: usuarios
    });
});

/**
 * POST /api/bolao/palpite
 */
router.post("/palpite", (req, res) => {
    try {
        const {
            participanteId,
            jogoId,
            casa,
            fora,
            golsCasa,
            golsFora
        } = req.body;

        if (!participanteId || !jogoId) {
            return res.status(400).json({
                erro: true,
                mensagem: "Participante e jogo são obrigatórios."
            });
        }

        if (golsCasa === undefined || golsFora === undefined) {
            return res.status(400).json({
                erro: true,
                mensagem: "Informe o placar completo do palpite."
            });
        }

        const usuarios = lerJson(ARQ_USUARIOS, []);
        const participante = usuarios.find(usuario => usuario.id === participanteId);

        if (!participante) {
            return res.status(404).json({
                erro: true,
                mensagem: "Participante não encontrado."
            });
        }

        const palpites = lerJson(ARQ_PALPITES, []);

        const palpiteExistente = palpites.find(palpite =>
            palpite.participanteId === participanteId &&
            palpite.jogoId === jogoId
        );

        const novoPalpite = {
            id: palpiteExistente ? palpiteExistente.id : gerarId(),
            participanteId,
            participanteNome: participante.nome,
            jogoId: String(jogoId),
            casa: String(casa || ""),
            fora: String(fora || ""),
            golsCasa: Number(golsCasa),
            golsFora: Number(golsFora),
            criadoEm: palpiteExistente ? palpiteExistente.criadoEm : new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };

        if (palpiteExistente) {
            const indice = palpites.findIndex(palpite => palpite.id === palpiteExistente.id);
            palpites[indice] = novoPalpite;
        } else {
            palpites.push(novoPalpite);
        }

        salvarJson(ARQ_PALPITES, palpites);

        res.status(palpiteExistente ? 200 : 201).json({
            sucesso: true,
            mensagem: palpiteExistente
                ? "Palpite atualizado com sucesso."
                : "Palpite registrado com sucesso.",
            palpite: novoPalpite
        });

    } catch (erro) {
        console.error("Erro ao salvar palpite:", erro);

        res.status(500).json({
            erro: true,
            mensagem: "Erro ao salvar palpite."
        });
    }
});

/**
 * GET /api/bolao/palpites
 */
router.get("/palpites", (req, res) => {
    const palpites = lerJson(ARQ_PALPITES, []);

    res.json({
        sucesso: true,
        total: palpites.length,
        palpites
    });
});

/**
 * GET /api/bolao/ranking
 */
router.get("/ranking", async (req, res) => {
    try {
        const usuarios = lerJson(ARQ_USUARIOS, []);
        const palpites = lerJson(ARQ_PALPITES, []);

        const COPA_API_URL = process.env.COPA_API_URL || "https://copa.topstatus.online/api/copa/home";

        const resposta = await axios.get(COPA_API_URL, {
            timeout: 15000,
            validateStatus: () => true
        });

        if (resposta.status < 200 || resposta.status >= 300) {
            return res.status(502).json({
                erro: true,
                mensagem: `Erro ao consultar API da Copa. HTTP ${resposta.status}`
            });
        }

        const jogosCopa = extrairJogosDaCopa(resposta.data);

        const mapaJogos = new Map();
        jogosCopa.forEach(jogo => {
            mapaJogos.set(String(jogo.id), jogo);
        });

        const ranking = usuarios.map(usuario => {
            const palpitesUsuario = palpites.filter(p =>
                p.participanteId === usuario.id
            );

            let pontos = 0;
            let acertos = 0;
            let placaresExatos = 0;

            palpitesUsuario.forEach(palpite => {
                const jogoReal = mapaJogos.get(String(palpite.jogoId));

                if (!jogoReal || !jogoFinalizado(jogoReal)) {
                    return;
                }

                const resultado = calcularPontuacaoPalpite(palpite, jogoReal);

                pontos += resultado.pontos;

                if (resultado.pontos > 0) {
                    acertos++;
                }

                if (resultado.tipo === "PLACAR_EXATO") {
                    placaresExatos++;
                }
            });

            return {
                participanteId: usuario.id,
                nome: usuario.nome,
                totalPalpites: palpitesUsuario.length,
                pontos,
                acertos,
                placaresExatos
            };
        });

        ranking.sort((a, b) =>
            b.pontos - a.pontos ||
            b.placaresExatos - a.placaresExatos ||
            b.acertos - a.acertos ||
            b.totalPalpites - a.totalPalpites ||
            a.nome.localeCompare(b.nome)
        );

        res.json({
            sucesso: true,
            atualizadoEm: new Date().toISOString(),
            ranking
        });

    } catch (erro) {
        console.error("Erro ao calcular ranking:", erro.message);

        res.status(500).json({
            erro: true,
            mensagem: "Erro ao calcular ranking do bolão."
        });
    }
});

function garantirArquivos() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(ARQ_USUARIOS)) {
        salvarJson(ARQ_USUARIOS, []);
    }

    if (!fs.existsSync(ARQ_PALPITES)) {
        salvarJson(ARQ_PALPITES, []);
    }
}

function lerJson(caminho, valorPadrao) {
    try {
        if (!fs.existsSync(caminho)) {
            return valorPadrao;
        }

        const conteudo = fs.readFileSync(caminho, "utf8");

        if (!conteudo.trim()) {
            return valorPadrao;
        }

        return JSON.parse(conteudo);

    } catch (erro) {
        console.error(`Erro ao ler JSON ${caminho}:`, erro.message);
        return valorPadrao;
    }
}

function salvarJson(caminho, dados) {
    fs.writeFileSync(
        caminho,
        JSON.stringify(dados, null, 4),
        "utf8"
    );
}

function gerarId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function limparTexto(valor) {
    return String(valor || "")
        .replace(/\D/g, "")
        .trim();
}

function extrairJogosDaCopa(dadosCopa) {
    const jogos = [];

    const grupos = Array.isArray(dadosCopa?.grupos) ? dadosCopa.grupos : [];
    const mataMata = Array.isArray(dadosCopa?.mataMata) ? dadosCopa.mataMata : [];

    grupos.forEach(grupo => {
        const listaJogos = Array.isArray(grupo.jogos) ? grupo.jogos : [];

        listaJogos.forEach(jogo => {
            jogos.push(normalizarJogoBolao(jogo, {
                fase: "Fase de grupos",
                grupo: grupo.nome
            }));
        });
    });

    mataMata.forEach(fase => {
        const listaJogos = Array.isArray(fase.jogos) ? fase.jogos : [];

        listaJogos.forEach(jogo => {
            jogos.push(normalizarJogoBolao(jogo, {
                fase: fase.fase || fase.nome || "Mata-mata",
                grupo: ""
            }));
        });
    });

    return jogos
        .filter(jogo => jogo.id)
        .sort((a, b) => {
            const dataA = new Date(a.dataISO || 0);
            const dataB = new Date(b.dataISO || 0);
            return dataA - dataB;
        });
}

function normalizarJogoBolao(jogo, extra = {}) {
    return {
        id: String(jogo.id || `${jogo.casa}-${jogo.fora}-${jogo.dataISO || jogo.data || ""}`),
        fase: extra.fase || jogo.fase || "",
        grupo: extra.grupo || jogo.grupo || "",
        data: jogo.data || "",
        hora: jogo.hora || "",
        dataISO: jogo.dataISO || null,
        casa: jogo.casa || "A definir",
        fora: jogo.fora || "A definir",
        bandeiraCasa: jogo.bandeiraCasa || "",
        bandeiraFora: jogo.bandeiraFora || "",
        golsCasa: jogo.golsCasa ?? null,
        golsFora: jogo.golsFora ?? null,
        status: jogo.status || "Agendado",
        local: jogo.local || jogo.estadio || jogo.cidade || ""
    };
}

function jogoFinalizado(jogo) {
    const status = String(jogo.status || "").toLowerCase();

    return (
        status.includes("finalizado") ||
        status.includes("encerrado") ||
        status.includes("finished") ||
        status.includes("complete") ||
        status === "ft"
    );
}

function calcularPontuacaoPalpite(palpite, jogoReal) {
    const palpiteCasa = Number(palpite.golsCasa);
    const palpiteFora = Number(palpite.golsFora);

    const realCasa = Number(jogoReal.golsCasa);
    const realFora = Number(jogoReal.golsFora);

    if (
        Number.isNaN(palpiteCasa) ||
        Number.isNaN(palpiteFora) ||
        Number.isNaN(realCasa) ||
        Number.isNaN(realFora)
    ) {
        return {
            pontos: 0,
            tipo: "SEM_RESULTADO"
        };
    }

    if (palpiteCasa === realCasa && palpiteFora === realFora) {
        return {
            pontos: 10,
            tipo: "PLACAR_EXATO"
        };
    }

    const resultadoPalpite = obterResultadoPartida(palpiteCasa, palpiteFora);
    const resultadoReal = obterResultadoPartida(realCasa, realFora);

    if (resultadoPalpite === resultadoReal) {
        return {
            pontos: 5,
            tipo: "VENCEDOR_OU_EMPATE"
        };
    }

    if (palpiteCasa === realCasa || palpiteFora === realFora) {
        return {
            pontos: 2,
            tipo: "GOLS_DE_UM_TIME"
        };
    }

    return {
        pontos: 0,
        tipo: "ERROU"
    };
}

function obterResultadoPartida(golsCasa, golsFora) {
    if (golsCasa > golsFora) return "CASA";
    if (golsFora > golsCasa) return "FORA";
    return "EMPATE";
}

module.exports = router;