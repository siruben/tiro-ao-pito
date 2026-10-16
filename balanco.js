// ═══════════════════════════════════════════════════════════════════════════════
//  EQUILÍBRIO DO JOGO
//  Tudo o que afeta a dificuldade está aqui: níveis, metas, estrelas, vidas, combos.
//  É partilhado entre o jogo (browser) e o simulador (Node: tools/simular.js).
// ═══════════════════════════════════════════════════════════════════════════════
(function (raiz) {
  const B = {};

  B.VIDAS_MAX   = 5;
  B.COMBO_PASSO = 5;   // de 5 em 5 acertos seguidos sobe o multiplicador
  B.MULT_MAX    = 5;

  // Os 3 primeiros níveis são fixos; depois a dificuldade sobe até um limite.
  B.NIVEIS = [
    { intervalo: 900, maxPitos: 2, duracao: 30, tempoVida: 2000 },
    { intervalo: 600, maxPitos: 3, duracao: 30, tempoVida: 1500 },
    { intervalo: 380, maxPitos: 4, duracao: 30, tempoVida: 1000 },
  ];

  // i = 0 para o nível 1
  B.configNivel = function (i) {
    if (i < B.NIVEIS.length) return B.NIVEIS[i];
    const extra = i - B.NIVEIS.length + 1;
    return {
      intervalo: Math.max(240, 380 - 25 * extra),
      maxPitos: 5,
      duracao: 30,
      tempoVida: Math.max(650, 1000 - 50 * extra),
    };
  };

  // Meta de pontos DESTE nível (não é cumulativa). Quem não a atinge perde.
  // i = 0 para o nível 1.
  B.metaNivel = function (i) {
    return Math.round((80 + 45 * i) / 10) * 10;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = B;
  else Object.assign(raiz, B);
})(typeof window !== "undefined" ? window : globalThis);
