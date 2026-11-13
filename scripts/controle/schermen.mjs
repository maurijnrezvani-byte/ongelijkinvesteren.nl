// Schermafbeeldingen en controle van de gebouwde site met Chrome zonder venster (DevTools-protocol).
// node schermen.mjs <basis-url> <uitmap> [--breedtes=1240,1075,375] [--paginas=/,/aanbod/] [--vol] [--wacht=350]
// --wacht: milliseconden wachten na het laden (ruim nemen voor de contactpagina, waar het Tally-formulier inlaadt)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [basis, uit, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
const breedtes = (opt.breedtes || '1240,1075,375').split(',').map(Number);
const paginas = (opt.paginas || '/,/aanbod/,/masterclass/,/methode/,/dashboard/,/over/,/contact/,/colofon/,/privacy/,/404.html').split(',');
const vol = 'vol' in opt; // hele pagina in één beeld op ware grootte (voor de gebruiker)
const tegelH = Number(opt.tegel || 1500);

const profiel = join(uit, '_chrome');
try { rmSync(profiel, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
mkdirSync(uit, { recursive: true });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profiel}`, '--hide-scrollbars',
  '--no-first-run', '--disable-gpu', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' });

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
let poort;
for (let i = 0; i < 100 && !poort; i++) {
  await wacht(100);
  const f = join(profiel, 'DevToolsActivePort');
  if (existsSync(f)) poort = readFileSync(f, 'utf8').split('\n')[0];
}
const doelen = await (await fetch(`http://127.0.0.1:${poort}/json`)).json();
const ws = new WebSocket(doelen.find((d) => d.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const open = new Map();
const luisteraars = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && open.has(d.id)) { const { res, rej } = open.get(d.id); open.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
  else if (d.method) luisteraars.forEach((l) => l(d));
};
const stuur = (method, params = {}) => new Promise((res, rej) => { open.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await stuur('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await stuur('Page.enable'); await stuur('Runtime.enable'); await stuur('Network.enable'); await stuur('Log.enable');

const controle = `(() => {
  const vw = document.documentElement.clientWidth;
  const uitsteek = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.right > vw + 1 || r.left < -1) {
      // alleen melden als geen voorouder het afknipt
      let p = el.parentElement, geknipt = false;
      while (p && p !== document.body) { const o = getComputedStyle(p); if (o.overflowX !== 'visible' || o.overflow !== 'visible') { geknipt = true; break; } p = p.parentElement; }
      uitsteek.push((geknipt ? '(geknipt) ' : '') + el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ').slice(0, 2).join('.') + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    }
  }
  // tekst die uit zijn eigen vak loopt
  const krap = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,a,li,span,button,td,th,dt,dd,label')) {
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).display !== 'inline') krap.push(el.tagName.toLowerCase() + ': ' + el.textContent.trim().slice(0, 40) + ' (' + el.scrollWidth + '>' + el.clientWidth + ')');
  }
  return { breed: document.documentElement.scrollWidth, vw, hoog: document.documentElement.scrollHeight, h1: document.querySelectorAll('h1').length,
    uitsteek: uitsteek.slice(0, 12), krap: krap.slice(0, 12), titel: document.title };
})()`;

const rapport = {};
for (const b of breedtes) {
  const mobiel = b < 600;
  const h = mobiel ? 812 : 800;
  await stuur('Emulation.setDeviceMetricsOverride', { width: b, height: h, deviceScaleFactor: vol && mobiel ? 2 : 1, mobile: mobiel });
  if (mobiel) await stuur('Emulation.setTouchEmulationEnabled', { enabled: true });
  for (const p of paginas) {
    const fouten = [];
    const l = (d) => {
      if (d.method === 'Runtime.exceptionThrown') fouten.push('uitzondering: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 200));
      if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) fouten.push('console.' + d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
      if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') fouten.push('log: ' + d.params.entry.text.slice(0, 160) + ' ' + (d.params.entry.url || ''));
      if (d.method === 'Network.responseReceived' && d.params.response.status >= 400 && !(d.params.type === 'Document')) fouten.push(d.params.response.status + ' ' + d.params.response.url);
      if (d.method === 'Network.requestWillBeSent' && !d.params.request.url.startsWith(basis) && !d.params.request.url.startsWith('data:') && !d.params.request.url.startsWith('about:')) fouten.push('EXTERN verzoek: ' + d.params.request.url.slice(0, 120));
    };
    luisteraars.push(l);
    const geladen = new Promise((r) => { const f = (d) => { if (d.method === 'Page.loadEventFired') { luisteraars.splice(luisteraars.indexOf(f), 1); r(); } }; luisteraars.push(f); });
    await stuur('Page.navigate', { url: basis + p });
    await geladen;
    await js('document.fonts.ready.then(() => 1)');
    await wacht(Number(opt.wacht || 350));
    const c = await js(controle);
    c.fouten = fouten;
    luisteraars.splice(luisteraars.indexOf(l), 1);
    rapport[`${b} ${p}`] = c;
    const naam = (p === '/' ? 'home' : p.replace(/\//g, '')) || 'home';
    const map = join(uit, String(b)); mkdirSync(map, { recursive: true });
    if (vol) {
      const s = await stuur('Page.captureScreenshot', { format: 'jpeg', quality: 88, captureBeyondViewport: true, clip: { x: 0, y: 0, width: b, height: c.hoog, scale: 1 } });
      writeFileSync(join(map, `${naam}.jpg`), Buffer.from(s.data, 'base64'));
    } else {
      const schaal = mobiel ? 1 : Math.min(1, 820 / b);
      for (let y = 0, n = 1; y < c.hoog; y += tegelH, n++) {
        const s = await stuur('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true, clip: { x: 0, y, width: b, height: Math.min(tegelH, c.hoog - y), scale: schaal } });
        writeFileSync(join(map, `${naam}-${n}.jpg`), Buffer.from(s.data, 'base64'));
      }
    }
  }
}
writeFileSync(join(uit, 'rapport.json'), JSON.stringify(rapport, null, 1));
for (const [k, v] of Object.entries(rapport)) {
  const opm = [];
  if (v.breed > v.vw) opm.push(`BREDER dan scherm: ${v.breed} > ${v.vw}`);
  if (v.h1 !== 1) opm.push(`h1: ${v.h1}`);
  if (v.uitsteek.length) opm.push('steekt uit: ' + v.uitsteek.join(' | '));
  if (v.krap.length) opm.push('krap: ' + v.krap.join(' | '));
  if (v.fouten.length) opm.push('fouten: ' + v.fouten.join(' | '));
  console.log(`${k}  hoog ${v.hoog}  ${opm.length ? opm.join('\n    ') : 'ok'}`);
}
ws.close(); chrome.kill();
try { rmSync(profiel, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
