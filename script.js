// ═══════════════════════════════════════════════════════════════════════════════
//  TIRO AO PITO
// ═══════════════════════════════════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

// ─── TIPOS DE PITO ────────────────────────────────────────────────────────────
// olhos: [centro-x, centro-y, diâmetro] em % da imagem (zona de penalização)
const PITOS = [
  { img: "pito.png",     pontos: 10, cor: "#ffd633", olhos: [[38.3, 37.6, 15.2], [63.5, 36.6, 15.0]] },
  { img: "gordo.png",    pontos: 5,  cor: "#ffd633", olhos: [[38.4, 38.0, 15.6], [64.0, 37.0, 15.6]] },
  { img: "magro.png",    pontos: 20, cor: "#ffd633", olhos: [[38.6, 38.0, 15.6], [64.0, 37.4, 15.6]] },
  { img: "careca.png",   pontos: 15, cor: "#f0a8a0", olhos: [[38.0, 34.0, 12.6], [62.4, 34.0, 12.6]] },
  { img: "cabeludo.png", pontos: 10, cor: "#e6b422", olhos: [[38.6, 37.6, 15.2], [63.6, 37.2, 15.2]] },
];

// Pitos raros, com efeito próprio. Usam os mesmos desenhos, com brilho e um selo.
const ESPECIAIS = {
  dourado: { base: 0, pontos: 50, cor: "#ffd700", selo: "⭐", vida: 0.7 },
  relogio: { base: 2, pontos: 10, cor: "#7fd4ff", selo: "⏱️", vida: 1.2 },
  coracao: { base: 3, pontos: 10, cor: "#ff6b8a", selo: "❤️", vida: 1.2 },
};

// ─── NÍVEIS ───────────────────────────────────────────────────────────────────
// Os 3 primeiros são fixos; a partir do 4.º o jogo continua, cada vez mais rápido.
const NIVEIS = [
  { intervalo: 900, maxPitos: 2, duracao: 30, tempoVida: 2000 },
  { intervalo: 600, maxPitos: 3, duracao: 30, tempoVida: 1500 },
  { intervalo: 380, maxPitos: 4, duracao: 30, tempoVida: 1000 },
];

function configNivel(i) {
  if (i < NIVEIS.length) return NIVEIS[i];
  const extra = i - NIVEIS.length + 1;
  return {
    intervalo: Math.max(240, 380 - 25 * extra),
    maxPitos: 5,
    duracao: 30,
    tempoVida: Math.max(650, 1000 - 50 * extra),
  };
}

const VIDAS_MAX   = 5;
const COMBO_PASSO = 5;   // de 5 em 5 acertos seguidos sobe o multiplicador
const MULT_MAX    = 5;

// pré-carrega os desenhos para os pitos aparecerem logo, sem falhas
PITOS.forEach((p) => { const i = new Image(); i.src = p.img; });

// ─── SLOTS (ninhos) ───────────────────────────────────────────────────────────
const SLOTS = [
  { id: 0, left: "11%", top: "72%" },
  { id: 1, left: "40%", top: "45%" },
  { id: 2, left: "73%", top: "55%" },
  { id: 3, left: "6%",  top: "55%" },
  { id: 4, left: "70%", top: "72%" },
];

// ─── ESTADO ───────────────────────────────────────────────────────────────────
const estado = {
  pontos: 0,
  tempoMs: 0,
  nivelAtual: 0,
  vidas: VIDAS_MAX,
  combo: 0,
  melhorCombo: 0,
  jogoAtivo: false,
  pausado: false,
  nivelEmTransicao: false,
  sessao: 0,              // muda a cada jogo novo; invalida temporizadores antigos
  loop: null,
  ultimoTick: 0,
  msJogo: 0,              // tempo de jogo efetivo (não conta pausas)
  proximoSpawn: 0,
  ultimoEspecial: -99999,
  pitosCriados: 0,
  pitos: new Set(),       // pitos em cena: { el, slotId, tipo, vida, tratado }
};

const multiplicador = () => Math.min(MULT_MAX, 1 + Math.floor(estado.combo / COMBO_PASSO));

// ─── ÁUDIO: MÚSICA ────────────────────────────────────────────────────────────
const introMusic = $("introMusic");
const gameMusic  = $("gameMusic");
let somAtivo = true;

introMusic.volume = 0.6;

function toggleSom() {
  somAtivo = !somAtivo;
  introMusic.muted = !somAtivo;
  gameMusic.muted  = !somAtivo;
  sfx.definirMudo(!somAtivo);
  $("btnSom").innerText = somAtivo ? "🔊" : "🔇";
}

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

// ─── ÁUDIO: EFEITOS (sintetizados; o tiro.mp3 é opcional) ─────────────────────
const sfx = {
  ctx: null,
  master: null,
  tiroBuf: null,
  mudo: false,

  iniciar() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.mudo ? 0 : 1;
    this.master.connect(this.ctx.destination);
    // Se existir um tiro.mp3 a sério, é usado no lugar do som sintetizado
    fetch("tiro.mp3")
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b && b.byteLength > 1000 ? this.ctx.decodeAudioData(b) : null))
      .then((buf) => { this.tiroBuf = buf; })
      .catch(() => {});
  },

  definirMudo(m) {
    this.mudo = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  },

  tom(freq, dur, tipo = "sine", vol = 0.2, atraso = 0, freqFim = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + atraso;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  ruido(dur, vol, freq) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const dados = buf.getChannelData(0);
    for (let i = 0; i < n; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
  },

  tocar(nome, extra = 0) {
    if (!this.ctx || this.mudo) return;
    switch (nome) {
      case "acerto":
        if (this.tiroBuf) {
          const s = this.ctx.createBufferSource();
          s.buffer = this.tiroBuf;
          s.connect(this.master);
          s.start();
        } else {
          this.ruido(0.11, 0.45, 1800);
          this.tom(240, 0.12, "triangle", 0.3, 0, 70);
        }
        // sobe ligeiramente com o combo
        if (extra > 0) this.tom(520 + extra * 90, 0.07, "square", 0.06, 0.03);
        break;
      case "olho":
        this.tom(320, 0.4, "sawtooth", 0.22, 0, 80);
        this.ruido(0.18, 0.3, 500);
        break;
      case "fuga":
        this.tom(300, 0.12, "sine", 0.07, 0, 180);
        break;
      case "combo":
        this.tom(520, 0.09, "square", 0.1, 0);
        this.tom(780, 0.12, "square", 0.1, 0.08);
        break;
      case "dourado":
        [660, 880, 1320, 1760].forEach((f, i) => this.tom(f, 0.12, "sine", 0.16, i * 0.07));
        break;
      case "relogio":
        this.tom(1000, 0.05, "square", 0.1, 0);
        this.tom(1000, 0.05, "square", 0.1, 0.12);
        this.tom(1500, 0.18, "sine", 0.14, 0.24);
        break;
      case "coracao":
        this.tom(440, 0.12, "sine", 0.18, 0);
        this.tom(660, 0.22, "sine", 0.18, 0.1);
        break;
      case "nivel":
        [523, 659, 784, 1047].forEach((f, i) => this.tom(f, 0.16, "triangle", 0.2, i * 0.1));
        break;
      case "fim":
        [392, 330, 262, 196].forEach((f, i) => this.tom(f, 0.3, "triangle", 0.22, i * 0.2));
        break;
    }
  },
};

// o áudio só pode arrancar depois de um toque do jogador
document.addEventListener("pointerdown", () => sfx.iniciar());

function vibrar(padrao) {
  try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) { /* sem vibração */ }
}

// ─── PAUSA E SEGUNDO PLANO ────────────────────────────────────────────────────
function pausar() {
  if (!estado.jogoAtivo || estado.pausado) return;
  estado.pausado = true;
  $("game").classList.add("pausado");
  $("pausaOverlay").style.display = "flex";
  gameMusic.pause();
}

function retomar() {
  if (!estado.jogoAtivo || !estado.pausado) return;
  estado.pausado = false;
  estado.ultimoTick = performance.now();
  $("game").classList.remove("pausado");
  $("pausaOverlay").style.display = "none";
  gameMusic.play().catch(() => {});
}

function sairParaMenu() {
  estado.sessao++;
  estado.jogoAtivo = false;
  estado.pausado = false;
  estado.nivelEmTransicao = false;
  clearInterval(estado.loop);
  limparPitos();
  gameMusic.pause();
  $("pausaOverlay").style.display = "none";
  $("nivelOverlay").style.display = "none";
  $("game").classList.remove("pausado");
  $("game").style.display = "none";
  $("gameOver").style.display = "none";
  $("menu").style.display = "block";
  atualizarRecordMenu();
  introMusic.currentTime = 0;
  introMusic.play().catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    introMusic.pause();
    gameMusic.pause();
    pausar();
  } else if (!estado.jogoAtivo && $("menu").style.display === "block") {
    introMusic.play().catch(() => {});
  }
});

// ─── INÍCIO DO JOGO ───────────────────────────────────────────────────────────
function startGame() {
  sfx.iniciar();
  $("menu").style.display = "none";
  $("gameOver").style.display = "none";
  $("pausaOverlay").style.display = "none";
  $("game").style.display = "block";
  $("game").classList.remove("pausado");

  removerOuvintesIntro();
  introMusic.pause();
  gameMusic.volume = 0.4;
  gameMusic.currentTime = 0;
  gameMusic.play().catch(() => {});

  estado.sessao++;
  estado.pontos = 0;
  estado.nivelAtual = 0;
  estado.vidas = VIDAS_MAX;
  estado.combo = 0;
  estado.melhorCombo = 0;
  estado.jogoAtivo = true;
  estado.pausado = false;
  estado.nivelEmTransicao = false;
  estado.msJogo = 0;
  estado.ultimoEspecial = -99999;
  estado.pitosCriados = 0;
  limparPitos();

  iniciarNivel();
  clearInterval(estado.loop);
  estado.ultimoTick = performance.now();
  estado.loop = setInterval(tick, 50);
}

function jogarDeNovo() {
  startGame();
}

// ─── NÍVEIS ───────────────────────────────────────────────────────────────────
function iniciarNivel() {
  const cfg = configNivel(estado.nivelAtual);
  estado.tempoMs = cfg.duracao * 1000;
  estado.proximoSpawn = 0;      // o primeiro pito aparece logo no próximo ciclo
  limparPitos();
  atualizarHUD();
}

function terminarNivel() {
  estado.nivelEmTransicao = true;
  limparPitos();
  sfx.tocar("nivel");
  vibrar([30, 40, 30]);

  const sessao = estado.sessao;
  const proximo = estado.nivelAtual + 1;
  mostrarTransicaoNivel(proximo + 1, () => {
    if (sessao !== estado.sessao || !estado.jogoAtivo) return;
    estado.nivelAtual = proximo;
    estado.nivelEmTransicao = false;
    iniciarNivel();
  });
}

function mostrarTransicaoNivel(numNivel, callback) {
  const overlay = $("nivelOverlay");
  $("nivelTexto").innerText = "NÍVEL " + numNivel + "!";
  overlay.style.display = "flex";
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

// ─── CICLO DO JOGO ────────────────────────────────────────────────────────────
function tick() {
  const agora = performance.now();
  const dt = Math.min(agora - estado.ultimoTick, 100);
  estado.ultimoTick = agora;
  if (!estado.jogoAtivo || estado.pausado || estado.nivelEmTransicao) return;

  const cfg = configNivel(estado.nivelAtual);
  estado.msJogo += dt;
  estado.tempoMs -= dt;

  // novos pitos
  estado.proximoSpawn -= dt;
  if (estado.proximoSpawn <= 0) {
    if (estado.pitos.size < cfg.maxPitos) criarPito();
    estado.proximoSpawn = cfg.intervalo;
  }

  // vida dos pitos: se se esgota, o pito foge
  estado.pitos.forEach((p) => {
    if (p.tratado) return;
    p.vida -= dt;
    if (p.vida <= 0) fugir(p);
  });

  if (estado.tempoMs <= 0) {
    estado.tempoMs = 0;
    atualizarHUD();
    terminarNivel();
    return;
  }
  atualizarHUD();
}

// ─── PITOS ────────────────────────────────────────────────────────────────────
function escolherTipo() {
  const podeEspecial =
    estado.pitosCriados > 4 && estado.msJogo - estado.ultimoEspecial > 7000;

  if (podeEspecial) {
    const r = Math.random();
    let nome = null;
    if (r < 0.06) nome = "dourado";
    else if (r < 0.10) nome = "relogio";
    else if (r < 0.14 && estado.vidas < VIDAS_MAX) nome = "coracao";

    if (nome) {
      estado.ultimoEspecial = estado.msJogo;
      const esp = ESPECIAIS[nome];
      const base = PITOS[esp.base];
      return { ...base, especial: nome, pontos: esp.pontos, cor: esp.cor, selo: esp.selo, vidaMult: esp.vida };
    }
  }
  return { ...PITOS[Math.floor(Math.random() * PITOS.length)], especial: null, vidaMult: 1 };
}

function criarPito() {
  const livres = SLOTS.filter((s) => ![...estado.pitos].some((p) => p.slotId === s.id));
  if (livres.length === 0) return;

  const slot = livres[Math.floor(Math.random() * livres.length)];
  const tipo = escolherTipo();
  estado.pitosCriados++;

  const el = document.createElement("div");
  el.className = "pito" + (tipo.especial ? " especial " + tipo.especial : "");
  el.style.left = slot.left;
  el.style.top  = slot.top;

  const img = document.createElement("img");
  img.src = tipo.img;
  img.draggable = false;
  el.appendChild(img);

  if (tipo.selo) {
    const selo = document.createElement("span");
    selo.className = "selo";
    selo.textContent = tipo.selo;
    el.appendChild(selo);
  }

  const pito = {
    el,
    slotId: slot.id,
    tipo,
    vida: Math.max(500, configNivel(estado.nivelAtual).tempoVida * tipo.vidaMult),
    tratado: false,
  };

  // zona de penalização: um círculo por olho
  tipo.olhos.forEach(([cx, cy, d]) => {
    const olho = document.createElement("div");
    olho.className = "olho";
    olho.style.width  = d + "%";
    olho.style.height = d + "%";
    olho.style.left   = (cx - d / 2) + "%";
    olho.style.top    = (cy - d / 2) + "%";
    olho.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      acertarOlho(pito);
    });
    el.appendChild(olho);
  });

  el.addEventListener("pointerdown", () => acertarPito(pito));

  $("game").appendChild(el);
  estado.pitos.add(pito);
}

function acertarPito(pito) {
  if (pito.tratado || !estado.jogoAtivo || estado.pausado || estado.nivelEmTransicao) return;
  pito.tratado = true;

  estado.combo++;
  estado.melhorCombo = Math.max(estado.melhorCombo, estado.combo);
  const mult = multiplicador();
  const valor = pito.tipo.pontos * mult;
  estado.pontos += valor;

  // efeitos do tipo
  let extra = "";
  switch (pito.tipo.especial) {
    case "relogio": {
      const cfg = configNivel(estado.nivelAtual);
      estado.tempoMs = Math.min(cfg.duracao * 1000, estado.tempoMs + 5000);
      extra = "+5s";
      sfx.tocar("relogio");
      break;
    }
    case "coracao":
      if (estado.vidas < VIDAS_MAX) estado.vidas++;
      extra = "+1 ❤";
      sfx.tocar("coracao");
      break;
    case "dourado":
      extra = "⭐";
      sfx.tocar("dourado");
      break;
    default:
      sfx.tocar("acerto", estado.combo > 1 ? Math.min(estado.combo, 12) : 0);
  }

  // subiu de multiplicador?
  const subiu = estado.combo % COMBO_PASSO === 0 && 1 + estado.combo / COMBO_PASSO <= MULT_MAX;
  if (subiu) {
    sfx.tocar("combo");
    mostrarMensagem("COMBO x" + mult + "!");
    vibrar([20, 30, 40]);
  } else {
    vibrar(pito.tipo.especial ? [15, 25, 25] : 15);
  }

  mostrarPontosVoadores(pito, valor, mult, extra);
  lancarPenas(pito, pito.tipo.cor, pito.tipo.especial ? 16 : 9);
  abanar(false);
  removerDepois(pito, "acertado", 180);
  atualizarHUD(true);
}

function acertarOlho(pito) {
  if (pito.tratado || !estado.jogoAtivo || estado.pausado || estado.nivelEmTransicao) return;
  pito.tratado = true;

  estado.vidas--;
  estado.combo = 0;
  estado.pontos -= pito.tipo.pontos;
  sfx.tocar("olho");
  vibrar([60, 40, 120]);
  mostrarPontosVoadores(pito, -pito.tipo.pontos, 1, "");
  mostrarMensagem("⚠ MAU! PRÓ OLHO NÃO!");
  lancarPenas(pito, "#ff4444", 6);
  abanar(true);
  piscarVermelho();
  removerDepois(pito, "acertado", 180);
  atualizarHUD(true);

  if (estado.vidas <= 0) {
    const sessao = estado.sessao;
    setTimeout(() => { if (sessao === estado.sessao) terminarJogo(); }, 450);
  }
}

function fugir(pito) {
  if (pito.tratado) return;
  pito.tratado = true;
  if (estado.combo >= 3) {
    mostrarMensagem("Fugiu! Combo perdido");
    sfx.tocar("fuga");
  }
  estado.combo = 0;
  removerDepois(pito, "a-sair", 220);
}

function removerDepois(pito, classe, ms) {
  pito.el.classList.add(classe);
  setTimeout(() => {
    pito.el.remove();
    estado.pitos.delete(pito);
  }, ms);
}

function limparPitos() {
  estado.pitos.forEach((p) => p.el.remove());
  estado.pitos.clear();
}

// ─── EFEITOS VISUAIS ──────────────────────────────────────────────────────────
function centroDe(el) {
  const r = el.getBoundingClientRect();
  const w = $("wrapper").getBoundingClientRect();
  return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2, h: r.height };
}

function mostrarPontosVoadores(pito, valor, mult, extra) {
  const c = centroDe(pito.el);
  const el = document.createElement("div");
  el.className = "pontos-voadores" + (valor > 0 ? " positivo" : " negativo");
  let txt = (valor > 0 ? "+" : "") + valor;
  if (mult > 1 && valor > 0) txt += " x" + mult;
  if (extra) txt += " " + extra;
  el.innerText = txt;
  el.style.left = c.x + "px";
  el.style.top  = (c.y - c.h / 4) + "px";
  if (mult > 1 && valor > 0) el.style.fontSize = "clamp(26px, 8vw, 42px)";
  $("wrapper").appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function lancarPenas(pito, cor, n) {
  const c = centroDe(pito.el);
  const wrapper = $("wrapper");
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "pena";
    p.style.left = c.x + "px";
    p.style.top  = c.y + "px";
    p.style.background = cor;
    p.style.setProperty("--dx",  (Math.random() * 2 - 1) * 100 + "px");
    p.style.setProperty("--dy",  (-20 - Math.random() * 100) + "px");
    p.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    wrapper.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

function abanar(forte) {
  const g = $("game");
  g.classList.remove("abana", "abana-forte");
  void g.offsetWidth;                       // reinicia a animação
  g.classList.add(forte ? "abana-forte" : "abana");
}

function piscarVermelho() {
  const f = $("flash");
  f.classList.remove("ativo");
  void f.offsetWidth;
  f.classList.add("ativo");
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
const hudCache = {};
function definir(id, valor) {
  if (hudCache[id] === valor) return;
  hudCache[id] = valor;
  $(id).innerText = valor;
}

function atualizarHUD(forcar = false) {
  definir("score", estado.pontos);
  definir("time",  Math.max(0, Math.ceil(estado.tempoMs / 1000)));
  definir("nivel", estado.nivelAtual + 1);
  definir("vidas", "🐣".repeat(Math.max(0, estado.vidas)));

  const mult = multiplicador();
  const combo = $("combo");
  if (estado.combo >= 2) {
    const txt = "COMBO " + estado.combo + (mult > 1 ? "  ·  x" + mult : "");
    if (hudCache.combo !== txt || forcar) {
      hudCache.combo = txt;
      combo.innerText = txt;
      combo.classList.add("visivel");
      combo.classList.remove("pulsa");
      void combo.offsetWidth;
      combo.classList.add("pulsa");
    }
  } else if (hudCache.combo !== "") {
    hudCache.combo = "";
    combo.classList.remove("visivel");
  }
}

// ─── MENSAGEM ─────────────────────────────────────────────────────────────────
let msgTimer = null;
function mostrarMensagem(texto) {
  const msg = $("mensagem");
  msg.innerText = texto;
  msg.style.display = "block";
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { msg.style.display = "none"; }, 1000);
}

// ─── RECORDE ──────────────────────────────────────────────────────────────────
function lerRecord() {
  try { return parseInt(localStorage.getItem("recordPito") || "0", 10) || 0; }
  catch (e) { return 0; }
}

function guardarRecord(v) {
  try { localStorage.setItem("recordPito", String(v)); } catch (e) { /* sem armazenamento */ }
}

function atualizarRecordMenu() {
  const r = lerRecord();
  const el = $("recordMenu");
  if (!el) return;
  el.innerText = r > 0 ? "🏆 Recorde: " + r + " pts" : "";
}

// ─── FIM DO JOGO ──────────────────────────────────────────────────────────────
function terminarJogo() {
  if (!estado.jogoAtivo) return;           // evita chamadas duplicadas
  estado.jogoAtivo = false;
  estado.sessao++;
  clearInterval(estado.loop);
  gameMusic.pause();
  limparPitos();
  sfx.tocar("fim");

  const recordAnterior = lerRecord();
  const novoRecord = estado.pontos > recordAnterior;
  if (novoRecord) guardarRecord(estado.pontos);
  const record = novoRecord ? estado.pontos : recordAnterior;

  $("finalScore").innerText     = estado.pontos;
  $("gameOverTitulo").innerText = "GAME OVER!";
  $("recordTexto").innerText    = novoRecord ? "🏆 Novo recorde!" : "🏆 Recorde: " + record + " pts";
  $("detalheTexto").innerText   = "Nível " + (estado.nivelAtual + 1) + "  ·  Melhor combo " + estado.melhorCombo;

  $("game").style.display     = "none";
  $("gameOver").style.display = "flex";
}

atualizarRecordMenu();
