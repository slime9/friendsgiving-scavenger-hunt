# Founder queue (Andy only)

## Before the party (2026-11-28)

Done: the first deploy, GitHub Pages (it turned on by itself when `gh-pages` was pushed; the site is
at https://slime9.github.io/friendsgiving-scavenger-hunt/), and a phone test of the placeholder hunt
(2026-11-27).

1. **Write the hunt.** In `hunt.config.json`, set each clue's `spot` and `text` and add or remove
   clues. Then run `npm run build` and `npm run deploy`.
2. **Phone-check the real clues** after that deploy. Long clue text is the one thing the placeholder
   test didn't cover.
3. **Print** `dist/print.html` at 100% scale. Cut off the stubs and hide the cards. Keep page 1
   (the answer key) yourself.
4. **Back up `hunt.config.json`.** It exists only on this laptop.
