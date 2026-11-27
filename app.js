import { unseal, normalizeCode, CODE_LENGTH } from './crypto.js';

const app = document.getElementById('app');
const slug = new URLSearchParams(location.search).get('c');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c); // strings become text nodes, never HTML
  return node;
}

function show(...nodes) {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

function landing() {
  show(el('section', { class: 'card center' },
    el('div', { class: 'emoji' }, '🦃'),
    el('h1', {}, 'Something is hidden in this house…'),
    el('p', {}, 'Find a QR code and scan it with your phone camera to play.'),
  ));
}

function notFound() {
  show(el('section', { class: 'card center' },
    el('div', { class: 'emoji' }, '🤔'),
    el('h1', {}, 'Hmm, that isn’t part of the hunt.'),
    el('p', {}, 'Try scanning the QR code again.'),
  ));
}

function renderClue(p) {
  show(el('section', { class: 'card' },
    el('div', { class: 'clue' }, p.text),
    el('div', { class: 'code-box' },
      el('p', { class: 'code-label' }, 'Your secret code for the next clue'),
      el('p', { class: 'code' }, p.code),
      el('p', { class: 'muted small' }, 'Memorize it or write it down. You’ll need it at the next QR code.'),
    ),
  ));
}

function renderFinale(p) {
  const clock = el('p', { class: 'clock' });
  const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }); };
  tick();
  setInterval(tick, 1000);
  show(el('section', { class: 'card center finale' },
    el('div', { class: 'emoji bounce' }, '🏆'),
    el('h1', {}, p.title),
    el('div', { class: 'clue' }, p.message),
    clock,
  ));
  document.body.classList.add('won');
  startConfetti();
}

function render(p) {
  if (p.kind === 'finale') renderFinale(p);
  else renderClue(p);
}

function lockScreen(box) {
  const input = el('input', {
    id: 'code', type: 'text', inputmode: 'text', autocomplete: 'off', autocorrect: 'off',
    autocapitalize: 'characters', spellcheck: 'false', maxlength: String(CODE_LENGTH + 3),
    placeholder: '•'.repeat(CODE_LENGTH), 'aria-label': 'Secret code',
  });
  const msg = el('p', { class: 'error', role: 'alert' });
  const button = el('button', { type: 'submit' }, 'Unlock');
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const code = normalizeCode(input.value);
      if (!code) return;
      button.disabled = true;
      button.textContent = 'Checking…';
      const payload = await unseal(box, code);
      if (payload) {
        try { localStorage.setItem(`hunt:${slug}`, code); } catch {}
        render(payload);
        return;
      }
      button.disabled = false;
      button.textContent = 'Unlock';
      msg.textContent = 'Nope, that’s not it. Did you start from the very first clue?';
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      input.select();
    },
  }, input, button, msg);

  show(el('section', { class: 'card center' },
    el('div', { class: 'emoji' }, '🔒'),
    el('h1', {}, 'You found a secret clue!'),
    el('p', {}, 'Enter the code from the previous clue to unlock it.'),
    form,
  ));
  input.focus();
}

async function main() {
  if (!slug || !/^[a-z0-9]+$/.test(slug)) return landing();
  let data;
  try {
    const res = await fetch(`c/${slug}.json`, { cache: 'no-store' });
    if (!res.ok) return notFound();
    data = await res.json();
  } catch {
    return notFound();
  }
  if (data.payload) return render(data.payload);

  let saved = null;
  try { saved = localStorage.getItem(`hunt:${slug}`); } catch {}
  if (saved) {
    const payload = await unseal(data.box, saved);
    if (payload) return render(payload);
  }
  lockScreen(data.box);
}

// ---- confetti -------------------------------------------------------------
function startConfetti() {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#e8743b', '#f2b134', '#c0392b', '#8e5a2b', '#5b8c3a', '#f7d794'];
  const emojis = ['🦃', '🍂', '🥧', '🎉', '🌽', '🍁'];
  let w, h, dpr;
  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);

  const make = (fromTop) => ({
    x: Math.random() * w,
    y: fromTop ? -20 * dpr : h * (0.4 + Math.random() * 0.3),
    vx: (Math.random() - 0.5) * 6 * dpr,
    vy: fromTop ? (1 + Math.random() * 2) * dpr : -(6 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    s: (6 + Math.random() * 8) * dpr,
    c: colors[Math.floor(Math.random() * colors.length)],
    e: Math.random() < 0.18 ? emojis[Math.floor(Math.random() * emojis.length)] : null,
  });

  let parts = Array.from({ length: reduce ? 0 : 160 }, () => make(false));
  const step = () => {
    ctx.clearRect(0, 0, w, h);
    if (!reduce && parts.length < 90) parts.push(make(true)); // gentle drizzle after the burst
    for (const p of parts) {
      p.vy += 0.12 * dpr;
      p.vx *= 0.99;
      if (p.vy > 3 * dpr) p.vy = 3 * dpr;
      p.x += p.vx + Math.sin(p.y / (40 * dpr)) * 0.6 * dpr;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      if (p.e) {
        ctx.font = `${p.s * 2.4}px serif`;
        ctx.fillText(p.e, -p.s, p.s);
      } else {
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      }
      ctx.restore();
    }
    parts = parts.filter((p) => p.y < h + 40 * dpr);
    requestAnimationFrame(step);
  };
  if (!reduce) requestAnimationFrame(step);
}

main();
