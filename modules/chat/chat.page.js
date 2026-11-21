// Код страницы chat.html (раздел chat). Подключается из chat.html.
(function () {
'use strict';

// ===================== параметры =====================
const qs = new URLSearchParams(location.search);
const EMBED = qs.has('embed');            // предпросмотр в админке
const DEMO = qs.has('demo') || EMBED;     
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const U = () => innerWidth / 1920; // один «пиксель» 1080p в точках экрана
const area = $('area'), feed = $('feed'), alertsBox = $('alerts');

let S = ChatKit.overlay({});                                         // настройки этого оверлея
let EV = ChatKit.read({}).events;                                     // настройки событий
let channel = (qs.get('channel') || '').toLowerCase().replace(/^#/, '');
let mode = null;

// ===================== цвета =====================
function rgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return [250, 199, 117];
  const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  const n = parseInt(h, 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
function setAcc(el, hex) {
  el.style.setProperty('--acc', rgba(hex, 1));
  el.style.setProperty('--acc-a', rgba(hex, 0.3));
  el.style.setProperty('--acc-g', rgba(hex, 0.5));
}

// ===================== применить настройки =====================
const loadedFonts = new Set();
function loadFont(id) {
  const f = ChatKit.FONTS.find(x => x[0] === id) || ChatKit.FONTS[0];
  if (f[3] && !loadedFonts.has(f[0])) {
    loadedFonts.add(f[0]);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f[3] + '&display=swap';
    document.head.appendChild(l);
  }
  return f[2];
}

function apply(next, events) {
  const prevMode = mode;
  S = next;
  if (events) EV = events;
  // свои звуки грузим заранее, чтобы алерт не ждал файл
  if (S.alerts && S.volume > 0) Object.values(EV).forEach(ev => { if (ev.on && ev.alert && String(ev.sound).includes('/')) soundFile(ev.sound); });
  const r = document.documentElement.style;
  r.setProperty('--fs', S.size);
  r.setProperty('--w', S.weight);
  r.setProperty('--nw', S.nickWeight);
  r.setProperty('--rad', S.radius);
  r.setProperty('--pad', S.pad);
  r.setProperty('--gap', S.gap);
  r.setProperty('--alpha', Math.max(0.2, S.alpha / 100));
  r.setProperty('--as', S.alertScale / 100);
  r.setProperty('--tc', S.color);
  r.setProperty('--bg', rgba(S.bgColor, S.bgAlpha / 100));
  r.setProperty('--tkl', S.tickerLabelColor);
  r.setProperty('--font', loadFont(S.font));
  setAcc(document.documentElement, S.accent);

  Object.assign(area.style, { left: S.x + '%', top: S.y + '%', width: S.w + '%', height: S.h + '%' });
  area.className = ['area', 'mode-' + S.mode, 'bg-' + S.bgMode, 'lay-' + S.layout, 'dir-' + S.dir, 'align-' + S.align,
    'from-' + S.rowFrom, S.outline ? 'outline' : ''].join(' ');
  area.hidden = S.mode === 'alerts';
  alertsBox.className = 'alerts pos-' + S.alertPos + (S.outline ? ' outline' : '');

  if (S.mode !== prevMode) {
    mode = S.mode;
    clearFeed();
    if (mode === 'ticker') tkBuild();
  }
  if (mode === 'ticker' && tk) {
    tk.label.hidden = !S.tickerLabel;
    tk.labelText.textContent = S.tickerLabel;
    tk.clock.hidden = !S.tickerClock;
  }
  if (mode === 'fly') flyLayout();
  frameSync();
}

function clearFeed() {
  feed.innerHTML = '';
  flyQ.length = 0;
  if (tk) { tk.root.remove(); tk = null; }
}

// ===================== сообщение =====================
const BADGE_SVG = {
  broadcaster: '<path d="M4 6h11a2 2 0 0 1 2 2v1.5l4-2.5v10l-4-2.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>',
  moderator: '<path d="M14.5 2 22 2 22 9.5 12.6 18.9l1.7 1.7-1.4 1.4-3.2-3.2-3.3 3.3a1.5 1.5 0 0 1-2.1-2.1l3.3-3.3-3.2-3.2 1.4-1.4 1.7 1.7z"/>',
  vip: '<path d="M6 3h12l4 6-10 12L2 9z"/>',
  sub: '<path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z"/>',
};
function badgesHTML(tags) {
  if (!S.badges) return '';
  const b = String(tags.badges || '');
  const has = k => new RegExp('(^|,)' + k + '/').test(b);
  let out = '';
  if (has('broadcaster')) out += `<span class="bd bd--broadcaster"><svg viewBox="0 0 24 24">${BADGE_SVG.broadcaster}</svg></span>`;
  if (has('moderator')) out += `<span class="bd bd--moderator"><svg viewBox="0 0 24 24">${BADGE_SVG.moderator}</svg></span>`;
  if (has('vip')) out += `<span class="bd bd--vip"><svg viewBox="0 0 24 24">${BADGE_SVG.vip}</svg></span>`;
  if (has('subscriber') || has('founder')) out += `<span class="bd bd--sub"><svg viewBox="0 0 24 24">${BADGE_SVG.sub}</svg></span>`;
  return out;
}

// m: { id, login, nick, color, badges, html, cap, acc, sys, fx }
function makeMsg(m) {
  const el = document.createElement('div');
  el.className = 'm' + (m.cap ? ' m--ev' : '') + (m.sys ? ' m--sys' : '') + (m.fx ? ' m--fx' : '') + (m.idle ? ' tk__idle' : '');
  if (m.acc) setAcc(el, m.acc);
  el.dataset.login = m.login || '';
  el.dataset.id = m.id || '';
  const who = S.nick && m.nick
    ? `<span class="m__who">${m.badges || ''}<span class="m__nick" style="color:${S.nickColors ? m.color : 'inherit'}">${esc(m.nick)}</span>${m.html ? '<span class="m__colon">:</span>' : ''}</span>`
    : '';
  el.innerHTML = (m.cap ? `<span class="m__cap">${esc(m.cap)}</span>` : '') + who + (m.html ? `<span class="m__text">${m.html}</span>` : '');
  return el;
}

// ===================== анимации колонки и строки =====================
const ease = 'cubic-bezier(.2,.8,.2,1)';
function inFrames() {
  const d = 46 * U();
  const side = mode === 'row' ? (S.rowFrom === 'left' ? -1 : 1) : (S.align === 'right' ? 1 : -1);
  switch (S.animIn) {
    case 'fade': return [{ opacity: 0 }, { opacity: 1 }];
    case 'pop': return [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.7 }, { opacity: 1, transform: 'none' }];
    case 'drop': return [{ opacity: 0, transform: `translateY(${-d}px)` }, { opacity: 1, transform: 'none' }];
    case 'slide': return [{ opacity: 0, transform: `translateX(${side * d}px)` }, { opacity: 1, transform: 'none' }];
    default: return null;
  }
}
function outFrames() {
  const d = 60 * U();
  const side = mode === 'row' ? (S.rowFrom === 'left' ? 1 : -1) : (S.align === 'right' ? 1 : -1);
  switch (S.animOut) {
    case 'fade': return [{ opacity: 1 }, { opacity: 0 }];
    case 'slide': return [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${side * d}px)` }];
    case 'shrink': return [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.7)' }];
    default: return null;
  }
}
// Остальные сообщения плавно съезжают на новое место (FLIP)
function flip(change) {
  const kids = [...feed.children];
  const before = new Map(kids.map(k => [k, k.getBoundingClientRect()]));
  change();
  if (S.animMs < 60) return;
  kids.forEach(k => {
    if (!k.isConnected) return;
    const b = before.get(k), a = k.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      k.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: S.animMs, easing: ease, composite: 'add' });
    }
  });
}
function stackAdd(el) {
  const first = (mode === 'list' && S.dir === 'down') || (mode === 'row' && S.rowFrom === 'left');
  flip(() => { if (first) feed.prepend(el); else feed.appendChild(el); });
  const f = inFrames();
  if (f) el.animate(f, { duration: S.animMs, easing: ease });
  if (S.life > 0) el._t = setTimeout(() => removeMsg(el, true), S.life * 1000);
  prune(first);
}
// Лишние и ушедшие за край — убираем без анимации (их и так не видно)
function prune(first) {
  const kids = [...feed.children].filter(k => !k._gone);
  const extra = kids.length - S.max;
  const old = first ? kids.slice().reverse() : kids;
  for (let i = 0; i < extra; i++) drop(old[i]);
  const box = feed.getBoundingClientRect();
  [...feed.children].forEach(k => {
    const r = k.getBoundingClientRect();
    const out = mode === 'list' ? (r.bottom < box.top - 2 || r.top > box.bottom + 2) : (r.right < box.left - 2 || r.left > box.right + 2);
    if (out) drop(k);
  });
}
function drop(el) { if (!el) return; el._gone = true; clearTimeout(el._t); el.remove(); }
function removeMsg(el, animate) {
  if (!el || el._gone) return;
  el._gone = true;
  clearTimeout(el._t);
  if (mode !== 'list' && mode !== 'row') { el.remove(); return; }
  const f = animate && outFrames();
  let done = false;
  const finish = () => { if (done) return; done = true; flip(() => el.remove()); };
  if (f) { el.animate(f, { duration: S.animMs, easing: 'ease-in', fill: 'forwards' }).onfinish = finish; setTimeout(finish, S.animMs + 150); }
  else finish();
}

// ===================== летающий =====================
const flyQ = [];
let lanes = [], laneStep = 40;
function flyLayout() {
  const probe = makeMsg({ nick: 'Ag', html: 'Ag', badges: '' });
  probe.style.visibility = 'hidden';
  feed.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  const g = Math.max(4, S.gap) * U();
  laneStep = h + g;
  const n = Math.max(1, Math.floor((feed.clientHeight + g) / laneStep));
  lanes = Array.from({ length: n }, (_, i) => lanes[i] || 0);
}
function flyPump() {
  while (flyQ.length && mode === 'fly') {
    if (feed.children.length >= S.max) return;
    const now = performance.now();
    const free = lanes.map((t, i) => (t <= now ? i : -1)).filter(i => i >= 0);
    if (!free.length) return;
    const lane = S.flyRandom ? pick(free) : free[0];
    const el = makeMsg(flyQ.shift());
    const W = feed.clientWidth;
    el.style.top = lane * laneStep + 'px';
    el.style.transform = `translateX(${W}px)`;
    feed.appendChild(el);
    const w = el.offsetWidth, v = Math.max(20, S.flySpeed) * U();
    const dur = (W + w) / v * 1000;
    lanes[lane] = now + (w + 70 * U()) / v * 1000; // следующий в эту дорожку — когда хвост отлетит
    const kill = () => el.remove();
    el.animate([{ transform: `translateX(${W}px)` }, { transform: `translateX(${-w - 10}px)` }], { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = kill;
    setTimeout(kill, dur + 1000);
  }
}
setInterval(flyPump, 120);

// ===================== новости =====================
let tk = null;
function tkBuild() {
  const root = document.createElement('div');
  root.className = 'tk';
  root.innerHTML = '<div class="tk__label"><span class="tk__dot"></span><span class="tk__lt"></span></div><div class="tk__view"></div><div class="tk__clock"></div>';
  area.appendChild(root);
  tk = { root, label: root.querySelector('.tk__label'), labelText: root.querySelector('.tk__lt'), view: root.querySelector('.tk__view'),
    clock: root.querySelector('.tk__clock'), items: [], last: performance.now() };
  tkClock();
}
function tkClock() {
  if (!tk) return;
  const d = new Date();
  tk.clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
setInterval(tkClock, 5000);
function tkAdd(el, idle) {
  if (!tk) return;
  tk.view.appendChild(el);
  const w = el.offsetWidth, V = tk.view.clientWidth, gap = S.size * U() * 1.6;
  const lastIt = tk.items[tk.items.length - 1];
  const x = Math.max(V, lastIt ? lastIt.x + lastIt.w + gap : V);
  tk.items.push({ el, x, w, idle });
  el.style.transform = `translate(${x}px, -50%)`;
  // чат несётся быстрее ленты: очередь не длиннее ~8 секунд ходу (на полной скорости),
  // лишнее — самые старые из ждущих, чтобы на экране было свежее
  const maxTail = tkMax() * 8;
  let waiting = tk.items.filter(it => it.x > V);
  while (waiting.length > 1 && waiting[waiting.length - 1].x + waiting[waiting.length - 1].w - V > maxTail) {
    const it = waiting.shift();
    it.el.remove();
    tk.items.splice(tk.items.indexOf(it), 1);
    tkRepack();
  }
}
const tkBase = () => Math.max(10, S.tickerSpeed) * U();
const tkMax = () => tkBase() * (S.tickerBoost ? 2.5 : 1);
// после удаления из очереди сдвигаем ждущих, чтобы не было дыры
function tkRepack() {
  const V = tk.view.clientWidth, gap = S.size * U() * 1.6;
  for (let i = 1; i < tk.items.length; i++) {
    const p = tk.items[i - 1], it = tk.items[i];
    if (it.x > V) it.x = Math.max(V, p.x + p.w + gap);
  }
}
function tkStep() {
  if (!tk) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - tk.last) / 1000);
  tk.last = now;
  const base = tkBase();
  // Чат пишет быстрее ленты: разгоняемся по длине очереди (за ~4 с её съесть), но не больше чем в 2.5 раза,
  // чат затих — плавно возвращаемся к обычной скорости
  let want = base;
  if (S.tickerBoost) {
    const V = tk.view.clientWidth, lastIt = tk.items[tk.items.length - 1];
    const tail = lastIt && !lastIt.idle ? lastIt.x + lastIt.w - V : 0;
    if (tail > 0) want = Math.min(tkMax(), base + tail / 4);
  }
  tk.v = tk.v ? tk.v + (want - tk.v) * Math.min(1, dt * 1.5) : want;
  const v = tk.v;
  for (let i = tk.items.length - 1; i >= 0; i--) {
    const it = tk.items[i];
    it.x -= v * dt;
    if (it.x + it.w < 0) { it.el.remove(); tk.items.splice(i, 1); }
    else it.el.style.transform = `translate(${it.x}px, -50%)`;
  }
  if (!tk.items.length && S.tickerIdle) tkAdd(makeMsg({ html: esc(S.tickerIdle), idle: true }), true);
}
function loop() { tkStep(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
// если кадры не идут (страница в фоне) — лента всё равно едет
setInterval(() => { if (tk && performance.now() - tk.last > 120) tkStep(); }, 100);

// ===================== в чат =====================
function pushChat(m) {
  if (mode === 'alerts') return;
  if (mode === 'fly') { flyQ.push(m); if (flyQ.length > 30) flyQ.shift(); flyPump(); return; }
  const el = makeMsg(m);
  if (mode === 'ticker') tkAdd(el);
  else stackAdd(el);
}
// Модератор удалил сообщение / забанил — убираем с экрана
function dropWhere(fn) {
  const all = tk ? tk.items.map(it => it.el) : [...feed.children];
  all.filter(fn).forEach(el => {
    if (tk) { const i = tk.items.findIndex(it => it.el === el); if (i >= 0) tk.items.splice(i, 1); el.remove(); }
    else removeMsg(el, true);
  });
  for (let i = flyQ.length - 1; i >= 0; i--) if (fn({ dataset: { id: flyQ[i].id, login: flyQ[i].login } })) flyQ.splice(i, 1);
}

// ===================== события =====================
function fillHTML(tpl, vars, html) {
  return String(tpl || '').split(/(\{\w+\})/).map(part => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) return esc(part);
    const k = m[1];
    if (html && html[k] != null) return html[k];
    return vars[k] != null ? esc(vars[k]) : '';
  }).join('');
}
// base — обычное сообщение (без текста, если событие без сообщения), n — число события
function onEvent(id, base, n, extra) {
  const ev = EV[id];
  const plain = () => { if (base.html) pushChat(base); };
  if (!ev || !ev.on || (ev.min && (n || 0) < ev.min)) return plain();
  const vars = Object.assign({ nick: base.nick || '', n: n == null ? '' : n, msg: base.text || '' }, extra);
  if (mode !== 'alerts') {
    if (S.highlights && ev.hl) pushChat(Object.assign({}, base, { cap: ChatKit.fill(ev.cap, vars), acc: ev.color, sys: !base.html }));
    else plain();
  }
  if (S.alerts && ev.alert && alertMine()) {
    const hv = { msg: base.html || '' };
    queueAlert({ anim: ev.anim, color: ev.color, sound: ev.sound, dur: ev.dur,
      text: fillHTML(ev.text, vars, hv), sub: fillHTML(ev.sub, vars, hv), plainText: ChatKit.fill(ev.text, vars) });
  }
}

// ===================== алерты =====================
// Несколько оверлеев с алертами в одном OBS: алерт рисует только один. Оверлеи перекликаются через
// BroadcastChannel; приоритет у того, что сейчас в эфире (OBS сообщает obsSourceActiveChanged),
// не в эфире — молчит. OBS ещё не сказал — средний приоритет. Ничего не слышно от других — показываем сами.
const INST = Math.random().toString(36).slice(2, 10);
let obsActive = null;
let bc = null;
const peers = new Map();
const alertRank = () => (obsActive === true ? 2 : obsActive === false ? 0 : 1);
function heartbeat() { if (bc) bc.postMessage({ inst: INST, alerts: !!S.alerts, rank: alertRank() }); }
if (!DEMO && 'BroadcastChannel' in window) {
  bc = new BroadcastChannel('chatkit-alerts');
  bc.onmessage = e => {
    const d = e.data;
    if (!d || !d.inst || d.inst === INST) return;
    if (d.bye) peers.delete(d.inst);
    else peers.set(d.inst, { alerts: d.alerts, rank: d.rank, at: Date.now() });
  };
  setInterval(heartbeat, 2000);
  addEventListener('pagehide', () => bc.postMessage({ inst: INST, bye: true }));
}
addEventListener('obsSourceActiveChanged', e => { obsActive = !!(e.detail && e.detail.active); heartbeat(); });
function alertMine() {
  if (!bc) return true;
  const me = alertRank();
  if (me === 0) return false;
  const now = Date.now();
  for (const [id, p] of peers) {
    if (now - p.at > 5000) { peers.delete(id); continue; }
    if (!p.alerts || p.rank === 0) continue;
    if (p.rank > me || (p.rank === me && id < INST)) return false;
  }
  return true;
}
const alertQ = [];
let alertOn = false;
function queueAlert(a) {
  alertQ.push(a);
  if (alertQ.length > 10) alertQ.shift();
  if (!alertOn) nextAlert();
}
function nextAlert() {
  const a = alertQ.shift();
  if (!a) { alertOn = false; return; }
  alertOn = true;
  const el = document.createElement('div');
  el.className = 'al al--' + (['burst', 'banner', 'neon'].includes(a.anim) ? a.anim : 'burst');
  setAcc(el, a.color || S.accent);
  const sub = a.sub ? `<div class="al__sub">${a.sub}</div>` : '';
  if (a.anim === 'banner') {
    el.innerHTML = `<div class="al__stripe"></div><div class="al__body"><div class="al__text">${a.text}</div>${sub}</div>`;
  } else if (a.anim === 'neon') {
    el.innerHTML = `<div class="al__text">${Array.from(a.plainText || '').map((ch, i) => `<span class="ch" style="--i:${i}">${esc(ch)}</span>`).join('')}</div>${sub}`;
  } else {
    const sparks = Array.from({ length: 26 }, (_, i) => {
      const ang = (i / 26) * Math.PI * 2 + rand(-0.15, 0.15), dist = rand(260, 560) * U() * S.alertScale / 100;
      const c = Math.random() < 0.35 ? '#fff' : '';
      return `<i class="al__p" style="--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist * 0.6).toFixed(0)}px;--r:${rand(-400, 400).toFixed(0)}deg;--d:${rand(0, 0.15).toFixed(2)}s${c ? ';--c:' + c : ''}"></i>`;
    }).join('');
    el.innerHTML = `<div class="al__rays"></div>${sparks}<div class="al__text">${a.text}</div>${sub}`;
  }
  alertsBox.appendChild(el);
  sound(a.sound);
  const dur = Math.max(2, a.dur || 6) * 1000;
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => { el.remove(); setTimeout(nextAlert, 350); }, 600);
  }, dur);
}

// Звуки: свои файлы (sounds/chat/..., загружаются в админке) или синтез
let actx = null;
let soundUrls = {}; // в админке: только что загруженный файл, пока GitHub Pages его не выложил
const audioCache = new Map();
function soundFile(path) {
  const url = soundUrls[path] || encodeURI(path);
  let a = audioCache.get(url);
  if (!a) { a = new Audio(url); a.preload = 'auto'; audioCache.set(url, a); }
  return a;
}
function sound(kind) {
  if (!kind || kind === 'off' || !(S.volume > 0)) return;
  if (kind.includes('/')) {
    try {
      const a = soundFile(kind).cloneNode();
      a.volume = Math.min(1, S.volume / 100);
      a.play().catch(() => {});
    } catch (e) { /* без звука */ }
    return;
  }
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime + 0.02;
    const master = actx.createGain();
    master.gain.value = S.volume / 100 * 0.5;
    master.connect(actx.destination);
    const note = (f, at, len, type, g, f2) => {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t + at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + len * 0.6);
      gn.gain.setValueAtTime(0.0001, t + at);
      gn.gain.linearRampToValueAtTime(g, t + at + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(gn); gn.connect(master);
      o.start(t + at); o.stop(t + at + len + 0.05);
    };
    if (kind === 'chime') { note(1318.5, 0, 1.0, 'sine', 0.55); note(1975.5, 0.13, 1.2, 'sine', 0.4); note(2637, 0.26, 1.0, 'sine', 0.18); }
    else if (kind === 'pop') { note(880, 0, 0.16, 'sine', 0.8, 260); note(1760, 0.05, 0.12, 'triangle', 0.25, 900); }
    else if (kind === 'fanfare') {
      [523.25, 659.25, 783.99].forEach((f, i) => note(f, i * 0.11, 0.22, 'triangle', 0.45));
      note(1046.5, 0.33, 1.1, 'triangle', 0.5); note(1318.5, 0.33, 1.1, 'sine', 0.22); note(783.99, 0.33, 1.1, 'sine', 0.2);
    }
  } catch (e) { /* без звука */ }
}

// ===================== смайлы 7TV / BTTV / FFZ =====================
const ext = new Map();
let extFor = '';
function loadEmotes(roomId) {
  if (!roomId || extFor === roomId) return;
  extFor = roomId;
  // Каждый сервис подключаем, как только ответил: FFZ бывает отвечает по полминуты
  const got = [];
  const j = (i, u) => {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 30000);
    return fetch(u, { signal: ctl.signal }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(data => { got[i] = data; if (extFor === roomId) buildEmotes(got); });
  };
  ['https://7tv.io/v3/users/twitch/' + roomId, 'https://api.betterttv.net/3/cached/users/twitch/' + roomId,
    'https://api.frankerfacez.com/v1/room/id/' + roomId, 'https://7tv.io/v3/emote-sets/global',
    'https://api.betterttv.net/3/cached/emotes/global', 'https://api.frankerfacez.com/v1/set/global'].forEach((u, i) => j(i, u));
}
function buildEmotes([stvU, btU, ffU, stvG, btG, ffG]) {
  ext.clear();
  const add = (name, url) => { if (name && url && !ext.has(name)) ext.set(name, url); };
  const stv = set => ((set && set.emotes) || []).forEach(e => {
    const h = e.data && e.data.host;
    if (h && h.url) add(e.name, (h.url.startsWith('//') ? 'https:' : '') + h.url + '/2x.webp');
  });
  const bt = list => (list || []).forEach(e => add(e.code, 'https://cdn.betterttv.net/emote/' + e.id + '/2x'));
  const ffz = d => Object.values((d && d.sets) || {}).forEach(s => (s.emoticons || []).forEach(e => {
    const u = e.urls && (e.urls['2'] || e.urls['1']);
    if (u) add(e.name, (u.startsWith('//') ? 'https:' : '') + u);
  }));
  // свои смайлы канала главнее общих
  stv(stvU && stvU.emote_set);
  if (btU) { bt(btU.channelEmotes); bt(btU.sharedEmotes); }
  ffz(ffU);
  stv(stvG);
  bt(btG);
  ffz(ffG);
}

// Текст со смайликами. Позиции в теге emotes — в символах (code points)
const CHEER = /^(cheer|biblethump|cheerwhal|corgo|uni|showlove|party|seemsgood|pride|kappa|frankerz|heyguys|dansgame|elegiggle|trihard|kreygasm|4head|swiftrage|notlikethis|failfish|vohiyo|pjsalt|mrdestructoid|bday|ripcheer|shamrock|streamlabs|muxy|holidaycheer|goal|anon|charity)\d+$/i;
function renderText(text, emotesTag, opts) {
  const chars = Array.from(text);
  const at = {};
  String(emotesTag || '').split('/').filter(Boolean).forEach(part => {
    const [id, ranges] = part.split(':');
    (ranges || '').split(',').forEach(r => { const [a, b] = r.split('-').map(Number); if (isFinite(a) && isFinite(b)) at[a] = { end: b, id }; });
  });
  const max = S.maxLen;
  const img = (src, giant) => `<img class="emote${giant ? ' emote--giant' : ''}" alt="" src="${esc(src)}">`;
  let out = '', buf = '', i = 0, len = 0, lastEmote = -1;
  const flush = () => {
    if (!buf) return;
    out += buf.split(/(\s+)/).map(tok => {
      if (!tok) return '';
      if (opts && opts.bits && CHEER.test(tok)) return '';
      if (S.emotes && ext.has(tok)) return img(ext.get(tok));
      return esc(tok);
    }).join('');
    buf = '';
  };
  while (i < chars.length && len < max) {
    const e = at[i];
    if (e) {
      flush();
      lastEmote = out.length;
      out += img(`https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(e.id)}/default/dark/2.0`);
      i = e.end + 1; len += 2;
    } else { buf += chars[i]; i++; len++; }
  }
  flush();
  // «гигантский смайл» за баллы — последний смайл крупно
  if (opts && opts.giant && lastEmote >= 0) out = out.slice(0, lastEmote) + out.slice(lastEmote).replace('class="emote"', 'class="emote emote--giant"');
  return out.trim() + (i < chars.length ? '…' : '');
}

// Цвет ника из Twitch, но не темнее, чем читается на тёмной плашке
function nickColor(hex, login) {
  let h, s, l;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (m) {
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    l = (mx + mn) / 2;
    s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    h = !d ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  } else {
    h = [...String(login || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7); s = 0.7; l = 0.7;
  }
  return `hsl(${Math.round((h + 360) % 360)}, ${Math.round(Math.min(s, 0.9) * 100)}%, ${Math.round(Math.max(l, 0.66) * 100)}%)`;
}

// ===================== чат Twitch (анонимно, только чтение) =====================
let ws = null, wsChan = '', reconnectDelay = 1000;
function connect() {
  if (ws) { ws.onclose = null; try { ws.close(); } catch (e) { /* уже закрыт */ } }
  wsChan = channel;
  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
    ws.send('JOIN #' + wsChan);
  };
  ws.onmessage = ev => ev.data.split('\r\n').forEach(line => { if (line) onLine(line); });
  ws.onclose = () => { setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(reconnectDelay * 2, 30000); };
  ws.onerror = () => { try { ws.close(); } catch (e) { /* закроется сам */ } };
}
function parseTags(raw) {
  const tags = {};
  raw.split(';').forEach(pair => {
    const i = pair.indexOf('=');
    tags[i < 0 ? pair : pair.slice(0, i)] = i < 0 ? '' : pair.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\');
  });
  return tags;
}
function onLine(line) {
  if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return; }
  let tags = {}, rest = line, prefix = '';
  if (rest[0] === '@') { const sp = rest.indexOf(' '); tags = parseTags(rest.slice(1, sp)); rest = rest.slice(sp + 1); }
  if (rest[0] === ':') { const sp = rest.indexOf(' '); prefix = rest.slice(1, sp); rest = rest.slice(sp + 1); }
  const sp = rest.indexOf(' ');
  const cmd = sp < 0 ? rest : rest.slice(0, sp);
  const params = sp < 0 ? '' : rest.slice(sp + 1);
  const text = params.includes(' :') ? params.slice(params.indexOf(' :') + 2) : '';
  if (cmd === '001') { reconnectDelay = 1000; return; }
  if (cmd === 'RECONNECT') { try { ws.close(); } catch (e) { /* переподключимся */ } return; }
  if (cmd === 'ROOMSTATE') { loadEmotes(tags['room-id']); return; }
  if (cmd === 'CLEARMSG') { dropWhere(el => el.dataset.id === tags['target-msg-id']); return; }
  if (cmd === 'CLEARCHAT') { const who = text.trim().toLowerCase(); dropWhere(el => !who || el.dataset.login === who); return; }
  if (cmd === 'PRIVMSG') onChat(tags, prefix.split('!')[0].toLowerCase(), text);
  else if (cmd === 'USERNOTICE') onNotice(tags, text);
}

const LINK = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(ru|com|tv|net|org|gg|ly|io|me|su|xyz|info|рф)\b/i;
const ignored = login => String(S.ignore || '').toLowerCase().split(/[\s,;]+/).filter(Boolean).includes(login);
function baseMsg(tags, login, text, opts) {
  const nick = tags['display-name'] || login;
  return {
    id: tags.id, login, nick, text: text.slice(0, 300),
    color: nickColor(tags.color, login), badges: badgesHTML(tags),
    html: text ? renderText(text, tags.emotes, opts) : '',
    fx: !!tags['animation-id'],
  };
}
function onChat(tags, login, raw) {
  let text = raw;
  const action = /^\u0001ACTION (.*)\u0001$/.exec(text);
  if (action) text = action[1];
  const bits = parseInt(tags.bits, 10) || 0;
  if (!bits) {
    if (ignored(login) || !text.trim()) return;
    if (S.hideCmd && text.trim()[0] === '!') return;
    if (S.hideLinks && LINK.test(text)) return;
  }
  const kind = tags['msg-id'];
  const m = baseMsg(tags, login, text, { bits: bits > 0, giant: kind === 'gigantified-emote-message' });
  if (bits) return onEvent('bits', m, bits);
  if (kind === 'highlighted-message') return onEvent('highlight', m);
  if (tags['custom-reward-id']) return onEvent('reward', m);
  if (tags['first-msg'] === '1') return onEvent('first', m);
  pushChat(m);
}

const mysteryGifts = new Set();
const TIERS = { Prime: 'Prime', 1000: '1', 2000: '2', 3000: '3' };
function onNotice(tags, text) {
  const id = tags['msg-id'];
  const login = (tags.login || '').toLowerCase();
  const p = k => tags['msg-param-' + k] || '';
  const m = baseMsg(tags, login, text || '');
  const tier = TIERS[p('sub-plan')] || '';
  if (id === 'sub') onEvent('sub', m, 1, { tier });
  else if (id === 'resub') onEvent('resub', m, parseInt(p('cumulative-months'), 10) || 0, { tier });
  else if (id === 'submysterygift') {
    if (p('community-gift-id')) mysteryGifts.add(p('community-gift-id'));
    onEvent('gift', m, parseInt(p('mass-gift-count'), 10) || 1, { tier });
  } else if (id === 'subgift') {
    if (p('community-gift-id') && mysteryGifts.has(p('community-gift-id'))) return; // часть пачки — алерт уже был
    onEvent('gift', m, 1, { to: p('recipient-display-name'), tier });
  } else if (id === 'raid') {
    m.nick = p('displayName') || m.nick;
    onEvent('raid', m, parseInt(p('viewerCount'), 10) || 0);
  } else if (id === 'viewermilestone' && p('category') === 'watch-streak') {
    onEvent('streak', m, parseInt(p('value'), 10) || 0);
  } else if (id === 'announcement') {
    onEvent('announce', m);
  }
}

// ===================== предпросмотр =====================
const NICKS = [['Lunatik_77', '#FF4500', 'moderator/1'], ['kotofey', '#1E90FF', 'subscriber/12'], ['Nyashka', '#FF69B4', 'vip/1'], ['dedinside', '', ''],
  ['Barmaley', '#9ACD32', 'subscriber/3'], ['night_owl', '#8A2BE2', ''], ['PetrovichTV', '#DAA520', 'subscriber/24'], ['pariparikai', '#FAC775', 'broadcaster/1']];
const LINES = ['привет!', 'всем ку', 'ну наконец-то', 'это было больно смотреть', 'го дальше', 'лол', 'ахахахах', 'чат, вы видели это?',
  'стример, ты лучший', 'а что за игра?', 'добрый вечер', 'зашёл на огонёк', 'я с работы, что пропустил?', 'кринж', 'красиво',
  'он сейчас опять упадёт', 'ставлю сотку что не пройдёт', 'это уже классика', 'GG', 'чай налит, я готов смотреть дальше'];
function fakeTags(nick, color, badges) {
  return { 'display-name': nick, color, badges, 'badge-info': badges.startsWith('subscriber') ? badges : '', id: String(Math.random()) };
}
function fakeChat() {
  const [nick, color, badges] = pick(NICKS);
  onChat(fakeTags(nick, color, badges), nick.toLowerCase(), pick(LINES));
}
const FAKE_N = { streak: 50, resub: 14, gift: 5, raid: 42, bits: 500 };
function fakeEvent(id) {
  const [nick, color, badges] = pick(NICKS.slice(0, 7));
  const tags = fakeTags(nick, color, badges);
  const withText = ['streak', 'first', 'resub', 'bits', 'highlight', 'reward', 'announce'].includes(id);
  const m = baseMsg(tags, nick.toLowerCase(), withText ? pick(LINES) : '');
  const ev = EV[id];
  onEvent(id, m, Math.max(FAKE_N[id] || 1, ev ? ev.min || 0 : 0), { to: 'kotofey', tier: '1' });
}
function demo() {
  document.body.classList.add('demo-' + (qs.get('bg') || 'busy'));
  const tick = () => {
    if (mode !== 'alerts') fakeChat();
    setTimeout(tick, rand(600, 2000) * (mode === 'fly' ? 0.6 : 1));
  };
  tick();
  // в отдельном предпросмотре — сами по себе события раз в 15 секунд; в админке — по кнопкам
  if (!EMBED) {
    let k = 0;
    setInterval(() => { const ids = ChatKit.EVENTS.map(e => e.id).filter(id => EV[id].on); if (ids.length) fakeEvent(ids[k++ % ids.length]); }, 15000);
  }
}

// ===================== рамка области (только в админке) =====================
let frame = null;
function frameSync() {
  if (!EMBED) return;
  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'frame';
    frame.innerHTML = '<span class="frame__tag">Тащи рамку или углы</span>' + ['nw', 'ne', 'sw', 'se'].map(h => `<i class="frame__h" data-h="${h}"></i>`).join('');
    document.body.appendChild(frame);
    frame.addEventListener('pointerdown', frameDown);
  }
  frame.hidden = S.mode === 'alerts' || qs.get('frame') === '0';
  Object.assign(frame.style, { left: S.x + '%', top: S.y + '%', width: S.w + '%', height: S.h + '%' });
  frame.classList.toggle('is-low', S.y < 6);
}
function frameDown(e) {
  e.preventDefault();
  const h = e.target.dataset.h || 'move';
  const start = { x: e.clientX, y: e.clientY, a: { x: S.x, y: S.y, w: S.w, h: S.h } };
  const r1 = v => Math.round(v * 2) / 2;
  const move = ev => {
    const dx = (ev.clientX - start.x) / innerWidth * 100, dy = (ev.clientY - start.y) / innerHeight * 100;
    const a = Object.assign({}, start.a);
    if (h === 'move') { a.x += dx; a.y += dy; } // форма та же, рамка только едет
    else {
      if (h.includes('w')) { a.x += dx; a.w -= dx; }
      if (h.includes('e')) a.w += dx;
      if (h.includes('n')) { a.y += dy; a.h -= dy; }
      if (h.includes('s')) a.h += dy;
    }
    a.w = Math.max(3, Math.min(100, a.w)); a.h = Math.max(3, Math.min(100, a.h));
    a.x = Math.max(0, Math.min(100 - a.w, a.x)); a.y = Math.max(0, Math.min(100 - a.h, a.y));
    Object.keys(a).forEach(k => { a[k] = r1(a[k]); });
    apply(Object.assign({}, S, a));
    parent.postMessage({ type: 'chatkit:area', area: a }, location.origin);
  };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
}

// ===================== настройки с сайта =====================
const loadJSON = path => hof.json(path, { fresh: true }); // оверлей висит часами — читаем мимо кэша
async function loadSettings() {
  let c = null, d = null;
  try { c = await loadJSON('data/config.json'); } catch (e) { /* канал по умолчанию */ }
  try { d = await loadJSON('data/chat.json'); } catch (e) { console.warn('Нет настроек чата, работаю на умолчаниях', e); }
  if (c && !qs.get('channel')) {
    const kv = hof.kv(c);
    const m = String(kv.streamer_twitch_url || '').match(/twitch\.tv\/([\w]+)/i);
    if (m) channel = m[1].toLowerCase();
  }
  if (!channel) channel = 'pariparikai';
  if (d) {
    const all = ChatKit.read(d);
    const o = all.overlays.find(x => x.id === qs.get('o')) || all.overlays[0];
    apply(o || ChatKit.overlay({}), all.events);
  } else if (!mode) apply(S, EV);
}

// Свежая копия с сайта (мимо кэша) с другой VERSION — перезагружаемся с меткой в адресе, которой нет в кэше
async function checkVersion() {
  if (location.protocol === 'file:' || EMBED) return;
  try {
    const html = await (await fetch(location.pathname + '?t=' + Date.now(), { cache: 'no-store' })).text();
    const m = /const VERSION = '([^']+)'/.exec(html);
    if (!m || m[1] === VERSION) return;
    if (Date.now() - (+qs.get('_v') || 0) < 120000) return;
    qs.set('_v', Date.now());
    location.replace(location.pathname + '?' + qs.toString());
  } catch (e) { /* сайт недоступен — работаем на том, что есть */ }
}
function checkSize() {
  if (EMBED || !innerHeight || Math.abs(innerWidth / innerHeight / (16 / 9) - 1) < 0.03) return;
  const el = document.createElement('div');
  el.className = 'size-warn';
  el.textContent = `Размер источника ${innerWidth}×${innerHeight}, картинка растянется. В свойствах источника поставь 1920 × 1080, ` +
    'потом ПКМ по источнику → Преобразование → Сбросить преобразование.';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 1200); }, 30000);
}

// Настройки из админки — сразу, без сохранения
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data) return;
  const d = e.data;
  if (d.type === 'chatkit:set') soundUrls = d.sounds || {};
  if (d.type === 'chatkit:set') apply(ChatKit.overlay(d.overlay), Object.fromEntries(ChatKit.EVENTS.map(x => [x.id, ChatKit.event(x.id, d.events && d.events[x.id])])));
  if (d.type === 'chatkit:test') fakeEvent(d.event);
  if (d.type === 'chatkit:clear') { mode = null; apply(S); alertsBox.innerHTML = ''; alertQ.length = 0; alertOn = false; }
});
addEventListener('resize', () => { if (mode === 'fly') flyLayout(); });

// ===================== запуск =====================
checkSize();
checkVersion();
setInterval(checkVersion, 5 * 60000);
if (EMBED) {
  apply(S, EV);
  demo();
  parent.postMessage({ type: 'chatkit:ready' }, location.origin);
} else {
  loadSettings().then(() => {
    if (DEMO) demo(); else connect();
    setInterval(loadSettings, 30000);
    setInterval(() => { if (!DEMO && channel !== wsChan) connect(); }, 60000);
  });
}
})();
