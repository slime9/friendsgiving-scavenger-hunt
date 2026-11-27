# friendsgiving-scavenger-hunt

A QR-code scavenger hunt. Each hidden QR code opens a clue page. Every clue after the first is
**locked with the code shown on the previous clue**, so nobody can join halfway through. The last QR
code opens a finale screen with confetti that says to come and claim raffle tickets.

The lock is real encryption (AES-GCM, with a key derived from the code), not a password check. Until
the right code is typed, a clue's text doesn't exist anywhere on the public site, even in the page
source.

## Setup (once)

Node 22 is under nvm and isn't on PATH by default:

```sh
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
npm install
```

## Configure the hunt

All of the content lives in **`hunt.config.json`**. The file is gitignored, because this repo is
public and the file holds every clue and code. The first `npm run build` creates it from
`hunt.config.example.json`.

```jsonc
{
  "baseUrl": "https://slime9.github.io/friendsgiving-scavenger-hunt/",  // where the site is hosted
  "startCode": null,          // null = clue 1 is open. Set a code to lock clue 1 too.
  "qrSizeInches": 1,          // printed QR size, 0.5 to 4. Leave it out for 1 inch.
  "clues": [
    {
      "spot": "bookshelf, living room",   // where THIS QR code is hidden (shown only on your print sheet)
      "slug": "rue5n28hgr",               // generated, don't edit: the QR code's address
      "code": "5CPVU",                    // generated: shown at the bottom of this clue, unlocks the NEXT one
      "text": "Riddle that leads to the next spot…"
    }
  ],
  "finale": {
    "spot": "…", "slug": "…",
    "title": "You did it! 🎉",
    "message": "Congratulations…\n\nFind Andy and show him this screen to claim 3 raffle tickets!"
  }
}
```

- **Add or remove clues** by adding or removing entries in `clues`. Leave out `slug` and `code` on new
  entries, and the next build fills them in.
- **Codes** are 5 random characters drawn from letters and digits that are hard to confuse (no
  0/O, 1/I/L). Each code mixes letters and digits. To get a new code, delete the `code` line and
  rebuild.
- **Clue text and the finale** can be edited at any time. Rebuild and deploy, and the printed QR codes
  keep working, because a QR code points at `slug`, which never changes.
- `\n` in text makes a new line. Emoji are fine. Text is shown as plain text, not HTML.
- **Keep a backup of `hunt.config.json`.** It exists only on this laptop. If it's lost, rebuilding
  creates new slugs, and every printed QR code stops working.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Builds `dist/site/` (the public site) and `dist/print.html` (the print sheet). |
| `npm test` | Builds the example config into a temp folder and checks the full chain. Each lock opens only with the right code, nothing secret leaks into the public site, and slugs stay stable across rebuilds. |
| `npm run serve` | Serves `dist/site` at http://localhost:8080 for a local look. |
| `npm run deploy` | Builds, then force-pushes **only `dist/site`** to the `gh-pages` branch. |

## Printing

Open `dist/print.html` in Chrome (double-click it) and print it at **100% scale**, not "Fit to
page", or the codes come out a different size.

- **Page 1 is the answer key.** It lists every QR code, its hiding spot, the code that unlocks it,
  and the code it reveals. Keep it to yourself.
- **The codes follow, packed onto page 2.** They're small (`qrSizeInches`, 1 inch by default) with
  no text on the front. Cut each one out on its dashed square, and keep the white border inside it,
  which the camera needs. The tiny label under each code (number and spot) is for you: cut it off
  before hiding.
- **Size:** 1 inch scans from about 15–20 cm on a modern phone. Below about 0.75 inch some phones
  struggle, so test any smaller size with the guests' kind of phones before printing them all.
  A code on a dark or busy surface needs its white border to scan.
- Each clue's text should lead to the **next** card's spot. The last clue should lead to the FINALE
  card.

## How the lock works

`src/site/crypto.js` is shared by the browser and the build. The build encrypts page *N* with the code
from clue *N−1*, using PBKDF2-SHA256 with 150k iterations and then AES-256-GCM. A wrong code fails
GCM authentication, so the page says "Nope." A phone remembers codes it has already entered
(localStorage), so rescanning a QR code doesn't ask again.

What it can't do: a static site can't record who finished first. The finale shows a live ticking
clock, so a screenshot passed to a friend is easy to spot.
