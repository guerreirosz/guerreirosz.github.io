/* Natures recomendadas — ESTIMATIVA pelos atributos base.
   O jogo pesa cada IV de um jeito por espécie (ficha do Pokémon → "Peso do IV na nota")
   e a nature vale 30% da nota. Os pesos oficiais não estão na wiki, então aqui estimamos:
   - o atributo de ataque principal (Ataque ou At. Especial) pesa mais;
   - o ataque que a espécie não usa pesa ~0 (ex.: Ataque do Gengar);
   - Velocidade pesa menos em Pokémon de pouco ataque (suporte/defensivos).
   Conferido com os pesos reais de Jumpluff e Rhyperior e com os exemplos da wiki (Gengar, Chansey, Excadrill).
   A melhor nature sobe o atributo de maior peso e baixa o de menor peso. */
(function () {
  const STATS = ['atk', 'def', 'spa', 'spd', 'spe'];
  const NATURES = [
    ['Hardy', null, null], ['Lonely', 'atk', 'def'], ['Brave', 'atk', 'spe'], ['Adamant', 'atk', 'spa'], ['Naughty', 'atk', 'spd'],
    ['Bold', 'def', 'atk'], ['Docile', null, null], ['Relaxed', 'def', 'spe'], ['Impish', 'def', 'spa'], ['Lax', 'def', 'spd'],
    ['Timid', 'spe', 'atk'], ['Hasty', 'spe', 'def'], ['Serious', null, null], ['Jolly', 'spe', 'spa'], ['Naive', 'spe', 'spd'],
    ['Modest', 'spa', 'atk'], ['Mild', 'spa', 'def'], ['Quiet', 'spa', 'spe'], ['Bashful', null, null], ['Rash', 'spa', 'spd'],
    ['Calm', 'spd', 'atk'], ['Gentle', 'spd', 'def'], ['Sassy', 'spd', 'spe'], ['Careful', 'spd', 'spa'], ['Quirky', null, null],
  ];

  // pesos estimados (somam 100) a partir dos atributos base [hp, atk, def, spa, spd, spe]
  function estimateWeights(st) {
    const [hp, atk, def, spa, spd, spe] = st;
    const v = (b) => Math.max(0, b - 40);
    const w = { hp: v(hp) * 0.7, atk: v(atk), def: v(def), spa: v(spa), spd: v(spd), spe: v(spe) };
    const hi = Math.max(atk, spa), lo = Math.min(atk, spa);
    // o ataque que a espécie não usa não conta
    if (lo < hi * 0.75) { if (atk < spa) w.atk = 0; else w.spa = 0; }
    // o ataque principal pesa mais
    if (atk >= spa) w.atk *= 1.6; if (spa >= atk) w.spa *= 1.6;
    // velocidade importa menos para quem bate pouco
    if (hi < 100) w.spe *= 0.5;
    const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    for (const k in w) w[k] = Math.round(w[k] / sum * 100);
    return w;
  }

  // ordena as natures pela diferença (peso do que sobe − peso do que desce)
  // em empate, é melhor baixar o ataque que a espécie não usa do que a velocidade
  const unusedFirst = (w, n) => ((n.down === 'atk' || n.down === 'spa') && w[n.down] === 0 ? 1 : 0);
  function rankNatures(w) {
    return NATURES.filter((n) => n[1]).map(([name, up, down]) => ({ name, up, down, score: w[up] - w[down] }))
      .sort((a, b) => b.score - a.score || unusedFirst(w, b) - unusedFirst(w, a) || w[b.up] - w[a.up]);
  }

  function recommend(st) {
    const w = estimateWeights(st);
    const ranked = rankNatures(w);
    const best = ranked[0];
    // alternativas: 1) sobe o 2º atributo mais importante e baixa o mesmo; 2) sobe o mesmo e baixa outro inútil
    const ok = (n) => n && n !== best && n.score > 0 && n.score >= best.score * 0.4;
    const altA = ranked.find((n) => n.down === best.down && n.up !== best.up);
    const altB = ranked.find((n) => n.up === best.up && n.down !== best.down);
    let alts = [altA, altB].filter(ok);
    for (const n of ranked) { if (alts.length >= 2) break; if (ok(n) && !alts.includes(n)) alts.push(n); }
    const worst = ranked[ranked.length - 1];
    const order = STATS.slice().sort((a, b) => w[b] - w[a]);
    return { w, best, alts, worst, top: order.filter((k) => w[k] > 0).slice(0, 2), dump: order[order.length - 1] };
  }

  window.NATURES = { recommend, estimateWeights, rankNatures, LIST: NATURES };
})();
