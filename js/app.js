/* Guerreiros Z — site da guilda. JavaScript puro, sem build. */
(function () {
  const W = window.WIKI;
  const S = window.STRAT;
  const SITE = { author: 'Guerreiros Z', authorRole: '', livepix: '', ...(window.SITE || {}) };
  S.init(W);
  const MOVES = S.MOVES();
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pctFmt = (n) => (n == null ? '—' : fmt(n, n < 0.1 ? 3 : n < 1 ? 2 : 1) + '%');

  // ---------- armazenamento local (tolerante a falhas) ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem('gz.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem('gz.' + k, JSON.stringify(v)); } catch {} },
  };
  let OWNED = new Set(store.get('owned', []));
  const toggleOwned = (id) => { OWNED.has(id) ? OWNED.delete(id) : OWNED.add(id); store.set('owned', [...OWNED]); };

  // ---------- tipos ----------
  const TI = {
    normal: ['Normal', '#9a9a7a'], fire: ['Fogo', '#ee7b30'], water: ['Água', '#5b8ef0'], electric: ['Elétrico', '#e8c020'],
    grass: ['Planta', '#5fbd45'], ice: ['Gelo', '#5cc8d0'], fighting: ['Lutador', '#c22e28'], poison: ['Veneno', '#a33ea1'],
    ground: ['Terra', '#d4a843'], flying: ['Voador', '#8f7ff0'], psychic: ['Psíquico', '#f95587'], bug: ['Inseto', '#9aae1a'],
    rock: ['Pedra', '#b6a136'], ghost: ['Fantasma', '#735797'], dragon: ['Dragão', '#6f35fc'], dark: ['Sombrio', '#6b5446'],
    steel: ['Aço', '#9a9ab8'], fairy: ['Fada', '#e47fc0'],
  };
  const tchip = (t) => `<span class="type" style="--c:${TI[t]?.[1] || '#666'}">${esc(TI[t]?.[0] || t)}</span>`;
  const tchips = (ts) => (ts || []).map(tchip).join(' ');
  const CAT = { phys: 'Físico', spec: 'Especial', status: 'Status' };
  const STAT_NAME = { atk: 'Ataque', def: 'Defesa', spa: 'At. Especial', spd: 'Def. Especial', spe: 'Velocidade' };
  const RAR = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico' };
  const rar = (r) => `<span class="rar-${esc(r)}">${esc(RAR[r] || r || '—')}</span>`;

  const BYSLUG = {}, BYID = {}, BYNAME = {};
  for (const s of W.species) { BYSLUG[s.slug] = s; BYID[s.id] = s; BYNAME[s.n.toLowerCase()] = s; }
  const ROUTE = {};
  for (const r of W.routes) ROUTE[r.slug] = r;
  // portais não listam as espécies na página deles: montamos a partir das espécies
  for (const s of W.species) for (const w of s.w) {
    const r = ROUTE[w[0]];
    if (r && !r.s.length && w[1] === 1) { (r._portal ||= []).push([s.slug, w[3], w[4], w[5]]); }
  }
  const spawnsOf = (r) => (r.s.length ? r.s : r._portal || []);

  const spr = (s, cls = '') => s ? `<span class="spr ${cls}" role="img" aria-label="${esc(s.n)}" style="background-image:url(https://idledex.com/sprites/poke/${esc(s.sp)}.png)"></span>` : '';
  const monLink = (s) => `<a href="#/dex/${esc(s.slug)}">${esc(s.n)}</a>`;
  const routeLink = (slug, name) => ROUTE[slug] ? `<a href="#/rotas/${esc(slug)}">${esc(name || ROUTE[slug].n)}</a>` : esc(name || slug);

  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  // ---------- horário de Brasília ----------
  const BRT = -3;
  const brtNow = () => new Date(Date.now() + BRT * 3600e3); // ler com getUTC*
  const brtToMs = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo, d, h, mi) - BRT * 3600e3;
  function nextDaily() { const b = brtNow(); return brtToMs(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + 1); }
  function nextWeekday(dow, h) { // dow: 0=domingo
    const b = brtNow();
    let add = (dow - b.getUTCDay() + 7) % 7;
    let t = brtToMs(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + add, h);
    if (t <= Date.now()) t = brtToMs(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + add + 7, h);
    return t;
  }
  function megaBossState() {
    const b = brtNow();
    if (b.getUTCDay() === 6 && b.getUTCHours() >= 15 && b.getUTCHours() < 18) return { live: true, until: brtToMs(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 18) };
    return { live: false, at: nextWeekday(6, 15) };
  }
  function nextMonthStart() { const b = brtNow(); return brtToMs(b.getUTCFullYear(), b.getUTCMonth() + 1, 1); }
  function countdown(ms) {
    let s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    return (d ? d + 'd ' : '') + String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
  }
  let tickers = [];
  setInterval(() => tickers.forEach((f) => f()), 1000);

  // =====================================================================
  // INÍCIO
  // =====================================================================
  function pageHome() {
    const boss = currentBoss();
    const sp = BYNAME[boss.species.toLowerCase()];
    const nRoutes = W.routes.filter((r) => r.k === 'route').length;
    app.innerHTML = `
    <section class="hero page">
      ${Array.from({ length: 9 }, (_, i) => `<i class="aura" style="left:${8 + i * 10}%;bottom:-10px;animation-delay:${(i * 0.7) % 6}s"></i>`).join('')}
      <div class="kicker">Guilda PvE · idleDEX</div>
      <h1>Somos os <span>Guerreiros Z</span></h1>
      <p class="lead">Uma guilda de quem cresceu com Pokémon e joga pela nostalgia, sem deixar de bater forte. Aqui o foco é PvE: boss da guilda, Mega Boss, raids e caçadas. E ninguém fica para trás.</p>
      <div class="row">
        <a class="btn primary" href="#/boss">⚔️ Estratégia do boss de hoje</a>
        <a class="btn" href="#/dex">🔎 Onde pego um Pokémon?</a>
      </div>
      <div class="stat-strip">
        <div><b>${W.species.length}</b><span>espécies na Pokédex</span></div>
        <div><b>${nRoutes}</b><span>rotas mapeadas</span></div>
        <div><b>${W.megas.length}</b><span>formas Mega</span></div>
        <div><b>1×</b><span>boss da guilda por dia</span></div>
      </div>
    </section>

    <section class="mt2">
      <div class="search-wrap" id="gsearch">
        <span class="ico">🔍</span>
        <input type="search" id="gq" placeholder="Busque um Pokémon, item ou rota… (ex.: Mawile, Ice Stone, Rota 150)" autocomplete="off">
        <div class="results hidden" id="gres"></div>
      </div>
    </section>

    <section class="grid g2 mt2">
      <div class="card">
        <div class="kicker">Boss da guilda de hoje</div>
        <div class="row" style="gap:16px">
          ${spr(sp, 'lg')}
          <div>
            <div class="boss-name">[BOSS] ${esc(boss.species)}</div>
            <div class="row" style="margin:6px 0">${tchips(boss.types)} <span class="chip z">Modo ${esc(boss.mode)}</span></div>
            <div class="small dim">Ataque ${fmt(boss.atk)} · Defesa ${fmt(boss.def)} · Def. Esp. ${fmt(boss.spd)}</div>
          </div>
        </div>
        <div id="homePlan" class="mt"></div>
        <a class="btn primary mt" href="#/boss">Ver plano completo →</a>
      </div>
      <div class="card">
        <div class="kicker">Agenda da semana (horário de Brasília)</div>
        <div class="grid g2" style="gap:10px">
          <div class="timer" id="tMega"><span class="small dim">Mega Boss de sábado</span><span class="t">…</span><span class="tiny dim">sáb 15h–18h, se a barra de silver encher</span></div>
          <div class="timer" id="tDaily"><span class="small dim">Novo dia (boss e Guild War)</span><span class="t">…</span><span class="tiny dim">vira à meia-noite</span></div>
          <div class="timer" id="tShop"><span class="small dim">Nova vitrine da loja da guilda</span><span class="t">…</span><span class="tiny dim">toda segunda, 00:00</span></div>
          <div class="timer" id="tMonth"><span class="small dim">Moedas de contribuição zeram</span><span class="t">…</span><span class="tiny dim">dia 1º de cada mês</span></div>
        </div>
        <p class="tiny dim mt">Use as moedas de contribuição antes do dia 1º. O que você já comprou fica.</p>
      </div>
    </section>

    <section class="mt3">
      <div class="section-head"><div><div class="kicker">Quem somos</div><h2>Uma guilda para jogar junto</h2></div></div>
      <div class="grid g3">
        <div class="card"><h3>🤝 Ajuda mútua</h3><p>Dúvida de rota, de time ou de item? Pergunte no grupo. Quem já passou por aquilo explica, e o que a gente aprende vira página aqui no site.</p></div>
        <div class="card"><h3>🕹️ Nostalgia em primeiro lugar</h3><p>Muita gente aqui voltou por causa de Kanto, Johto e companhia. Completar a Dex, achar aquele shiny da infância e montar o time dos sonhos também contam como progresso.</p></div>
        <div class="card"><h3>🔥 PvE com estratégia</h3><p>Boss da guilda todo dia, Mega Boss no sábado, raids e World Boss. A gente estuda cada luta para tirar o máximo de pontos sem gastar à toa.</p></div>
      </div>
      <div class="card mt">
        <div class="row between"><h3 style="margin:0">Combinados da casa</h3><span class="chip">Liderança PvP no ranking, guilda PvE no coração</span></div>
        <div class="grid g2 mt small">
          <div>✅ Faça sua tentativa diária no boss da guilda. É contribuição para a loja de todos.</div>
          <div>✅ Doe silver para a barra do Mega Boss quando puder. Se encher, todo mundo ganha Mega Token.</div>
          <div>✅ Upou um Pokémon da lista do boss? Marque "tenho no 100" no site para a guilda saber.</div>
          <div>✅ Novato pergunta, veterano responde. Sem julgamento.</div>
        </div>
      </div>
    </section>

    <section class="mt3">
      <div class="card credit">
        <div class="credit-ava">🛠️</div>
        <div style="flex:1;min-width:220px">
          <div class="kicker">Quem fez o site</div>
          <h3 style="margin:0">Feito por <span class="nick">${esc(SITE.author)}</span></h3>
          <p class="small dim" style="margin:6px 0 0">${esc(SITE.authorRole)}. Montei este site para a guilda parar de procurar as mesmas coisas na wiki toda hora. Achou um erro ou tem uma ideia? Me chama no jogo ou no grupo da guilda.</p>
        </div>
        ${SITE.livepix ? `<a class="btn primary" href="${esc(SITE.livepix)}" target="_blank" rel="noopener">☕ Apoie o site</a>` : ''}
      </div>
      ${SITE.livepix ? '<p class="tiny dim mt">Apoio 100% opcional: ajuda a manter o site no ar e não libera nada a mais. Tudo continua aberto para todo mundo.</p>' : ''}
    </section>

    <section class="mt3">
      <div class="section-head"><div><div class="kicker">Ferramentas</div><h2>O que tem no site</h2></div><p>Tudo vem dos dados da wiki oficial.</p></div>
      <div class="grid g4">
        <a class="tile" href="#/boss"><span class="em">⚔️</span><b>Boss da guilda</b><span>Debuffers + DPS, time ideal e lista do que upar.</span></a>
        <a class="tile" href="#/dex"><span class="em">🔎</span><b>Onde pego?</b><span>Rotas ordenadas pela maior chance de encontro.</span></a>
        <a class="tile" href="#/itens"><span class="em">💎</span><b>Itens e farm</b><span>Pedras, fragmentos, placas e charms: a melhor rota para cada um.</span></a>
        <a class="tile" href="#/rotas"><span class="em">🗺️</span><b>Rotas</b><span>Quem aparece, requisitos e bônus de XP de cada mapa.</span></a>
        <a class="tile" href="#/mega"><span class="em">🧬</span><b>Mega</b><span>Mega Boss de sábado, loja de pedras e as ${W.megas.length} formas.</span></a>
        <a class="tile" href="#/shiny"><span class="em">✨</span><b>Shiny</b><span>Calculadora da escada do Shiny Boost.</span></a>
        <a class="tile" href="#/guerra"><span class="em">🏴</span><b>Guild War</b><span>Resumo rápido de Influence e pontos.</span></a>
        <a class="tile" href="https://wiki.idledex.com/" target="_blank" rel="noopener"><span class="em">📖</span><b>Wiki oficial</b><span>A fonte de todos os números.</span></a>
      </div>
    </section>`;

    // mini-plano do boss
    try {
      const r = S.analyze(bossObj(boss), { owned: OWNED, noLegend: true });
      const p = r.plan;
      const li = [];
      if (p.defDeb) li.push(`<li>${spr(p.defDeb.s, 'sm')} <b>${esc(p.defDeb.s.n)}</b> baixa o ${STAT_NAME[r.bossMain]} do boss</li>`);
      if (p.offDeb) li.push(`<li>${spr(p.offDeb.s, 'sm')} <b>${esc(p.offDeb.s.n)}</b> baixa a ${STAT_NAME[p.offKey]}</li>`);
      if (p.mainDps) li.push(`<li>${spr(p.mainDps.s, 'sm')} <b>${esc(p.mainDps.s.n)}</b> bate com ${esc(cap(p.mainDps.atk.move.name))} até o fim</li>`);
      $('#homePlan').innerHTML = `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">${li.map((x) => x.replace('<li>', '<li class="row" style="gap:8px">')).join('')}</ul>`;
    } catch (e) { console.error(e); }

    const setT = (id, label, ms, live) => { const el = $('#' + id); if (!el) return; el.classList.toggle('live', !!live); $('.t', el).textContent = label || countdown(ms); };
    const tick = () => {
      const mb = megaBossState();
      if (mb.live) setT('tMega', 'AO VIVO · ' + countdown(mb.until), 0, true); else setT('tMega', null, mb.at);
      setT('tDaily', null, nextDaily()); setT('tShop', null, nextWeekday(1, 0)); setT('tMonth', null, nextMonthStart());
    };
    tickers.push(tick); tick();
    globalSearch($('#gq'), $('#gres'));
  }

  // ---------- busca global ----------
  const ITEMS = buildItems();
  function globalSearch(input, box) {
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let hl = -1;
    const render = () => {
      const q = norm(input.value.trim());
      if (q.length < 2) { box.classList.add('hidden'); return; }
      const res = [];
      for (const s of W.species) if (norm(s.n).includes(q)) res.push(`<a href="#/dex/${s.slug}">${spr(s, 'sm')}<span>${esc(s.n)}</span><span class="kind">Pokémon</span></a>`);
      for (const it of Object.values(ITEMS)) if (norm(it.name).includes(q)) res.push(`<a href="#/itens/${it.slug}"><img src="${esc(it.img)}" width="28" height="28" style="image-rendering:pixelated" alt=""><span>${esc(it.name)}</span><span class="kind">Item</span></a>`);
      for (const r of W.routes) if (norm(r.n).includes(q)) res.push(`<a href="#/rotas/${r.slug}"><span class="em">🗺️</span><span>${esc(r.n)}</span><span class="kind">${r.k === 'portal' ? 'Portal' : 'Rota'}</span></a>`);
      box.innerHTML = res.slice(0, 30).join('') || '<div class="muted-box">Nada encontrado.</div>';
      box.classList.remove('hidden'); hl = -1;
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      const links = $$('a', box);
      if (e.key === 'ArrowDown') { hl = Math.min(links.length - 1, hl + 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); e.preventDefault(); }
      else if (e.key === 'Enter') { (links[hl] || links[0])?.click(); return; }
      links.forEach((a, i) => a.classList.toggle('hl', i === hl));
    });
    document.addEventListener('click', (e) => { if (!box.contains(e.target) && e.target !== input) box.classList.add('hidden'); }, { once: false });
  }
  const cap = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

  // =====================================================================
  // BOSS DA GUILDA
  // =====================================================================
  function allBosses() { return [...window.GUILD_BOSSES, ...store.get('bosses', [])]; }
  function currentBoss() {
    const shared = sharedBossFromHash();
    if (shared) return shared;
    const id = store.get('bossId', null);
    const list = allBosses();
    return list.find((b) => b.id === id) || list[list.length - 1] || window.GUILD_BOSSES[0];
  }
  function bossObj(b) {
    const moves = b.moves.map((n) => S.moveByName(n)).filter(Boolean);
    return { name: b.species, level: +b.level || 100, types: b.types, atk: +b.atk, def: +b.def, spa: +b.spa, spd: +b.spd, spe: +b.spe, moves };
  }
  function encodeBoss(b) { return btoa(unescape(encodeURIComponent(JSON.stringify(b)))).replace(/=+$/, ''); }
  function sharedBossFromHash() {
    const m = location.hash.match(/[?&]b=([^&]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch { return null; }
  }

  const bossOpts = store.get('bossOpts', { setup: true, debuff: true, noLegend: true, onlyOwned: false });

  function pageBoss() {
    const b = currentBoss();
    const bo = bossObj(b);
    const sp = BYNAME[b.species.toLowerCase()];
    const list = allBosses();
    const r = S.analyze(bo, { ...bossOpts, owned: OWNED });
    const filt = (arr) => (bossOpts.onlyOwned && OWNED.size ? arr.filter((x) => OWNED.has(x.s.id)) : arr);
    const p = r.plan;

    const moveRow = (m, raw) => m
      ? `<div class="bmove">${tchip(m.type)} <b>${esc(cap(m.name))}</b> <span class="tiny dim">${CAT[m.cat]}</span><span class="r">${m.power ?? '—'} · ${m.acc > 100 ? '∞' : (m.acc ?? '—') + '%'}</span></div>`
      : `<div class="bmove"><span class="chip bad">não achei "${esc(raw)}" na wiki</span></div>`;

    app.innerHTML = `
    <div class="page">
      <div class="section-head">
        <div><div class="kicker">Boss da guilda</div><h2>Estratégia automática</h2><p>Debuffers primeiro, depois 1 DPS batendo até o tempo acabar.</p></div>
        <div class="row">
          <select id="bossSel" style="width:auto">${list.map((x) => `<option value="${esc(x.id)}" ${x.id === b.id ? 'selected' : ''}>${esc(x.species)} · ${esc(x.mode)}${x.seen ? ' · ' + esc(x.seen) : ''}</option>`).join('')}</select>
          <button class="btn sm" id="newBossBtn">＋ Cadastrar boss do dia</button>
          <button class="btn sm" id="shareBtn">🔗 Compartilhar</button>
        </div>
      </div>

      <div id="bossForm" class="card hidden"></div>

      <div class="grid g2">
        <div class="card">
          <div class="boss-card">
            ${spr(sp, 'lg')}
            <div>
              <div class="boss-name">[BOSS] ${esc(b.species)}</div>
              <div class="small dim">Nível ${esc(b.level)} · modo ${esc(b.mode)}${b.pointsMult ? ' · pontos ×' + fmt(b.pointsMult, 1) : ''}</div>
              <div class="row" style="margin-top:6px">${tchips(b.types)}</div>
            </div>
          </div>
          <div class="bstats">${['atk', 'def', 'spa', 'spd', 'spe'].map((k) => `<div><span>${STAT_NAME[k]}</span><b>${fmt(b[k])}</b></div>`).join('')}</div>
          <div class="mt">${b.moves.map((n) => moveRow(S.moveByName(n), n)).join('')}</div>
          ${b.notes ? `<p class="tiny dim mt">${esc(b.notes)}</p>` : ''}
        </div>
        <div class="card">
          <h3>Leitura rápida do boss</h3>
          ${bossReading(bo, r)}
        </div>
      </div>

      <div class="card mt">
        <div class="row between"><h3 style="margin:0">Opções</h3><span class="tiny dim">${OWNED.size} Pokémon marcados como "tenho no 100"</span></div>
        <div class="row mt">
          ${opt('setup', 'DPS usa golpe de preparo (Swords Dance, Calm Mind…)')}
          ${opt('debuff', 'Debuffers levam a defesa do boss a −6')}
          ${opt('noLegend', 'Esconder lendários e míticos')}
          ${opt('onlyOwned', 'Rankings só com os meus')}
        </div>
      </div>

      <section class="mt2">
        <div class="section-head"><div><div class="kicker">Plano de luta</div><h2>Ordem de ação</h2></div><p>A ordem segue o que a guilda já faz: debuff primeiro e depois DPS até o fim.</p></div>
        <div class="plan">${planSteps(r, b)}</div>
      </section>

      <section class="mt2">
        <div class="section-head"><div><div class="kicker">Time sugerido</div><h2>Quem levar</h2></div><p>Marque quem você já tem no nível 100: o plano passa a preferir os seus.</p></div>
        <div class="grid g2">${teamCards(r)}</div>
      </section>

      <section class="mt2">
        <div class="section-head"><div><div class="kicker">Rankings</div><h2>Todas as opções</h2></div><p>Clique num Pokémon para ver onde capturar.</p></div>
        <div class="tabs" id="rankTabs">
          <button data-k="dps" class="on">🔥 DPS</button>
          <button data-k="atk">🛡️ Baixar Ataque</button>
          <button data-k="spa">🛡️ Baixar At. Esp.</button>
          <button data-k="def">⚔️ Baixar Defesa</button>
          <button data-k="spd">⚔️ Baixar Def. Esp.</button>
          <button data-k="status">💫 Status</button>
        </div>
        <div id="rankBox"></div>
      </section>

      <section class="mt2">
        <div class="section-head"><div><div class="kicker">Lista para upar</div><h2>O que levar ao nível 100</h2></div><p>Os melhores de cada papel que você ainda não marcou, e onde capturar cada um.</p></div>
        ${levelList(r)}
      </section>

      <div class="muted-box mt2">
        <b>Como o site calcula:</b> usa a fórmula de dano clássica de Pokémon, os atributos base da wiki, nível 100 e IV médio, sem EV nem natureza. Os golpes considerados são os que a espécie aprende até o nível 100 e por TM.
        Os números servem para <b>comparar</b> opções, não são o dano exato do jogo. A wiki não publica a fórmula do boss nem a habilidade dele.
        Lendários e míticos podem ser mostrados desmarcando a opção acima.
      </div>
    </div>`;

    // eventos
    $('#bossSel').onchange = (e) => { store.set('bossId', e.target.value); if (location.hash.includes('b=')) location.hash = '#/boss'; else route(); };
    $('#newBossBtn').onclick = () => openBossForm(b);
    $('#shareBtn').onclick = () => {
      const url = location.href.split('#')[0] + '#/boss?b=' + encodeBoss(b);
      navigator.clipboard?.writeText(url).then(() => toast('Link copiado! Mande no grupo da guilda.'), () => prompt('Copie o link:', url));
    };
    $$('[data-opt]').forEach((el) => el.onchange = () => { bossOpts[el.dataset.opt] = el.checked; store.set('bossOpts', bossOpts); route(); });
    $$('.owned-btn').forEach(bindOwned);
    const showRank = (k) => {
      $$('#rankTabs button').forEach((x) => x.classList.toggle('on', x.dataset.k === k));
      $('#rankBox').innerHTML = k === 'dps' ? rankDps(filt(r.dps).slice(0, 30)) : rankDeb(filt(r.lists[k]).slice(0, 25), k);
      $$('#rankBox .owned-btn').forEach(bindOwned);
    };
    $$('#rankTabs button').forEach((x) => x.onclick = () => showRank(x.dataset.k));
    showRank('dps');
  }
  function opt(k, label) { return `<label class="toggle"><input type="checkbox" data-opt="${k}" ${bossOpts[k] ? 'checked' : ''}> ${esc(label)}</label>`; }
  function bindOwned(el) {
    el.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const id = +el.dataset.id; toggleOwned(id); $$(`.owned-btn[data-id="${id}"]`).forEach((x) => { x.classList.toggle('on', OWNED.has(id)); x.textContent = OWNED.has(id) ? '✓ tenho no 100' : 'tenho no 100?'; }); };
  }
  const hitTxt = (p) => p <= 0 ? 'não leva dano dos golpes dele' : p >= 100 ? `um golpe do boss derruba (~${fmt(p)}% da vida)` : `um golpe do boss tira ~${fmt(p)}% da vida`;
  const ownedBtn = (s) => `<button class="owned-btn ${OWNED.has(s.id) ? 'on' : ''}" data-id="${s.id}">${OWNED.has(s.id) ? '✓ tenho no 100' : 'tenho no 100?'}</button>`;

  function bossReading(bo, r) {
    const weak = [], resist = [], immune = [];
    for (const t of S.TYPES) { const e = S.eff(t, bo.types); if (e === 0) immune.push(t); else if (e > 1) weak.push([t, e]); else if (e < 1) resist.push([t, e]); }
    weak.sort((a, b) => b[1] - a[1]);
    const safe = [], danger = new Set();
    for (const t of S.TYPES) {
      let worst = 0, any = false;
      for (const m of bo.moves) if (m.power) { any = true; worst = Math.max(worst, S.eff(m.type, [t])); }
      if (any && worst === 0) safe.push([t, 'imune a todos os golpes de dano']);
      else if (any && worst < 1) safe.push([t, 'resiste a todos os golpes de dano']);
      for (const m of bo.moves) if (m.power && S.eff(m.type, [t]) > 1) danger.add(t);
    }
    const cats = bo.moves.filter((m) => m.power).map((m) => m.cat);
    const warn = [];
    if (r.bossBoosts) warn.push('Ele tem golpe que <b>sobe os próprios atributos</b> (' + bo.moves.filter((m) => Object.keys(m.fx.raises).length).map((m) => esc(cap(m.name))).join(', ') + '). Depois de 2 usos, repita o debuff de Ataque.');
    if (r.bossHaze) warn.push('Ele tem golpe que <b>zera os atributos</b>: os debuffs podem sumir. Fique de olho.');
    if (bo.moves.some((m) => m.fx.flags.recharge)) warn.push('Depois de ' + bo.moves.filter((m) => m.fx.flags.recharge).map((m) => esc(cap(m.name))).join(', ') + ' ele <b>perde o turno seguinte</b>: é a melhor hora para preparar (Swords Dance etc.).');
    return `
      <p class="small"><b>Fraco a:</b> ${weak.map(([t, e]) => tchip(t) + ` <span class="tiny dim">×${e}</span>`).join(' ') || '—'}</p>
      <p class="small"><b>Resiste a:</b> ${resist.map(([t, e]) => tchip(t) + ` <span class="tiny dim">×${e}</span>`).join(' ') || '—'}</p>
      ${immune.length ? `<p class="small"><b>Imune a:</b> ${immune.map(tchip).join(' ')} <span class="tiny dim">não usem golpes desses tipos</span></p>` : ''}
      <p class="small"><b>Ataques dele:</b> ${cats.filter((c) => c === 'phys').length} físico(s), ${cats.filter((c) => c === 'spec').length} especial(is). Principal: <b>${STAT_NAME[r.bossMain]}</b>.</p>
      <p class="small"><b>Tipos que aguentam bem:</b> ${safe.map(([t]) => tchip(t)).join(' ') || '—'}</p>
      ${warn.map((w) => `<p class="small">⚠️ ${w}</p>`).join('')}
      <p class="tiny dim">Se o boss for um Dragonite, ele pode ter <b>Multiscale</b> (metade do dano com HP cheio). O primeiro golpe tira menos. Golpes de vários acertos ajudam.</p>`;
  }

  const howTxt = (how) => (how?.tm ? 'TM' : how?.lvl != null ? (how.lvl <= 1 ? 'já sabe' : 'Nv ' + how.lvl) : '');
  function planSteps(r, b) {
    const p = r.plan, out = [];
    const uses = (o) => Math.ceil(6 / o.n);
    if (p.defDeb) {
      const o = p.defDeb.d[r.bossMain];
      out.push(`<div class="step"><div><b>Debuff para proteger o time: ${esc(p.defDeb.s.n)}</b> usa <b>${esc(cap(o.move.name))}</b> ${uses(o)}× <span class="dim">(${howTxt(o.how)})</span>.<br><span class="small dim">Leva o ${STAT_NAME[r.bossMain]} do boss a −6. Seus Pokémon passam a aguentar bem mais golpes. ${p.defDeb.ab === 'Prankster' ? 'Com Prankster, o golpe sai antes do boss.' : ''}</span></div></div>`);
    }
    if (p.offDeb) {
      const o = p.offDeb.d[p.offKey];
      out.push(`<div class="step"><div><b>Debuff para o DPS bater mais: ${esc(p.offDeb.s.n)}</b> usa <b>${esc(cap(o.move.name))}</b> ${uses(o)}× <span class="dim">(${howTxt(o.how)})</span>.<br><span class="small dim">Leva a ${STAT_NAME[p.offKey]} do boss a −6: o DPS passa a causar <b>4× mais dano</b>.</span></div></div>`);
    }
    if (p.statusDeb) {
      const o = p.statusDeb.d.status[0];
      const what = { burn: 'queimadura: corta o dano físico dele', par: 'paralisia: ele às vezes perde o turno', psn: 'veneno: tira vida todo turno', tox: 'veneno forte', seed: 'Leech Seed: tira vida todo turno', curse: 'maldição: tira 1/4 da vida por turno' }[o.kind] || o.kind;
      out.push(`<div class="step"><div><b>Opcional: ${esc(p.statusDeb.s.n)}</b> usa <b>${esc(cap(o.move.name))}</b> <span class="dim">(${howTxt(o.how)})</span>.<br><span class="small dim">${esc(what)}. Vale testar se funciona no boss.</span></div></div>`);
    }
    if (p.mainDps) {
      const a = p.mainDps.atk;
      const setup = a.setup ? `usa <b>${esc(cap(a.setup.move.name))}</b> ${Math.ceil(6 / a.setup.n)}× <span class="dim">(${howTxt(a.setup.how)})</span>, depois ` : '';
      out.push(`<div class="step"><div><b>DPS: ${esc(p.mainDps.s.n)}</b> ${setup}usa <b>${esc(cap(a.move.name))}</b> ${tchip(a.type)} <span class="dim">(${howTxt(a.how)})</span> até o tempo acabar.<br><span class="small dim">${a.eff >= 4 ? 'Super efetivo ×4!' : a.eff >= 2 ? 'Super efetivo ×2.' : ''} ${a.stab ? 'Golpe do mesmo tipo do Pokémon (bônus STAB).' : ''} ${a.hits > 1 ? 'Acerta várias vezes.' : ''}</span></div></div>`);
    }
    out.push(`<div class="step"><div><b>Poções e revives</b><br><span class="small dim">${esc(b.notes || '')} Guarde os revives para o DPS e os debuffers. Se o boss subir o ataque de novo, traga o debuffer de volta e repita o debuff.</span></div></div>`);
    return out.join('');
  }

  function memberCard(role, x, line, isDps) {
    if (!x) return '';
    const o = S.obtain(x.s);
    const where = o?.best ? `${routeLink(o.best[0], o.best[2])} · ${pctFmt(o.best[5])}${o.via !== x.s ? ` (como ${esc(o.via.n)})` : ''}` : o?.roaming ? 'lendário solto' : '—';
    const immTxt = x.imm.filter((i) => i.kind === 'imune').map((i) => `<span class="chip good">imune a ${esc(cap(i.move))}</span>`).join(' ');
    const mega = x.mega ? `<span class="chip z" title="${esc(x.mega.map((m) => m.name + ': ' + m.ability).join(' · '))}">tem Mega</span>` : '';
    return `<div class="member ${isDps ? 'dps' : ''}">
      ${spr(x.s)}
      <div style="flex:1;min-width:0">
        <div class="role">${esc(role)}</div>
        <b class="n"><a href="#/dex/${x.s.slug}">${esc(x.s.n)}</a></b>
        <div class="row" style="gap:5px;margin:4px 0">${tchips(x.s.t)} ${immTxt} ${mega}</div>
        <div class="small">${line}</div>
        <div class="tiny dim" style="margin-top:4px">Onde pegar: ${where}</div>
      </div>
      ${ownedBtn(x.s)}
    </div>`;
  }
  function teamCards(r) {
    const p = r.plan, out = [];
    if (p.mainDps) { const a = p.mainDps.atk; out.push(memberCard('DPS principal', p.mainDps, `${a.setup ? esc(cap(a.setup.move.name)) + ' → ' : ''}<b>${esc(cap(a.move.name))}</b> ${tchip(a.type)} · dano relativo ${fmt(a.dmg)}`, true)); }
    if (p.defDeb) { const o = p.defDeb.d[r.bossMain]; out.push(memberCard('Debuff · baixa ' + STAT_NAME[r.bossMain], p.defDeb, `<b>${esc(cap(o.move.name))}</b> (−${o.n} por uso) · ${esc(p.defDeb.ab)}`)); }
    if (p.offDeb) { const o = p.offDeb.d[p.offKey]; out.push(memberCard('Debuff · baixa ' + STAT_NAME[p.offKey], p.offDeb, `<b>${esc(cap(o.move.name))}</b> (−${o.n} por uso) · ${esc(p.offDeb.ab)}`)); }
    if (p.statusDeb) { const o = p.statusDeb.d.status[0]; out.push(memberCard('Status (opcional)', p.statusDeb, `<b>${esc(cap(o.move.name))}</b> · ${esc(p.statusDeb.ab)}`)); }
    // reservas de DPS com outro tipo de dano
    const alt = r.dps.filter((x) => x !== p.mainDps && x.atk.defKey !== p.mainDps?.atk.defKey)[0];
    if (alt) { const a = alt.atk; out.push(memberCard('DPS reserva (' + (a.defKey === 'def' ? 'físico' : 'especial') + ')', alt, `${a.setup ? esc(cap(a.setup.move.name)) + ' → ' : ''}<b>${esc(cap(a.move.name))}</b> ${tchip(a.type)} · dano relativo ${fmt(a.dmg)}`, false)); }
    const alt2 = r.dps.filter((x) => x !== p.mainDps && x !== alt)[0];
    if (alt2) { const a = alt2.atk; out.push(memberCard('DPS reserva', alt2, `${a.setup ? esc(cap(a.setup.move.name)) + ' → ' : ''}<b>${esc(cap(a.move.name))}</b> ${tchip(a.type)} · dano relativo ${fmt(a.dmg)}`, false)); }
    return out.join('');
  }
  function rankDps(arr) {
    if (!arr.length) return '<div class="muted-box">Nenhum Pokémon aqui. Marque alguns como "tenho no 100" ou desligue o filtro.</div>';
    const top = arr[0].score;
    return `<div class="rank">${arr.map((x, i) => {
      const a = x.atk;
      return `<div class="rank-row">
        <span class="pos">${i + 1}</span>${spr(x.s, 'sm')}
        <div style="min-width:0"><b>${monLink(x.s)}</b> ${x.legend ? '<span class="chip warn">lendário</span>' : ''}<div class="row" style="gap:4px">${tchips(x.s.t)}</div></div>
        <div class="hide-sm small">${a.setup ? esc(cap(a.setup.move.name)) + ' → ' : ''}<b>${esc(cap(a.move.name))}</b> ${tchip(a.type)} <span class="tiny dim">${CAT[a.cat]} · ${howTxt(a.how)}${a.eff > 1 ? ' · ×' + a.eff : ''}</span>
          <div class="bar"><i style="width:${(x.score / top * 100).toFixed(0)}%"></i></div>
          <span class="tiny dim">${hitTxt(x.hitPctDeb, x.worstName)} com o ataque do boss baixado</span></div>
        ${ownedBtn(x.s)}
      </div>`;
    }).join('')}</div>`;
  }
  function rankDeb(arr, k) {
    if (!arr.length) return '<div class="muted-box">Nenhum Pokémon encontrado para este papel.</div>';
    const top = arr[0].score || 1;
    return `<div class="rank">${arr.map((x, i) => {
      const os = k === 'status' ? x.d.status : [x.d[k]];
      return `<div class="rank-row">
        <span class="pos">${i + 1}</span>${spr(x.s, 'sm')}
        <div style="min-width:0"><b>${monLink(x.s)}</b> ${x.legend ? '<span class="chip warn">lendário</span>' : ''}<div class="row" style="gap:4px">${tchips(x.s.t)}</div></div>
        <div class="hide-sm small">${os.map((o) => `<b>${esc(cap(o.move.name))}</b> <span class="tiny dim">${k === 'status' ? '' : '−' + o.n + ' · '}${o.move.acc > 100 ? 'nunca erra' : o.move.acc + '%'} · ${howTxt(o.how)}</span>`).join('<br>')}
          <div class="bar"><i style="width:${(x.score / top * 100).toFixed(0)}%"></i></div>
          <span class="tiny dim">${esc(x.ab)}${x.ab === 'Prankster' ? ' (debuff sai primeiro)' : ''} · ${hitTxt(x.hitPct)}</span></div>
        ${ownedBtn(x.s)}
      </div>`;
    }).join('')}</div>`;
  }
  function levelList(r) {
    const rows = [];
    const seen = new Set();
    const add = (x, role, moveTxt) => {
      if (!x || seen.has(x.s.id) || OWNED.has(x.s.id)) return;
      seen.add(x.s.id);
      const o = S.obtain(x.s);
      rows.push(`<tr>
        <td><div class="row" style="gap:8px;flex-wrap:nowrap">${spr(x.s, 'sm')}<b>${monLink(x.s)}</b></div></td>
        <td>${esc(role)}</td><td class="small">${moveTxt}</td>
        <td class="small">${o?.best ? `${routeLink(o.best[0], o.best[2])}<br><span class="tiny dim">${rar(o.best[4])} · ${pctFmt(o.best[5])}${o.via !== x.s ? ' · capture ' + esc(o.via.n) + ' e evolua' : ''}</span>` : o?.roaming ? 'Lendário solto (aparece de surpresa)' : '—'}</td>
        <td>${ownedBtn(x.s)}</td></tr>`);
    };
    const mvTxt = (o) => `${esc(cap(o.move.name))} <span class="tiny dim">(${howTxt(o.how)})</span>`;
    r.dps.slice(0, 5).forEach((x) => add(x, 'DPS', (x.atk.setup ? mvTxt(x.atk.setup) + ' + ' : '') + mvTxt(x.atk)));
    r.lists[r.bossMain].slice(0, 3).forEach((x) => add(x, 'Debuff ' + STAT_NAME[r.bossMain], mvTxt(x.d[r.bossMain])));
    const offKey = r.plan.offKey;
    r.lists[offKey].slice(0, 3).forEach((x) => add(x, 'Debuff ' + STAT_NAME[offKey], mvTxt(x.d[offKey])));
    if (!rows.length) return '<div class="muted-box">Você já marcou todos os recomendados. Boa! 💪</div>';
    return `<div class="tbl-wrap"><table><thead><tr><th>Pokémon</th><th>Papel</th><th>Golpes</th><th>Onde capturar</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <p class="tiny dim mt">Como aprender: "Nv X" = aprende subindo de nível; "TM" = precisa de TM (5 Fragmentos de TM no Técnico de TMs).</p>`;
  }

  // ---------- cadastro de boss ----------
  function openBossForm(base) {
    const box = $('#bossForm');
    box.classList.remove('hidden');
    const names = W.species.map((s) => `<option value="${esc(s.n)}">`).join('');
    const mvNames = MOVES.map((m) => `<option value="${esc(cap(m.name))}">`).join('');
    box.innerHTML = `
      <div class="row between"><h3 style="margin:0">Cadastrar boss do dia</h3><button class="btn sm ghost" id="bfClose">Fechar</button></div>
      <p class="small dim">Copie do jogo o que aparece na tela do boss. Os tipos são preenchidos sozinhos pela espécie.</p>
      <datalist id="dlSp">${names}</datalist><datalist id="dlMv">${mvNames}</datalist>
      <div class="form-grid mt">
        <label class="field" style="grid-column:span 2">Espécie<input type="text" id="bfSp" list="dlSp" value="${esc(base.species)}"></label>
        <label class="field">Modo<select id="bfMode">${['Fácil', 'Normal', 'Difícil', 'Insano'].map((m) => `<option ${m === base.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="field">Nível<input type="number" id="bfLvl" value="${esc(base.level)}"></label>
        <label class="field">Pontos ×<input type="number" step="0.1" id="bfMult" value="${esc(base.pointsMult || 1)}"></label>
        <label class="field">Tipos<input type="text" id="bfTypes" value="${esc(base.types.join(', '))}" title="em inglês, separados por vírgula"></label>
        ${['atk', 'def', 'spa', 'spd', 'spe'].map((k) => `<label class="field">${STAT_NAME[k]}<input type="number" id="bf_${k}" value="${esc(base[k])}"></label>`).join('')}
        <span></span>
        ${[0, 1, 2, 3].map((i) => `<label class="field" style="grid-column:span 3">Golpe ${i + 1}<input type="text" list="dlMv" id="bfM${i}" value="${esc(base.moves[i] || '')}"></label>`).join('')}
        <label class="field" style="grid-column:1/-1">Observações<input type="text" id="bfNotes" value="${esc(base.notes || '')}"></label>
      </div>
      <div class="row mt"><button class="btn primary" id="bfSave">Salvar e calcular</button><span class="tiny dim">Fica salvo neste navegador. Para a guilda toda ver, use "Compartilhar" e mande o link.</span></div>`;
    $('#bfClose').onclick = () => box.classList.add('hidden');
    $('#bfSp').onchange = (e) => { const s = BYNAME[e.target.value.toLowerCase()]; if (s) $('#bfTypes').value = s.t.join(', '); };
    $('#bfSave').onclick = () => {
      const sp = $('#bfSp').value.trim();
      const types = $('#bfTypes').value.split(',').map((x) => x.trim().toLowerCase()).filter((x) => TI[x]);
      const b = {
        id: 'local-' + Date.now(), species: sp, mode: $('#bfMode').value, level: +$('#bfLvl').value || 100, pointsMult: +$('#bfMult').value || 1,
        types: types.length ? types : (BYNAME[sp.toLowerCase()]?.t || ['normal']),
        atk: +$('#bf_atk').value, def: +$('#bf_def').value, spa: +$('#bf_spa').value, spd: +$('#bf_spd').value, spe: +$('#bf_spe').value,
        moves: [0, 1, 2, 3].map((i) => $('#bfM' + i).value.trim()).filter(Boolean),
        seen: new Date().toISOString().slice(0, 10), notes: $('#bfNotes').value.trim(),
      };
      const bad = b.moves.filter((m) => !S.moveByName(m));
      if (bad.length) { alert('Não achei estes golpes na wiki: ' + bad.join(', ') + '\nConfira a grafia (em inglês, como no jogo).'); return; }
      const list = store.get('bosses', []); list.push(b); store.set('bosses', list); store.set('bossId', b.id);
      location.hash = '#/boss'; route(); toast('Boss salvo!');
    };
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // =====================================================================
  // POKÉDEX / ONDE PEGO
  // =====================================================================
  let dexState = { q: '', types: new Set(), onlyWild: false, sort: 'id' };
  function pageDex(slug) {
    app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="kicker">Pokédex da caça</div><h2>Onde pego?</h2><p>Escolha um Pokémon para ver as rotas, da maior chance de encontro para a menor.</p></div></div>
      <div class="card">
        <div class="row"><div class="search-wrap" style="flex:1;min-width:220px"><span class="ico">🔍</span><input type="search" id="dq" placeholder="Nome do Pokémon…" value="${esc(dexState.q)}"></div>
          <select id="dsort" style="width:auto"><option value="id">Nº da Dex</option><option value="name">Nome</option><option value="chance">Mais fácil de achar</option><option value="bst">Mais forte (total base)</option></select>
          <label class="toggle"><input type="checkbox" id="dwild" ${dexState.onlyWild ? 'checked' : ''}> Só quem aparece no mato</label></div>
        <div class="type-filter mt">${S.TYPES.map((t) => `<button class="type ${dexState.types.has(t) ? 'on' : ''}" style="--c:${TI[t][1]}" data-t="${t}">${TI[t][0]}</button>`).join('')}</div>
      </div>
      <div class="dex-grid mt" id="dgrid"></div>
    </div>`;
    $('#dsort').value = dexState.sort;
    const draw = () => {
      const q = dexState.q.toLowerCase();
      let arr = W.species.filter((s) => (!q || s.n.toLowerCase().includes(q) || String(s.id) === q) && (!dexState.types.size || s.t.some((t) => dexState.types.has(t))) && (!dexState.onlyWild || s.w.some((w) => w[1] === 0)));
      const best = (s) => Math.max(0, ...s.w.map((w) => w[5] || 0));
      if (dexState.sort === 'name') arr.sort((a, b) => a.n.localeCompare(b.n));
      else if (dexState.sort === 'chance') arr.sort((a, b) => best(b) - best(a));
      else if (dexState.sort === 'bst') arr.sort((a, b) => b.st.reduce((x, y) => x + y) - a.st.reduce((x, y) => x + y));
      $('#dgrid').innerHTML = arr.slice(0, 400).map((s) => {
        const o = S.obtain(s);
        const sub = s.w.length ? `${s.w.length} mapa${s.w.length > 1 ? 's' : ''} · até ${pctFmt(best(s))}` : o?.roaming ? 'lendário solto' : o ? 'evolui de ' + esc(o.via.n) : 'não aparece no mato';
        return `<a class="mon" href="#/dex/${s.slug}">${spr(s)}<span style="min-width:0"><b>${esc(s.n)}</b><span class="tiny dim">#${s.id} · ${sub}</span><span class="row" style="gap:3px;margin-top:3px">${tchips(s.t)}</span></span></a>`;
      }).join('') + (arr.length > 400 ? `<div class="muted-box">Mostrando 400 de ${arr.length}. Refine a busca.</div>` : '') || '<div class="muted-box">Nenhum Pokémon com esses filtros.</div>';
    };
    $('#dq').oninput = (e) => { dexState.q = e.target.value; draw(); };
    $('#dsort').onchange = (e) => { dexState.sort = e.target.value; draw(); };
    $('#dwild').onchange = (e) => { dexState.onlyWild = e.target.checked; draw(); };
    $$('.type-filter button').forEach((b) => b.onclick = () => { const t = b.dataset.t; dexState.types.has(t) ? dexState.types.delete(t) : dexState.types.add(t); b.classList.toggle('on'); draw(); });
    draw();
    if (slug) openMon(slug);
  }

  function modal(html, onClose) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="card page"><button class="close" aria-label="Fechar">✕</button>${html}</div>`;
    const close = () => { m.remove(); document.removeEventListener('keydown', esc_); onClose && onClose(); };
    const esc_ = (e) => { if (e.key === 'Escape') close(); };
    m.addEventListener('click', (e) => { if (e.target === m || e.target.classList.contains('close')) close(); });
    document.addEventListener('keydown', esc_);
    document.body.appendChild(m);
    return m;
  }
  function openMon(slug) {
    const s = BYSLUG[slug];
    if (!s) return;
    const o = S.obtain(s);
    const tot = s.st.reduce((a, b) => a + b, 0);
    const labels = ['HP', 'Ataque', 'Defesa', 'At. Esp.', 'Def. Esp.', 'Velocidade'];
    const where = [...s.w].sort((a, b) => (b[5] ?? -1) - (a[5] ?? -1));
    const megas = S.MEGA_BY_BASE()[s.id] || [];
    const ls = S.learnset(s);
    const useful = [];
    for (const [i, how] of ls) {
      const m = MOVES[i];
      const d = Object.entries(m.fx.drops), r = Object.entries(m.fx.raises);
      if (m.cat === 'status' && (d.length || r.length || m.fx.status)) useful.push(`<span class="chip ${d.length || m.fx.status ? 'z' : ''}" title="${esc(m.effect)}">${esc(cap(m.name))} <span class="tiny dim">${howTxt(how)}</span></span>`);
    }
    const evoFrom = s.ef ? BYSLUG[s.ef] || BYID[parseInt(s.ef)] : null;
    const html = `
      <div class="row" style="gap:16px">${spr(s, 'lg')}<div><div class="tiny dim">#${s.id}</div><h2 style="margin:0">${esc(s.n)}</h2><div class="row" style="margin-top:6px">${tchips(s.t)} ${ownedBtn(s)}</div></div></div>
      <div class="grid g2 mt">
        <div>
          <h3>Atributos base</h3>
          ${s.st.map((v, i) => `<div class="statbar"><span class="dim">${labels[i]}</span><b>${v}</b><span class="bg"><i style="width:${Math.min(100, v / 1.8)}%"></i></span></div>`).join('')}
          <div class="tiny dim">Total ${tot}</div>
        </div>
        <div>
          <h3>Habilidades</h3>
          ${s.ab.map((a) => `<p class="small"><b>${esc(a[0])}</b> ${a[1] ? '<span class="chip warn">oculta</span>' : ''}<br><span class="dim">${esc(a[2])}</span></p>`).join('')}
          ${s.ex ? `<p class="small"><b>Evolução:</b> ${esc(s.ex)}</p>` : ''}
          ${megas.length ? `<p class="small"><b>Mega:</b> ${megas.map((m) => `${esc(m.name)} (${tchips(m.types)}, ${esc(m.ability)}, pedra ${esc(m.stone)})`).join('<br>')}</p>` : ''}
        </div>
      </div>
      <h3 class="mt2">Onde encontrar</h3>
      ${where.length ? `<div class="tbl-wrap"><table><thead><tr><th>Mapa</th><th>Nível</th><th>Raridade</th><th class="num">Chance por encontro</th></tr></thead><tbody>
        ${where.map((w, i) => `<tr><td>${i === 0 ? '⭐ ' : ''}${routeLink(w[0], w[2])}${w[1] ? ' <span class="chip">portal</span>' : ''}</td><td class="small">${esc(w[3])}</td><td>${rar(w[4])}</td><td class="num"><b>${pctFmt(w[5])}</b></td></tr>`).join('')}
      </tbody></table></div>`
      : `<div class="muted-box">${o && o.via !== s ? `Não aparece no mato. Capture <a href="#/dex/${o.via.slug}">${esc(o.via.n)}</a> (melhor rota: ${routeLink(o.best[0], o.best[2])}, ${pctFmt(o.best[5])}) e evolua.` : esc(s.wn || 'Não aparece no mato nesta versão.')}</div>`}
      ${evoFrom && where.length ? `<p class="tiny dim mt">Também dá para capturar <a href="#/dex/${evoFrom.slug}">${esc(evoFrom.n)}</a> e evoluir.</p>` : ''}
      ${s.dr.length ? `<h3 class="mt2">O que derruba na vitória</h3><div class="row">${s.dr.map((d) => `<a class="chip" href="#/itens/${esc(d[0])}"><img src="${esc(d[3])}" width="20" height="20" alt="" style="image-rendering:pixelated">${esc(d[1])} · ${pctFmt(d[2])}</a>`).join('')}</div>` : ''}
      <p class="tiny dim mt">Toda vitória contra ele também pode dar Fragmento de Charm de ${esc(TI[s.t[0]][0])}.</p>
      ${useful.length ? `<h3 class="mt2">Golpes de suporte (debuff, status e preparo)</h3><div class="row">${useful.join('')}</div><p class="tiny dim">Em laranja: golpes que enfraquecem o alvo. Passe o mouse para ver o efeito.</p>` : ''}
      <details class="mt"><summary class="small" style="cursor:pointer">Golpes por nível</summary>
        <div class="tbl-wrap mt"><table><thead><tr><th>Nv</th><th>Golpe</th><th>Tipo</th><th>Cat.</th><th class="num">Poder</th></tr></thead><tbody>
        ${s.lm.map(([l, i]) => { const m = MOVES[i]; return `<tr><td>${l}</td><td>${esc(cap(m.name))}</td><td>${tchip(m.type)}</td><td class="small">${CAT[m.cat]}</td><td class="num">${m.power ?? '—'}</td></tr>`; }).join('')}
        </tbody></table></div></details>
      <p class="tiny dim mt"><a href="${W.src}/species/${esc(s.slug)}" target="_blank" rel="noopener">Ver na wiki oficial ↗</a></p>`;
    const m = modal(html, () => { if (location.hash.startsWith('#/dex/')) history.replaceState(null, '', '#/dex'); });
    $$('.owned-btn', m).forEach(bindOwned);
  }

  // =====================================================================
  // ITENS E FARM
  // =====================================================================
  function buildItems() {
    const items = {};
    for (const s of W.species) for (const [slug, name, chance, img] of s.dr) {
      const it = (items[slug] ||= { slug, name, img, drop: [] });
      it.drop.push({ s, chance });
    }
    for (const it of Object.values(items)) {
      it.cat = /plate/.test(it.slug) ? 'Placas' : /stone/.test(it.slug) ? 'Pedras de evolução' : /fragment/.test(it.slug) ? 'Fragmentos de lendário' : /shard/.test(it.slug) ? 'Cacos' : 'Outros';
    }
    return items;
  }
  function itemRoutes(it) {
    // por rota: soma de (chance de aparecer × chance de derrubar) dos que derrubam
    const byRoute = {};
    for (const { s, chance } of it.drop) for (const w of s.w) {
      if (w[5] == null) continue;
      const r = (byRoute[w[0]] ||= { slug: w[0], name: w[2], exp: 0, who: [] });
      const e = (w[5] / 100) * (chance / 100) * 10000;
      r.exp += e; r.who.push({ s, spawn: w[5], chance, rarity: w[4] });
    }
    return Object.values(byRoute).sort((a, b) => b.exp - a.exp);
  }
  const CHARM_RATE = { comum: 0.03, incomum: 0.04, raro: 0.06, epico: 0.1 };
  function pageItems(slug) {
    const cats = {};
    for (const it of Object.values(ITEMS)) (cats[it.cat] ||= []).push(it);
    const it = slug ? ITEMS[slug] : null;
    app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="kicker">Itens e farm</div><h2>Onde farmo?</h2><p>Escolha um item: o site cruza quem derruba com onde cada um aparece e mostra a melhor rota.</p></div></div>
      <div class="grid g2">
        <div class="card">
          ${Object.entries(cats).map(([c, arr]) => `<h3 class="${c === Object.keys(cats)[0] ? '' : 'mt'}">${esc(c)}</h3><div class="row">${arr.sort((a, b) => a.name.localeCompare(b.name)).map((x) => `<a class="chip ${x.slug === slug ? 'z' : ''}" href="#/itens/${x.slug}"><img src="${esc(x.img)}" width="20" height="20" alt="" style="image-rendering:pixelated">${esc(x.name)}</a>`).join('')}</div>`).join('')}
        </div>
        <div class="card" id="itemBox">${it ? itemDetail(it) : '<div class="muted-box">👈 Escolha um item para ver as melhores rotas.</div>'}</div>
      </div>

      <section class="mt2">
        <div class="section-head"><div><div class="kicker">Charms</div><h2>Farm de Fragmento de Charm por tipo</h2><p>O tipo do fragmento é o tipo <b>primário</b> do Pokémon derrotado. 10 fragmentos = 1 Charm (+1% de dano no tipo, até +5%).</p></div>
          <select id="charmT" style="width:auto">${S.TYPES.map((t) => `<option value="${t}">${TI[t][0]}</option>`).join('')}</select></div>
        <div id="charmBox"></div>
      </section>
    </div>`;
    const drawCharm = (t) => {
      const res = [];
      for (const r of W.routes) {
        let exp = 0, n = 0, total = 0;
        for (const [sp, , rr, ch] of spawnsOf(r)) {
          const s = BYSLUG[sp]; if (!s || ch == null) continue;
          total += ch;
          if (s.t[0] === t) { exp += (ch / 100) * (CHARM_RATE[rr] || 0.03) / 100 * 1000; n++; }
        }
        if (exp > 0) res.push({ r, exp, n, share: spawnsOf(r).filter(([sp, , , ch]) => BYSLUG[sp]?.t[0] === t).reduce((a, x) => a + (x[3] || 0), 0) });
      }
      res.sort((a, b) => b.exp - a.exp);
      $('#charmBox').innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Rota</th><th>Nível</th><th class="num">% dos encontros do tipo</th><th class="num">≈ fragmentos / 1.000 vitórias</th></tr></thead><tbody>
        ${res.slice(0, 15).map((x, i) => `<tr><td>${i === 0 ? '⭐ ' : ''}${routeLink(x.r.slug, x.r.n)}</td><td class="small">${esc(x.r.lv)}</td><td class="num">${fmt(x.share, 1)}%</td><td class="num"><b>${fmt(x.exp, 2)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="dim">Nenhuma rota com esse tipo.</td></tr>'}
      </tbody></table></div><p class="tiny dim mt">Chance por raridade (wiki): comum 0,03%, incomum 0,04%, raro 0,06%, épico 0,1%. O bônus de itens do mapa multiplica.</p>`;
    };
    const sel = $('#charmT');
    sel.value = store.get('charmT', 'fire');
    sel.onchange = () => { store.set('charmT', sel.value); drawCharm(sel.value); };
    drawCharm(sel.value);
  }
  function itemDetail(it) {
    const rs = itemRoutes(it);
    return `<div class="row"><img src="${esc(it.img)}" width="40" height="40" alt="" style="image-rendering:pixelated"><h3 style="margin:0">${esc(it.name)}</h3></div>
      <p class="small dim mt">${it.drop.length} espécie(s) derrubam. Só a <b>vitória</b> derruba item (captura não) e sai no máximo 1 tesouro por luta.</p>
      ${rs.length ? `<div class="kicker mt">Melhores rotas</div><div class="tbl-wrap"><table><thead><tr><th>Rota</th><th>Quem derruba ali</th><th class="num">≈ por 10.000 vitórias</th></tr></thead><tbody>
      ${rs.slice(0, 12).map((r, i) => `<tr><td>${i === 0 ? '⭐ ' : ''}${routeLink(r.slug, r.name)}</td><td class="small">${r.who.map((w) => `${monLink(w.s)} <span class="tiny dim">${pctFmt(w.spawn)} × ${pctFmt(w.chance)}</span>`).join('<br>')}</td><td class="num"><b>${fmt(r.exp, r.exp < 0.1 ? 3 : 2)}</b></td></tr>`).join('')}
      </tbody></table></div>` : ''}
      <div class="kicker mt">Quem derruba</div>
      <div class="row">${it.drop.sort((a, b) => b.chance - a.chance).map((d) => `<a class="chip" href="#/dex/${d.s.slug}">${spr(d.s, 'sm')}${esc(d.s.n)} · ${pctFmt(d.chance)}</a>`).join('')}</div>
      ${it.drop.some((d) => !d.s.w.some((w) => w[5] != null)) ? '<p class="tiny dim mt">Alguns só aparecem em portais ou eventos, então não entram na conta de rotas.</p>' : ''}`;
  }

  // =====================================================================
  // ROTAS
  // =====================================================================
  let rotaState = { q: '', region: '', sort: 'order' };
  const bonusVal = (r, label) => { const b = r.b.find((x) => x.startsWith(label)); return b ? parseFloat(b.replace(/[^\d,.-]/g, '').replace(',', '.')) : 0; };
  const lvMin = (r) => { const m = (r.lv || '').match(/(\d+)/); return m ? +m[1] : 0; };
  function pageRoutes(slug) {
    const regions = [...new Set(W.routes.map((r) => r.rg).filter(Boolean))];
    app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="kicker">Mapas</div><h2>Rotas e portais</h2><p>${W.routes.length} mapas. Clique para ver quem aparece, os requisitos e os bônus.</p></div></div>
      <div class="card"><div class="row">
        <div class="search-wrap" style="flex:1;min-width:200px"><span class="ico">🔍</span><input type="search" id="rq" placeholder="Nome ou número da rota…" value="${esc(rotaState.q)}"></div>
        <select id="rreg" style="width:auto"><option value="">Todas as regiões</option>${regions.map((g) => `<option ${g === rotaState.region ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
        <select id="rsort" style="width:auto"><option value="order">Ordem do mundo</option><option value="xp">Maior bônus de XP</option><option value="lv">Nível mais alto</option><option value="sp">Mais espécies</option></select>
      </div></div>
      <div class="tbl-wrap mt"><table><thead><tr><th>Mapa</th><th>Região</th><th>Nível</th><th>Bônus</th><th class="num">Espécies</th></tr></thead><tbody id="rbody"></tbody></table></div>
    </div>`;
    $('#rsort').value = rotaState.sort;
    const draw = () => {
      const q = rotaState.q.toLowerCase();
      let arr = W.routes.filter((r) => (!q || r.n.toLowerCase().includes(q)) && (!rotaState.region || r.rg === rotaState.region));
      if (rotaState.sort === 'xp') arr = [...arr].sort((a, b) => bonusVal(b, 'Experiência') - bonusVal(a, 'Experiência'));
      if (rotaState.sort === 'lv') arr = [...arr].sort((a, b) => lvMin(b) - lvMin(a));
      if (rotaState.sort === 'sp') arr = [...arr].sort((a, b) => spawnsOf(b).length - spawnsOf(a).length);
      $('#rbody').innerHTML = arr.map((r) => `<tr><td>${routeLink(r.slug, r.n)}${r.k === 'portal' ? ' <span class="chip">portal</span>' : ''}</td><td class="small">${esc(r.rg)}</td><td class="small">${esc(r.lv)}</td><td>${r.b.map((b) => `<span class="chip">${esc(b)}</span>`).join(' ')}</td><td class="num">${spawnsOf(r).length}</td></tr>`).join('');
    };
    $('#rq').oninput = (e) => { rotaState.q = e.target.value; draw(); };
    $('#rreg').onchange = (e) => { rotaState.region = e.target.value; draw(); };
    $('#rsort').onchange = (e) => { rotaState.sort = e.target.value; draw(); };
    draw();
    if (slug) openRoute(slug);
  }
  function openRoute(slug) {
    const r = ROUTE[slug]; if (!r) return;
    const sp = [...spawnsOf(r)].sort((a, b) => (b[3] ?? -1) - (a[3] ?? -1));
    const html = `
      <div class="kicker">${esc(r.rg)}</div><h2>${esc(r.n)}</h2>
      <div class="row">${r.lv ? `<span class="chip z">${esc(r.lv)}</span>` : ''}${r.b.map((b) => `<span class="chip good">${esc(b)}</span>`).join('')}</div>
      ${r.info ? `<p class="small dim mt">${esc(r.info)}</p>` : ''}
      ${r.rq.length ? `<h3 class="mt2">Para entrar</h3><ul class="small">${r.rq.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h3 class="mt2">Quem aparece</h3>
      ${sp.length ? `<div class="tbl-wrap"><table><thead><tr><th>Pokémon</th><th>Tipo</th><th>Raridade</th><th class="num">Chance</th><th>Derruba</th></tr></thead><tbody>
      ${sp.map(([s_, lv, rr, ch]) => { const s = BYSLUG[s_]; if (!s) return ''; return `<tr><td><div class="row" style="gap:8px;flex-wrap:nowrap">${spr(s, 'sm')}${monLink(s)}</div></td><td>${tchips(s.t)}</td><td>${rar(rr)}</td><td class="num"><b>${pctFmt(ch)}</b></td><td>${s.dr.map((d) => `<a href="#/itens/${esc(d[0])}" title="${esc(d[1])} · ${pctFmt(d[2])}"><img src="${esc(d[3])}" width="22" height="22" alt="${esc(d[1])}" style="image-rendering:pixelated"></a>`).join('')}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="muted-box">Sem lista de espécies para este mapa.</div>'}
      <p class="tiny dim mt"><a href="${W.src}/${r.k === 'portal' ? 'portals' : 'routes'}/${esc(r.slug)}" target="_blank" rel="noopener">Ver na wiki oficial ↗</a></p>`;
    modal(html, () => { if (location.hash.startsWith('#/rotas/')) history.replaceState(null, '', '#/rotas'); });
  }

  // =====================================================================
  // MEGA
  // =====================================================================
  function pageMega() {
    app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="kicker">Mega Evolução</div><h2>Mega Boss e pedras</h2></div></div>
      <div class="grid g2">
        <div class="card">
          <h3>🧬 Mega Boss de sábado</h3>
          <div class="timer mt" id="tMega2"><span class="small dim">Próximo Mega Boss</span><span class="t">…</span><span class="tiny dim">sábado, 15:00 às 18:00 (Brasília)</span></div>
          <ul class="small mt">
            <li>A barra precisa de <b>100.000.000 de silver</b>, somando todos os jogadores. Conta de segunda 00:00 até sábado 15:00.</li>
            <li>Doação mínima de 1.000 silver. O silver doado <b>não volta</b>, mesmo se a barra não encher.</li>
            <li>Se a barra não encher, o boss não aparece. A barra zera e a espécie continua a mesma na semana seguinte.</li>
            <li>Quem causar dano leva <b>até 10 Mega Tokens</b>. O token é intransferível, mas as pedras podem ser negociadas.</li>
            <li>Luta na Arena, sem captura. Quem segura a pedra Mega da própria espécie Mega Evolui sozinho.</li>
          </ul>
        </div>
        <div class="card">
          <h3>🛒 Loja do Mega Token</h3>
          <div class="tbl-wrap mt"><table><tbody>
            <tr><td>Espécie comum</td><td class="num"><b>15</b> tokens</td></tr>
            <tr><td>Rara, épica ou pseudo-lendária</td><td class="num"><b>30</b> tokens</td></tr>
            <tr><td>Lendária ou mítica</td><td class="num"><b>60</b> tokens</td></tr>
          </tbody></table></div>
          <h3 class="mt">⚡ Stamina da Mega</h3>
          <p class="small">Cada Pokémon com Mega tem stamina própria (30 no máximo). Cada luta em que ele Mega Evolui gasta 1. Só pode <b>1 Mega por equipe</b>.</p>
          <p class="small"><b>Frutas tier 1 (+3):</b> Oran, Cheri, Chesto, Pecha, Rawst, Aspear, Persim, Pomeg, Kelpsy, Qualot, Hondew, Grepa, Tamato.<br><b>Frutas tier 2 (+8):</b> Sitrus, Lum, Leppa.</p>
        </div>
      </div>
      <section class="mt2">
        <div class="section-head"><div><h2>As ${W.megas.length} formas Mega</h2><p>Filtre por tipo para achar uma Mega que sirva contra o boss.</p></div>
          <div class="row"><input type="search" id="mq" placeholder="Buscar…" style="width:180px"><select id="mt" style="width:auto"><option value="">Todos os tipos</option>${S.TYPES.map((t) => `<option value="${t}">${TI[t][0]}</option>`).join('')}</select></div></div>
        <div class="tbl-wrap"><table><thead><tr><th>Forma</th><th>Tipos</th><th>Habilidade</th><th>Pedra</th></tr></thead><tbody id="mbody"></tbody></table></div>
      </section>
    </div>`;
    const draw = () => {
      const q = $('#mq').value.toLowerCase(), t = $('#mt').value;
      $('#mbody').innerHTML = W.megas.filter((m) => (!q || (m.name + m.stone + m.ability).toLowerCase().includes(q)) && (!t || m.types.includes(t))).map((m) => {
        const s = BYID[parseInt(m.base)];
        return `<tr><td><div class="row" style="gap:8px;flex-wrap:nowrap">${spr(s, 'sm')}<span><b>${esc(m.name)}</b>${s ? `<br><span class="tiny">${monLink(s)}</span>` : ''}</span></div></td><td>${tchips(m.types)}</td><td class="small">${esc(m.ability)}</td><td class="small">${esc(m.stone)}</td></tr>`;
      }).join('');
    };
    $('#mq').oninput = draw; $('#mt').onchange = draw; draw();
    const tick = () => { const el = $('#tMega2'); if (!el) return; const mb = megaBossState(); el.classList.toggle('live', mb.live); $('.t', el).textContent = mb.live ? 'AO VIVO · termina em ' + countdown(mb.until) : countdown(mb.at); };
    tickers.push(tick); tick();
  }

  // =====================================================================
  // SHINY
  // =====================================================================
  const LADDER = [80000, 40000, 35000, 30000, 25000, 20000, 15000, 10000, 5000, 3000, 500, 100];
  function pageShiny() {
    const st = store.get('shiny', { step: 0, perHour: 600 });
    app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="kicker">Shiny</div><h2>Escada do Shiny Boost</h2><p>Cada hora de boost ativo sobe um degrau. O degrau fica guardado quando o boost acaba.</p></div></div>
      <div class="grid g2">
        <div class="card">
          <label class="field">Em que degrau você está? (horas de boost acumuladas)
            <input type="range" id="sStep" min="0" max="11" value="${st.step}" style="accent-color:var(--z)"></label>
          <div class="ladder" id="sLadder"></div>
          <label class="field mt">Quantos encontros você faz por hora (mais ou menos)?<input type="number" id="sRate" value="${st.perHour}" min="1"></label>
          <div id="sOut" class="mt"></div>
        </div>
        <div class="card">
          <h3>Como a escada se move</h3>
          <ul class="small">
            <li>O tempo do boost corre no relógio, com o jogo aberto ou fechado.</li>
            <li><b>Encontrar</b> um shiny com o boost ativo desce 1 degrau.</li>
            <li><b>Capturar</b> um shiny com o boost ativo volta para 1 em 40.000 (se você estava acima disso).</li>
            <li>Sem boost ativo, a escada fica parada.</li>
            <li>Derrotar um shiny sem capturar dá de 1 a 3 Fragmentos de Shiny (troque por Shiny Stone no Caçador de Tesouros).</li>
            <li>Guild Shiny Boost (líder ou vice): shiny ×2 nas 20 rotas da guerra por 30 min.</li>
          </ul>
        </div>
      </div>
    </div>`;
    const draw = () => {
      const step = +$('#sStep').value, rate = Math.max(1, +$('#sRate').value || 1);
      store.set('shiny', { step, perHour: rate });
      $('#sLadder').innerHTML = LADDER.map((c, i) => `<div class="${i <= step ? 'on' : ''}" title="${i}h">${i === 11 ? '11h+' : i + 'h'}<br>1/${c >= 1000 ? c / 1000 + 'k' : c}</div>`).join('');
      const c = LADDER[step];
      const hoursToTop = 11 - step;
      const expHours = c / rate;
      $('#sOut').innerHTML = `<div class="grid g2" style="gap:10px">
        <div class="timer"><span class="small dim">Chance agora</span><span class="t">1 em ${fmt(c)}</span></div>
        <div class="timer"><span class="small dim">Horas de boost até 1 em 100</span><span class="t">${hoursToTop ? hoursToTop + 'h' : 'no topo!'}</span></div>
        <div class="timer"><span class="small dim">Tempo médio até um shiny (neste degrau)</span><span class="t">${expHours < 1 ? fmt(expHours * 60) + ' min' : fmt(expHours, 1) + ' h'}</span></div>
        <div class="timer"><span class="small dim">Boosts de 1h necessários</span><span class="t">${hoursToTop}</span></div></div>`;
    };
    $('#sStep').oninput = draw; $('#sRate').oninput = draw; draw();
  }

  // =====================================================================
  // GUILD WAR (resumo)
  // =====================================================================
  function pageWar() {
    const routes = [['Rota 5 — Caverna Rasa', 'Kanto', 500], ['Rota 10 — Praia Dourada', 'Kanto', 500], ['Rota 15 — Enseada dos Juncos', 'Kanto', 750], ['Rota 20 — Pântano Nebuloso', 'Kanto', 750], ['Rota 43 — Sopé Verdejante', 'Johto', 1000], ['Rota 76 — Neve Profunda', 'Johto', 1000], ['Rota 77 — Cume Silencioso', 'Johto', 1250], ['Rota 80 — Ruínas Cobertas', 'Johto', 1250], ['Rota 85 — Gruta de Cristal', 'Hoenn', 1500], ['Rota 110 — Lodaçal Antigo', 'Hoenn', 1500], ['Rota 111 — Vale da Poeira', 'Hoenn', 1750], ['Rota 115 — Cânion Vermelho', 'Hoenn', 1750], ['Rota 142 — Fornalha Natural', 'Sinnoh', 2000], ['Rota 147 — Borda da Caldeira', 'Sinnoh', 2000], ['Rota 148 — Trono de Lava', 'Sinnoh', 2250], ['Rota 150 — Fundo do Mundo', 'Sinnoh', 2250], ['Rota 180 — Bosque das Memórias', 'Unova', 2500], ['Rota 182 — Gruta dos Tentilhões', 'Unova', 2500], ['Rota 185 — Ponte do Rio Largo', 'Unova', 3000], ['Rota 190 — Ilha do Vulcão', 'Unova', 4000]];
    const slugOf = (n) => { const m = n.match(/Rota (\d+)/); return m ? 'route_' + m[1].padStart(3, '0') : ''; };
    app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="kicker">Guild War</div><h2>Resumo rápido</h2><p>A guilda é PvE, mas caçar numa rota da guerra já ajuda sem esforço extra.</p></div></div>
      <div class="grid g2">
        <div class="card">
          <h3>Como funciona</h3>
          <ul class="small">
            <li>Lutar ou capturar numa das 20 rotas da guerra gera <b>Influence</b> para a guilda. Manual, AUTO e caçada offline contam.</li>
            <li>A cada hora cheia, cada rota paga 1/24 dos pontos do dia, divididos pela fatia de Influence de cada guilda.</li>
            <li>A Influence zera à meia-noite (Brasília). Quem tiver mais Influence na rota controla ela no dia seguinte e pode erguer a <b>Guild Flag</b>.</li>
            <li>Dica PvE: se você vai caçar mesmo, cace numa rota da guerra da sua faixa de nível.</li>
            <li>Quem não quiser participar pode sair na aba Guerra da guilda (dá para mudar 1× por dia).</li>
          </ul>
          <h3 class="mt">Influence por luta</h3>
          <div class="tbl-wrap"><table><thead><tr><th>Aparição na rota</th><th class="num">Derrotar</th><th class="num">Capturar</th><th class="num">Shiny</th></tr></thead><tbody>
            ${[['Abundante', 1, 1, 100], ['Frequente', 2, 2, 100], ['Ocasional', 4, 5, 250], ['Escassa', 8, 10, 250], ['Pseudo-lendário (final)', 20, 25, 500], ['Lendário', 75, 100, 2000], ['Mítico', 200, 250, 5000]].map((r) => `<tr><td>${r[0]}</td><td class="num">+${r[1]}</td><td class="num">+${r[2]}</td><td class="num">+${fmt(r[3])}</td></tr>`).join('')}
          </tbody></table></div>
          <p class="tiny dim mt">Mais: Gold Ball +25 · tempo ativo +25/h · Pokémon Boost até +120 · Coletor da rota até +200 · duelo de guerra ±100.</p>
        </div>
        <div class="card">
          <h3>As 20 rotas da guerra</h3>
          <div class="tbl-wrap"><table><thead><tr><th>Rota</th><th>Região</th><th class="num">Pontos/dia</th></tr></thead><tbody>
            ${routes.map((r) => `<tr><td>${routeLink(slugOf(r[0]), r[0])}</td><td class="small">${r[1]}</td><td class="num">${fmt(r[2])}</td></tr>`).join('')}
          </tbody></table></div>
          <h3 class="mt">Guild Flag (24 h, escolha 1)</h3>
          <div class="row"><span class="chip">XP +3%</span><span class="chip">Silver +3%</span><span class="chip">Captura +3%</span><span class="chip">Shiny +1% relativo</span><span class="chip">Dano +3%</span></div>
        </div>
      </div>
      <p class="tiny dim mt">Detalhes completos na <a href="${W.src}/mechanics/guild-war" target="_blank" rel="noopener">wiki oficial</a>.</p>
    </div>`;
  }

  // =====================================================================
  // ROTEADOR
  // =====================================================================
  function route() {
    tickers = [];
    $$('.modal').forEach((m) => m.remove());
    const h = location.hash.replace(/^#\/?/, '');
    const [path] = h.split('?');
    const [sec, arg] = path.split('/');
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === (sec || '')));
    $('#nav').classList.remove('open');
    try {
      if (!sec) pageHome();
      else if (sec === 'boss') pageBoss();
      else if (sec === 'dex') pageDex(arg && decodeURIComponent(arg));
      else if (sec === 'itens') pageItems(arg && decodeURIComponent(arg));
      else if (sec === 'rotas') pageRoutes(arg && decodeURIComponent(arg));
      else if (sec === 'mega') pageMega();
      else if (sec === 'shiny') pageShiny();
      else if (sec === 'guerra') pageWar();
      else pageHome();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="card"><h3>Ops, algo deu errado nesta página.</h3><p class="small dim">${esc(e.message)}</p></div>`;
    }
    window.scrollTo({ top: 0 });
  }
  // abrir detalhes sem redesenhar a página quando já estamos nela
  let lastSec = null;
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    const [sec, arg] = h.split('/');
    if (sec === lastSec && arg && (sec === 'dex' || sec === 'rotas')) { $$('.modal').forEach((m) => m.remove()); sec === 'dex' ? openMon(decodeURIComponent(arg)) : openRoute(decodeURIComponent(arg)); return; }
    if (sec === lastSec && sec === 'itens') { const y = window.scrollY; pageItems(arg && decodeURIComponent(arg)); window.scrollTo({ top: y }); if (arg && innerWidth < 620) $('#itemBox')?.scrollIntoView({ behavior: 'smooth' }); return; }
    lastSec = sec; route();
  });
  $('#menuBtn').onclick = () => $('#nav').classList.toggle('open');
  $('#authorFoot').textContent = SITE.author;
  if (SITE.livepix) { const d = $('#donateFoot'); d.href = SITE.livepix; d.classList.remove('hidden'); }
  const d = W.gen ? new Date(W.gen) : null;
  $('#dataInfo').innerHTML = `Dados da <a href="${W.src}" target="_blank" rel="noopener">Wiki idleDEX</a>${d ? ' · atualizados em ' + d.toLocaleDateString('pt-BR') : ''}`;
  lastSec = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0];
  route();
})();
