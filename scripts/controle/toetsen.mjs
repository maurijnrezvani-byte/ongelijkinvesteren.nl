// Meet per hero: het contrast van tekst tegen wat er werkelijk achter staat, en de afstand tussen het kaartlabel en de kop.
// node contrast.mjs <basis-url> [--breedtes=...] [--paginas=...] [--rood=a,b,c,d,e,f] [--blauw=...] [--groen=...] [--beeld=map]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [basis, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => { const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), ''] : [a.slice(2, i), a.slice(i + 1)]; }));
const breedtes = (opt.breedtes || '1240,375').split(',').map(Number);
const paginas = (opt.paginas || '/,/aanbod/,/masterclass/,/methode/,/over/,/contact/,/colofon/,/privacy/,/404.html').split(',');
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


await stuur('DOM.enable');
const toets = async (key, code, vk, mod = 0) => { for (const type of ['rawKeyDown', 'keyUp']) await stuur('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, modifiers: mod }); };
const actief = `(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
  const zichtbaar = r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  return { el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).filter((k) => !k.startsWith('astro-')).join('.') : ''), tekst: (e.innerText || e.getAttribute('aria-label') || e.placeholder || e.value || '').trim().slice(0, 34), zichtbaar, rand: c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2, kleur: c.outlineColor, y: Math.round(r.top), x: Math.round(r.left) }; })()`;
for (const b of breedtes) {
  await stuur('Emulation.setDeviceMetricsOverride', { width: b, height: b < 600 ? 812 : 800, deviceScaleFactor: 1, mobile: false });
  for (const p of paginas) {
    const geladen = new Promise((r) => { const f = (d) => { if (d.method === 'Page.loadEventFired') { luisteraars.splice(luisteraars.indexOf(f), 1); r(); } }; luisteraars.push(f); });
    await stuur('Page.navigate', { url: basis + p }); await geladen; await js('document.fonts.ready.then(() => 1)'); await wacht(200);
    const stops = []; const fout = [];
    let menuGetest = false;
    for (let i = 0; i < 80; i++) {
      await toets('Tab', 'Tab', 9); await wacht(40);
      const a = await js(actief);
      if (!a) break;
      const sleutel = a.el + '|' + a.tekst;
      if (stops.length && stops[0].sleutel === sleutel) break;
      stops.push({ ...a, sleutel });
      if (!a.zichtbaar) fout.push(`niet zichtbaar: ${sleutel}`);
      if (!a.rand) fout.push(`geen focusrand: ${sleutel}`);
      if (opt.beeld && (i === 0 || (i === 2 && b > 600))) { mkdirSync(opt.beeld, { recursive: true }); const s = await stuur('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: b, height: 260, scale: 1 } }); writeFileSync(join(opt.beeld, `${b}-${p === '/' ? 'home' : p.replace(/\//g, '')}-tab${i + 1}.jpg`), Buffer.from(s.data, 'base64')); }
      if (a.el.includes('menuknop') && !menuGetest) {
        menuGetest = true;
        await toets('Enter', 'Enter', 13); await stuur('Input.dispatchKeyEvent', { type: 'char', text: '\r' }); await wacht(120);
        let open = await js(`document.querySelector('.kop').classList.contains('open') + '|' + document.querySelector('.menuknop').getAttribute('aria-expanded')`);
        if (open !== 'true|true') { await js(`document.activeElement.click()`); await wacht(100); open = await js(`document.querySelector('.kop').classList.contains('open') + '|' + document.querySelector('.menuknop').getAttribute('aria-expanded')`) + ' (na klik, Enter deed niets)'; }
        const items = [];
        for (let k = 0; k < 6; k++) { await toets('Tab', 'Tab', 9); await wacht(40); const m = await js(actief); items.push(m ? m.tekst + (m.zichtbaar && m.rand ? '' : ' (!)') : '?'); }
        if (opt.beeld) { const s = await stuur('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: b, height: 560, scale: 1 } }); writeFileSync(join(opt.beeld, `${b}-${p === '/' ? 'home' : p.replace(/\//g, '')}-menu.jpg`), Buffer.from(s.data, 'base64')); }
        await toets('Escape', 'Escape', 27); await wacht(80);
        const na = await js(`document.querySelector('.kop').classList.contains('open') + '|' + (document.activeElement.className || '')`);
        console.log(`   menu: open=${open}; items: ${items.join(', ')}; na Escape: ${na}`);
      }
    }
    console.log(`${b} ${p}: ${stops.length} stops: ${stops.map((s) => s.tekst || s.el).join(' > ')}${fout.length ? '\n   FOUT: ' + [...new Set(fout)].join(' | ') : ''}`);
  }
}
ws.close(); chrome.kill(); await wacht(300);
try { rmSync(profiel, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
