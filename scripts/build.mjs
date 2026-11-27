// Builds the hunt from hunt.config.json:
//   dist/site/    -> the public site (only encrypted clue data). This is what gets deployed.
//   dist/print.html -> QR cards + answer key. Local only, never deployed.
// Missing slugs and codes are generated once and written back into the config, so printed
// QR codes keep working when you edit clue text later.
//
// Usage: node scripts/build.mjs [--config hunt.config.json] [--out dist]

import fs from 'node:fs';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { seal, ALPHABET, CODE_LENGTH, normalizeCode } from '../src/site/crypto.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? path.resolve(args[i + 1]) : def;
};
const configPath = opt('config', path.join(root, 'hunt.config.json'));
const outDir = opt('out', path.join(root, 'dist'));

if (!fs.existsSync(configPath)) {
  fs.copyFileSync(path.join(root, 'hunt.config.example.json'), configPath);
  console.log(`Created ${path.relative(root, configPath)} from the example. Edit it, then build again.`);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const fail = (msg) => { console.error(`Config error: ${msg}`); process.exit(1); };

// ---- validate --------------------------------------------------------------
if (typeof config.baseUrl !== 'string' || !/^https?:\/\/.+\/$/.test(config.baseUrl)) fail('baseUrl must be a URL ending in "/"');
if (!Array.isArray(config.clues) || config.clues.length === 0) fail('clues must be a non-empty list');
config.clues.forEach((c, i) => {
  if (typeof c.text !== 'string' || !c.text.trim()) fail(`clue ${i + 1} needs "text"`);
});
const f = config.finale;
if (!f || typeof f.title !== 'string' || typeof f.message !== 'string') fail('finale needs "title" and "message"');
if (config.startCode != null && normalizeCode(config.startCode).length < 3) fail('startCode must be null or at least 3 letters/digits');

// ---- fill in slugs and codes (once) ----------------------------------------
const pick = (chars, n) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join('');
const randomCode = () => {
  // Mix letters and digits so codes look random and never spell a word.
  for (;;) {
    const c = pick(ALPHABET, CODE_LENGTH);
    if (/[A-Z]/.test(c) && /[0-9]/.test(c)) return c;
  }
};
const pages = [...config.clues, f];
let changed = false;
const usedSlugs = new Set();
const usedCodes = new Set();
for (const p of pages) {
  if (!p.slug || usedSlugs.has(p.slug)) { p.slug = pick('abcdefghijkmnpqrstuvwxyz23456789', 10); changed = true; }
  usedSlugs.add(p.slug);
}
for (const c of config.clues) {
  if (c.code) c.code = normalizeCode(c.code);
  if (!c.code || usedCodes.has(c.code)) { c.code = randomCode(); changed = true; }
  usedCodes.add(c.code);
}
if (changed) {
  // Keep a readable key order: spot, slug, code, then the rest.
  const order = (o, keys) => Object.fromEntries([...keys.filter((k) => k in o).map((k) => [k, o[k]]), ...Object.entries(o).filter(([k]) => !keys.includes(k))]);
  config.clues = config.clues.map((c) => order(c, ['spot', 'slug', 'code', 'text']));
  config.finale = order(f, ['spot', 'slug', 'title', 'message']);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`Generated new slugs/codes and saved them to ${path.relative(root, configPath)}.`);
}

// ---- build site --------------------------------------------------------------
const siteDir = path.join(outDir, 'site');
fs.rmSync(siteDir, { recursive: true, force: true });
fs.mkdirSync(path.join(siteDir, 'c'), { recursive: true });
for (const file of fs.readdirSync(path.join(root, 'src/site'))) {
  fs.copyFileSync(path.join(root, 'src/site', file), path.join(siteDir, file));
}
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');
fs.writeFileSync(path.join(siteDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

const clues = config.clues;
const finale = config.finale;
const total = clues.length;
const entries = [
  ...clues.map((c, i) => ({
    page: c,
    label: `#${i + 1}`,
    payload: { kind: 'clue', n: i + 1, total, text: c.text, code: c.code },
    lock: i === 0 ? (config.startCode ? normalizeCode(config.startCode) : null) : clues[i - 1].code,
  })),
  {
    page: finale,
    label: 'FINALE',
    payload: { kind: 'finale', title: finale.title, message: finale.message },
    lock: clues[total - 1].code,
  },
];

for (const e of entries) {
  const data = e.lock ? { box: await seal(e.payload, e.lock) } : { payload: e.payload };
  fs.writeFileSync(path.join(siteDir, 'c', `${e.page.slug}.json`), JSON.stringify(data));
  e.url = `${config.baseUrl}?c=${e.page.slug}`;
}

// ---- print sheet --------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const cards = [];
for (const e of entries) {
  const svg = await QRCode.toString(e.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  cards.push(`
  <section class="card">
    <div class="face">
      <p class="hey">🦃 You found something!</p>
      <div class="qr">${svg}</div>
      <p class="scan">Scan with your phone camera</p>
    </div>
    <div class="stub">✂ host only, cut off before hiding · <b>${esc(e.label)}</b> · ${esc(e.page.spot || '(no spot set)')}</div>
  </section>`);
}
const rows = entries.map((e) => `
    <tr><td><b>${esc(e.label)}</b></td><td>${esc(e.page.spot)}</td><td class="mono">${e.lock ? esc(e.lock) : '(open)'}</td>
    <td class="mono">${e.payload.code ? esc(e.payload.code) : '(finale)'}</td><td class="url">${esc(e.url)}</td></tr>`).join('');

fs.writeFileSync(path.join(outDir, 'print.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Hunt print sheet (SECRET)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #222; }
  .key { padding: 0.5in; page-break-after: always; }
  .key h1 { margin-top: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  td, th { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 15px; letter-spacing: 0.1em; }
  .url { font-size: 10px; word-break: break-all; }
  .card { height: 5.3in; display: flex; flex-direction: column; justify-content: space-between; border-bottom: 1px dashed #999; page-break-inside: avoid; }
  .card:nth-of-type(2n) { page-break-after: always; }
  .face { text-align: center; padding-top: 0.25in; }
  .hey { font-size: 28px; font-weight: 800; margin: 0 0 8px; }
  .qr svg { width: 3.4in; height: 3.4in; }
  .scan { font-size: 18px; margin: 4px 0 0; }
  .stub { border-top: 1px dashed #999; padding: 8px 0.4in; font-size: 12px; color: #555; }
  @media print { .noprint { display: none; } }
</style></head><body>
<div class="key">
  <h1>Answer key (don’t leave this lying around)</h1>
  <p>Clue 1 is ${entries[0].lock ? `locked with start code <b class="mono">${esc(entries[0].lock)}</b>` : 'open with no code; post it where everyone starts'}.
  Each clue’s text should lead to the <i>next</i> spot. Cut the stub off every card before hiding it.</p>
  <table><tr><th>QR</th><th>Hidden at</th><th>Code to unlock</th><th>Code it reveals</th><th>URL</th></tr>${rows}</table>
  <p class="noprint">Print with “Background graphics” off and scale at 100%. The cards start on page 2, two per page.</p>
</div>
${cards.join('\n')}
</body></html>
`);

console.log(`Built ${entries.length} pages (${total} clues + finale) into ${path.relative(root, siteDir) || siteDir}`);
console.log(`Print sheet: ${path.join(outDir, 'print.html')}`);
