// Builds, then force-pushes ONLY dist/site (encrypted clue data + page code) to the
// gh-pages branch. The config with the plain clues and codes never leaves this laptop.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

run(process.execPath, [path.join(root, 'scripts/build.mjs')]);

const site = path.join(root, 'dist/site');
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root }).toString().trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hunt-deploy-'));
fs.cpSync(site, tmp, { recursive: true });

run('git', ['init', '-q', '-b', 'gh-pages'], tmp);
run('git', ['add', '-A'], tmp);
run('git', ['-c', 'user.name=hunt-deploy', '-c', 'user.email=hunt-deploy@users.noreply.github.com', 'commit', '-q', '-m', 'Deploy hunt site'], tmp);
run('git', ['push', '--force', remote, 'gh-pages'], tmp);
fs.rmSync(tmp, { recursive: true, force: true });

const { baseUrl } = JSON.parse(fs.readFileSync(path.join(root, 'hunt.config.json'), 'utf8'));
console.log(`\nDeployed. GitHub Pages usually updates within a minute: ${baseUrl}`);
