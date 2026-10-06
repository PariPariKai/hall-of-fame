// Общий код страниц заказов (anime, movies, series, games): загрузка листа, витрина «Сейчас и скоро»,
// фильтры и карточки-постеры в стиле страницы «Боль». Страница задаёт только window.ORDERS_PAGE (см. movies.html).
(function () {
'use strict';
const CFG = window.ORDERS_PAGE;
const VIEWERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThU3PDQlG4EPkPHygpf1q54KuNuuc4WYWnGqZde3-8iD8buBBFLEkr3MIDdnvv-oekgEN0CXj7Bq6C/pub?gid=527100001&single=true&output=csv";
const STATUS = Object.fromEntries(CFG.statuses.map(s => [s.id, s]));
const TYPE = Object.fromEntries((CFG.types || []).map(t => [t.id, t]));
const isDone = s => !!(STATUS[s] && STATUS[s].done);
// Цвета заглушек для заказов без обложки — те же, что у «Боли».
const PALETTE = ['#8d4564', '#555897', '#ad704b', '#487c87', '#754d92', '#9a5359', '#687748', '#455f95'];
const AVATAR_COLORS = ['#7F77DD', '#FAC775', '#97C459', '#F0997B', '#88B4F5', '#C5A9F8', '#F38787', '#F0BC58', '#6FA13C', '#D85A30'];
const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const $ = id => document.getElementById(id);

const state = { items: [], status: 'all', type: 'all', sort: 'default', title: '', nick: '', signature: '' };

// ---------- данные ----------
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  return rows;
}

function rowsToViewers(rows) {
  if (rows.length < 2) return {};
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const nickIdx = headers.indexOf('nick'), avatarIdx = headers.indexOf('avatar_url'), twitchIdx = headers.indexOf('twitch_url');
  if (nickIdx < 0) return {};
  const map = {};
  rows.slice(1).forEach(r => {
    const nick = (r[nickIdx] || '').trim();
    if (!nick) return;
    map[nick.toLowerCase()] = {
      avatar: avatarIdx >= 0 ? (r[avatarIdx] || '').trim() : '',
      twitchUrl: twitchIdx >= 0 ? (r[twitchIdx] || '').trim() : '',
    };
  });
  return map;
}

// Эмодзи в названиях (флаги и т.п.) на разных устройствах рисуются по-разному — убираем
const noEmoji = s => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{E0020}-\u{E007F}]/gu, '').replace(/\s+/g, ' ').trim();
const num = s => { const n = parseFloat(String(s).replace(',', '.')); return isFinite(n) ? n : null; };

// Колонки читаются по заголовку; каких-то нет в листе — поле просто пустое.
function rowsToItems(rows, viewers) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = name => headers.indexOf(name);
  const idx = {};
  ['nick', 'title', 'type', 'url', 'status', 'rating', 'cover_url', 'date_added', 'date_completed', 'notes',
    'scheduled_at', 'format', 'episodes_total', 'episodes_watched', 'progress_percent', 'hours_played'].forEach(c => { idx[c] = col(c); });
  if (idx.nick < 0 || idx.title < 0) return [];
  return rows.slice(1)
    .filter(r => (r[idx.nick] || '').trim() && (r[idx.title] || '').trim())
    .map((r, i) => {
      const get = c => idx[c] >= 0 ? (r[idx[c]] || '').trim() : '';
      const nick = get('nick');
      const viewer = viewers[nick.toLowerCase()] || {};
      const status = STATUS[get('status').toLowerCase()] ? get('status').toLowerCase() : CFG.statuses[0].id;
      const type = TYPE[get('type').toLowerCase()] ? get('type').toLowerCase() : (CFG.types ? 'other' : '');
      const format = get('format').toLowerCase();
      return {
        _order: i,
        // key — название как в таблице (по нему ищем обложку и подпись), title — для показа, без эмодзи
        nick, key: get('title'), title: noEmoji(get('title')) || get('title'), status, type, url: get('url'),
        avatar: viewer.avatar || '', twitchUrl: viewer.twitchUrl || '',
        rating: num(get('rating')),
        cover_url: get('cover_url'),
        date_added: get('date_added'), date_completed: get('date_completed'),
        notes: get('notes'), scheduled_at: get('scheduled_at'),
        format: format === 'sub' || format === 'dub' ? format : '',
        episodes_total: parseInt(get('episodes_total'), 10) || 0,
        episodes_watched: parseInt(get('episodes_watched'), 10) || 0,
        // Пустой прогресс у игры = нет концовки (R.E.P.O, No Man's Sky, онлайн) — шкалу не рисуем
        progress_percent: get('progress_percent') ? num(get('progress_percent')) : null,
        hours_played: num(get('hours_played')) || 0,
      };
    });
}

// Ссылка и обложка, найденные роботом (.github/scripts/orders-meta.mjs), — только если в таблице пусто.
// У YouTube-заказов без обложки берём превью прямо из ссылки на видео.
const ORDERS_META = fetch('orders-meta.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
// Короткие смешные подписи для оборота карточки (как у «Боли»), см. orders-quips.json
const ORDERS_QUIPS = fetch('orders-quips.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
function metaKey(list, title) {
  return list + '|' + String(title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');
}
function applyOrdersMeta(items, meta, quips) {
  const found = (meta && meta.items) || {};
  const quip = (quips && quips.items) || {};
  items.forEach(it => {
    it.quip = quip[metaKey(CFG.list, it.key)] || '';
    const m = found[metaKey(CFG.list, it.key)];
    if (m && m.found) {
      if (!it.url && m.url) it.url = m.url;
      if (!it.cover_url && m.cover) it.cover_url = m.cover;
      // Обложка в таблице есть — запоминаем робота как запасную вертикальную (см. fitCover)
      else if (m.cover && m.cover !== it.cover_url) it.alt_cover = m.cover;
    }
    const yt = (it.url || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
    if (!it.cover_url && yt) it.cover_url = `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  });
}

// ---------- даты ----------
// Время в таблице — по часам стримера (siteTime из site.js: DD.MM.YYYY, пояс, летнее время).
// Кнопка «Моё время» показывает время показа в поясе зрителя.
const parseSheetDate = siteTime.parse;
const ts = s => { const d = parseSheetDate(s); return d ? d.getTime() : 0; };
const dayNo = (d, tz) => { const p = siteTime.parts(d, tz); return Date.UTC(p.y, p.mo, p.d) / 86400000; };
// Дата без времени (добавлено, досмотрено) — по календарю стримера
function shortDate(s) {
  const d = parseSheetDate(s);
  if (!d) return s;
  const p = siteTime.parts(d);
  return `${p.d} ${MONTHS_RU[p.mo]} ${p.y}`;
}
// Дата показа из scheduled_at: «сегодня в 20:00», «завтра в 18:00», «вс, 4 окт в 18:00».
// Только дата без времени — всегда по календарю стримера (иначе у зрителя на западе съехала бы на день).
function showTime(s) {
  const d = parseSheetDate(s);
  if (!d) return s;
  const timed = siteTime.hasTime(s);
  const tz = timed ? siteTime.show() : siteTime.streamer;
  const p = siteTime.parts(d, tz);
  const hm = timed ? ` в ${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}` : '';
  const diff = dayNo(d, tz) - dayNo(new Date(), tz);
  if (diff === 0) return 'сегодня' + hm;
  if (diff === 1) return 'завтра' + hm;
  return `${WEEKDAYS_RU[p.wd]}, ${p.d} ${MONTHS_RU[p.mo]}${hm}`;
}
// Бейдж даты показа: data-show — чтобы при «Моё время» обновить текст, не пересобирая карточки
const showTag = s => tag('show', icon('calendar') + `<span class="tz" data-show="${esc(s)}">${esc(showTime(s))}</span>`);
// Время назначенного показа (сегодня или позже по календарю стримера), иначе 0. Досмотренное и паузу не анонсируем.
function upcomingTs(it) {
  if (!it.scheduled_at || isDone(it.status) || it.status === 'paused') return 0;
  const t = ts(it.scheduled_at);
  const p = siteTime.parts(new Date());
  return t >= siteTime.at(p.y, p.mo, p.d, 0, 0).getTime() ? t : 0;
}

// ---------- мелочи ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function isHttpUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
}
const cssUrl = s => `url(&quot;${esc(String(s).replace(/"/g, '%22'))}&quot;)`;
function hashOf(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function initials(nick) {
  const clean = nick.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, '');
  return (clean.length >= 2 ? clean[0] + clean[1] : clean[0] || '?').toUpperCase();
}
const fmtNum = n => Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1);
function plural(n, one, few, many) {
  const t = n % 100, d = n % 10;
  if (t >= 11 && t <= 14) return many;
  return d === 1 ? one : d >= 2 && d <= 4 ? few : many;
}
// Подпись ссылки по сайту: «Кинопоиск ↗», «Shikimori ↗»…
const LINK_SITES = [
  [/shikimori/, 'Shikimori'], [/kinopoisk/, 'Кинопоиск'], [/youtu\.?be/, 'YouTube'], [/steampowered|steamcommunity/, 'Steam'],
  [/imdb/, 'IMDb'], [/myanimelist/, 'MyAnimeList'], [/anilist/, 'AniList'], [/igdb/, 'IGDB'], [/mydramalist/, 'MyDramaList'],
  [/doramy|dorama/, 'Дорамы'], [/twitch/, 'Twitch'],
];
function linkLabel(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'Ссылка'; }
  const hit = LINK_SITES.find(([re]) => re.test(host));
  return hit ? hit[1] : host;
}
const tag = (tone, html) => `<span class="tag tag--${tone}">${html}</span>`;

function avatarHtml(it) {
  return it.avatar
    ? `<span class="who__ava" style="background-image:${cssUrl(it.avatar)}"></span>`
    : `<span class="who__ava" style="background:${AVATAR_COLORS[hashOf(it.nick.toLowerCase()) % AVATAR_COLORS.length]}">${esc(initials(it.nick))}</span>`;
}
function whoHtml(it, linked) {
  const nick = linked && isHttpUrl(it.twitchUrl)
    ? `<a class="who__nick" href="${esc(it.twitchUrl)}" target="_blank" rel="noopener">${esc(it.nick)}</a>`
    : `<span class="who__nick">${esc(it.nick)}</span>`;
  return `<div class="who">${avatarHtml(it)}${nick}</div>`;
}

// Прогресс: серии (аниме, сериалы) или проценты (игры). null — шкалу не рисуем.
function progressOf(it) {
  const tone = STATUS[it.status].tone;
  const fill = tone === 'done' ? 'done' : tone === 'dropped' ? 'dropped' : tone === 'active' ? 'active' : '';
  if (CFG.progress === 'episodes') {
    if (it.episodes_total <= 0) return null;
    const watched = Math.max(0, it.episodes_watched);
    const pct = Math.round(Math.min(watched, it.episodes_total) / it.episodes_total * 100);
    return { pct, fill: fill || (watched > 0 ? 'active' : ''), label: `<b>${watched}</b> / ${it.episodes_total} ${plural(it.episodes_total, 'серия', 'серии', 'серий')}` };
  }
  if (CFG.progress === 'percent') {
    // «Сыграно» и игры без концовки — без шкалы, остаются только часы
    if (tone === 'played') return null;
    if (it.progress_percent === null && tone !== 'done') return null;
    const pct = tone === 'done' ? 100 : Math.max(0, Math.min(100, Math.round(it.progress_percent || 0)));
    return { pct, fill, label: 'Прогресс' };
  }
  return null;
}
function progressHtml(p, compact) {
  if (!p) return '';
  return `<div class="progress">${compact ? '' : `<div class="progress__label"><span>${p.label}</span><span>${p.pct}%</span></div>`}` +
    `<div class="progress__bar"><div class="progress__fill${p.fill ? ' progress__fill--' + p.fill : ''}" style="width:${p.pct}%"></div></div></div>`;
}

function statusTags(it) {
  const st = STATUS[it.status];
  const show = upcomingTs(it);
  const tags = [];
  if (show) tags.push(showTag(it.scheduled_at));
  if (!show || it.status !== CFG.statuses[0].id) tags.push(tag(st.tone, esc(st.label)));
  return tags;
}

// ---------- карточка ----------
function buildCard(it) {
  const st = STATUS[it.status];
  const color = PALETTE[hashOf(it.title) % PALETTE.length];
  const cover = isHttpUrl(it.cover_url) ? it.cover_url : '';
  const prog = progressOf(it);
  const show = upcomingTs(it);

  const placeholder = `<div class="pcard__placeholder">${esc([...it.title][0].toUpperCase())}</div>`;
  const front = `
    <div class="pcard__face pcard__front"${cover ? '' : ` style="background:linear-gradient(160deg, ${color}, #10142a)"`}>
      ${cover ? `<div class="pcard__blur" style="background-image:${cssUrl(cover)}"></div><img src="${esc(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : placeholder}
      <div class="pcard__tags">${it.status === CFG.statuses[0].id && !show ? '' : statusTags(it).join('')}</div>
      <div class="pcard__shade">
        <div class="pcard__title">${esc(it.title)}</div>
        ${whoHtml(it, false)}
        ${st.tone === 'active' ? progressHtml(prog, true) : ''}
      </div>
      <div class="pcard__flip-hint">${icon('flip')}</div>
    </div>`;

  const meta = [];
  if (it.type && TYPE[it.type]) meta.push(TYPE[it.type].one);
  if (it.format === 'dub') meta.push('озвучка');
  else if (it.format === 'sub') meta.push('субтитры');
  const tags = statusTags(it);
  if (it.rating !== null) tags.push(tag('rating', icon('star', 'ic--fill') + esc(fmtNum(it.rating))));

  const stats = [];
  const stat = (label, value) => stats.push(`<div class="stat"><span>${label}</span><b>${esc(value)}</b></div>`);
  if (show) stat('Показ', showTime(it.scheduled_at));
  if (it.hours_played > 0) stat('Наиграно', `${fmtNum(it.hours_played)} ч`);
  if (it.date_added) stat('Добавлено', shortDate(it.date_added));
  if (it.date_completed) stat(st.doneLabel || 'Завершено', shortDate(it.date_completed));
  const link = isHttpUrl(it.url)
    ? `<a class="pcard__link" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(linkLabel(it.url))} ${icon('external')}</a>` : '';

  const back = `
    <div class="pcard__face pcard__back">
      <div class="pcard__back-bg" style="${cover ? `background-image:${cssUrl(cover)}` : `background:${color}`}"></div>
      <div class="pcard__back-body">
        <div class="pcard__back-title">${esc(it.title)}</div>
        ${meta.length ? `<div class="pcard__meta">${esc(meta.join(' · '))}</div>` : ''}
        <div class="pcard__genres">${tags.join('')}</div>
        ${progressHtml(prog, false)}
        ${it.quip ? `<p class="pcard__quip">${esc(it.quip)}</p>` : '<div class="pcard__spacer"></div>'}
        ${it.notes ? `<p class="pcard__verdict"><span>Вердикт стримера</span>${esc(it.notes)}</p>` : ''}
        ${stats.length || link ? `<div class="pcard__stats">${stats.join('')}${link}</div>` : ''}
      </div>
    </div>`;

  const li = document.createElement('li');
  li.className = 'pcard' + (st.tone === 'done' || st.tone === 'dropped' ? ' is-done' : '') + (st.tone === 'paused' || st.tone === 'played' ? ' is-dim' : '') +
    (show ? ' is-scheduled' : '') + (st.tone === 'active' ? ' is-active' : '');
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.setAttribute('aria-label', `${it.title} — перевернуть карточку`);
  li.innerHTML = `<div class="pcard__inner">${front}${back}</div>`;

  const img = li.querySelector('.pcard__front img');
  if (img) {
    const face = img.parentNode;
    img.addEventListener('load', () => fitCover(img, it));
    img.addEventListener('error', () => {
      if (it.alt_cover && !it._altTried) { it._altTried = true; setCover(img, it.alt_cover); return; }
      face.querySelector('.pcard__blur').remove();
      img.replaceWith(Object.assign(document.createElement('div'), { className: 'pcard__placeholder', textContent: [...it.title][0].toUpperCase() }));
      face.style.background = `linear-gradient(160deg, ${color}, #10142a)`;
    });
  }
  const flip = () => li.classList.toggle('is-flipped');
  li.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
  li.addEventListener('contextmenu', e => { if (!e.target.closest('a')) { e.preventDefault(); flip(); } });
  li.addEventListener('keydown', e => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flip(); } });
  li.querySelectorAll('a').forEach(a => a.addEventListener('keydown', e => e.stopPropagation()));
  it.card = li;
  return li;
}
function setCover(img, url) {
  img.src = url;
  const blur = img.parentNode.querySelector('.pcard__blur');
  if (blur) blur.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
  const bg = img.closest('.pcard').querySelector('.pcard__back-bg');
  if (bg) bg.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
}
// Горизонтальную обложку вписываем целиком; если у робота есть вертикальная — берём её.
function fitCover(img, it) {
  if (img.naturalWidth <= img.naturalHeight * 0.85) return;
  if (it.alt_cover && !it._altTried) { it._altTried = true; setCover(img, it.alt_cover); return; }
  img.parentNode.classList.add('is-landscape');
}

// «Моё время»: пересчитать бейджи дат показа на карточках и витрину
siteTime.onChange(() => {
  document.querySelectorAll('[data-show]').forEach(el => { el.textContent = showTime(el.dataset.show); });
  renderNow();
});

// ---------- витрина «Сейчас и скоро» ----------
function renderNow() {
  const box = $('now');
  const upcoming = state.items.filter(upcomingTs).sort((a, b) => upcomingTs(a) - upcomingTs(b));
  const active = state.items.filter(it => STATUS[it.status].tone === 'active' && !upcomingTs(it));
  const list = [...upcoming, ...active].slice(0, 4);
  box.hidden = !list.length;
  if (!list.length) return;
  // Есть анонсы с временем — рядом кнопка «Моё время» и подпись пояса
  const timed = upcoming.some(it => siteTime.hasTime(it.scheduled_at));
  box.innerHTML = `<div class="spotlight__head"><h2 class="spotlight__title">Сейчас и скоро</h2>${timed ? siteTime.toggle() : ''}</div>` +
    (timed ? `<p class="spotlight__zone tz-zone">${siteTime.zoneLabel()}</p>` : '') + `<div class="spot-list">` + list.map((it, i) => {
    const cover = isHttpUrl(it.cover_url) ? it.cover_url : '';
    const poster = cover
      ? `<span class="spot-item__poster" style="background-image:${cssUrl(cover)}"></span>`
      : `<span class="spot-item__poster" style="background:linear-gradient(160deg, ${PALETTE[hashOf(it.title) % PALETTE.length]}, #10142a)">${esc([...it.title][0].toUpperCase())}</span>`;
    const label = upcomingTs(it) ? showTag(it.scheduled_at) : tag('active', esc(STATUS[it.status].label));
    const prog = progressOf(it);
    return `<button type="button" class="spot-item" data-i="${i}">${poster}<span class="spot-item__body">${label}` +
      `<span class="spot-item__title">${esc(it.title)}</span>${whoHtml(it, false)}${prog && prog.pct > 0 ? progressHtml(prog, false) : ''}</span></button>`;
  }).join('') + '</div>';
  box.querySelectorAll('.spot-item').forEach(btn => btn.addEventListener('click', () => {
    const it = list[+btn.dataset.i];
    if (!it.card.isConnected) resetFilters();
    it.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    it.card.classList.remove('is-flash');
    void it.card.offsetWidth;
    it.card.classList.add('is-flash');
  }));
}

// ---------- фильтры, сортировка ----------
function dateTs(it) {
  // В разделах «досмотрено/пройдено» — по дате завершения, иначе по дате добавления.
  if (isDone(state.status) && it.date_completed) return ts(it.date_completed);
  return ts(it.date_added) || ts(it.date_completed);
}
function compare(a, b) {
  if (state.sort === 'date-desc' || state.sort === 'date-asc') {
    const da = dateTs(a), db = dateTs(b);
    if (da !== db) return state.sort === 'date-desc' ? db - da : da - db;
    return a._order - b._order;
  }
  if (isDone(state.status)) {
    const da = ts(a.date_completed), db = ts(b.date_completed);
    return da !== db ? db - da : a._order - b._order;
  }
  const ua = upcomingTs(a), ub = upcomingTs(b);
  if (!!ua !== !!ub) return ua ? -1 : 1;
  if (ua !== ub) return ua - ub;
  const sw = STATUS[a.status].weight - STATUS[b.status].weight;
  if (sw) return sw;
  const da = ts(a.date_added), db = ts(b.date_added);
  return da !== db ? db - da : a._order - b._order;
}

function render() {
  const shown = state.items.filter(it =>
    (state.status === 'all' || it.status === state.status) &&
    (state.type === 'all' || it.type === state.type) &&
    (!state.title || it.title.toLowerCase().includes(state.title)) &&
    (!state.nick || it.nick.toLowerCase().includes(state.nick))
  ).sort(compare);
  const grid = $('grid');
  grid.replaceChildren(...shown.map(it => it.card));
  grid.hidden = !shown.length;
  const none = $('no-results');
  none.hidden = !!shown.length || !state.items.length;
  if (!shown.length) {
    const parts = [];
    if (state.title) parts.push(`«${state.title}»`);
    if (state.nick) parts.push(`заказчик «${state.nick}»`);
    none.textContent = parts.length ? `Ничего не найдено по ${parts.join(', ')}` : 'В этой категории пока пусто';
  }
  const filtered = shown.length !== state.items.length;
  const count = $('shown-count');
  count.hidden = !filtered || !shown.length;
  count.textContent = `Показано: ${shown.length} из ${state.items.length}`;
}

function chipsRow(boxId, field, chips, label) {
  const box = $(boxId);
  box.innerHTML = (label ? `<span class="toolbar__label">${label}</span>` : '') + chips.map(([value, text, count]) =>
    `<button type="button" class="chip${state[field] === value ? ' is-active' : ''}" data-value="${esc(value)}">${esc(text)}` +
    (count === undefined ? '' : ` <span class="count">${count}</span>`) + '</button>').join('');
}
function renderChips() {
  const counts = {};
  state.items.forEach(it => { counts[it.status] = (counts[it.status] || 0) + 1; counts['t:' + it.type] = (counts['t:' + it.type] || 0) + 1; });
  chipsRow('status-filters', 'status', [['all', 'Все', state.items.length], ...CFG.statuses.map(s => [s.id, s.chip || s.label, counts[s.id] || 0])]);
  if (CFG.types) {
    chipsRow('type-filters', 'type', [['all', 'Все типы', state.items.length], ...CFG.types.map(t => [t.id, t.label, counts['t:' + t.id] || 0])], 'Тип:');
    $('type-filters').hidden = false;
  }
  chipsRow('sort-filters', 'sort', [['default', 'По статусу'], ['date-desc', 'Сначала новые'], ['date-asc', 'Сначала старые']], 'Сортировка:');
  const sub = $('subtitle');
  sub.innerHTML = CFG.summary(counts, state.items.length, n => `<span class="accent">${n}</span>`);
}
function bindChips(boxId, field) {
  if (!$(boxId)) return;
  $(boxId).addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state[field] = b.dataset.value;
    $(boxId).querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === b));
    render();
  });
}
function resetFilters() {
  Object.assign(state, { status: 'all', type: 'all', title: '', nick: '' });
  $('search-title').value = '';
  $('search-nick').value = '';
  renderChips();
  render();
}

// ---------- загрузка ----------
async function load() {
  const status = $('status');
  try {
    const [csv, viewersCsv, meta, quips] = await Promise.all([
      fetch(CFG.csv).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} при загрузке листа ${CFG.sheet}`); return r.text(); }),
      fetch(VIEWERS_CSV_URL).then(r => r.ok ? r.text() : '').catch(() => ''),
      ORDERS_META,
      ORDERS_QUIPS,
    ]);
    // Каждую минуту перечитываем лист; ничего не поменялось — карточки не трогаем (перевёрнутые остаются перевёрнутыми).
    const signature = csv + '\n' + viewersCsv;
    if (signature === state.signature) return;
    state.signature = signature;
    const flipped = new Set(state.items.filter(it => it.card && it.card.classList.contains('is-flipped')).map(it => it.title + '|' + it.nick));
    state.items = rowsToItems(parseCSV(csv), rowsToViewers(parseCSV(viewersCsv)));
    applyOrdersMeta(state.items, meta, quips);
    state.items.forEach(it => { buildCard(it); if (flipped.has(it.title + '|' + it.nick)) it.card.classList.add('is-flipped'); });
    status.className = 'empty-state';
    status.hidden = !!state.items.length;
    status.textContent = `Пока ни одного заказа ${CFG.noun}.`;
    renderChips();
    renderNow();
    render();
  } catch (err) {
    console.error(err);
    if (state.items.length) return; // уже что-то показано — тихо ждём следующей попытки
    status.className = 'error-state';
    status.hidden = false;
    status.innerHTML = `${icon('alert')}Не удалось загрузить данные.<br>${esc(err.message)}<br><button type="button" class="btn" id="reload">${icon('refresh')}Обновить</button>`;
    $('reload').addEventListener('click', () => { status.className = 'empty-state'; status.textContent = 'Загружаю заказы...'; load(); });
  }
}

bindChips('status-filters', 'status');
bindChips('type-filters', 'type');
bindChips('sort-filters', 'sort');
$('search-title').addEventListener('input', e => { state.title = e.target.value.trim().toLowerCase(); render(); });
$('search-nick').addEventListener('input', e => { state.nick = e.target.value.trim().toLowerCase(); render(); });
load();
setInterval(load, 60000);
})();
