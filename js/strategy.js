/* Motor de estratégia do boss da guilda: debuffers + 1 DPS.
   Usa a fórmula de dano padrão de Pokémon (a wiki diz que o motor de batalha segue as regras clássicas).
   Tudo aqui é estimativa para ORDENAR opções, não o número exato do jogo. */
(function () {
  const TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
  // CHART[atk][def] = multiplicador (só o que não é 1)
  const CHART = {
    normal:{rock:.5,ghost:0,steel:.5},
    fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
    water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
    electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
    grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
    ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
    fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
    poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
    ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
    flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
    psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
    bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
    rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
    ghost:{normal:0,psychic:2,ghost:2,dark:.5},
    dragon:{dragon:2,steel:.5,fairy:0},
    dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
    steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
    fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5},
  };
  const eff = (atk, defTypes) => defTypes.reduce((m, d) => m * (CHART[atk]?.[d] ?? 1), 1);
  const stageMul = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

  const STAT_PT = { 'Ataque': 'atk', 'Defesa': 'def', 'Ataque Especial': 'spa', 'Defesa Especial': 'spd', 'Velocidade': 'spe' };

  // ---------- leitura dos efeitos (texto da wiki) ----------
  function parseEffect(e) {
    const out = { drops: {}, raises: {}, status: null, flags: {} };
    for (const m of e.matchAll(/(?:^|\. )Derruba (\d+) níve(?:l|is) de (Ataque Especial|Defesa Especial|Ataque|Defesa|Velocidade) do alvo/g)) out.drops[STAT_PT[m[2]]] = +m[1];
    for (const m of e.matchAll(/(?:^|\. )Sobe (\d+) níve(?:l|is) de (Ataque Especial|Defesa Especial|Ataque|Defesa|Velocidade) do usuário/g)) out.raises[STAT_PT[m[2]]] = +m[1];
    if (/^100% de chance de queimar/.test(e)) out.status = 'burn';
    else if (/^100% de chance de paralisar/.test(e)) out.status = 'par';
    else if (/^100% de chance de envenenar/.test(e)) out.status = 'psn';
    else if (/envenena gravemente|veneno grave|Toxic/i.test(e) && /100%/.test(e)) out.status = 'tox';
    if (/Planta uma semente/.test(e)) out.status = 'seed';
    if (/amaldiçoar o alvo/.test(e)) out.status = 'curse';
    const f = out.flags;
    let mh = e.match(/Acerta de (\d+) a (\d+) vezes/); if (mh) f.multi = [+mh[1], +mh[2]];
    mh = e.match(/Acerta (\d+) vezes/); if (mh) f.multi = [+mh[1], +mh[1]];
    if (/PERDE o turno seguinte/.test(e)) f.recharge = 1;
    if (/Carrega no primeiro turno/.test(e)) f.charge = 1;
    if (/desmaia ao usar/.test(e)) f.selfko = 1;
    if (/Ataca sozinho por/.test(e)) f.rampage = 1;
    if (/Usa o Ataque do ALVO/.test(e)) f.foul = 1;
    if (/com a Defesa do usuário/.test(e)) f.bodypress = 1;
    if (/contra a Defesa física do alvo/.test(e)) f.psyshock = 1;
    if (/Ignora as mudanças de Defesa/.test(e)) f.ignoreDef = 1;
    // golpes que baixam o próprio ataque (Superpower, Draco Meteor…) perdem força ao repetir
    if (/Derruba \d+ níve(?:l|is) de Ataque do próprio usuário/.test(e)) f.selfAtk = 1;
    if (/Derruba \d+ níve(?:l|is) de Ataque Especial do próprio usuário/.test(e)) f.selfSpa = 1;
    if (/Nocaute em um golpe|Dano fixo|metade do HP atual|Reduz a vida do alvo|Devolve o dano|Nunca nocauteia|Só funciona no primeiro turno|Só funciona se o alvo estiver dormindo|acompanha a vida do alvo|MENOS vida|PESADO|usuário pesa|Trava o usuário|mais RÁPIDO|Poder dobrado se o alvo estiver com|Só funciona se o alvo for usar/.test(e)) f.unreliable = 1;
    return out;
  }

  // ---------- índices ----------
  let W, MOVES, SP, BYSLUG, BYID, MEGA_BY_BASE, OBTAIN;
  function init(wiki) {
    W = wiki;
    MOVES = W.moves.map((m, i) => {
      const [name, type, cat, power, acc, prio, effect, tm] = m;
      return { i, name, type, cat, power, acc: acc ?? 100, prio, effect, tm: !!tm, fx: parseEffect(effect || '') };
    });
    SP = W.species;
    BYSLUG = {}; BYID = {};
    for (const s of SP) { BYSLUG[s.slug] = s; BYID[s.id] = s; }
    MEGA_BY_BASE = {};
    for (const m of W.megas) { const id = parseInt(m.base); (MEGA_BY_BASE[id] ||= []).push(m); }
    // onde capturar: a própria espécie ou a pré-evolução mais próxima que aparece no mato
    OBTAIN = {};
    for (const s of SP) OBTAIN[s.slug] = findObtain(s);
  }
  function findObtain(s) {
    let cur = s, steps = 0;
    while (cur && steps < 4) {
      const best = [...cur.w].filter((w) => w[5] != null).sort((a, b) => b[5] - a[5])[0] || cur.w[0];
      if (best) return { via: cur, best, all: cur.w };
      if (/Lendário solto/.test(cur.wn || '')) return { via: cur, best: null, all: [], roaming: true };
      cur = cur.ef ? BYSLUG[cur.ef] || BYID[parseInt(cur.ef)] : null; steps++;
    }
    return null;
  }
  const moveByName = (name) => {
    const k = String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return MOVES.find((m) => m.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === k) || null;
  };
  // golpes que a espécie consegue ter no nível 100: por nível (≤100) + TM
  function learnset(s) {
    const map = new Map();
    for (const [lvl, i] of s.lm) if (lvl <= 100 && !map.has(i)) map.set(i, { lvl });
    for (const i of s.tm) if (!map.has(i)) map.set(i, { tm: true });
    return map;
  }

  // ---------- atributos no nível 100 ----------
  const IV = 20; // média razoável sem treino
  const statAt = (base, lvl, isHp) => isHp ? Math.floor((2 * base + IV) * lvl / 100) + lvl + 10 : Math.floor((2 * base + IV) * lvl / 100) + 5;
  function ourStats(s, lvl = 100) {
    const [hp, atk, def, spa, spd, spe] = s.st;
    return { hp: statAt(hp, lvl, 1), atk: statAt(atk, lvl), def: statAt(def, lvl), spa: statAt(spa, lvl), spd: statAt(spd, lvl), spe: statAt(spe, lvl) };
  }
  const normalAbility = (s) => (s.ab.find((a) => !a[1]) || s.ab[0] || [''])[0];

  function baseDamage(lvl, power, A, D) { return ((2 * lvl / 5 + 2) * power * A / D) / 50 + 2; }

  // ---------- dano do boss contra um dos nossos ----------
  function bossHitOn(boss, s, st, atkStage = 0) {
    let worst = null;
    for (const bm of boss.moves) {
      if (!bm || !bm.power || bm.cat === 'status') continue;
      const e = eff(bm.type, s.t);
      const A = (bm.cat === 'phys' ? boss.atk : boss.spa) * stageMul(atkStage);
      const D = bm.cat === 'phys' ? st.def : st.spd;
      const stab = boss.types.includes(bm.type) ? 1.5 : 1;
      const dmg = baseDamage(boss.level, bm.power, A, D) * stab * e;
      if (!worst || dmg > worst.dmg) worst = { move: bm, dmg, eff: e };
    }
    return worst;
  }
  function immunities(boss, s) {
    const out = [];
    for (const bm of boss.moves) {
      if (!bm || !bm.power || bm.cat === 'status') continue;
      const e = eff(bm.type, s.t);
      if (e === 0) out.push({ move: bm.name, kind: 'imune' });
      else if (e < 1) out.push({ move: bm.name, kind: 'resiste' });
      else if (e > 1) out.push({ move: bm.name, kind: 'fraco' });
    }
    return out;
  }

  // ---------- melhor golpe de dano de uma espécie contra o boss ----------
  function bestAttack(s, boss, opts) {
    const st = ourStats(s);
    const ab = normalAbility(s);
    const ls = learnset(s);
    let best = null;
    // setup: maior subida de Ataque / At. Especial que ela aprende
    let setupAtk = null, setupSpa = null;
    for (const [i, how] of ls) {
      const m = MOVES[i];
      if (m.cat !== 'status') continue;
      const r = m.fx.raises;
      if (r.atk && (!setupAtk || r.atk > setupAtk.n)) setupAtk = { n: r.atk, move: m, how };
      if (r.spa && (!setupSpa || r.spa > setupSpa.n)) setupSpa = { n: r.spa, move: m, how };
    }
    for (const [i, how] of ls) {
      const m = MOVES[i];
      if (m.cat === 'status' || !m.power || m.fx.flags.selfko || m.fx.flags.unreliable) continue;
      let type = m.type, power = m.power, mult = 1;
      // habilidades que mudam muito o dano
      if (m.type === 'normal' && /Pixilate|Refrigerate|Aerilate|Galvanize|Dragonize/.test(ab)) {
        type = { Pixilate: 'fairy', Refrigerate: 'ice', Aerilate: 'flying', Galvanize: 'electric', Dragonize: 'dragon' }[ab]; mult *= 1.2;
      }
      if (ab === 'Technician' && power <= 60) mult *= 1.5;
      const e = eff(type, boss.types);
      if (e === 0) continue;
      const stab = s.t.includes(type) ? (ab === 'Adaptability' ? 2 : 1.5) : 1;
      const physical = m.cat === 'phys' && !m.fx.flags.psyshock ? true : m.cat === 'phys';
      const useCat = m.cat; // categoria do golpe
      // atacante
      let A, atkStage = 0, setup = null;
      if (m.fx.flags.foul) { A = boss.atk; atkStage = 0; }
      else if (m.fx.flags.bodypress) { A = st.def; }
      else if (useCat === 'phys') { A = st.atk * (/Huge Power|Pure Power/.test(ab) ? 2 : 1); setup = setupAtk; }
      else { A = st.spa; setup = setupSpa; }
      if (setup && opts.setup) atkStage = 6;
      // defensor: debuff de Defesa / Def. Esp. aplicado pelos debuffers
      const defKey = useCat === 'phys' || m.fx.flags.psyshock ? 'def' : 'spd';
      const D = boss[defKey];
      const defStage = m.fx.flags.ignoreDef ? 0 : (opts.debuff ? -6 : 0);
      let hits = 1;
      if (m.fx.flags.multi) { const [a, b] = m.fx.flags.multi; hits = a === b ? a : (ab === 'Skill Link' ? b : (a === 2 && b === 5 ? 3.1 : (a + b) / 2)); }
      if (m.fx.flags.recharge || m.fx.flags.charge) mult *= 0.5;
      if (m.fx.flags.rampage) mult *= 0.85;
      if ((useCat === 'phys' && m.fx.flags.selfAtk) || (useCat === 'spec' && m.fx.flags.selfSpa)) mult *= 0.3;
      const acc = Math.min(m.acc, 100) / 100;
      const dmg = baseDamage(100, power, A * stageMul(atkStage), D * stageMul(defStage)) * stab * e * mult * hits * acc;
      if (!best || dmg > best.dmg) best = { move: m, how, type, dmg, eff: e, stab: stab > 1, cat: useCat, defKey, setup: setup && opts.setup ? setup : null, hits };
    }
    return best;
  }

  // ---------- debuffers ----------
  function debuffOptions(s, boss) {
    const ls = learnset(s);
    const out = { def: null, spd: null, atk: null, spa: null, spe: null, status: [] };
    for (const [i, how] of ls) {
      const m = MOVES[i];
      const d = m.fx.drops;
      // Captivate só funciona com gênero oposto: o gênero do boss não aparece, então não dá para contar com ele
      const isGuaranteed = (m.cat === 'status' || /^Derruba/.test(m.effect)) && !/gênero oposto/.test(m.effect);
      if (isGuaranteed) {
        for (const k of Object.keys(d)) {
          const cand = { move: m, n: d[k], how };
          if (!out[k] || d[k] > out[k].n || (d[k] === out[k].n && m.acc > out[k].move.acc)) out[k] = cand;
        }
      }
      if (m.fx.status && m.cat === 'status') {
        const st = m.fx.status;
        // imunidades de tipo do boss
        const bt = boss.types;
        if (st === 'burn' && bt.includes('fire')) continue;
        if (st === 'par' && (bt.includes('electric') || (m.type === 'electric' && eff('electric', bt) === 0))) continue;
        if ((st === 'psn' || st === 'tox') && (bt.includes('poison') || bt.includes('steel'))) continue;
        if (st === 'seed' && bt.includes('grass')) continue;
        if (st === 'curse' && !s.t.includes('ghost')) continue;
        out.status.push({ move: m, kind: st, how });
      }
    }
    return out;
  }

  // lendário/mítico: só aparece em covil (portal) ou como "lendário solto"
  function isLegendLike(s) {
    const o = OBTAIN[s.slug];
    if (!o) return false;
    if (o.roaming) return true;
    return o.all.length > 0 && o.all.every((w) => w[1] === 1);
  }

  // ---------- análise completa ----------
  function analyze(boss, opts = {}) {
    opts = { setup: true, debuff: true, onlyObtainable: true, owned: null, ...opts };
    const physPower = boss.moves.filter((m) => m && m.cat === 'phys').reduce((a, m) => a + (m.power || 0), 0);
    const specPower = boss.moves.filter((m) => m && m.cat === 'spec').reduce((a, m) => a + (m.power || 0), 0);
    const bossMain = physPower >= specPower ? 'atk' : 'spa';
    const bossBoosts = boss.moves.some((m) => m && Object.keys(m.fx.raises).length && /usuário/.test(m.effect));
    const bossHaze = boss.moves.some((m) => m && /Zera as mudanças/.test(m.effect));

    const dps = [], deb = [];
    for (const s of SP) {
      if (opts.onlyObtainable && !OBTAIN[s.slug]) continue;
      // pula formas que ainda evoluem (no nível 100 vai ser a forma final)
      if (opts.finalOnly !== false && s.et && s.et.length) continue;
      if (opts.noLegend && isLegendLike(s)) continue;
      const st = ourStats(s);
      const worst = bossHitOn(boss, s, st, 0);
      // depois que o debuffer baixa o ataque principal do boss (−6, mas ele pode subir de novo)
      const worstDeb = bossHitOn(boss, s, st, -4);
      const raw = (w) => (w && w.dmg > 0 ? st.hp / w.dmg : 99);
      const hitsToKo = Math.max(0, Math.floor(raw(worst)));
      const hitsDeb = Math.max(0, Math.floor(raw(worstDeb)));
      const bulk = raw(worstDeb); // número contínuo, para desempatar
      const hitPct = worst && st.hp ? worst.dmg / st.hp * 100 : 0;       // % da vida que um golpe tira
      const hitPctDeb = worstDeb && st.hp ? worstDeb.dmg / st.hp * 100 : 0;
      const surv = Math.min(bulk, 6) / 6;
      const atk = bestAttack(s, boss, opts);
      if (atk) {
        const score = atk.dmg * (0.5 + 0.5 * surv);
        dps.push({ s, st, atk, worst, hitsToKo, hitsDeb, bulk, hitPct, hitPctDeb, imm: immunities(boss, s), score, mega: MEGA_BY_BASE[s.id] || null, legend: isLegendLike(s) });
      }
      const d = debuffOptions(s, boss);
      if (d.def || d.spd || d.atk || d.spa || d.status.length) {
        deb.push({ s, st, d, worst, hitsToKo, hitsDeb, bulk, hitPct, hitPctDeb, bulkRaw: raw(worst), imm: immunities(boss, s), ab: normalAbility(s), legend: isLegendLike(s) });
      }
    }
    dps.sort((a, b) => b.score - a.score);
    const physDps = dps.filter((x) => x.atk.defKey === 'def');
    const specDps = dps.filter((x) => x.atk.defKey === 'spd');

    // um debuffer bom: aguenta mais golpes; Prankster faz o debuff sair antes
    // o debuffer age ANTES do ataque do boss baixar, então conta o bulk sem debuff
    const debScore = (x, key) => {
      const o = key === 'status' ? x.d.status[0] : x.d[key];
      if (!o) return -1;
      const turns = key === 'status' ? 1 : Math.ceil(6 / o.n);
      const acc = Math.min(o.move.acc, 100) / 100;
      const prank = x.ab === 'Prankster' ? 1.6 : 1;
      return (Math.min(x.bulkRaw, 4) + 0.2) * prank * acc / turns;
    };
    const rankDeb = (key) => deb.filter((x) => key === 'status' ? x.d.status.length : x.d[key]).map((x) => ({ ...x, key, score: debScore(x, key) })).sort((a, b) => b.score - a.score);

    const lists = { def: rankDeb('def'), spd: rankDeb('spd'), atk: rankDeb('atk'), spa: rankDeb('spa'), status: rankDeb('status') };

    // plano: escolher o melhor DPS (respeitando a box se informada) e os debuffers que combinam com ele
    const pick = (arr, used = new Set()) => {
      const pool = opts.owned && opts.owned.size ? arr.filter((x) => opts.owned.has(x.s.id)) : arr;
      return (pool.find((x) => !used.has(x.s.id)) || arr.find((x) => !used.has(x.s.id))) || null;
    };
    const used = new Set();
    const mainDps = pick(dps, used); if (mainDps) used.add(mainDps.s.id);
    const offKey = mainDps ? mainDps.atk.defKey : 'def';
    const offDeb = pick(lists[offKey], used); if (offDeb) used.add(offDeb.s.id);
    const defDeb = pick(lists[bossMain], used); if (defDeb) used.add(defDeb.s.id);
    const statusDeb = pick(lists.status.filter((x) => x.d.status.some((o) => (o.kind === 'burn' && bossMain === 'atk') || o.kind === 'par' || o.kind === 'tox' || o.kind === 'seed')), used);
    if (statusDeb) used.add(statusDeb.s.id);

    return { boss, bossMain, bossBoosts, bossHaze, dps, physDps, specDps, lists, plan: { mainDps, offDeb, defDeb, statusDeb, offKey } };
  }

  // ---------- capturas / farm ----------
  function obtain(s) { return OBTAIN[s.slug]; }

  window.STRAT = { init, analyze, eff, TYPES, CHART, moveByName, MOVES: () => MOVES, learnset, obtain, ourStats, MEGA_BY_BASE: () => MEGA_BY_BASE, parseEffect, normalAbility };
})();
