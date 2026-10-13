// ─── TIPOS DE PITO ───────────────────────────────────────────────────────────
// olhos: [centro-x, centro-y, diâmetro] em % da imagem (zona de penalização)
const PITOS = [
  { img: "pito.png",     pontos: 10, olhos: [[38.3, 37.6, 15.2], [63.5, 36.6, 15.0]] },
  { img: "gordo.png",    pontos: 5,  olhos: [[38.4, 38.0, 15.6], [64.0, 37.0, 15.6]] },
  { img: "magro.png",    pontos: 20, olhos: [[38.6, 38.0, 15.6], [64.0, 37.4, 15.6]] },
  { img: "careca.png",   pontos: 15, olhos: [[38.0, 34.0, 12.6], [62.4, 34.0, 12.6]] },
  { img: "cabeludo.png", pontos: 10, olhos: [[38.6, 37.6, 15.2], [63.6, 37.2, 15.2]] },
];

// ─── CONFIGURAÇÃO DOS NÍVEIS ──────────────────────────────────────────────────
const NIVEIS = [
  { nivel: 1, intervalo: 900, maxPitos: 2, duracao: 30, tempoVida: 2000 },
  { nivel: 2, intervalo: 600, maxPitos: 3, duracao: 30, tempoVida: 1500 },
  { nivel: 3, intervalo: 380, maxPitos: 4, duracao: 30, tempoVida: 1000 },
];

// ─── SLOTS ────────────────────────────────────────────────────────────────────
const SLOTS = [
  { id: 0, left: "11%",  top: "72%" },
  { id: 1, left: "40%", top: "45%" },
  { id: 2, left: "73%", top: "55%" },
  { id: 3, left: "6%", top: "55%" },
  { id: 4, left: "70%", top: "72%" },
];

// ─── ESTADO DO JOGO ───────────────────────────────────────────────────────────
const estado = {
  pontos: 0,
  tempo: 30,
  nivelAtual: 0,
  vidas: 5,
  jogoAtivo: false,
  nivelEmTransicao: false,
  intervaloPitos: null,
  intervaloTempo: null,
  slotsOcupados: new Set(),
};

// ─── ÁUDIOS ───────────────────────────────────────────────────────────────────
const introMusic = document.getElementById("introMusic");
const gameMusic  = document.getElementById("gameMusic");
const tiro       = document.getElementById("tiro");

// ─── SOM ──────────────────────────────────────────────────────────────────────
let somAtivo = true;

function toggleSom() {
  somAtivo = !somAtivo;
  introMusic.muted = !somAtivo;
  gameMusic.muted  = !somAtivo;
  tiro.muted       = !somAtivo;
  document.getElementById("btnSom").innerText = somAtivo ? "🔊" : "🔇";
}

// ─── ÁUDIO ────────────────────────────────────────────────────────────────────
function tocarTiro() {
  tiro.currentTime = 0;
  tiro.play().catch(() => {});
}

// ─── INTRO ────────────────────────────────────────────────────────────────────
introMusic.volume = 0.6;

function tocarIntro() {
  if (estado.jogoAtivo) return;
  introMusic.play().then(removerOuvintesIntro).catch(() => {});
}

function removerOuvintesIntro() {
  document.removeEventListener("pointerdown", tocarIntro);
  document.removeEventListener("keydown", tocarIntro);
}

// tenta já; se o browser bloquear, toca no primeiro toque/tecla
window.addEventListener("load", tocarIntro);
document.addEventListener("pointerdown", tocarIntro);
document.addEventListener("keydown", tocarIntro);

// pausa o som quando a app vai para segundo plano
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    introMusic.pause();
    gameMusic.pause();
  } else if (estado.jogoAtivo) {
    gameMusic.play().catch(() => {});
  } else if (document.getElementById("menu").style.display === "block") {
    introMusic.play().catch(() => {});
  }
});

// ─── INÍCIO DO JOGO ───────────────────────────────────────────────────────────
function startGame() {
  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";

  removerOuvintesIntro();
  introMusic.pause();
  gameMusic.volume = 0.4;
  gameMusic.currentTime = 0;
  gameMusic.play().catch(() => {});

  estado.pontos          = 0;
  estado.nivelAtual      = 0;
  estado.vidas           = 5;
  estado.jogoAtivo       = true;
  estado.nivelEmTransicao = false;
  estado.slotsOcupados.clear();

  document.getElementById("gameOver").style.display = "none";
  atualizarHUD();
  iniciarNivel();
}

// ─── JOGAR DE NOVO (sem recarregar a página) ──────────────────────────────────
function jogarDeNovo() {
  startGame();
}

// ─── INICIAR NÍVEL ────────────────────────────────────────────────────────────
function iniciarNivel() {
  if (!estado.jogoAtivo) return;
  const cfg = NIVEIS[estado.nivelAtual];
  estado.tempo = cfg.duracao;
  atualizarHUD();

  // Limpa intervals anteriores
  clearInterval(estado.intervaloTempo);
  clearInterval(estado.intervaloPitos);
  estado.slotsOcupados.clear();
  document.querySelectorAll(".pito").forEach(p => p.remove());

  // Temporizador do nível
  estado.intervaloTempo = setInterval(() => {
    if (!estado.jogoAtivo || estado.nivelEmTransicao) return;
    estado.tempo--;
    atualizarHUD();
    if (estado.tempo <= 0) terminarNivel();
  }, 1000);

  // Loop de pitos
  criarPito();
  estado.intervaloPitos = setInterval(() => {
    if (!estado.jogoAtivo || estado.nivelEmTransicao) return;
    // Só cria se não atingiu o máx de pitos simultâneos
    if (estado.slotsOcupados.size < cfg.maxPitos) criarPito();
  }, cfg.intervalo);
}

// ─── FIM DE NÍVEL ─────────────────────────────────────────────────────────────
function terminarNivel() {
  estado.nivelEmTransicao = true;
  clearInterval(estado.intervaloTempo);
  clearInterval(estado.intervaloPitos);
  document.querySelectorAll(".pito").forEach(p => p.remove());
  estado.slotsOcupados.clear();

  const proximoNivel = estado.nivelAtual + 1;

  if (proximoNivel >= NIVEIS.length) {
    // Acabaram todos os níveis
    terminarJogo();
  } else {
    // Mostra ecrã de transição
    mostrarTransicaoNivel(proximoNivel + 1, () => {
      estado.nivelAtual = proximoNivel;
      estado.nivelEmTransicao = false;
      iniciarNivel();
    });
  }
}

// ─── ECRÃ DE TRANSIÇÃO DE NÍVEL ───────────────────────────────────────────────
function mostrarTransicaoNivel(numNivel, callback) {
  const overlay = document.getElementById("nivelOverlay");
  const texto   = document.getElementById("nivelTexto");

  texto.innerText = "NÍVEL " + numNivel + "!";
  overlay.style.display = "flex";

  // Animação: aparece 0.3s, fica 1.2s, desaparece 0.3s
  overlay.classList.remove("a-sair-nivel");
  overlay.classList.add("a-entrar-nivel");

  setTimeout(() => {
    overlay.classList.add("a-sair-nivel");
    setTimeout(() => {
      overlay.style.display = "none";
      overlay.classList.remove("a-entrar-nivel", "a-sair-nivel");
      callback();
    }, 400);
  }, 1500);
}

// ─── CRIAR PITO ───────────────────────────────────────────────────────────────
function criarPito() {
  const livres = SLOTS.filter(s => !estado.slotsOcupados.has(s.id));
  if (livres.length === 0) return;

  const slot = livres[Math.floor(Math.random() * livres.length)];
  estado.slotsOcupados.add(slot.id);

  const pito = document.createElement("div");
  pito.className = "pito";
  pito.style.left = slot.left;
  pito.style.top  = slot.top;

  const tipo = PITOS[Math.floor(Math.random() * PITOS.length)];

  const img = document.createElement("img");
  img.src = tipo.img;
  img.draggable = false;

  pito.appendChild(img);

  // zona de penalização: um círculo por olho, posicionado para este pito
  tipo.olhos.forEach(([cx, cy, d]) => {
    const olho = document.createElement("div");
    olho.className = "olho";
    olho.style.width  = d + "%";
    olho.style.height = d + "%";
    olho.style.left   = (cx - d / 2) + "%";
    olho.style.top    = (cy - d / 2) + "%";
    olho.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (pito.classList.contains("acertado") || !estado.jogoAtivo) return;
      estado.vidas--;
      atualizarHUD();
      acertarPito(pito, slot.id, -tipo.pontos, "⚠ MAU! PRÓ OLHO NÃO!");
      if (estado.vidas <= 0) {
        setTimeout(() => terminarJogo(true), 300);
      }
    });
    pito.appendChild(olho);
  });

  pito.addEventListener("pointerdown", () => {
    if (pito.classList.contains("acertado") || !estado.jogoAtivo) return;
    acertarPito(pito, slot.id, tipo.pontos);
  });

  document.getElementById("game").appendChild(pito);

  // Tempo de vida do pito diminui com o nível (ver NIVEIS)
  setTimeout(() => {
    if (pito.isConnected) removerPito(pito, slot.id);
  }, NIVEIS[estado.nivelAtual].tempoVida);
}

// ─── ACERTAR PITO ─────────────────────────────────────────────────────────────
function acertarPito(pito, slotId, valor, mensagem = null) {
  mostrarPontosVoadores(pito, valor);
  tocarTiro();
  estado.pontos += valor;
  atualizarHUD();
  if (mensagem) mostrarMensagem(mensagem);
  pito.classList.add("acertado");
  setTimeout(() => {
    if (pito.isConnected) pito.remove();
    estado.slotsOcupados.delete(slotId);
  }, 180);
}

// ─── REMOVER PITO SEM CLIQUE ──────────────────────────────────────────────────
function removerPito(pito, slotId) {
  pito.classList.add("a-sair");
  setTimeout(() => {
    if (pito.isConnected) pito.remove();
    estado.slotsOcupados.delete(slotId);
  }, 220);
}

// ─── PONTOS VOADORES ─────────────────────────────────────────────────────────
function mostrarPontosVoadores(pito, valor) {
  const rect        = pito.getBoundingClientRect();
  const wrapperRect = document.getElementById("wrapper").getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pontos-voadores" + (valor > 0 ? " positivo" : " negativo");
  el.innerText = (valor > 0 ? "+" : "") + valor;

  el.style.left = (rect.left - wrapperRect.left + rect.width / 2) + "px";
  el.style.top  = (rect.top  - wrapperRect.top  + rect.height / 4) + "px";

  document.getElementById("wrapper").appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function atualizarHUD() {
  document.getElementById("score").innerText = estado.pontos;
  document.getElementById("time").innerText  = estado.tempo;
  document.getElementById("nivel").innerText = estado.nivelAtual + 1;
  document.getElementById("vidas").innerText = "🐣".repeat(estado.vidas);
}

// ─── MENSAGEM ─────────────────────────────────────────────────────────────────
function mostrarMensagem(texto) {
  const msg = document.getElementById("mensagem");
  msg.innerText     = texto;
  msg.style.display = "block";
  setTimeout(() => { msg.style.display = "none"; }, 1000);
}

// ─── FIM DO JOGO ──────────────────────────────────────────────────────────────
function terminarJogo(perdeu = false) {
  if (!estado.jogoAtivo) return;   // evita chamadas duplicadas
  estado.jogoAtivo = false;
  clearInterval(estado.intervaloTempo);
  clearInterval(estado.intervaloPitos);
  gameMusic.pause();

  document.querySelectorAll(".pito").forEach(p => p.remove());
  estado.slotsOcupados.clear();

  const recordAnterior = parseInt(localStorage.getItem("recordPito") || "0");
  const novoRecord = estado.pontos > recordAnterior;
  if (novoRecord) localStorage.setItem("recordPito", estado.pontos);
  const record = novoRecord ? estado.pontos : recordAnterior;

  document.getElementById("finalScore").innerText   = estado.pontos;
  document.getElementById("gameOverTitulo").innerText = perdeu ? "GAME OVER!" : "FIM DO JOGO!";
  document.getElementById("recordTexto").innerText    = novoRecord
    ? "🏆 Novo recorde!"
    : "🏆 Recorde: " + record + " pts";

  document.getElementById("game").style.display     = "none";
  document.getElementById("gameOver").style.display = "flex";
}
