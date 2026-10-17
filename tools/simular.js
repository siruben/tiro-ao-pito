#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
//  Simulador do Tiro ao Pito: joga milhares de partidas com jogadores artificiais
//  para calibrar as metas de cada nível (balanco.js).
//
//  Uso:   node tools/simular.js pontos   -> pontos por nível de cada perfil
//         node tools/simular.js corridas -> até que nível chega cada perfil
//
//  As regras espelham o script.js (pontos, combos, especiais, vidas, tempos).
//  Se mudares as regras do jogo, muda também aqui.
// ═══════════════════════════════════════════════════════════════════════════════
"use strict";
const B = require("../balanco.js");

const PONTOS_BASE = [10, 5, 20, 15, 10];                 // pito, gordo, magro, careca, cabeludo
const ESPECIAIS = {
  dourado: { pontos: 50, vida: 0.7 },
  relogio: { pontos: 10, vida: 1.2 },
  coracao: { pontos: 10, vida: 1.2 },
};
const DT = 50;                                           // o jogo corre a cada 50 ms

// aviso: ms até o jogador reparar num pito; toque: ms entre decidir e tocar;
// olho: probabilidade de acertar no olho; falha: probabilidade de tocar ao lado
const PERFIS = {
  novato: { aviso: 330, toque: 1000, olho: 0.060, falha: 0.100 },
  fraco:  { aviso: 260, toque: 750, olho: 0.040, falha: 0.080 },
  medio:  { aviso: 210, toque: 560, olho: 0.025, falha: 0.050 },
  bom:    { aviso: 170, toque: 430, olho: 0.015, falha: 0.030 },
  otimo:  { aviso: 140, toque: 350, olho: 0.008, falha: 0.015 },
  super:  { aviso: 120, toque: 290, olho: 0.003, falha: 0.008 },
};

// ─── aleatório com semente (resultados repetíveis) ────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rng, media, desvio) {
  const u = 1 - rng(), v = rng();
  return media + desvio * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── um nível ─────────────────────────────────────────────────────────────────
function jogarNivel(jogo, i, P, rng) {
  const cfg = B.configNivel(i);
  let tempo = cfg.duracao * 1000;
  let proximoSpawn = 0;
  let t = 0;
  let pontosNivel = 0;
  let pitos = [];
  let ocupadoAte = 0;
  let acao = null;

  const mult = () => Math.min(B.MULT_MAX, 1 + Math.floor(jogo.combo / B.COMBO_PASSO));

  function escolherTipo() {
    if (jogo.criados > 4 && jogo.ms - jogo.ultimoEspecial > 7000) {
      const r = rng();
      let nome = null;
      if (r < 0.06) nome = "dourado";
      else if (r < 0.10) nome = "relogio";
      else if (r < 0.14 && jogo.vidas < B.VIDAS_MAX) nome = "coracao";
      if (nome) {
        jogo.ultimoEspecial = jogo.ms;
        return { especial: nome, pontos: ESPECIAIS[nome].pontos, vidaMult: ESPECIAIS[nome].vida };
      }
    }
    return { especial: null, pontos: PONTOS_BASE[Math.floor(rng() * 5)], vidaMult: 1 };
  }

  function criar() {
    if (pitos.length >= 5) return;                       // só há 5 ninhos
    const tipo = escolherTipo();
    jogo.criados++;
    pitos.push({
      tipo,
      vida: Math.max(500, cfg.tempoVida * tipo.vidaMult),
      tratado: false,
      removerEm: 0,
      visivelEm: t + Math.max(60, normal(rng, P.aviso, P.aviso * 0.25)),
    });
  }

  function acertar(p) {
    p.tratado = true; p.removerEm = t + 180;
    jogo.combo++;
    const valor = p.tipo.pontos * mult();
    pontosNivel += valor;
    if (p.tipo.especial === "relogio") tempo = Math.min(cfg.duracao * 1000, tempo + 5000);
    if (p.tipo.especial === "coracao" && jogo.vidas < B.VIDAS_MAX) jogo.vidas++;
  }
  function olho(p) {
    p.tratado = true; p.removerEm = t + 180;
    jogo.vidas--; jogo.combo = 0;
    pontosNivel -= p.tipo.pontos;
  }

  while (tempo > 0 && jogo.vidas > 0) {
    t += DT; jogo.ms += DT; tempo -= DT;

    proximoSpawn -= DT;
    if (proximoSpawn <= 0) {
      if (pitos.length < cfg.maxPitos) criar();
      proximoSpawn = cfg.intervalo;
    }

    for (const p of pitos) {
      if (p.tratado) continue;
      p.vida -= DT;
      if (p.vida <= 0) { p.tratado = true; p.removerEm = t + 220; jogo.combo = 0; }
    }
    pitos = pitos.filter((p) => !(p.tratado && t >= p.removerEm));

    // jogador
    if (acao && t >= acao.quando) {
      const p = acao.pito;
      if (!p.tratado) {
        const r = rng();
        if (r < P.falha) { /* tocou ao lado */ }
        else if (r < P.falha + P.olho) olho(p);
        else acertar(p);
      }
      acao = null;
    }
    if (!acao && t >= ocupadoAte) {
      // só vale a pena ir a pitos que ainda estarão lá quando o dedo chegar
      const toque = Math.max(120, normal(rng, P.toque, P.toque * 0.2));
      const alvos = pitos.filter((p) => !p.tratado && p.visivelEm <= t && p.vida > toque + DT);
      if (alvos.length) {
        const prio = (p) => (p.tipo.especial === "dourado" ? 0
          : p.tipo.especial === "coracao" && jogo.vidas < B.VIDAS_MAX ? 1
          : p.tipo.especial === "relogio" ? 2 : 3);
        alvos.sort((a, b) => prio(a) - prio(b) || a.vida - b.vida);
        acao = { pito: alvos[0], quando: t + toque };
        ocupadoAte = acao.quando;
      }
    }
  }
  return pontosNivel;
}

function novoJogo() {
  return { vidas: B.VIDAS_MAX, combo: 0, ms: 0, criados: 0, ultimoEspecial: -99999 };
}

const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

// ─── modos ────────────────────────────────────────────────────────────────────
function modoPontos(N = 300, NIV = 30) {
  console.log("Pontos feitos em cada nível (mediana [p10 – p90]), cada nível com 5 vidas e sem combo inicial\n");
  console.log("nível | meta  | " + Object.keys(PERFIS).map((k) => k.padEnd(18)).join(" "));
  for (let i = 0; i < NIV; i++) {
    const linhas = Object.entries(PERFIS).map(([nome, P], k) => {
      const v = [];
      for (let n = 0; n < N; n++) v.push(jogarNivel(novoJogo(), i, P, mulberry32(1000 * (k + 1) + n + i * 7)));
      return `${String(pct(v, 0.5)).padStart(5)} [${pct(v, 0.1)}–${pct(v, 0.9)}]`.padEnd(18);
    });
    console.log(String(i + 1).padStart(5), "|", String(B.metaNivel(i)).padStart(5), "|", linhas.join(" "));
  }
}

function modoCorridas(N = 400, MAX = 60) {
  console.log("Até que nível chega cada perfil (nível em que falha), " + N + " partidas cada\n");
  for (const [nome, P] of Object.entries(PERFIS)) {
    const falhou = [], motivos = { meta: 0, vidas: 0, fim: 0 };
    for (let n = 0; n < N; n++) {
      const rng = mulberry32(777 + n * 31 + nome.length);
      const jogo = novoJogo();
      let i = 0, motivo = "fim";
      for (; i < MAX; i++) {
        const pts = jogarNivel(jogo, i, P, rng);
        if (jogo.vidas <= 0) { motivo = "vidas"; break; }
        if (pts < B.metaNivel(i)) { motivo = "meta"; break; }
      }
      falhou.push(i + 1); motivos[motivo]++;
    }
    console.log(nome.padEnd(7),
      "mediana nível", String(pct(falhou, 0.5)).padStart(2),
      "| p10", String(pct(falhou, 0.1)).padStart(2),
      "| p90", String(pct(falhou, 0.9)).padStart(2),
      "| perdeu por meta", String(motivos.meta).padStart(3), "vidas", String(motivos.vidas).padStart(3), "chegou ao máx.", motivos.fim);
  }
}

if (require.main === module) {
  const modo = process.argv[2] || "pontos";
  if (modo === "pontos") modoPontos();
  else if (modo === "corridas") modoCorridas();
  else console.log("Uso: node tools/simular.js pontos|corridas");
}
module.exports = { jogarNivel, novoJogo, PERFIS, mulberry32 };
