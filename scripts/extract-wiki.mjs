// Extrai os dados da Wiki idleDEX (wiki.idledex.com) para data/wiki.json.
// Uso: node scripts/extract-wiki.mjs
// Faz poucas requisições por vez, com pausa, para não pesar no site da wiki.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://wiki.idledex.com';
const UA = 'GuerreirosZ-guild-site/1.0 (fan site; reference use)';
const CONCURRENCY = 4;
const PAUSE_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, tries = 3) {
  const url = BASE + path + (path.endsWith('/') || path.endsWith('.xml') ? '' : '/');
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {}
    await sleep(1000 * (i + 1));
  }
  throw new Error('Falhou: ' + url);
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      await sleep(PAUSE_MS);
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

// ---------- utilidades de HTML ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1)));
  return ENT[e] ?? m;
});
const text = (s) => decode(s.replace(/<!--.*?-->/gs, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const mainOf = (html) => {
  const a = html.indexOf('<main'), b = html.indexOf('</main>');
  return html.slice(a, b).replace(/<svg[\s\S]*?<\/svg>/g, '');
};
// devolve o HTML entre um <h2> com título e o próximo <h2>
function section(main, title) {
  const re = new RegExp('<h2[^>]*>\\s*' + title + '[^<]*</h2>([\\s\\S]*?)(?=<h2|$)');
  const m = main.match(re);
  return m ? m[1] : '';
}
const rows = (html) => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]).filter((r) => r.includes('<td'));
const cells = (row) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
const pct = (s) => { const m = text(s).match(/([\d.,]+)\s*%/); return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null; };
const num = (s) => { const m = text(s).match(/-?\d+/); return m ? parseInt(m[0]) : null; };

const TYPE_EN = /types\/gen8\/(\w+)\.png/g;
const typesIn = (html) => [...html.matchAll(TYPE_EN)].map((m) => m[1]);
const TYPE_PT = { Normal: 'normal', Fogo: 'fire', 'Água': 'water', 'Elétrico': 'electric', Planta: 'grass', Gelo: 'ice', Lutador: 'fighting', Veneno: 'poison', Terra: 'ground', Voador: 'flying', 'Psíquico': 'psychic', Inseto: 'bug', Pedra: 'rock', Fantasma: 'ghost', 'Dragão': 'dragon', Sombrio: 'dark', 'Aço': 'steel', Fada: 'fairy' };
const typesFromChips = (html) => [...html.matchAll(/chip-with-icon">(?:<img[^>]*>)?([^<]+)</g)].map((m) => TYPE_PT[m[1].trim()]).filter(Boolean);
const RARITY = { 'chip-common': 'comum', 'chip-uncommon': 'incomum', 'chip-rare': 'raro', 'chip-epic': 'epico' };
const rarityOf = (html) => { const m = html.match(/chip (chip-\w+)">([^<]+)</); return m ? (RARITY[m[1]] || text(m[2]).toLowerCase()) : null; };
const moveKey = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- golpes ----------
async function extractMoves() {
  const main = mainOf(await get('/moves'));
  const moves = {};
  for (const r of rows(main)) {
    const c = cells(r);
    if (c.length < 8) continue;
    const name = text(c[0]);
    const catTxt = text(c[2]);
    moves[moveKey(name)] = {
      name,
      type: typesIn(c[1])[0] || null,
      cat: catTxt.startsWith('F') ? 'phys' : catTxt.startsWith('E') ? 'spec' : 'status',
      power: num(c[3]),
      acc: /nunca/.test(text(c[4])) ? 101 : num(c[4]),
      prio: num(c[5]) || 0,
      effect: text(c[6]),
      tm: /sim/i.test(text(c[7])),
    };
  }
  return moves;
}

// ---------- espécies ----------
async function extractSpecies(path) {
  const html = await get(path);
  if (!html) return null;
  const main = mainOf(html);
  const [, id, slug] = path.match(/species\/(\d+)-([^/]+)/);
  const name = text((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, slug])[1]);
  const head = main.slice(0, main.indexOf('<h2'));
  const types = typesIn(head);
  const sprite = (main.match(/sprites\/poke\/([^&"]+?)\.png/) || [])[1] || null;

  const abil = rows(section(main, 'Habilidades')).map((r) => {
    const c = cells(r);
    return { name: text(c[0]).replace(/\s*oculta$/, ''), hidden: /oculta/.test(c[0]), desc: text(c[1] || '') };
  });

  const statsHtml = section(main, 'Stats base');
  const statVals = [...statsHtml.matchAll(/text-right font-semibold text-body">(\d+)</g)].map((m) => +m[1]);
  const [hp, atk, def, spa, spd, spe] = statVals;

  const evoHtml = section(main, 'Evolu');
  const evo = { from: null, to: [] };
  const fromM = evoHtml.match(/Evolui de[\s\S]*?href="\/species\/([^"]+)"/);
  if (fromM) evo.from = fromM[1];
  for (const m of evoHtml.matchAll(/Evolui para[\s\S]*?href="\/species\/([^"]+)"/g)) evo.to.push(m[1]);
  evo.text = text(evoHtml).slice(0, 300);

  const whereHtml = section(main, 'Onde encontrar');
  const where = [];
  for (const r of rows(whereHtml)) {
    const c = cells(r);
    const link = (c[0].match(/href="\/(routes|portals)\/([^"]+)"/) || []);
    if (c.length >= 4) {
      where.push({ map: link[2] || null, kind: link[1] || null, name: text(c[0]), lvl: text(c[1]), rarity: rarityOf(c[2]) || text(c[2]).toLowerCase(), chance: pct(c[3]) });
    } else if (c.length >= 3) {
      where.push({ map: link[2] || null, kind: link[1] || null, name: text(c[0]), lvl: text(c[1]), rarity: text(c[2]), chance: null });
    }
  }
  const whereNote = where.length ? null : text(whereHtml).slice(0, 260);

  const drops = rows(section(main, 'O que derruba')).map((r) => {
    const c = cells(r);
    const slugM = c[0].match(/href="\/items\/([^"]+)"/);
    const img = (c[0].match(/src="(https:\/\/idledex\.com\/sprites\/items\/[^"]+)"/) || [])[1] || null;
    return { item: slugM ? slugM[1] : null, name: text(c[0]), chance: pct(c[1] || ''), img };
  }).filter((d) => d.item);

  const lvlMoves = rows(section(main, 'Golpes por n')).map((r) => {
    const c = cells(r);
    return [num(c[0]), moveKey(text(c[1]))];
  });
  const tmHtml = section(main, 'TMs que aprende');
  const tms = [...tmHtml.matchAll(/<button[^>]*>([^<]+)</g)].map((m) => moveKey(decode(m[1])));

  return { id: +id, slug: `${id}-${slug}`, name, types, sprite, abil, stats: { hp, atk, def, spa, spd, spe }, evo, where, whereNote, drops, lvlMoves, tms };
}

// ---------- rotas / portais ----------
async function extractRoute(path) {
  const html = await get(path);
  if (!html) return null;
  const main = mainOf(html);
  const slug = path.split('/').filter(Boolean).pop();
  const region = text((main.match(/<header[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]);
  const name = text((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, slug])[1]);
  const lvl = text((main.match(/<\/header>\s*<p[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]);
  const req = [...section(main, 'Para entrar').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
  const bonus = [...section(main, 'B.nus do mapa').matchAll(/<span class="chip">([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
  const spawns = rows(section(main, 'O que aparece')).map((r) => {
    const c = cells(r);
    const sp = (c[0].match(/href="\/species\/([^"]+)"/) || [])[1];
    return sp ? { sp, lvl: text(c[2] || ''), rarity: rarityOf(c[3] || '') || text(c[3] || '').toLowerCase(), chance: pct(c[4] || '') } : null;
  }).filter(Boolean);
  return { slug, kind: path.startsWith('/portals') ? 'portal' : 'route', name, region, lvl, req, bonus, spawns, desc: spawns.length ? null : text(main).slice(0, 400) };
}

// ---------- formas Mega ----------
async function extractMegas() {
  const main = mainOf(await get('/mechanics/mega'));
  const tbl = section(main, 'As \\d+ formas Mega');
  return rows(tbl).map((r) => {
    const c = cells(r);
    const base = (c[0].match(/href="\/species\/([^"]+)"/) || [])[1] || null;
    const parts = [...c[0].matchAll(/>([^<>]+)</g)].map((m) => decode(m[1]).trim()).filter(Boolean);
    return { name: parts[0] || text(c[0]), base, types: typesIn(c[1]).length ? typesIn(c[1]) : typesFromChips(c[1]), ability: text(c[2]), stone: text(c[3]) };
  }).filter((m) => m.name);
}

// ---------- principal ----------
async function main() {
  if (process.argv.includes('--megas')) {
    const out = join(ROOT, 'data', 'wiki.json');
    const data = JSON.parse(await readFile(out, 'utf8'));
    data.megas = await extractMegas();
    await writeFile(out, JSON.stringify(data));
    console.log(`Megas: ${data.megas.length}`);
    return;
  }
  console.log('Lendo sitemap…');
  const sm = await get('/sitemap.xml');
  const locs = [...sm.matchAll(/<loc>https:\/\/wiki\.idledex\.com([^<]*)<\/loc>/g)].map((m) => m[1]).filter((p) => !/^\/(en|es)(\/|$)/.test(p));
  const lastmod = (sm.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || null;
  const speciesPaths = locs.filter((p) => p.startsWith('/species/'));
  const routePaths = locs.filter((p) => p.startsWith('/routes/') || p.startsWith('/portals/'));

  console.log('Golpes…');
  const moves = await extractMoves();
  console.log(`  ${Object.keys(moves).length} golpes`);

  console.log(`Espécies (${speciesPaths.length})…`);
  const species = (await pool(speciesPaths, extractSpecies)).filter(Boolean).sort((a, b) => a.id - b.id);

  console.log(`Rotas e portais (${routePaths.length})…`);
  const routes = (await pool(routePaths, extractRoute)).filter(Boolean);

  // ordem do mundo: rotas por número, depois portais e especiais
  const order = (r) => { const m = r.slug.match(/route_(\d+)/); return m ? +m[1] : 10000 + (r.kind === 'portal' ? 0 : 500); };
  routes.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));

  console.log('Formas Mega…');
  const megas = await extractMegas();

  const data = { source: BASE, generatedAt: new Date().toISOString(), wikiDate: lastmod, moves, species, routes, megas };
  await mkdir(join(ROOT, 'data'), { recursive: true });
  const out = join(ROOT, 'data', 'wiki.json');
  let prev = null;
  try { prev = JSON.parse(await readFile(out, 'utf8')); } catch {}
  await writeFile(out, JSON.stringify(data));
  console.log(`Pronto: ${species.length} espécies, ${routes.length} mapas, ${Object.keys(moves).length} golpes.`);
  if (prev) console.log(`(antes: ${prev.species.length} espécies, ${prev.routes.length} mapas)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
