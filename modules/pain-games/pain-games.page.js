// Код страницы pain-games.html (раздел pain-games). Подключается из pain-games.html.
'use strict';
// Кнопка доната — ссылка из профиля (админка → «Настройки» → «Стример»); пусто — кнопки нет
function setDonate() {
  const a = document.getElementById('donate-link');
  if (siteProfile.donateUrl) a.href = siteProfile.donateUrl;
  a.hidden = !siteProfile.donateUrl;
}
setDonate();
siteModules.onChange(setDonate);

// Цвета заглушки для игр без обложки — те же, что у секторов рулетки.
const PALETTE = ['#8d4564','#555897','#ad704b','#487c87','#754d92','#9a5359','#687748','#455f95'];
const MONTHS = ['янв.','февр.','марта','апр.','мая','июня','июля','авг.','сент.','окт.','нояб.','дек.'];
const state = {games: [], status: 'all', genre: 'all', sort: 'added', query: ''};
const key = s => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

// «12», «12,5» — часы; «12:30» — часы:минуты. Возвращает минуты или null.
function parseHours(s) {
  s = (s || '').trim().replace(',', '.');
  if (!s) return null;
  const hm = s.match(/^(\d+):(\d{1,2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}
// «02.10.2026», «2026-10-02», «10/2/2026». Возвращает timestamp или null.
function parseDate(s) {
  s = (s || '').trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(+m[3], m[2] - 1, +m[1]).getTime();
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], m[1] - 1, +m[2]).getTime();
  return null;
}
function fmtMinutes(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h} ч ${m} мин` : h ? `${h} ч` : `${m} мин`;
}
function fmtDate(ts) { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildGames(rows, meta) {
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = re => header.findIndex((h, i) => i > 0 && re.test(h));
  const playedCol = col(/наигр|сыгр|час|hours/), lastCol = col(/послед|дата|когда|last/), quipCol = col(/описан|от себя|quip/);
  const seen = new Set(), games = [];
  rows.slice(1).forEach(r => {
    const name = (r[0] || '').trim().replace(/\s+/g, ' ');
    if (!name || seen.has(key(name))) return;
    seen.add(key(name));
    const m = meta[key(name)] || {};
    games.push({
      name, order: games.length, meta: m,
      minutes: playedCol >= 0 ? parseHours(r[playedCol]) : null,
      last: lastCol >= 0 ? parseDate(r[lastCol]) : null,
      // Своё описание из таблицы важнее придуманного роботом.
      quip: (quipCol >= 0 && (r[quipCol] || '').trim()) || m.quip || '',
    });
  });
  return games;
}

function buildCard(g) {
  const li = el('li', 'pcard');
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.setAttribute('aria-label', `${g.name} — перевернуть карточку`);
  const inner = el('div', 'pcard__inner');
  const color = PALETTE[g.order % PALETTE.length];
  const image = g.meta.cover || g.meta.header;

  // Лицо: только обложка и название.
  const front = el('div', 'pcard__face pcard__front');
  const placeholder = () => {
    front.style.background = `linear-gradient(160deg, ${color}, #10142a)`;
    front.prepend(el('div', 'pcard__placeholder', [...g.name][0].toUpperCase()));
  };
  if (image) {
    const img = el('img');
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = image;
    img.onerror = () => {
      if (g.meta.header && img.src !== g.meta.header) img.src = g.meta.header;
      else { img.remove(); placeholder(); }
    };
    front.append(img);
  } else placeholder();
  const shade = el('div', 'pcard__shade');
  shade.append(el('div', 'pcard__title', g.name));
  const hint = el('div', 'pcard__flip-hint');
  hint.innerHTML = icon('flip');
  front.append(shade, hint);

  // Оборот: жанры, год, описание, сколько и когда играли.
  const back = el('div', 'pcard__face pcard__back');
  const bg = el('div', 'pcard__back-bg');
  if (image) bg.style.backgroundImage = `url("${image}")`; else bg.style.background = color;
  const body = el('div', 'pcard__back-body');
  body.append(el('div', 'pcard__back-title', g.meta.title || g.name));
  if (g.meta.year) body.append(el('div', 'pcard__meta', `${g.meta.year} год`));
  if (g.meta.genres?.length) {
    const genres = el('div', 'pcard__genres');
    g.meta.genres.forEach(name => genres.append(el('span', 'pcard__genre', name)));
    body.append(genres);
  }
  if (g.quip) body.append(el('p', 'pcard__quip', g.quip));
  else if (g.meta.description) body.append(el('p', 'pcard__desc', g.meta.description));
  else if (!g.meta.found) body.append(el('p', 'pcard__desc', g.meta.checked
    ? 'Не нашли эту игру ни в Steam, ни в базах игр. Стример может добавить картинку вручную.'
    : 'Игра только что попала в пул — данные подтянутся в течение получаса.'));
  const stats = el('div', 'pcard__stats');
  const stat = (label, value, played) => {
    const row = el('div', 'stat' + (played ? ' is-played' : ''));
    row.append(el('span', '', label), el('b', '', value));
    return row;
  };
  // Не играли — одна строка вместо двух пустых, чтобы подписи хватило места.
  if (g.minutes || g.last) {
    stats.append(stat('Наиграно', g.minutes ? fmtMinutes(g.minutes) : '—', !!g.minutes));
    if (g.last) stats.append(stat('Последний раз', fmtDate(g.last), false));
  } else {
    stats.append(el('div', 'stat stat--fresh', 'Ещё не страдал'));
  }
  const url = g.meta.steamUrl || g.meta.igdbUrl;
  if (url) {
    const link = el('a', 'pcard__link');
    link.innerHTML = (g.meta.steamUrl ? 'Steam ' : 'IGDB ') + icon('external');
    link.href = url; link.target = '_blank'; link.rel = 'noopener';
    link.addEventListener('click', e => e.stopPropagation());
    stats.append(link);
  }
  body.append(stats);
  back.append(bg, body);

  inner.append(front, back);
  li.append(inner);
  const flip = () => li.classList.toggle('is-flipped');
  li.addEventListener('click', flip);
  li.addEventListener('contextmenu', e => { e.preventDefault(); flip(); });
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  g.card = li;
  return li;
}

const isPlayed = g => !!(g.minutes || g.last);
const SORTS = {
  added: (a, b) => b.order - a.order,
  recent: (a, b) => (b.last || 0) - (a.last || 0) || (b.minutes || 0) - (a.minutes || 0) || b.order - a.order,
  hours: (a, b) => (b.minutes || 0) - (a.minutes || 0) || (b.last || 0) - (a.last || 0) || b.order - a.order,
  year: (a, b) => (b.meta.year || 0) - (a.meta.year || 0) || a.name.localeCompare(b.name, 'ru'),
  name: (a, b) => a.name.localeCompare(b.name, 'ru'),
};

function renderGenres() {
  const counts = new Map();
  state.games.forEach(g => (g.meta.genres || []).forEach(name => counts.set(name, (counts.get(name) || 0) + 1)));
  const box = document.getElementById('genre-filters');
  const chips = [['all', 'Все жанры', state.games.length], ...[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).map(([n, c]) => [n, n, c])];
  box.replaceChildren(...chips.map(([value, label, count]) => {
    const b = el('button', 'chip' + (state.genre === value ? ' is-active' : ''), label + ' ');
    b.append(el('span', 'count', count));
    b.addEventListener('click', () => { state.genre = value; renderGenres(); render(); });
    return b;
  }));
  box.hidden = counts.size === 0;
}

function render() {
  const q = state.query;
  const shown = state.games.filter(g =>
    (!q || g.name.toLocaleLowerCase('ru').includes(q) || (g.meta.title || '').toLocaleLowerCase('ru').includes(q)) &&
    (state.status === 'all' || (state.status === 'played') === isPlayed(g)) &&
    (state.genre === 'all' || (g.meta.genres || []).includes(state.genre))
  ).sort(SORTS[state.sort]);
  const grid = document.getElementById('grid');
  grid.replaceChildren(...shown.map(g => g.card));
  grid.hidden = !shown.length;
  document.getElementById('no-results').hidden = !!shown.length || !state.games.length;
  const filtered = shown.length !== state.games.length;
  const count = document.getElementById('shown-count');
  count.hidden = !filtered || !shown.length;
  count.textContent = `Показано: ${shown.length} из ${state.games.length}`;
}

function renderSummary() {
  const total = state.games.length, played = state.games.filter(isPlayed);
  const minutes = played.reduce((s, g) => s + (g.minutes || 0), 0);
  document.getElementById('cnt-all').textContent = total;
  document.getElementById('cnt-played').textContent = played.length;
  document.getElementById('cnt-fresh').textContent = total - played.length;
  const sub = document.getElementById('subtitle');
  sub.replaceChildren('Игры, которыми можно наказать стримера · в пуле ');
  const a = el('span', 'accent', `${total} ${plural(total, 'игра', 'игры', 'игр')}`);
  sub.append(a);
  if (minutes) {
    sub.append(' · отстрадано ');
    sub.append(el('span', 'accent', fmtMinutes(minutes)));
  }
}

function bindChips(boxId, attr, field) {
  document.getElementById(boxId).addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state[field] = b.dataset[attr];
    document.querySelectorAll(`#${boxId} .chip`).forEach(c => c.classList.toggle('is-active', c === b));
    render();
  });
}

async function load() {
  const status = document.getElementById('status');
  try {
    const [csv, meta] = await Promise.all([
      siteData.fetch(PAIN_CSV_URL).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }),
      // Без данных об играх страница всё равно работает — просто без обложек.
      fetch('pain-meta.json?v=' + Math.floor(Date.now() / 60000), {cache: 'no-cache'})
        .then(r => r.ok ? r.json() : {games: {}}).catch(() => ({games: {}})),
    ]);
    state.games = buildGames(parseCSV(csv), meta.games || {});
    state.games.forEach(buildCard);
    status.hidden = !!state.games.length;
    status.textContent = 'Пул пока пуст. Закажи первую игру за баллы канала.';
    renderSummary(); renderGenres(); render();
  } catch (err) {
    console.warn('Pain pool load failed:', err.message);
    status.textContent = 'Не удалось загрузить пул игр. Обнови страницу чуть позже.';
  }
}
document.getElementById('search').addEventListener('input', e => { state.query = e.target.value.trim().toLocaleLowerCase('ru'); render(); });
bindChips('status-filters', 'status', 'status');
bindChips('sort-filters', 'sort', 'sort');
load();
