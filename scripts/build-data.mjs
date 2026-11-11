// Compacta data/wiki.json em data/wiki.js (o arquivo que o site carrega).
// Uso: node scripts/build-data.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const d = JSON.parse(await readFile(join(ROOT, 'data', 'wiki.json'), 'utf8'));

const moveKeys = Object.keys(d.moves).sort();
const mIdx = Object.fromEntries(moveKeys.map((k, i) => [k, i]));
// golpes: [nome, tipo, cat, poder, precisão, prioridade, efeito, tm]
const moves = moveKeys.map((k) => { const m = d.moves[k]; return [m.name, m.type, m.cat, m.power, m.acc, m.prio, m.effect, m.tm ? 1 : 0]; });

const species = d.species.map((s) => ({
  id: s.id, slug: s.slug, n: s.name, t: s.types, sp: s.sprite,
  ab: s.abil.map((a) => [a.name, a.hidden ? 1 : 0, a.desc]),
  st: [s.stats.hp, s.stats.atk, s.stats.def, s.stats.spa, s.stats.spd, s.stats.spe],
  ef: s.evo.from, et: s.evo.to, ex: s.evo.text,
  w: s.where.map((w) => [w.map, w.kind === 'portals' ? 1 : 0, w.name, w.lvl, w.rarity, w.chance]),
  wn: s.whereNote,
  dr: s.drops.map((x) => [x.item, x.name, x.chance, x.img]),
  lm: s.lvlMoves.filter(([, k]) => k in mIdx).map(([l, k]) => [l, mIdx[k]]),
  tm: s.tms.filter((k) => k in mIdx).map((k) => mIdx[k]),
}));

const routes = d.routes.map((r) => ({
  slug: r.slug, k: r.kind, n: r.name, rg: r.region, lv: /^Nv/.test(r.lvl) ? r.lvl : '',
  info: /^Nv/.test(r.lvl) ? '' : r.lvl,
  rq: r.req.map((x) => x.replace(/\s+,/g, ',')), b: r.bonus,
  s: r.spawns.map((x) => [x.sp, x.lvl, x.rarity, x.chance]),
}));

const out = { src: d.source, gen: d.generatedAt, wikiDate: d.wikiDate, moves, species, routes, megas: d.megas || [] };
const js = '/* Gerado por scripts/build-data.mjs a partir da Wiki idleDEX. Não edite à mão. */\nwindow.WIKI=' + JSON.stringify(out) + ';\n';
await writeFile(join(ROOT, 'data', 'wiki.js'), js);
console.log(`data/wiki.js: ${(js.length / 1024).toFixed(0)} KB`);
