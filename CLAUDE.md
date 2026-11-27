# CLAUDE.md

A QR scavenger hunt for a Friendsgiving party. A static site is built by Node and hosted on GitHub
Pages. See README.md for the config format and commands.

## Rules for this repo

- **The repo is public. Never commit `hunt.config.json`, `dist/`, or anything else holding clue
  text, spots, or codes.** Only `dist/site/`, which contains encrypted clue data, is published, and
  only through `npm run deploy` to the `gh-pages` branch. `hunt.config.json` is gitignored, so
  check `git status` before every commit anyway.
- `npm run deploy` publishes to the internet. It has an `ask` rule in `.claude/settings.json`, so it
  always needs Andy's yes.
- Don't change existing `slug`s in Andy's config. Printed QR codes point at them.
- Node 22 needs `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`.
- `npm test` must pass before any commit that touches `scripts/` or `src/site/`.

## Layout

- `src/site/`: the page (`index.html`, `app.js`, `style.css`) and `crypto.js`, which is shared with
  the build.
- `scripts/build.mjs`: validates the config, fills in slugs and codes, encrypts the pages, and writes
  `dist/site/` and `dist/print.html`.
- `scripts/test.mjs`: an end-to-end check of the chain against the example config.
- `scripts/deploy.mjs`: builds, then force-pushes `dist/site` to `gh-pages`.
- `docs/founder-queue.md`: things only Andy can do.
