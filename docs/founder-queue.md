# Founder queue (Andy only)

## Before the party (2026-11-28)

1. **Approve the first deploy.** Claude runs `npm run deploy` once you say yes. That makes the
   `gh-pages` branch, which holds only encrypted clue data.
2. **Turn on GitHub Pages** (once). Either let Claude run
   `gh api -X POST repos/slime9/friendsgiving-scavenger-hunt/pages -f "source[branch]=gh-pages" -f "source[path]=/"`,
   or go to GitHub → repo **Settings → Pages**, set Source to *Deploy from a branch*, choose
   `gh-pages` / `(root)`, and click Save. The site is at
   https://slime9.github.io/friendsgiving-scavenger-hunt/.
3. **Write the hunt.** In `hunt.config.json`, set each clue's `spot` and `text` and add or remove
   clues. Then `npm run build`, and `npm run deploy` (with a yes).
4. **Test on a real phone over cellular** (Wi-Fi off). Scan QR #1 from the print sheet on screen.
   Enter a wrong code on #2 and check that it's refused. Play through to the finale and check the
   confetti and the clock. A headless check can't prove the phone camera opens the link, how the
   keyboard behaves, or how it looks on a small screen.
5. **Print** `dist/print.html` at 100% scale. Cut off the stubs and hide the cards. Keep page 1
   (the answer key) yourself.
6. **Back up `hunt.config.json`.** It exists only on this laptop.
