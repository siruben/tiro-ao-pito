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
  B.BONUS_SEGUNDO = 5; // pontos de bónus por cada segundo que sobra ao cumprir a meta

  // A dificuldade sobe em DEGRAUS de 5 níveis (1-5, 6-10, 11-15…). Dentro de um
  // degrau a diferença entre níveis é pequena; o salto sente-se ao passar para o
  // degrau seguinte, e é maior a partir do nível 10.
  //   intervalo: ms entre pitos novos | tempoVida: ms que cada pito fica em cena
  B.NIVEIS_POR_DEGRAU = 5;
  B.DEGRAUS = [
    { intervalo: 900, maxPitos: 2, tempoVida: 2000 },   // níveis 1-5
    { intervalo: 800, maxPitos: 3, tempoVida: 1800 },   // níveis 6-10
    { intervalo: 500, maxPitos: 4, tempoVida: 1200 },   // níveis 11-15
    { intervalo: 390, maxPitos: 5, tempoVida: 1000 },   // níveis 16-20
    { intervalo: 320, maxPitos: 5, tempoVida: 880 },    // níveis 21-25
    { intervalo: 275, maxPitos: 5, tempoVida: 780 },    // níveis 26-30
    { intervalo: 250, maxPitos: 5, tempoVida: 720 },    // níveis 31-35
  ];
  B.PASSO_INTERVALO  = 8;    // ms a menos por cada nível dentro do degrau
  B.PASSO_TEMPO_VIDA = 15;

  // i = 0 para o nível 1
  B.configNivel = function (i) {
    const d = Math.floor(i / B.NIVEIS_POR_DEGRAU);
    const pos = i % B.NIVEIS_POR_DEGRAU;
    let base;
    if (d < B.DEGRAUS.length) {
      base = B.DEGRAUS[d];
    } else {
      // depois do último degrau, cada degrau novo aperta mais um pouco, até um limite
      const extra = d - B.DEGRAUS.length + 1;
      const ultimo = B.DEGRAUS[B.DEGRAUS.length - 1];
      base = {
        intervalo: Math.max(220, ultimo.intervalo - 20 * extra),
        maxPitos: ultimo.maxPitos,
        tempoVida: Math.max(650, ultimo.tempoVida - 40 * extra),
      };
    }
    return {
      intervalo: Math.max(200, base.intervalo - B.PASSO_INTERVALO * pos),
      maxPitos: base.maxPitos,
      duracao: 30,
      tempoVida: Math.max(600, base.tempoVida - B.PASSO_TEMPO_VIDA * pos),
    };
  };

  // Meta de pontos DESTE nível (não é cumulativa). Quem não a atinge perde.
  // i = 0 para o nível 1.
  // Até ao nível 10 a meta sobe 45 por nível; daí em diante sobe mais depressa.
  B.metaNivel = function (i) {
    const ate10 = Math.min(i, 9);
    const depois = Math.max(0, i - 9);
    return Math.round((80 + 45 * ate10 + 75 * depois) / 10) * 10;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = B;
  else Object.assign(raiz, B);
})(typeof window !== "undefined" ? window : globalThis);
