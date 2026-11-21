// Код страницы iguana.html (раздел iguana). Подключается из iguana.html.
const qs = new URLSearchParams(location.search);
const num = (k, d) => { const v = parseFloat(qs.get(k)); return Number.isFinite(v) ? v : d; };

// Всё задано в пикселях кадра 1920 и масштабируется под реальный размер источника.
const SIZE = Math.max(40, num('size', 640));
const BOTTOM = num('bottom', 0);
const SPEED = Math.max(0.05, num('speed', 1));
const DELAY = Math.max(0, num('delay', 0)) * 1000;
const EVERY = Math.max(0, num('every', 0)) * 60000;
const FIRST = qs.has('first') ? Math.max(0, num('first', 0)) * 60000 : -1; // -1 — без расписания
const LOOP = qs.has('loop');
const RTL = qs.get('dir') === 'rtl';
// Шаг в гифке: за секунду опорная лапа уезжает назад на ~0.29 ширины спрайта.
// С такой скоростью игуана и движется — тогда лапы стоят на «полу», а не скользят.
const GROUND = 0.29;

const el = document.getElementById('iguana');
let walking = null;

function layout() {
  const k = innerWidth / 1920;
  el.style.width = SIZE * k + 'px';
  el.style.bottom = BOTTOM * k + 'px';
}

function walk() {
  if (walking) return walking;
  layout();
  const w = el.getBoundingClientRect().width || SIZE * innerWidth / 1920;
  const path = innerWidth + w;
  const ms = path / (GROUND * w * SPEED) * 1000;
  const flip = RTL ? ' scaleX(-1)' : '';
  const from = RTL ? innerWidth : -w;
  const to = RTL ? -w : innerWidth;
  el.style.visibility = 'visible';
  const anim = el.animate(
    [{ transform: `translateX(${from}px)${flip}` }, { transform: `translateX(${to}px)${flip}` }],
    { duration: ms, delay: DELAY, easing: 'linear', fill: 'both' }
  );
  walking = anim.finished.catch(() => {}).then(() => {
    el.style.visibility = 'hidden';
    anim.cancel();
    walking = null;
    if (LOOP) walk();
  });
  return walking;
}

// ---------- расписание ?first=…&every=… ----------
let firstTimer = 0, everyTimer = 0;
function stopSchedule() {
  clearTimeout(firstTimer); clearInterval(everyTimer);
  firstTimer = everyTimer = 0;
}
function startSchedule() {
  stopSchedule();
  firstTimer = setTimeout(() => {
    walk();
    if (EVERY) everyTimer = setInterval(walk, EVERY);
  }, FIRST);
}

// Сцену показали (глазик или смена сцены): без расписания — сразу проход,
// с расписанием — отсчёт с нуля. Убрали из эфира — расписание стоит.
function onShown(shown) {
  if (FIRST < 0) { if (shown) walk(); return; }
  if (shown) startSchedule(); else stopSchedule();
}

addEventListener('resize', layout);
addEventListener('obsSourceVisibleChanged', e => onShown(!!(e.detail && e.detail.visible)));
addEventListener('obsSourceActiveChanged', e => onShown(!!(e.detail && e.detail.active)));
if (EVERY && FIRST < 0) setInterval(walk, EVERY);

// ---------- обновление самой страницы ----------
// Свежая копия с сайта (мимо кэша) с другой VERSION — перезагружаемся с меткой в адресе, которой нет в кэше.
async function checkVersion() {
  if (location.protocol === 'file:') return;
  try {
    const html = await (await fetch(location.pathname + '?t=' + Date.now(), { cache: 'no-store' })).text();
    const m = /const VERSION = '([^']+)'/.exec(html);
    if (!m || m[1] === VERSION) return;
    if (walking) return; // не обрываем игуану на полпути
    if (Date.now() - (+qs.get('_v') || 0) < 120000) return;
    qs.set('_v', Date.now());
    location.replace(location.pathname + '?' + qs.toString());
  } catch (e) { /* сайт недоступен — работаем на том, что есть */ }
}
setInterval(checkVersion, 10 * 60 * 1000);

// ---------- запуск ----------
if (FIRST >= 0) startSchedule();
else if (el.complete) walk(); else el.addEventListener('load', walk, { once: true });
