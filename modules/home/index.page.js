// Код страницы index.html (раздел home). Подключается из index.html.
// Строки CSV -> объекты по заголовкам (заголовки в нижнем регистре), пустые строки отбрасываются
function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1)
    .filter(r => r.some(c => (c || '').trim().length > 0))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
      return o;
    });
}

function rowsToConfig(rows) {
  const config = {};
  rowsToObjects(rows).forEach(r => {
    if (r.key) config[r.key.toLowerCase()] = r.value || '';
  });
  return config;
}

async function fetchRows(url) {
  if (!url) throw new Error('нет ссылки');
  return parseCSV(await siteData.text(url)); // и лист Google, и data/*.json
}

function isValidUrl(s) {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Обложка для витрины: гифки (часто мемы-заглушки) не берём
function isNiceCover(s) {
  return isValidUrl(s) && !/\.gif(\?|$)|tenor\.com|giphy\.com/i.test(s);
}

function isTruthy(v) {
  return ['true', 'yes', '1', 'да'].includes(String(v || '').trim().toLowerCase());
}



// ===== Часовые пояса — общие из site.js (siteTime) =====
// Время в таблице — по часам стримера; кнопка «Моё время» показывает его в поясе зрителя.
const STREAMER_TZ = siteTime.streamer;
const showTZ = siteTime.show;
const zparts = siteTime.parts, zdate = siteTime.at;
const parseSheetDate = siteTime.parse, hasSheetTime = siteTime.hasTime;
function dateTs(str) {
  const d = parseSheetDate(str);
  return d && !isNaN(d.getTime()) ? d.getTime() : 0;
}

function setCounter(key, html) {
  const el = document.querySelector(`[data-counter="${key}"]`);
  if (el) el.innerHTML = html;
}

// ===== Конфиг: имя, интро, аватар, Twitch, розыгрыш =====
function applyConfig(config) {
  const name = (config.streamer_name || '').trim();
  const intro = (config.streamer_intro || '').trim();
  const avatar = (config.streamer_avatar_url || '').trim();
  const twitch = (config.streamer_twitch_url || '').trim();

  if (name) {
    document.getElementById('hero-name').textContent = name;
    document.title = name;
    const initials = name.replace(/[^A-Za-zА-Яа-я0-9]/g, '').slice(0, 2).toUpperCase() || 'PK';
    document.getElementById('hero-avatar-fallback').textContent = initials;
  }
  if (intro) {
    document.getElementById('hero-intro').textContent = intro;
  }

  if (isValidUrl(avatar)) {
    const img = document.getElementById('hero-avatar');
    const fb = document.getElementById('hero-avatar-fallback');
    img.onload = () => { img.style.display = 'block'; fb.style.display = 'none'; };
    img.onerror = () => { img.style.display = 'none'; fb.style.display = ''; };
    // Twitch отдаёт аватар в нескольких размерах — 70x70 на большом круге мылит, берём 300x300
    img.src = /jtvnw\.net/.test(avatar)
      ? avatar.replace(/-profile_image-\d+x\d+\./, '-profile_image-300x300.')
      : avatar;
    img.alt = name || 'Avatar';
  }

  if (isValidUrl(twitch)) {
    const cta = document.getElementById('hero-cta');
    cta.href = twitch;
    cta.classList.remove('hero__cta--hidden');
  }

  setupRaffle(config);
}

// ===== Розыгрыш: включается/выключается ключом raffle_active в листе Config =====
let raffleTimer = null;

function setupRaffle(config) {
  const active = isTruthy(config.raffle_active);
  const ticketsNav = document.querySelector('.site-nav__links a[href="tickets.html"]');
  if (ticketsNav) ticketsNav.parentElement.hidden = !active;
  if (!active) return;

  document.getElementById('event').hidden = false;
  document.getElementById('card-tickets').hidden = false;
  layoutCards();
  if (config.raffle_title) document.getElementById('event-title').textContent = config.raffle_title;

  const date = parseSheetDate(config.raffle_date);
  const timerEl = document.getElementById('event-timer');
  if (date && !isNaN(date.getTime())) {
    const tick = () => {
      const diff = date - Date.now();
      if (diff <= 0) {
        timerEl.innerHTML = icon('zap', 'ic--fill') + ' Розыгрыш уже идёт!';
        clearInterval(raffleTimer);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff / 3600000) % 24;
      const m = Math.floor(diff / 60000) % 60;
      const s = Math.floor(diff / 1000) % 60;
      const pad = n => String(n).padStart(2, '0');
      timerEl.textContent = (d > 0 ? `${d} д ` : '') + `${pad(h)}:${pad(m)}:${pad(s)}`;
    };
    tick();
    raffleTimer = setInterval(tick, 1000);
  }

  fetchRows(TICKETS_CSV_URL)
    .then(rows => {
      let participants = 0, total = 0;
      rowsToObjects(rows).forEach(r => {
        const n = (parseInt(r.silver, 10) || 0) + (parseInt(r.gold, 10) || 0);
        if (n > 0) { participants++; total += n; }
      });
      const stats = participants === 0
        ? 'пока нет участников — будь первым'
        : `<b>${participants}</b> ${plural(participants, ['участник', 'участника', 'участников'])} · <b>${total}</b> ${plural(total, ['билет', 'билета', 'билетов'])}`;
      document.getElementById('event-stats').innerHTML = stats;
      setCounter('tickets', stats.replace(/<b>/g, '<span class="accent">').replace(/<\/b>/g, '</span>'));
    })
    .catch(err => {
      console.warn('Tickets load failed:', err.message);
      setCounter('tickets', '—');
    });
}

// Ссылка и обложка, найденные роботом (.github/scripts/orders-meta.mjs), — только если в таблице пусто.
// У YouTube-заказов без обложки берём превью прямо из ссылки на видео.
const ORDERS_META = fetch('orders-meta.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {}).catch(() => ({}));
// Часы в Steam по заказанным играм (робот .github/scripts/steam-stats.mjs) — главнее ручных hours_played
const STEAM_STATS = fetch('steam.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null);
let steamGames = {};
function metaKey(list, title) {
  return list + '|' + String(title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');
}
function applyOrdersMeta(items, meta, list) {
  const found = (meta && meta.items) || {};
  items.forEach(it => {
    const m = found[metaKey(list, it.title)];
    if (m && m.found) {
      if (m.appid) it.appid = m.appid;
      if (!it.url && m.url) it.url = m.url;
      if (!it.cover_url && m.cover) it.cover_url = m.cover;
      // Обложка в таблице есть — запоминаем робота как запасную вертикальную (см. fitCover)
      else if (m.cover && m.cover !== it.cover_url) it.alt_cover = m.cover;
    }
    const steam = (it.url || '').match(/store\.steampowered\.com\/app\/(\d+)/); // ссылка в заказе главнее находки робота
    if (steam) it.appid = +steam[1];
    const yt = (it.url || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
    if (!it.cover_url && yt) it.cover_url = `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  });
}

// ===== Списки заказов =====
const CATS = {
  anime:  { url: ANIME_CSV_URL,  page: 'anime.html',  label: 'Аниме',  icon: 'torii', active: ['watching'], done: ['watched'] },
  movies: { url: MOVIES_CSV_URL, page: 'movies.html', label: 'Фильм',  icon: 'film', active: ['watching'], done: ['watched'] },
  series: { url: SERIES_CSV_URL, page: 'series.html', label: 'Сериал', icon: 'tv', active: ['watching'], done: ['watched'] },
  games:  { url: GAMES_CSV_URL,  page: 'games.html',  label: 'Игра',   icon: 'gamepad', active: ['playing'],  done: ['completed'] },
};

function statusOf(item) { return (item.status || 'pending').toLowerCase(); }

// Обложки бывают и вертикальные, и горизонтальные: горизонтальную вписываем целиком (см. .pcover)
function blurLayer(url) {
  return `<div class="pcover__blur" style="background-image:url('${esc(url)}')"></div>`;
}
function fitCover(img) {
  if (img.naturalWidth <= img.naturalHeight * 0.85) return;
  // Горизонтальная картинка из таблицы, а у робота есть вертикальная обложка — показываем её
  const alt = img.dataset.alt;
  if (alt) {
    img.dataset.alt = '';
    const blur = img.parentNode.querySelector('.pcover__blur');
    if (blur) blur.style.backgroundImage = `url("${alt.replace(/"/g, '%22')}")`;
    img.src = alt;
    return;
  }
  img.parentNode.classList.add('is-landscape');
}

function layoutCards() {
  const cards = document.getElementById('cards');
  cards.dataset.n = cards.querySelectorAll('.page-card:not([hidden])').length;
}

// Назначен на сегодня или позже (и не досмотрен, не на паузе)
function isScheduled(it) {
  if (!it.scheduled_at || ['watched', 'paused'].includes(statusOf(it))) return false;
  const d = parseSheetDate(it.scheduled_at);
  return !!d && !isNaN(d.getTime()) && d >= startOfDay(new Date());
}

function countText(key, items) {
  if (items.length === 0) return 'пока пусто';
  const cat = CATS[key];
  const queued = items.filter(i => statusOf(i) === 'pending').length;
  const active = items.filter(i => cat.active.includes(statusOf(i))).length;
  const done = items.filter(i => cat.done.includes(statusOf(i))).length;
  const parts = [`<span class="accent">${queued}</span> в очереди`];
  if (active > 0) parts.push(`<span class="accent">${active}</span> ${key === 'games' ? 'играем' : 'смотрим'}`);
  parts.push(`<span class="accent">${done}</span> ${key === 'games' ? 'пройдено' : 'просмотрено'}`);
  // Игры без концовки (R.E.P.O, No Man's Sky…) — статус played, «сыграно»
  const played = key === 'games' ? items.filter(i => statusOf(i) === 'played').length : 0;
  if (played > 0) parts.push(`<span class="accent">${played}</span> сыграно`);
  return parts.join(' · ');
}

// Веер из трёх свежих обложек очереди; если обложек нет — остаётся эмодзи
function renderFan(key, items) {
  const art = document.getElementById('art-' + key);
  if (!art) return;
  const covers = items
    .filter(i => statusOf(i) === 'pending' && isNiceCover(i.cover_url))
    .map((i, idx) => ({ i, idx }))
    .sort((a, b) => (dateTs(b.i.date_added) - dateTs(a.i.date_added)) || (b.idx - a.idx))
    .map(x => ({url: x.i.cover_url, alt: x.i.alt_cover || ''}));
  if (covers.length === 0) return;
  // Порядок в DOM: левая, правая, центральная (центральная — самая свежая, рисуется сверху)
  const shown = covers.slice(0, 3);
  const order = shown.length === 3 ? [shown[1], shown[2], shown[0]] : shown.slice().reverse();
  const fanItems = order.map(c =>
    `<div class="fan__item pcover">${blurLayer(c.url)}<img src="${esc(c.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-alt="${esc(c.alt)}" onload="fitCover(this)" onerror="fanImgError(this)"></div>`
  ).join('');
  art.innerHTML = `
    <div class="page-card__bg" style="background-image:url('${esc(covers[0].alt || covers[0].url)}')"></div>
    <div class="fan">${fanItems}</div>`;
  const fan = art.querySelector('.fan');
  fan._spare = covers.slice(3, 8).map(c => c.url);   // запас на случай битых ссылок
  layoutFan(fan);
}

function layoutFan(fan) {
  const items = [...fan.children];
  const pos = items.length === 3 ? ['l', 'r', 'c'] : items.length === 2 ? ['l2', 'r2'] : ['c'];
  items.forEach((el, i) => {
    el.className = el.className.replace(/\s*fan__item--\w+/g, '') + ' fan__item--' + pos[i];
  });
}

// Битая обложка: подставляем следующую из запаса, а если запаса нет — убираем и перекладываем веер
function fanImgError(img) {
  const item = img.parentNode;
  const fan = item.parentNode;
  const spare = fan._spare && fan._spare.shift();
  if (spare) {
    item.classList.remove('is-landscape');
    item.querySelector('.pcover__blur').style.backgroundImage = `url("${spare.replace(/"/g, '%22')}")`;
    img.src = spare;
    return;
  }
  item.remove();
  layoutFan(fan);
}

function progressOf(key, it) {
  if (key === 'games') {
    const pct = parseFloat((it.progress_percent || '').replace(',', '.'));
    const sg = it.appid && steamGames[it.appid];
    const hours = sg ? Math.round(sg.minutes / 6) / 10 : parseFloat((it.hours_played || '').replace(',', '.'));
    const bits = [];
    if (pct > 0) bits.push(`${Math.round(pct)}%`);
    if (hours > 0) bits.push(`${hours % 1 ? hours.toFixed(1) : hours} ч в игре`);
    return { pct: pct > 0 ? Math.min(100, pct) : null, text: bits.join(' · ') };
  }
  const total = parseInt(it.episodes_total, 10);
  const watched = parseInt(it.episodes_watched, 10);
  if (total > 0 && watched >= 0) {
    const ofForm = (total % 10 === 1 && total % 100 !== 11) ? 'серии' : 'серий';
    return { pct: Math.min(100, watched / total * 100), text: `${watched} из ${total} ${ofForm}` };
  }
  if (total > 0) return { pct: null, text: `${total} ${plural(total, ['серия', 'серии', 'серий'])}` };
  return { pct: null, text: '' };
}

// ===== Расписание недели =====
// Лист Config: schedule_sun … schedule_sat = "17:00-22:00" (пусто = выходной), picker_time, movie_time.
// Пока ключей в Config нет — действует расписание ниже.
const DAY_KEYS  = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];   // индекс = Date.getDay()
const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_IN    = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

let SCHEDULE = {
  days: { sun: '17:00-22:00', mon: '17:00-22:00', tue: '17:00-22:00', wed: '17:00-22:00', thu: '17:00-22:00', fri: '14:00-18:00', sat: '' },
  picker: '19:00',
  movie: '20:00',
};

function applyScheduleConfig(config) {
  DAY_KEYS.forEach(k => {
    if (('schedule_' + k) in config) SCHEDULE.days[k] = config['schedule_' + k];
  });
  if (parseHM(config.picker_time)) SCHEDULE.picker = config.picker_time;
  if (parseHM(config.movie_time)) SCHEDULE.movie = config.movie_time;
}

function parseHM(s) {
  const m = String(s || '').match(/(\d{1,2})[:.](\d{2})/);
  return m ? { h: +m[1], m: +m[2] } : null;
}
function parseRange(s) {
  const m = String(s || '').match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
  return m ? { start: { h: +m[1], m: +m[2] }, end: { h: +m[3], m: +m[4] } } : null;
}
// Дни считаем по календарю стримера (расписание и таблица — по его часам), а время показываем
// в выбранном поясе (showTZ). Время, пересчитанное кнопкой «Моё время», помечено классом tz — оно зелёное.
function atTime(day, hm) {
  const p = zparts(day, STREAMER_TZ);
  return zdate(p.y, p.mo, p.d, hm.h, hm.m);
}
function startOfDay(d) {
  const p = zparts(d, STREAMER_TZ);
  return zdate(p.y, p.mo, p.d, 0, 0);
}
const pad2 = n => String(n).padStart(2, '0');
const fmtHM = d => { const p = zparts(d, showTZ()); return `${pad2(p.h)}:${pad2(p.mi)}`; };
// Номер дня по календарю пояса — для «сегодня / завтра / через N дней»
const dayNo = (d, tz) => { const p = zparts(d, tz); return Date.UTC(p.y, p.mo, p.d) / 86400000; };

// Окно стрима в этот день (по календарю стримера): { start, end } или null (выходной)
function streamWindow(day) {
  const p = zparts(day, STREAMER_TZ);
  const r = parseRange(SCHEDULE.days[DAY_KEYS[p.wd]]);
  if (!r) return null;
  return { start: zdate(p.y, p.mo, p.d, r.start.h, r.start.m), end: zdate(p.y, p.mo, p.d, r.end.h, r.end.m) };
}

// Ближайший стрим (начиная с from), в окно которого попадает время hm.
// includeFrom = false — не раньше следующего дня после from.
function nextStreamAt(from, hm, includeFrom) {
  const p0 = zparts(from, STREAMER_TZ);
  const nextDay = zdate(p0.y, p0.mo, p0.d + 1, 0, 0);
  for (let i = 0; i < 14; i++) {
    const day = zdate(p0.y, p0.mo, p0.d + i, 12, 0); // полдень — подальше от перевода часов
    const w = streamWindow(day);
    if (!w) continue;
    const t = atTime(day, hm);
    if (t >= w.start && t < w.end && (includeFrom ? t > from : t >= nextDay)) return t;
  }
  return null;
}

function dayPhrase(d, now) {
  const diff = dayNo(d, showTZ()) - dayNo(now, showTZ());
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  return DAY_IN[zparts(d, showTZ()).wd];
}

function renderWeek() {
  const now = new Date();
  const tz = showTZ();
  // Полное время «17:00–22:00»: короткое «0–4» у зрителей из других поясов читалось как «ноль минус четыре»
  const short = p => `${pad2(p.h)}:${pad2(p.mi)}`;
  // Стримы этой недели (по календарю стримера), разложенные по дням недели показываемого пояса:
  // у зрителя далеко на востоке четверговый стрим может оказаться уже в пятницу.
  const p0 = zparts(now, STREAMER_TZ);
  const monday = p0.d - ((p0.wd + 6) % 7);
  const byDay = [[], [], [], [], [], [], []]; // 0 = вс
  for (let k = 0; k < 7; k++) {
    const w = streamWindow(zdate(p0.y, p0.mo, monday + k, 12, 0));
    if (!w) continue;
    const s = zparts(w.start, tz), e = zparts(w.end, tz);
    // Начало и конец — друг под другом, без тире: в узкой колонке тире висело криво
    byDay[s.wd].push(`<span class="week__from">${short(s)}</span><span class="week__to">${short(e)}</span>`);
  }
  const today = zparts(now, tz).wd;
  const days = [1, 2, 3, 4, 5, 6, 0].map(i => {
    const cls = ['week__day'];
    if (!byDay[i].length) cls.push('is-off');
    if (i === today) cls.push('is-today');
    const time = byDay[i].length ? byDay[i].map(t => `<span class="tz">${t}</span>`).join('') : 'отдых';
    return `<div class="${cls.join(' ')}"${i === today ? ' aria-current="date"' : ''}>
      <span class="week__name">${DAY_SHORT[i]}</span><span class="week__time">${time}</span></div>`;
  }).join('');
  const picker = fmtHM(atTime(now, parseHM(SCHEDULE.picker)));
  const movie = fmtHM(atTime(now, parseHM(SCHEDULE.movie)));
  document.getElementById('week').innerHTML = `
    <div class="week__head">
      <span class="week__label">Расписание стримов</span>
      ${siteTime.toggle()}
    </div>
    <div class="week__days">${days}</div>
    <p class="week__note">На вечерних стримах: <b class="tz">${picker}</b> рулетка заказов${movieAfterPicker()
      ? ' и сразу кино-вечер' : ` · <b class="tz">${movie}</b> кино-вечер`}. Иногда начинаю раньше.</p>
    <p class="week__zone tz-zone">${siteTime.zoneLabel()}</p>`;
}

// «Моё время» (кнопка из site.js): перерисовываем всё, где есть время
siteTime.onChange(() => { renderWeek(); renderNow(); });

// ===== Афиша: анонсы из колонки scheduled_at + то, что смотрим/играем сейчас =====
const SHOW_CATS = ['anime', 'movies', 'series'];
const FORMAT_LABEL = { sub: 'с субтитрами', dub: 'в озвучке' };
let afishaLists = null;

// Когда показ «закончился»: конец стрима в тот день, иначе +4 часа
function showEnd(start) {
  const w = streamWindow(start);
  if (w && w.end > start) return w.end;
  return new Date(start.getTime() + 4 * 3600000);
}

function relText(start, now) {
  const mins = Math.round((start - now) / 60000);
  const days = dayNo(start, showTZ()) - dayNo(now, showTZ());
  if (days >= 2) return `через ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
  if (days === 1) return 'завтра';
  if (mins >= 60) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `через ${h} ч${m ? ` ${m} мин` : ''}`;
  }
  return `через ${Math.max(1, mins)} мин`;
}

// Обложка не загрузилась — вместо неё иконка раздела
function coverFailed(img, cat) {
  img.parentNode.innerHTML = icon(CATS[cat].icon);
}

function renderNowItem(it, opts) {
  opts = opts || {};
  const cat = CATS[it._cat];
  const cover = isValidUrl(it.cover_url) ? it.cover_url : '';
  const prog = opts.noProgress ? { pct: null, text: '' } : progressOf(it._cat, it);
  let type = it._cat === 'movies' && (it.type || '').toLowerCase() === 'youtube' ? 'YouTube' : cat.label;
  const fmt = FORMAT_LABEL[(it.format || '').toLowerCase()];
  if (fmt) type += ' · ' + fmt;
  const meta = opts.meta != null ? opts.meta : prog.text;
  return `
    <a class="now-item${opts.big ? ' now-item--big' : ''}" href="${cat.page}">
      ${cover ? `<div class="now-item__glow" style="background-image:url('${esc(cover)}')"></div>` : ''}
      <div class="now-item__cover pcover">${cover
        ? `${blurLayer(cover)}<img src="${esc(cover)}" alt="" referrerpolicy="no-referrer" data-alt="${esc(it.alt_cover || '')}" onload="fitCover(this)" onerror="coverFailed(this, '${it._cat}')">`
        : icon(cat.icon)}</div>
      <div class="now-item__body">
        <span class="now-item__type">${esc(type)}</span>
        <h3 class="now-item__title">${esc(it.title || 'Без названия')}</h3>
        ${opts.when ? `<div class="now-item__when tz">${esc(opts.when)}</div>` : ''}
        ${opts.rel ? `<span class="now-item__rel${opts.live ? ' now-item__rel--live' : ''}">${esc(opts.rel)}</span>` : ''}
        ${it.nick ? `<p class="now-item__by">заказ от <b>${esc(it.nick)}</b></p>` : ''}
        ${prog.pct != null ? `<div class="now-item__bar"><span style="width:${prog.pct.toFixed(1)}%"></span></div>` : ''}
        ${meta ? `<p class="now-item__meta${opts.metaTz ? ' tz' : ''}">${esc(meta)}</p>` : ''}
      </div>
    </a>`;
}

// Кино «сразу после рулетки» — в админке хранится как movie_time = picker_time
function movieAfterPicker() {
  const p = parseHM(SCHEDULE.picker), m = parseHM(SCHEDULE.movie);
  return !!p && !!m && p.h === m.h && p.m === m.m;
}

function renderRitual(now) {
  const picker = nextStreamAt(now, parseHM(SCHEDULE.picker), true);
  const movie = picker ? nextStreamAt(picker, parseHM(SCHEDULE.movie), false) : null;
  let next = '';
  if (picker) {
    next = `Ближайшая рулетка — <b class="tz">${dayPhrase(picker, now)} в ${fmtHM(picker)}</b>.`;
    if (movie) next += ` Что выпадет, смотрим <b class="tz">${dayPhrase(movie, now)} в ${fmtHM(movie)}</b>.`;
  }
  return `
    <div class="ritual">
      <div class="ritual__row"><span class="ritual__time tz">${fmtHM(atTime(now, parseHM(SCHEDULE.picker)))}</span><span>Рулетка заказов: зрители решают, что смотрим дальше</span></div>
      <div class="ritual__row">${movieAfterPicker()
        ? '<span class="ritual__time ritual__time--after">сразу</span><span>после рулетки — кино-вечер: смотрим победителя прошлой рулетки</span>'
        : `<span class="ritual__time tz">${fmtHM(atTime(now, parseHM(SCHEDULE.movie)))}</span><span>Кино-вечер: смотрим победителя прошлой рулетки</span>`}</div>
      ${next ? `<p class="ritual__next">${next}</p>` : ''}
      <a href="picker.html">Рулетка заказов →</a>
    </div>`;
}

function renderNow() {
  const lists = afishaLists;
  if (!lists) return;
  const now = new Date();
  const all = [];
  Object.keys(lists).forEach(key => (lists[key] || []).forEach(it => all.push({ ...it, _cat: key })));

  // Анонсы: есть дата, не досмотрено и не на паузе, показ ещё не закончился
  const shows = all
    .filter(it => SHOW_CATS.includes(it._cat) && it.scheduled_at && !['watched', 'paused'].includes(statusOf(it)))
    .map(it => {
      let start = parseSheetDate(it.scheduled_at);
      if (!start || isNaN(start.getTime())) return null;
      // Только дата без времени — значит в обычное время кино-вечера
      if (!hasSheetTime(it.scheduled_at)) start = atTime(start, parseHM(SCHEDULE.movie));
      return { ...it, _start: start, _end: showEnd(start) };
    })
    .filter(it => it && it._end > now)
    .sort((a, b) => a._start - b._start);

  const shownKeys = new Set(shows.map(s => s._cat + '|' + s.title + '|' + s.nick));
  const continuing = all.filter(it =>
    CATS[it._cat].active.includes(statusOf(it)) && !shownKeys.has(it._cat + '|' + it.title + '|' + it.nick));

  const live = shows.length > 0 && shows[0]._start <= now;
  document.getElementById('now-dot').hidden = !live;
  document.getElementById('now-label').textContent = live ? 'Смотрим прямо сейчас' : 'Афиша';

  const parts = [];
  if (shows.length > 0) {
    const s = shows[0];
    const sp = zparts(s._start, showTZ());
    parts.push(renderNowItem(s, {
      big: true,
      noProgress: s._cat === 'movies',
      when: `${DAY_SHORT[sp.wd]}, ${sp.d} ${MONTHS_GEN[sp.mo]} · ${fmtHM(s._start)}`,
      rel: live ? 'идёт сейчас' : relText(s._start, now),
      live,
    }));
    shows.slice(1, 3).forEach(n => {
      const np = zparts(n._start, showTZ());
      parts.push(renderNowItem(n, {
        noProgress: true,
        meta: `${dayPhrase(n._start, now)}, ${np.d} ${MONTHS_GEN[np.mo]} в ${fmtHM(n._start)}`,
        metaTz: true,
      }));
    });
  } else {
    parts.push(renderRitual(now));
  }
  const room = shows.length > 0 ? Math.max(0, 3 - Math.min(shows.length, 3)) : 2;
  if (continuing.length > 0 && room > 0) {
    parts.push(`<div class="now__sub">Продолжаем</div>`);
    continuing.slice(0, room).forEach(it => parts.push(renderNowItem(it)));
  }
  document.getElementById('now-list').innerHTML = parts.join('');
}

async function loadAll() {
  renderWeek();

  const configReady = fetchRows(CONFIG_CSV_URL)
    .then(rows => {
      const config = rowsToConfig(rows);
      applyConfig(config);
      applyScheduleConfig(config);
      renderWeek();
    })
    .catch(err => console.warn('Config load failed:', err.message));

  // Списки грузятся параллельно; каждый переживает свою ошибку
  const keys = Object.keys(CATS);
  const results = await Promise.all(keys.map(key =>
    fetchRows(CATS[key].url)
      .then(async rows => {
        // Как на страницах списков: строка без ника или названия — не заказ (заготовки в таблице)
        const items = rowsToObjects(rows).filter(i => i.nick && i.title);
        applyOrdersMeta(items, await ORDERS_META, key);
        if (key === 'games') steamGames = ((await STEAM_STATS) || {}).games || {};
        setCounter(key, countText(key, items));
        renderFan(key, items);
        return items;
      })
      .catch(err => {
        console.warn(`List "${key}" failed:`, err.message);
        setCounter(key, '—');
        return [];
      })
  ));
  afishaLists = {};
  keys.forEach((k, i) => { afishaLists[k] = results[i]; });
  document.getElementById('card-series').hidden = !afishaLists.series.some(it =>
    isScheduled(it) || CATS.series.active.includes(statusOf(it)));
  layoutCards();
  await configReady;   // афише нужно расписание (конец стрима, время рулетки)
  renderNow();
  // Раз в минуту: «через 2 ч» → «через 1 ч», анонс сам переключается на «идёт сейчас»
  setInterval(() => { renderNow(); renderWeek(); }, 60000);
}

// ===== Рекомендую: карусель друзей-стримеров =====
// Лист Friends: nick, image_url (картинка 5:1, лучше 2500×500), url (страница стрима;
// пусто — twitch.tv/ник), active (FALSE — спрятать). Порядок — как в таблице, старт — со случайного.
const FRIEND_COLORS = ['#8d4564', '#555897', '#ad704b', '#487c87', '#754d92', '#9a5359', '#687748', '#455f95'];
let friendsTimer = null;
async function loadFriends() {
  if (!FRIENDS_CSV_URL) return;
  // Копии картинок на самом сайте (робот .github/scripts/friends-images.mjs): JPEG, лёгкие,
  // открываются у всех — сторонние хостинги видны не каждому зрителю
  const copies = fetch('friends-meta.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  let rows;
  try {
    const res = await siteData.fetch(FRIENDS_CSV_URL);
    if (!res.ok) return;
    rows = parseCSV(await res.text());
  } catch (e) { return; }
  const local = ((await copies).images) || {};
  if (rows.length < 2) return;
  const h = rows[0].map(x => x.trim().toLowerCase());
  const col = n => h.indexOf(n);
  const [cNick, cImg, cUrl, cActive] = [col('nick'), col('image_url'), col('url'), col('active')];
  if (cNick < 0) return;
  const friends = rows.slice(1).map(r => ({
    nick: (r[cNick] || '').trim(),
    image: cImg >= 0 ? (r[cImg] || '').trim() : '',
    copy: cImg >= 0 ? (local[(r[cImg] || '').trim()] || {}).file || '' : '',
    url: cUrl >= 0 ? (r[cUrl] || '').trim() : '',
    active: cActive < 0 || !/^(false|нет|0|no)$/i.test((r[cActive] || '').trim()),
  })).filter(f => f.nick && f.active);
  renderFriends(friends);
}

function renderFriends(friends) {
  const box = document.getElementById('friends');
  const stage = document.getElementById('friends-stage');
  stage.querySelectorAll('.friend').forEach(el => el.remove());
  clearInterval(friendsTimer);
  box.hidden = !friends.length;
  if (!friends.length) return;
  stage.dataset.count = friends.length;
  const slides = friends.map((f, i) => {
    const url = isValidUrl(f.url) ? f.url : 'https://www.twitch.tv/' + encodeURIComponent(f.nick.replace(/\s+/g, ''));
    const a = document.createElement('a');
    a.className = 'friend';
    a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.draggable = false;
    a.setAttribute('aria-label', `${f.nick} — открыть стрим`);
    const fallback = `<div class="friend__fallback" style="background:linear-gradient(120deg, ${FRIEND_COLORS[i % FRIEND_COLORS.length]}, #10142a)">${esc(f.nick)}</div>`;
    const src = f.copy || (isValidUrl(f.image) ? f.image : '');
    a.innerHTML = (src ? `<img class="friend__img" src="${esc(src)}" alt="" referrerpolicy="no-referrer" draggable="false">` : fallback) +
      `<span class="friend__tag"><span class="friend__live"></span>${esc(f.nick)}<span class="friend__go">смотреть ${icon('external')}</span></span>`;
    const img = a.querySelector('img');
    // Копия не загрузилась — пробуем исходную ссылку, потом — заглушка с ником
    if (img) img.addEventListener('error', () => {
      if (f.copy && isValidUrl(f.image) && img.getAttribute('src') !== f.image) img.src = f.image;
      else img.outerHTML = fallback;
    });
    stage.insertBefore(a, document.getElementById('friends-dots'));
    return a;
  });
  const n = slides.length;
  const dots = document.getElementById('friends-dots');
  dots.innerHTML = friends.map((f, i) => `<button type="button" class="friends__dot" data-i="${i}" aria-label="${esc(f.nick)}"></button>`).join('');

  // pos — дробный номер слайда в центре (2.3 = третий слайд, чуть сдвинутый). Лента бесконечная:
  // каждый слайд ставится на ближайшее к центру место по кругу.
  let pos = Math.floor(Math.random() * n); // стартуем со случайного — каждому другу шанс быть первым
  let anim = null;
  const mod = (x, m) => ((x % m) + m) % m;
  const draw = () => {
    const w = stage.clientWidth;
    slides.forEach((s, k) => {
      let d = mod(k - pos, n);
      if (d > n / 2) d -= n;
      s.style.transform = `translate3d(${(d * w).toFixed(1)}px,0,0)`;
      s.style.visibility = Math.abs(d) < 1 ? 'visible' : 'hidden';
    });
    const cur = mod(Math.round(pos), n);
    slides.forEach((s, k) => { s.tabIndex = k === cur ? 0 : -1; });
    dots.querySelectorAll('.friends__dot').forEach((d, k) => d.classList.toggle('is-on', k === cur));
  };
  // Плавно доехать до слайда target (целое число, можно за пределами 0..n-1 — лента по кругу)
  const goTo = target => {
    cancelAnimationFrame(anim);
    const from = pos, dist = target - from;
    if (!dist) { draw(); return; }
    const dur = Math.min(900, 380 + Math.abs(dist) * 160);
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      pos = from + dist * (1 - Math.pow(1 - t, 3));
      draw();
      if (t < 1) anim = requestAnimationFrame(step); else pos = mod(Math.round(pos), n);
    };
    anim = requestAnimationFrame(step);
  };
  const restart = () => {
    clearInterval(friendsTimer);
    if (n > 1) friendsTimer = setInterval(() => { if (!stage.matches(':hover') && !drag) goTo(Math.round(pos) + 1); }, 6000);
  };
  // Кратчайший путь до слайда i по кругу
  const nearest = i => { const c = Math.round(pos); let d = mod(i - c, n); if (d > n / 2) d -= n; return c + d; };
  document.getElementById('friends-prev').onclick = () => { goTo(Math.round(pos) - 1); restart(); };
  document.getElementById('friends-next').onclick = () => { goTo(Math.round(pos) + 1); restart(); };
  dots.onclick = e => { const d = e.target.closest('.friends__dot'); if (d) { goTo(nearest(+d.dataset.i)); restart(); } };

  // Тянуть мышкой (зажатая ЛКМ) или пальцем; сильный бросок проматывает несколько слайдов
  let drag = null, moved = false, noClickUntil = 0;
  stage.onpointerdown = e => {
    if (n < 2 || e.button !== 0 || e.target.closest('.friends__nav, .friends__dot')) return;
    cancelAnimationFrame(anim);
    drag = {x: e.clientX, pos, last: e.clientX, t: performance.now(), v: 0, id: e.pointerId};
    moved = false;
  };
  stage.onpointermove = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      stage.classList.add('is-dragging');
      stage.setPointerCapture(e.pointerId);
    }
    if (!moved) return;
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.v = 0.8 * ((e.clientX - drag.last) / dt) + 0.2 * drag.v; // px/мс, сглаженная скорость
    drag.last = e.clientX; drag.t = now;
    pos = drag.pos - dx / stage.clientWidth;
    draw();
  };
  const release = e => {
    if (!drag || e.pointerId !== drag.id) return;
    stage.classList.remove('is-dragging');
    if (moved) {
      // Куда «докатится» лента: текущее место плюс инерция броска
      const fling = performance.now() - drag.t > 120 ? 0 : -drag.v * 320 / stage.clientWidth;
      goTo(Math.round(pos + Math.max(-6, Math.min(6, fling))));
      restart();
      noClickUntil = performance.now() + 350;
    }
    drag = null;
  };
  stage.onpointerup = release;
  stage.onpointercancel = release;
  // Перетаскивание — не клик: стрим не открываем
  stage.addEventListener('click', e => { if (performance.now() < noClickUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('resize', draw);

  draw();
  restart();
}

loadAll();
loadFriends();

// ===== Новогодняя гирлянда по бокам (стили — .xlights выше) =====
(function xmasLights() {
  if (window.siteSeason !== 'winter') return;
  const COLORS = ['#ff4d5e', '#ffc94a', '#4fd17d', '#55aaff', '#ff7ad9'];
  const NS = 'http://www.w3.org/2000/svg';
  const f = n => +n.toFixed(1);
  // темнее цвет — «погасшая» лампочка
  const dim = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16 & 255) * .4 | 0},${(n >> 8 & 255) * .4 | 0},${(n & 255) * .4 | 0})`; };

  function build(box, side) {
    const H = box.clientHeight;
    if (!H) return;
    const A = 6, D = 26;                 // провод крепится у самого края, провисает к странице на D
    const n = Math.max(2, Math.round((H + 40) / 160)), L = (H + 40) / n, top = -30;
    const id = 'xl' + side;
    let defs = '', wire = `M${A} ${top}`, nails = '', bulbs = '', k = 0;
    COLORS.forEach((c, i) => {
      defs += `<radialGradient id="${id}g${i}"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset=".45" stop-color="${c}" stop-opacity=".22"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    });
    for (let s = 0; s < n; s++) {
      const y0 = top + s * L, y1 = y0 + L, cx = A + 2 * D, cy = (y0 + y1) / 2;
      wire += ` Q${cx} ${f(cy)} ${A} ${f(y1)}`;
      nails += `<circle cx="${A}" cy="${f(y1)}" r="2.2" fill="#6d7f72"/>`;
      for (const t of [0.22, 0.5, 0.78]) {
        const u = 1 - t;
        const x = u * u * A + 2 * u * t * cx + t * t * A, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        const tx = 2 * u * (cx - A) + 2 * t * (A - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
        // нормаль к проводу в сторону страницы + немного вниз (лампочки тянет вес)
        let nx = ty, ny = -tx; if (nx < 0) { nx = -nx; ny = -ny; }
        const len = Math.hypot(nx, ny); nx /= len; ny /= len;
        const ang = Math.atan2(ny * 0.8 + 0.45, nx * 0.8) * 180 / Math.PI - 90;
        const ci = k % COLORS.length, c = COLORS[ci];
        const spark = k % 4 === 3;
        const style = `animation-delay:${f(-(k * 0.23) - (spark ? Math.random() * 2 : 0))}s` + (spark ? `;animation-duration:${f(1.5 + Math.random())}s` : '');
        bulbs += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})">` +
          `<rect x="-2.6" y="-1" width="5.2" height="5.5" rx="1" fill="#2c4a36"/>` +
          `<ellipse cx="0" cy="11.5" rx="4.6" ry="7.6" fill="${dim(c)}"/>` +
          `<g class="xl-on${spark ? ' xl-on--spark' : ''}" style="${style}">` +
            `<circle cx="0" cy="11.5" r="17" fill="url(#${id}g${ci})"/>` +
            `<ellipse cx="0" cy="11.5" rx="4.6" ry="7.6" fill="${c}"/>` +
            `<ellipse cx="-1.5" cy="8.6" rx="1.4" ry="2.6" fill="#fff" fill-opacity=".8"/>` +
          `</g></g>`;
        k++;
      }
    }
    box.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 64 ${H}" preserveAspectRatio="xMinYMin meet" aria-hidden="true"><defs>${defs}</defs>` +
      `<path d="${wire}" fill="none" stroke="#24402e" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="${wire}" fill="none" stroke="#5f8f6c" stroke-width=".7" stroke-opacity=".6" transform="translate(-.6 -.6)"/>` +
      nails + bulbs + '</svg>';
  }

  const boxes = ['l', 'r'].map(side => {
    const el = document.createElement('div');
    el.className = 'xlights xlights--' + side;
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return [el, side];
  });
  const all = () => boxes.forEach(([el, side]) => build(el, side));
  all();
  let lastH = 0, timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { const h = boxes[0][0].clientHeight; if (h !== lastH) { lastH = h; all(); } }, 200);
  });
  lastH = boxes[0][0].clientHeight;
})();
