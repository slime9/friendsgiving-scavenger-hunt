// Builds the example config into a temp folder and checks the chain end to end:
// every lock opens with the right code, refuses wrong ones, and no secret text leaks
// into the public site.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { unseal } from '../src/site/crypto.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hunt-test-'));
const cfgPath = path.join(tmp, 'hunt.config.json');
const example = JSON.parse(fs.readFileSync(path.join(root, 'hunt.config.example.json'), 'utf8'));
example.clues.push({ spot: 'SECRET-SPOT-XYZ', text: 'Clue with <b>html</b> & "quotes" SECRET-TEXT-XYZ' });
fs.writeFileSync(cfgPath, JSON.stringify(example));

const build = () => execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs'), '--config', cfgPath, '--out', tmp], { stdio: 'pipe' });
build();
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const site = path.join(tmp, 'site');
const read = (slug) => JSON.parse(fs.readFileSync(path.join(site, 'c', `${slug}.json`), 'utf8'));

// codes: 5 chars, unambiguous alphabet, letters + digits, unique
const codes = cfg.clues.map((c) => c.code);
for (const c of codes) assert.match(c, /^(?=.*[A-Z])(?=.*[2-9])[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/);
assert.equal(new Set(codes).size, codes.length);

// clue 1 is open
const first = read(cfg.clues[0].slug);
assert.equal(first.payload.n, 1);
assert.equal(first.payload.code, codes[0]);

// each later page opens only with the previous clue's code
const pages = [...cfg.clues, cfg.finale];
for (let i = 1; i < pages.length; i++) {
  const { box } = read(pages[i].slug);
  assert.ok(box, `page ${i + 1} should be locked`);
  assert.equal(await unseal(box, 'WRONG'), null);
  if (i >= 2) assert.equal(await unseal(box, codes[i - 2]), null, 'an older code must not open it');
  const p = await unseal(box, codes[i - 1].toLowerCase()); // case-insensitive
  assert.ok(p, `page ${i + 1} should open with ${codes[i - 1]}`);
  if (i < cfg.clues.length) {
    assert.equal(p.n, i + 1);
    assert.equal(p.code, codes[i]);
    assert.equal(p.text, cfg.clues[i].text);
  } else {
    assert.equal(p.kind, 'finale');
    assert.match(p.message, /raffle tickets/);
  }
}

// nothing secret in the public site
const all = fs.readdirSync(site, { recursive: true })
  .filter((f) => fs.statSync(path.join(site, f)).isFile())
  .map((f) => fs.readFileSync(path.join(site, f), 'utf8')).join('\n');
for (const secret of ['SECRET-SPOT-XYZ', 'SECRET-TEXT-XYZ', 'raffle', ...codes.slice(1)]) {
  assert.ok(!all.includes(secret), `public site leaks "${secret}"`);
}

// rebuilding keeps slugs and codes stable (printed QR codes keep working)
build();
const again = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
assert.deepEqual(again.clues.map((c) => [c.slug, c.code]), cfg.clues.map((c) => [c.slug, c.code]));
assert.equal(again.finale.slug, cfg.finale.slug);

// print sheet has one QR per page
const print = fs.readFileSync(path.join(tmp, 'print.html'), 'utf8');
assert.equal((print.match(/<svg/g) || []).length, pages.length);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`ok: ${pages.length} pages, chain verified, no leaks, stable rebuild`);
