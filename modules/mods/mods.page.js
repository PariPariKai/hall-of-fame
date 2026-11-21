// Код страницы mods.html (раздел mods). Подключается из mods.html.
const qs = new URLSearchParams(location.search);
const MODS_KEY = 'ppk_mods_v1';
// ?bridge=http://127.0.0.1:3799 — другой порт моста, ?bridge=0 — без моста
const BRIDGE = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(qs.get('bridge') || '') ? qs.get('bridge') : 'http://127.0.0.1:3777';
const OVER_HOLD = 5000;   // сколько висит «Время вышло», потом карточка уходит
const HURRY_MS = 10000;   // последние 10 секунд — красный пульс
const MAX_SHOWN = 5;

const pos = (qs.get('pos') || 'tr').toLowerCase();
const stack = document.getElementById('stack');
if (['tr', 'tl', 'br', 'bl', 'tc'].includes(pos)) stack.className = 'stack stack--' + pos;
const scale = parseFloat(qs.get('scale'));
if (scale > 0.3 && scale < 4) document.documentElement.style.setProperty('--scale', scale);

let box = { mods: [], updatedAt: 0 };
const shown = new Map(); // id мода → { el, mod }

function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#FAC775'; }
function fmtClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

function adopt(next) {
  if (!next || !Array.isArray(next.mods)) return;
  if ((next.updatedAt || 0) <= (box.updatedAt || 0)) return;
  box = { mods: next.mods, updatedAt: next.updatedAt };
  render();
}

// какие моды сейчас должны быть на экране: живые + закончившиеся не раньше OVER_HOLD назад.
// Модификатор всегда один — самый свежий (список идёт от новых к старым), он сменяет прошлый.
function visibleMods(now) {
  let modSeen = false;
  return box.mods.filter(m => {
    if (m.endsAt && m.endsAt <= now - OVER_HOLD) return false;
    if (m.hideAt && m.hideAt <= now) return false; // модификатор без таймера отвисел своё (настройка в cards.html)
    if (m.kind === 'mod') { if (modSeen) return false; modSeen = true; }
    return true;
  }).slice(0, MAX_SHOWN);
}

function cardHTML(m) {
  const label = m.kindLabel || 'Модификатор';
  const foot = [`<span><b>${esc(m.rarity || '')}</b></span>`];
  if (m.group && m.group.toLowerCase() !== label.toLowerCase()) foot.push(`<span>${esc(m.group)}</span>`);
  if (m.target) foot.push(`<span>${esc(m.target)}</span>`);
  return `
    <div class="mod__shine"></div>
    <i class="mod__c mod__c--tl"></i><i class="mod__c mod__c--tr"></i>
    <i class="mod__c mod__c--bl"></i><i class="mod__c mod__c--br"></i>
    <div class="mod__plate"><i></i>${esc(label)}<i></i></div>
    <div class="mod__text">${esc(m.text)}</div>
    ${m.endsAt ? `<div class="mod__timer"><div class="mod__bar"><i></i></div><span class="mod__time"></span></div>` : ''}
    <div class="mod__foot">${foot.join('')}</div>`;
}

function render() {
  const now = Date.now();
  const want = visibleMods(now);
  const ids = new Set(want.map(m => m.id));

  // ушедшие — плавно убираем
  for (const [id, v] of shown) {
    if (ids.has(id) || v.leaving) continue;
    v.leaving = true;
    // уходящая плашка тает на своём месте, не толкая новую
    Object.assign(v.el.style, { top: v.el.offsetTop + 'px', left: v.el.offsetLeft + 'px', width: v.el.offsetWidth + 'px' });
    v.el.classList.add('is-out');
    setTimeout(() => { v.el.remove(); shown.delete(id); }, 700);
  }
  // новые и изменившиеся (например, +1 мин)
  want.forEach((m, i) => {
    let v = shown.get(m.id);
    if (v && v.leaving) { v.el.remove(); shown.delete(m.id); v = null; }
    if (!v) {
      const el = document.createElement('div');
      // рамка цвета редкости — только у модификатора; остальные с таймером — серые
      if (m.kind === 'mod') {
        el.className = 'mod';
        el.style.setProperty('--rc', safeColor(m.color));
      } else {
        el.className = 'mod mod--plain';
        el.style.setProperty('--rar', safeColor(m.color));
      }
      el.innerHTML = cardHTML(m);
      v = { el, mod: m };
      shown.set(m.id, v);
    } else if (!!v.mod.endsAt !== !!m.endsAt || v.mod.text !== m.text) {
      v.el.innerHTML = cardHTML(m);
    }
    v.mod = m;
    // порядок: свежие первыми (в нижних углах column-reverse — свежие ближе к краю)
    const at = stack.children[i];
    if (at !== v.el) stack.insertBefore(v.el, at || null);
  });
  tick();
}

function tick() {
  const now = Date.now();
  let changed = false;
  for (const [, v] of shown) {
    const m = v.mod;
    if (!v.leaving && m.hideAt && m.hideAt <= now) changed = true;
    if (v.leaving || !m.endsAt) continue;
    const left = m.endsAt - now;
    const total = Math.max(1, m.endsAt - (m.startedAt || m.endsAt - m.durationSec * 1000));
    const time = v.el.querySelector('.mod__time'), bar = v.el.querySelector('.mod__bar i');
    const over = left <= 0;
    if (over && !v.el.classList.contains('is-over')) { v.el.classList.remove('is-hurry'); v.el.classList.add('is-over'); }
    if (!over) { v.el.classList.remove('is-over'); v.el.classList.toggle('is-hurry', left <= HURRY_MS); }
    if (time) time.textContent = over ? 'Время вышло' : fmtClock(left);
    if (bar) bar.style.width = Math.max(0, Math.min(100, left / total * 100)) + '%';
    if (left < -OVER_HOLD) changed = true;
  }
  if (changed) render();
}
setInterval(tick, 250);

// ---------- источники ----------
function readLocal() {
  try { return JSON.parse(localStorage.getItem(MODS_KEY)); } catch (e) { return null; }
}
window.addEventListener('storage', e => {
  if (e.key === MODS_KEY && e.newValue) { try { adopt(JSON.parse(e.newValue)); } catch (_) {} }
});
try { new BroadcastChannel('ppk-mods').onmessage = e => adopt(e.data); } catch (e) {}

// мост: поток событий; сам переподключается, если мост перезапустили
function connectBridge() {
  if (qs.get('bridge') === '0' || typeof EventSource === 'undefined') return;
  const es = new EventSource(BRIDGE + '/api/mods/events');
  es.onmessage = e => { try { adopt(JSON.parse(e.data)); } catch (_) {} };
}

// ---------- демо ----------
function demo() {
  const now = Date.now();
  adopt({
    updatedAt: now,
    mods: [
      { id: 'd1', kind: 'mod', text: 'Говорить о себе в третьем лице', kindLabel: 'Модификатор', group: 'Модификатор',
        rarity: 'Необычная', color: '#5FD68A', target: 'Стример', durationSec: 180, startedAt: now - 40000, endsAt: now + 140000 },
      { id: 'd2', kind: 'mod', text: '«Моё почтение» с приподниманием цилиндра после каждой фразы', kindLabel: 'Модификатор',
        rarity: 'Необычная', color: '#5FD68A', target: 'Стример', durationSec: 0, startedAt: now, endsAt: null },
      { id: 'd3', kind: 'punish', text: 'Запрещённая кнопка на 5 минут', kindLabel: 'Наказание', group: 'Игры',
        rarity: 'Редкая', color: '#56A8F5', target: 'Стример', durationSec: 300, startedAt: now - 288000, endsAt: now + 12000 }
    ]
  });
}

// ---------- обновление самой страницы ----------
// Свежая копия с сайта (мимо кэша) с другой VERSION — перезагружаемся с меткой в адресе, которой нет в кэше.
async function checkVersion() {
  if (location.protocol === 'file:') return;
  try {
    const html = await (await fetch(location.pathname + '?t=' + Date.now(), { cache: 'no-store' })).text();
    const m = /const VERSION = '([^']+)'/.exec(html);
    if (!m || m[1] === VERSION) return;
    if (Date.now() - (+qs.get('_v') || 0) < 120000) return;
    qs.set('_v', Date.now());
    location.replace(location.pathname + '?' + qs.toString());
  } catch (e) { /* сайт недоступен — работаем на том, что есть */ }
}

// ---------- запуск ----------
if (qs.has('demo')) demo();
else { adopt(readLocal()); connectBridge(); }
setInterval(checkVersion, 10 * 60 * 1000);
