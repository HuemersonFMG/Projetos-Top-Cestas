require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const bolaoRoutes = require("./routes/bolao");

const app = express();

const PORT = Number(process.env.PORT) || 5052;

const PUBLIC_DIR = path.join(__dirname, "public");
const HTML_BOLAO = path.join(PUBLIC_DIR, "Bolao2026.html");

const DATA_DIR = path.join(__dirname, "data");
const LOG_DIR = path.join(__dirname, "logs");

const LOG_ACCESS = path.join(LOG_DIR, "access.log");
const LOG_ERROR = path.join(LOG_DIR, "error.log");

criarPastasNecessarias();

app.use(cors());

app.use(express.json({
    limit: "2mb"
}));

app.use(express.urlencoded({
    extended: true
}));

app.use((req, res, next) => {
    gravarLog(LOG_ACCESS, `${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
});

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(HTML_BOLAO);
});

app.get("/Bolao2026.html", (req, res) => {
    res.sendFile(HTML_BOLAO);
});

app.get("/api/status", (req, res) => {
    res.json({
        online: true,
        projeto: "Top Bolão Copa 2026",
        porta: PORT,
        ambiente: process.env.NODE_ENV || "development",
        dataHora: new Date().toLocaleString("pt-BR")
    });
});

app.use("/api/bolao", bolaoRoutes);

app.use((req, res) => {
    res.status(404).json({
        erro: true,
        mensagem: "Rota não encontrada.",
        rota: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error("Erro interno:", err);

    gravarLog(
        LOG_ERROR,
        `${req.method} ${req.originalUrl} - ${err.message}`
    );

    res.status(500).json({
        erro: true,
        mensagem: "Erro interno no servidor."
    });
});

app.listen(PORT, () => {
    console.log("========================================");
    console.log("Top Bolão Copa 2026 iniciado com sucesso");
    console.log("========================================");
    console.log(`Página principal: http://localhost:${PORT}`);
    console.log(`Página direta:    http://localhost:${PORT}/Bolao2026.html`);
    console.log(`API status:       http://localhost:${PORT}/api/status`);
    console.log(`API bolão:        http://localhost:${PORT}/api/bolao/status`);
    console.log("========================================");
});

function criarPastasNecessarias() {
    criarPasta(DATA_DIR);
    criarPasta(LOG_DIR);

    garantirArquivoJson(path.join(DATA_DIR, "palpites.json"), []);
    garantirArquivoJson(path.join(DATA_DIR, "usuarios.json"), []);
}

function criarPasta(pasta) {
    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, {
            recursive: true
        });
    }
}

function garantirArquivoJson(caminho, valorPadrao) {
    if (!fs.existsSync(caminho)) {
        fs.writeFileSync(
            caminho,
            JSON.stringify(valorPadrao, null, 4),
            "utf8"
        );
    }
}

function gravarLog(arquivo, mensagem) {
    const linha = `[${new Date().toLocaleString("pt-BR")}] ${mensagem}\n`;

    fs.appendFile(arquivo, linha, err => {
        if (err) {
            console.error("Erro ao gravar log:", err.message);
        }
    });
}