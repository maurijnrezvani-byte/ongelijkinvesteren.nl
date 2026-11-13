// Maakt src/data/helmond.json en src/data/gemeenten.json uit de werkversie van het dashboard.
//
// Draaien (vanuit website/):  node scripts/helmond-data.mjs
//
// Het script leest alleen; aan het dashboard verandert niets. De rekenregels hieronder zijn
// letterlijk die van dashboard/index.html met de standaardinstellingen: buurten, vergeleken
// met heel Nederland, weging per thema, minstens 200 inwoners, minstens 70% van de
// indicatoren gevuld, studentenbuurten (25% of meer hbo/wo) niet meegeteld, stapeling bij
// 4 of meer thema's in de zwaarste 20% van Nederland.
//
// De uitkomst staat in de repository, zodat de site ook bouwt zonder de dashboardmap
// (die staat niet in de openbare repository).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hier = dirname(fileURLToPath(import.meta.url));
const dashboard = join(hier, '..', '..', 'Ongelijk Investeren Dashboard', 'dashboard');
const GM = 'GM0794';
const INST = { minInw: 200, minDek: 0.7, zonderStud: true, drempel: 4 };

const D = JSON.parse(readFileSync(join(dashboard, 'data', 'buurtscores.json'), 'utf8'));
const geo = JSON.parse(readFileSync(join(dashboard, 'geo', `${GM}.json`), 'utf8'));
const vorm = JSON.parse(readFileSync(join(hier, 'kaart-helmond-vorm.json'), 'utf8'));

// ---- rekenregels (uit dashboard/index.html) ----
const IND = D.ind;
const TH = D.themas;
const NIND = IND.length;
const NIETMEE = ['geb', 'verd', 'ctx'];
const indTelt = (x) => !NIETMEE.includes(x.t);
const A = IND.map((x, i) => (indTelt(x) && x.std !== false ? i : -1)).filter((i) => i >= 0);
const STUD = IND.findIndex((x) => x.k === 'stud');
const gem = (a) => { let s = 0, n = 0; for (const x of a) if (x != null) { s += x; n++; } return n ? s / n : null; };

const s = D.buurt;
const rijen = s.c.map((c, k) => {
  const v = s.v[k];
  const tv = v.map((x, i) => (x == null ? null : IND[i].log ? Math.log(x + (IND[i].log || 1)) : x));
  return { c, n: s.n[k], g: s.g[k], i: s.i[k] || 0, v, tv };
});
const dekking = (r) => { let n = 0; for (const i of A) if (r.tv[i] != null) n++; return n; };
const isStudent = (r) => STUD >= 0 && r.v[STUD] != null && r.v[STUD] >= 25;
const telt = (r) => r.i >= INST.minInw && dekking(r) >= Math.ceil(INST.minDek * A.length) && !(INST.zonderStud && isStudent(r));

function stats(rows) {
  const m = new Array(NIND).fill(null), sd = new Array(NIND).fill(null);
  for (const i of A) {
    let sw = 0, swx = 0, n = 0;
    for (const r of rows) { const v = r.tv[i]; if (v == null) continue; const w = Math.max(1, r.i); sw += w; swx += w * v; n++; }
    if (n < 5) continue;
    const mu = swx / sw; let q = 0;
    for (const r of rows) { const v = r.tv[i]; if (v != null) q += Math.max(1, r.i) * (v - mu) * (v - mu); }
    m[i] = mu; sd[i] = Math.sqrt(q / sw) || null;
  }
  return { m, s: sd };
}
const KAP = 4;
function scoor(r, ref) {
  const z = new Array(NIND).fill(null);
  for (let i = 0; i < NIND; i++) {
    const v = r.tv[i];
    if (v == null || ref.m[i] == null || !ref.s[i]) continue;
    z[i] = Math.max(-KAP, Math.min(KAP, (-IND[i].r * (v - ref.m[i])) / ref.s[i]));
  }
  const th = {};
  for (const t of TH) th[t.k] = gem(A.filter((i) => IND[i].t === t.k).map((i) => z[i]));
  return { th, tot: gem(TH.map((t) => th[t.k])) };
}
function drempels(res) {
  const d = {};
  for (const t of TH) {
    const v = res.map((x) => x.th[t.k]).filter((x) => x != null).sort((a, b) => a - b);
    d[t.k] = v.length >= 5 ? v[Math.max(0, Math.ceil(v.length * 0.8) - 1)] : null;
  }
  return d;
}

const mee = rijen.filter(telt);
const ref = stats(mee);
const res = new Map(mee.map((r) => [r, scoor(r, ref)]));
const dr = drempels([...res.values()]);
for (const x of res.values()) {
  let st = 0, m = 0; x.zwaar = [];
  for (const t of TH) { const z = x.th[t.k]; if (z == null || dr[t.k] == null) continue; m++; if (z >= dr[t.k]) { st++; x.zwaar.push(t.n); } }
  x.stap = m ? st : null;
}

// ---- landelijk ----
let nlInwMee = 0, nlInwStap = 0, nlStap = 0;
for (const [r, x] of res) { nlInwMee += r.i; if (x.stap != null && x.stap >= INST.drempel) { nlInwStap += r.i; nlStap++; } }

// ---- Helmond ----
const gIdx = D.gem.findIndex((g) => g.c === GM);
const gemeente = D.gem[gIdx];
const alle = rijen.filter((r) => r.g === gIdx);

// De vereenvoudigde vormen uit het huisstijlblad hebben geen buurtcode. Koppel ze aan de
// buurten van het dashboard via het zwaartepunt (zelfde tekenvlak van 1000 x 684,5).
const punten = (d) => [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]);
function zwaartepunt(d) {
  const p = punten(d); let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; const k = x1 * y2 - x2 * y1;
    a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k;
  }
  return [cx / (3 * a), cy / (3 * a)];
}
const geoZ = Object.entries(geo.b).map(([c, d]) => ({ c, z: zwaartepunt(d.split('Z')[0] + 'Z') }));
const vrij = new Set(geoZ.map((g) => g.c));
const buurten = vorm.buurten.map((d) => {
  const [x, y] = zwaartepunt(d);
  let best = null, bd = Infinity;
  for (const g of geoZ) { const q = (g.z[0] - x) ** 2 + (g.z[1] - y) ** 2; if (q < bd) { bd = q; best = g; } }
  if (!vrij.has(best.c)) throw new Error(`Buurt ${best.c} is twee keer gekoppeld; controleer de vormen.`);
  if (Math.sqrt(bd) > 25) throw new Error(`Vorm bij (${x.toFixed(0)}, ${y.toFixed(0)}) ligt te ver van een buurt (${Math.sqrt(bd).toFixed(1)}).`);
  vrij.delete(best.c);
  const r = alle.find((q) => q.c === best.c);
  const x_ = r && res.get(r);
  return {
    c: best.c, n: r ? r.n : best.c, i: r ? r.i : 0,
    stap: x_ ? x_.stap : null,                       // aantal thema's in de zwaarste 20% (null = niet meegeteld)
    zwaar: x_ ? x_.zwaar : [],                       // namen van die thema's
    tot: x_ && x_.tot != null ? +x_.tot.toFixed(3) : null,
    x: +x.toFixed(1), y: +y.toFixed(1), d,
  };
});
if (vrij.size) throw new Error(`Niet gekoppeld: ${[...vrij].join(', ')}`);

const meeH = buurten.filter((b) => b.stap != null);
const stapH = meeH.filter((b) => b.stap >= INST.drempel);
const som = (a) => a.reduce((t, b) => t + b.i, 0);
const verdeling = [0, 1, 2, 3, 4].map((k) => meeH.filter((b) => (k < 4 ? b.stap === k : b.stap >= 4)).length);
// Het label op het vlak: de buurt met de meeste thema's (bij gelijke stand de hoogste totaalscore),
// onder de buurten met minstens 1.000 inwoners. Zo wijst het label niet naar een buurt van een paar straten.
const kern = meeH.filter((b) => b.i >= 1000).sort((a, b) => b.stap - a.stap || b.tot - a.tot)[0];

const uit = {
  bron: 'Ongelijk Investeren Dashboard Nederland, werkversie',
  gebouwd: D.gebouwd, versie: D.versie, indeling: D.indeling,
  themas: TH.map((t) => ({ k: t.k, n: t.n, groep: t.as === 'bev' ? 'bevolking' : 'plek' })), indicatoren: A.length, drempel: INST.drempel,
  gemeente: { c: GM, n: gemeente.n, inwoners: gemeente.i },
  cijfers: {
    buurten: buurten.length, meegeteld: meeH.length, stapelingsbuurten: stapH.length,
    inwonersMeegeteld: som(meeH), inwonersStapeling: som(stapH),
    aandeelInwonersStapeling: +(som(stapH) / som(meeH)).toFixed(4),
    verdeling, // aantal buurten met 0, 1, 2, 3 en 4 of meer thema's in de zwaarste 20%
  },
  nederland: {
    gemeenten: D.gem.length, buurten: rijen.length, meegeteld: mee.length, stapelingsbuurten: nlStap,
    aandeelBuurtenStapeling: +(nlStap / mee.length).toFixed(4),
    aandeelInwonersStapeling: +(nlInwStap / nlInwMee).toFixed(4),
  },
  kern: { c: kern.c, n: kern.n, stap: kern.stap, x: kern.x, y: kern.y },
  box: vorm.box, vorm: vorm.vorm, lijn: vorm.lijn, buurten,
};
writeFileSync(join(hier, '..', 'src', 'data', 'helmond.json'), JSON.stringify(uit));
writeFileSync(join(hier, '..', 'src', 'data', 'gemeenten.json'),
  JSON.stringify(D.gem.map((g) => ({ c: g.c, n: g.n, p: g.p })).sort((a, b) => a.n.localeCompare(b.n, 'nl'))));

console.log(`Dashboardversie ${D.versie} (${D.gebouwd}), ${TH.length} thema's, ${A.length} indicatoren tellen mee.`);
console.log(`${gemeente.n}: ${buurten.length} buurten, ${meeH.length} meegeteld, ${stapH.length} met stapeling;`
  + ` ${(100 * som(stapH) / som(meeH)).toFixed(1)}% van de inwoners. Verdeling 0/1/2/3/4+: ${verdeling.join(' / ')}.`);
console.log(`Heetste kern: ${kern.n}, ${kern.stap} van ${TH.length} thema's.`);
console.log(`Nederland: ${(100 * nlStap / mee.length).toFixed(1)}% van de buurten, ${(100 * nlInwStap / nlInwMee).toFixed(1)}% van de inwoners.`);
