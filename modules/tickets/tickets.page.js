// Код страницы tickets.html (раздел tickets). Подключается из tickets.html.
function rowsToViewers(rows) {
  if (rows.length < 2) return {};
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const nickIdx = headers.indexOf('nick');
  const avatarIdx = headers.indexOf('avatar_url');
  if (nickIdx < 0) return {};
  const map = {};
  rows.slice(1).forEach(r => {
    if (r.length > 0 && r[nickIdx] && r[nickIdx].trim()) {
      const nick = r[nickIdx].trim();
      map[nick.toLowerCase()] = {
        nick: nick,
        avatar: avatarIdx >= 0 ? (r[avatarIdx] || '').trim() : '',
      };
    }
  });
  return map;
}

function rowsToTickets(rows, viewersMap) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    nick:   headers.indexOf('nick'),
    silver: headers.indexOf('silver'),
    gold:   headers.indexOf('gold'),
  };
  if (idx.nick < 0) return [];
  return rows.slice(1)
    .filter(r => r.length > 0 && r[idx.nick] && r[idx.nick].trim())
    .map(r => {
      const nick = (r[idx.nick] || '').trim();
      const silver = parseInt((r[idx.silver] || '0').trim(), 10) || 0;
      const gold   = parseInt((r[idx.gold]   || '0').trim(), 10) || 0;
      const viewer = viewersMap[nick.toLowerCase()] || {};
      return {
        nick:   nick,
        avatar: viewer.avatar || '',
        silver: silver,
        gold:   gold,
        score:  gold * 5 + silver,
      };
    })
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score);
}

function rowsToConfig(rows) {
  if (rows.length < 2) return {};
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const keyIdx = headers.indexOf('key');
  const valIdx = headers.indexOf('value');
  if (keyIdx < 0 || valIdx < 0) return {};
  const config = {};
  rows.slice(1).forEach(r => {
    if (r.length > 0 && r[keyIdx]) {
      config[r[keyIdx].trim().toLowerCase()] = (r[valIdx] || '').trim();
    }
  });
  return config;
}

function initials(nick) {
  const clean = nick.replace(/[^A-Za-zА-Яа-я0-9]/g, '');
  if (clean.length >= 2) return (clean[0] + clean[1]).toUpperCase();
  return (clean[0] || '?').toUpperCase();
}


// ===== Таймер =====
let raffleDate = null;
let timerInterval = null;

// Дата розыгрыша — по часам стримера (siteTime из site.js), поэтому отсчёт верен в любом поясе
const parseSheetDate = siteTime.parse;
const WHEN_DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WHEN_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
// Под отсчётом: «вс, 15 ноября · 20:00» + кнопка «Моё время» и подпись пояса
function renderTimerWhen() {
  const box = document.getElementById('timer-when');
  if (!raffleDate) { box.innerHTML = ''; return; }
  const p = siteTime.parts(raffleDate, siteTime.show());
  const pad = n => String(n).padStart(2, '0');
  box.innerHTML = `<span class="timer-when__date tz">${WHEN_DAYS[p.wd]}, ${p.d} ${WHEN_MONTHS[p.mo]} · ${pad(p.h)}:${pad(p.mi)}</span>` +
    siteTime.toggle() + `<span class="timer-when__zone tz-zone">${siteTime.zoneLabel()}</span>`;
}
siteTime.onChange(renderTimerWhen);
function setupTimer(config) {
  const box = document.getElementById('timer-box');
  const bg = document.getElementById('timer-bg');

  const isActive = (config.raffle_active || '').toLowerCase();
  const showTimer = isActive === 'true' || isActive === 'yes' || isActive === '1' || isActive === 'да';

  if (!showTimer || !config.raffle_date) {
    box.style.display = 'none';
    if (timerInterval) clearInterval(timerInterval);
    return;
  }

  raffleDate = parseSheetDate(config.raffle_date);
  if (!raffleDate || isNaN(raffleDate.getTime())) {
    raffleDate = null;
    box.style.display = 'none';
    return;
  }

  if (config.raffle_title) {
    document.getElementById('timer-event').textContent = config.raffle_title;
  }

  // Фон-баннер
  if (config.tickets_banner_url) {
    bg.style.backgroundImage = `url('${config.tickets_banner_url}')`;
    box.classList.remove('no-bg');
  } else {
    bg.style.backgroundImage = '';
    box.classList.add('no-bg');
  }

  box.style.display = 'block';
  if (timerInterval) clearInterval(timerInterval);
  renderTimerWhen();
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
  if (!raffleDate) return;
  const now = new Date();
  const diff = raffleDate - now;

  if (diff <= 0) {
    document.getElementById('timer-countdown').style.display = 'none';
    document.getElementById('timer-finished').style.display = 'block';
    if (timerInterval) clearInterval(timerInterval);
    return;
  }

  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins  = Math.floor((diff / (1000 * 60)) % 60);
  const secs  = Math.floor((diff / 1000) % 60);

  document.getElementById('t-days').textContent  = days;
  document.getElementById('t-hours').textContent = String(hours).padStart(2, '0');
  document.getElementById('t-mins').textContent  = String(mins).padStart(2, '0');
  document.getElementById('t-secs').textContent  = String(secs).padStart(2, '0');
}

// ===== Рендер =====
function buildAvatar(t, sizeClass) {
  if (t.avatar) {
    return `<div class="${sizeClass}" style="background-image:url('${esc(t.avatar)}');"></div>`;
  }
  return `<div class="${sizeClass}">${esc(initials(t.nick))}</div>`;
}

function ticketsPills(t) {
  const parts = [];
  if (t.silver > 0) parts.push(`<span class="ticket-pill ticket-silver" title="Серебряные билеты">${icon('ticket')}${t.silver}</span>`);
  if (t.gold > 0)   parts.push(`<span class="ticket-pill ticket-gold" title="Золотые билеты">${icon('ticket')}${t.gold}</span>`);
  return parts.join('');
}

function renderPodium(top3) {
  const podium = document.getElementById('podium');
  const order = [top3[1], top3[0], top3[2]];
  const positions = [2, 1, 3];
  podium.innerHTML = order.map((t, i) => {
    if (!t) return '<div></div>';
    const pos = positions[i];
    return `
      <div class="podium-card p-${pos}">
        <div class="podium-medal">${pos}</div>
        ${buildAvatar(t, 'podium-avatar')}
        <div class="podium-nick">${esc(t.nick)}</div>
        <div class="podium-tickets">${ticketsPills(t)}</div>
      </div>
    `;
  }).join('');
  document.getElementById('podium-wrap').style.display = 'block';
}

function renderGrid(rest) {
  const grid = document.getElementById('grid');
  if (rest.length === 0) {
    grid.innerHTML = '';
    document.getElementById('rest-wrap').style.display = 'none';
    return;
  }
  grid.innerHTML = rest.map((t, i) => `
    <div class="ticket-card" data-nick="${esc(t.nick.toLowerCase())}">
      <div class="ticket-rank">#${i + 4}</div>
      ${buildAvatar(t, 'ticket-avatar')}
      <div class="ticket-nick">${esc(t.nick)}</div>
      <div class="ticket-counts">${ticketsPills(t)}</div>
    </div>
  `).join('');
  document.getElementById('rest-wrap').style.display = 'block';
}

let allTickets = [];

function applyFilters() {
  const search = (document.getElementById('search-input').value || '').trim().toLowerCase();
  let filtered = allTickets;
  if (search) filtered = allTickets.filter(t => t.nick.toLowerCase().includes(search));

  if (search) {
    document.getElementById('podium-wrap').style.display = 'none';
    const grid = document.getElementById('grid');
    if (filtered.length === 0) {
      document.getElementById('rest-wrap').style.display = 'block';
      grid.innerHTML = '<div class="no-results">Никого не нашли по этому нику</div>';
    } else {
      grid.innerHTML = filtered.map(t => {
        const rank = allTickets.indexOf(t) + 1;
        return `
          <div class="ticket-card" data-nick="${esc(t.nick.toLowerCase())}">
            <div class="ticket-rank">#${rank}</div>
            ${buildAvatar(t, 'ticket-avatar')}
            <div class="ticket-nick">${esc(t.nick)}</div>
            <div class="ticket-counts">${ticketsPills(t)}</div>
          </div>
        `;
      }).join('');
      document.getElementById('rest-wrap').style.display = 'block';
    }
    return;
  }

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3, 20);
  if (top3.length > 0) renderPodium(top3);
  else document.getElementById('podium-wrap').style.display = 'none';
  renderGrid(rest);
}

document.getElementById('search-input').addEventListener('input', applyFilters);

// ===== Загрузка =====
let viewersMap = {};

async function loadAll() {
  const status = document.getElementById('status');
  const content = document.getElementById('content');

  if (!TICKETS_CSV_URL || TICKETS_CSV_URL === 'PASTE_YOUR_TICKETS_CSV_URL_HERE') {
    status.classList.add('error');
    status.innerHTML = icon('alert') + ' Не настроена ссылка <code>TICKETS_CSV_URL</code>';
    return;
  }

  // Загружаем всё параллельно
  try {
    const [ticketsRes, configRes, viewersRes] = await Promise.allSettled([
      siteData.fetch(TICKETS_CSV_URL),
      CONFIG_CSV_URL && CONFIG_CSV_URL !== 'PASTE_YOUR_CONFIG_CSV_URL_HERE'
        ? siteData.fetch(CONFIG_CSV_URL) : Promise.resolve(null),
      VIEWERS_CSV_URL && VIEWERS_CSV_URL !== 'PASTE_YOUR_VIEWERS_CSV_URL_HERE'
        ? siteData.fetch(VIEWERS_CSV_URL) : Promise.resolve(null),
    ]);

    // Viewers (опционально)
    if (viewersRes.status === 'fulfilled' && viewersRes.value && viewersRes.value.ok) {
      const csv = await viewersRes.value.text();
      viewersMap = rowsToViewers(parseCSV(csv));
    }

    // Config (опционально для таймера)
    if (configRes.status === 'fulfilled' && configRes.value && configRes.value.ok) {
      const csv = await configRes.value.text();
      setupTimer(rowsToConfig(parseCSV(csv)));
    }

    // Tickets (обязательно)
    if (ticketsRes.status === 'rejected' || !ticketsRes.value.ok) {
      throw new Error('Не удалось загрузить лист Tickets');
    }
    const ticketsCsv = await ticketsRes.value.text();
    allTickets = rowsToTickets(parseCSV(ticketsCsv), viewersMap);

    if (allTickets.length === 0) {
      status.innerHTML = 'Пока ни у кого нет билетов. Заходи на стрим — копи билеты!';
      return;
    }

    applyFilters();
    status.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    status.classList.add('error');
    status.innerHTML = icon('alert') + ' Ошибка: ' + esc(err.message);
  }
}

loadAll();
setInterval(loadAll, 60000);
