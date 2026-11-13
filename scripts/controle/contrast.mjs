// Meet per hero: het contrast van tekst tegen wat er werkelijk achter staat, en de afstand tussen het kaartlabel en de kop.
// node contrast.mjs <basis-url> [--breedtes=...] [--paginas=...] [--rood=a,b,c,d,e,f] [--blauw=...] [--groen=...] [--beeld=map]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [basis, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => { const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), ''] : [a.slice(2, i), a.slice(i + 1)]; }));
const breedtes = (opt.breedtes || '1000,1075,1240,1440').split(',').map(Number);
const paginas = (opt.paginas || '/,/aanbod/,/masterclass/,/methode/,/dashboard/,/over/').split(',');
const kern = JSON.parse(opt.kern || '{"x":592.4,"y":221.7}');
const matrices = {};
for (const t of ['rood', 'blauw', 'groen']) if (opt[t]) matrices[t] = opt[t].split(',').map(Number);
const hoogMatrix = opt.hoog ? opt.hoog.split(',').map(Number) : null; // aparte uitsnede voor de hoge hero (homepage)
const kanten = { rood: opt['kant-rood'], blauw: opt['kant-blauw'], groen: opt['kant-groen'] };

const profiel = mkdtempSync(join(opt.tmp || tmpdir(), 'chr-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profiel}`, '--hide-scrollbars', '--no-first-run', '--disable-gpu', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' });
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
let poort;
for (let i = 0; i < 100 && !poort; i++) { await wacht(100); const f = join(profiel, 'DevToolsActivePort'); if (existsSync(f)) poort = readFileSync(f, 'utf8').split('\n')[0]; }
const doelen = await (await fetch(`http://127.0.0.1:${poort}/json`)).json();
const ws = new WebSocket(doelen.find((d) => d.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const open = new Map(); const luisteraars = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && open.has(d.id)) { const { res, rej } = open.get(d.id); open.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method) luisteraars.forEach((l) => l(d)); };
const stuur = (method, params = {}) => new Promise((res, rej) => { open.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => { const r = await stuur('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
await stuur('Page.enable'); await stuur('Runtime.enable');

const meet = `(async (a, b) => {
  const laad = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([laad(a), laad(b)]);
  const w = ia.width, h = ia.height;
  const pix = (i) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, w, h).data; };
  const pa = pix(ia), pb = pix(ib);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const hero = document.querySelector('.hero');
  const groepen = { kop: ['.hero h1'], intro: ['.hero .intro'], uitleg: ['.hero .uitleg'], nav: ['.kop .menu a:not(.knop)', '.kop .woordmerk span'] };
  const uit = {};
  for (const [naam, sels] of Object.entries(groepen)) {
    const cs = [];
    for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
      if (!el.getClientRects().length) continue;
      const m = getComputedStyle(el).color.match(/[\\d.]+/g).map(Number);
      const lt = lum(m[0], m[1], m[2]);
      const r = document.createRange(); r.selectNodeContents(el);
      for (const q of r.getClientRects()) {
        for (let y = Math.max(0, Math.floor(q.top + scrollY)); y < Math.min(h, q.bottom + scrollY); y++)
          for (let x = Math.max(0, Math.floor(q.left)); x < Math.min(w, q.right); x++) {
            const i = (y * w + x) * 4;
            // alleen de kern van een letter: daar is de pixel (bijna) helemaal tekstkleur
            const d = Math.abs(pa[i] - m[0]) + Math.abs(pa[i + 1] - m[1]) + Math.abs(pa[i + 2] - m[2]);
            const verschil = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
            if (d > 24 || verschil < 12) continue;
            const lb = lum(pb[i], pb[i + 1], pb[i + 2]);
            cs.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05));
          }
      }
    }
    cs.sort((x, y) => x - y);
    uit[naam] = cs.length ? { min: +cs[0].toFixed(2), p2: +cs[Math.floor(cs.length * 0.02)].toFixed(2), n: cs.length } : null;
  }
  // label en kop
  const lab = [...document.querySelectorAll('.vlak-label .kern')].find((e) => e.getClientRects().length && getComputedStyle(e.parentElement).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
  if (lab) {
    const L = lab.getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(document.querySelector('.hero h1'));
    let gat = Infinity;
    for (const q of r.getClientRects()) {
      const dx = Math.max(q.left - L.right, L.left - q.right, 0), dy = Math.max(q.top - L.bottom, L.top - q.bottom, 0);
      gat = Math.min(gat, Math.hypot(dx, dy));
    }
    const k = document.querySelector('.kop .kop-binnen > :last-child, .kop .menuknop');
    let nav = Infinity;
    for (const el of document.querySelectorAll('.kop a, .kop button')) { if (!el.getClientRects().length) continue; const q = el.getBoundingClientRect(); const dx = Math.max(q.left - L.right, L.left - q.right, 0), dy = Math.max(q.top - L.bottom, L.top - q.bottom, 0); nav = Math.min(nav, Math.hypot(dx, dy)); }
    const H = hero.getBoundingClientRect();
    uit.label = { gatKop: Math.round(gat), gatNav: Math.round(nav), rechts: Math.round(document.documentElement.clientWidth - L.right), links: Math.round(L.left), onder: Math.round(H.bottom - L.bottom), boven: Math.round(L.top - H.top) };
  } else uit.label = null;
  return uit;
})`;

const rijen = [];
for (const b of breedtes) {
  await stuur('Emulation.setDeviceMetricsOverride', { width: b, height: b < 600 ? 812 : 800, deviceScaleFactor: 1, mobile: b < 600 });
  for (const p of paginas) {
    const geladen = new Promise((r) => { const f = (d) => { if (d.method === 'Page.loadEventFired') { luisteraars.splice(luisteraars.indexOf(f), 1); r(); } }; luisteraars.push(f); });
    await stuur('Page.navigate', { url: basis + p }); await geladen;
    await js('document.fonts.ready.then(() => 1)'); await wacht(250);
    const info = await js(`(() => { const h = document.querySelector('.hero'); if (!h) return null; return { thema: document.documentElement.dataset.theme, hoog: h.classList.contains('hoog') }; })()`);
    if (!info) continue;
    const m = (info.hoog && hoogMatrix) || matrices[info.thema];
    if (m && b >= 640) {
      await js(`(() => { const m = ${JSON.stringify(m)}; const k = ${JSON.stringify(kern)};
        for (const u of document.querySelectorAll('.hero .vlak.breed use')) u.setAttribute('transform', 'matrix(' + m.join(' ') + ')');
        const p = document.querySelector('.hero .vlak-label.breed .kern');
        if (p) { p.style.left = ((m[0] * k.x + m[2] * k.y + m[4]) / 1240 * 100) + '%'; p.style.top = ((m[1] * k.x + m[3] * k.y + m[5]) / 720 * 100) + '%';
          const kant = ${JSON.stringify(kanten)}[${JSON.stringify(info.thema)}]; if (kant) { p.classList.remove('links', 'rechts', 'auto'); p.classList.add(kant); } } })()`);
      await wacht(150);
    }
    const H = await js(`(() => { const r = document.querySelector('.hero').getBoundingClientRect(); return { y: r.top + scrollY, h: r.height }; })()`);
    const clip = { x: 0, y: 0, width: b, height: Math.ceil(H.y + H.h), scale: 1 };
    const A = (await stuur('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })).data;
    await js(`(() => { const s = document.createElement('style'); s.id = 'meet'; s.textContent = '.hero h1, .hero .intro, .hero .uitleg, .kop .menu a:not(.knop), .kop .woordmerk span { color: transparent !important; text-decoration-color: transparent !important; }'; document.head.append(s); })()`);
    await wacht(80);
    const B = (await stuur('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })).data;
    await js(`document.getElementById('meet').remove()`);
    const r = await js(`${meet}(${JSON.stringify(A)}, ${JSON.stringify(B)})`);
    rijen.push({ b, p, ...r });
    if (opt.beeld) { mkdirSync(opt.beeld, { recursive: true }); const s = await stuur('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true, clip: { ...clip, scale: Math.min(1, 820 / b) } }); writeFileSync(join(opt.beeld, `${b}-${p === '/' ? 'home' : p.replace(/\//g, '')}.jpg`), Buffer.from(s.data, 'base64')); }
  }
}
const f = (o) => (o ? `${o.min.toFixed(1)}/${o.p2.toFixed(1)}` : '-');
console.log('breedte pagina          kop(min/p2)  intro     uitleg    nav       label: gat kop, gat nav, rechts, onder');
for (const r of rijen) {
  const l = r.label ? `${r.label.gatKop}, ${r.label.gatNav}, ${r.label.rechts}, ${r.label.onder}` : 'geen';
  const vlag = [(r.kop && r.kop.min < 3) ? 'KOP<3' : '', (r.intro && r.intro.min < 4.5) ? 'INTRO<4.5' : '', (r.uitleg && r.uitleg.min < 4.5) ? 'UITLEG<4.5' : '', (r.nav && r.nav.min < 4.5) ? 'NAV<4.5' : '', (r.label && (r.label.gatKop < 24 || r.label.rechts < 8 || r.label.gatNav < 8)) ? 'LABEL' : ''].filter(Boolean).join(' ');
  console.log(`${String(r.b).padEnd(7)} ${r.p.padEnd(14)} ${f(r.kop).padEnd(12)} ${f(r.intro).padEnd(9)} ${f(r.uitleg).padEnd(9)} ${f(r.nav).padEnd(9)} ${l.padEnd(22)} ${vlag}`);
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(rijen));
ws.close(); chrome.kill();
await wacht(300);
try { rmSync(profiel, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
