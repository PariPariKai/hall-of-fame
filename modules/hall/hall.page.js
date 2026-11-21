// Код страницы hall.html (раздел hall). Подключается из hall.html.
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

function rowsToWinners(rows, viewersMap) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    nick:        headers.indexOf('nick'),
    prize:       headers.indexOf('prize'),
    chance:      headers.indexOf('chance'),
    rank:        headers.indexOf('rank'),
    quote:       headers.indexOf('quote'),
    date:        headers.indexOf('date'),
    unique:      headers.indexOf('unique'),
    prizeImage:  headers.indexOf('prize_image_url'),
  };
  return rows.slice(1)
    .filter(r => r.length > 1 && idx.nick >= 0 && r[idx.nick] && r[idx.nick].trim())
    .map(r => {
      const nick = (r[idx.nick] || '').trim();
      const uniqueRaw = (idx.unique >= 0 ? (r[idx.unique] || '') : '').trim().toLowerCase();
      const viewer = viewersMap[nick.toLowerCase()] || {};
      return {
        nick:       nick,
        avatar:     viewer.avatar || '',
        prize:      (idx.prize      >= 0 ? (r[idx.prize]      || '').trim() : ''),
        chance:     (idx.chance     >= 0 ? (r[idx.chance]     || '').trim() : ''),
        rank:       (idx.rank       >= 0 ? (r[idx.rank]       || '').trim().toLowerCase() : ''),
        quote:      (idx.quote      >= 0 ? (r[idx.quote]      || '').trim() : ''),
        date:       (idx.date       >= 0 ? (r[idx.date]       || '').trim() : ''),
        unique:     uniqueRaw === 'true' || uniqueRaw === 'yes' || uniqueRaw === '1' || uniqueRaw === 'да',
        prizeImage: (idx.prizeImage >= 0 ? (r[idx.prizeImage] || '').trim() : ''),
      };
    })
    .filter(w => ['legendary', 'artifact'].includes(w.rank));
}

function rowsToCurrentPrizes(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    image:  headers.indexOf('image_url'),
    title:  headers.indexOf('title'),
    link:   headers.indexOf('link'),
    active: headers.indexOf('active'),
  };
  if (idx.image < 0) return [];
  return rows.slice(1)
    .filter(r => r.length > 0 && r[idx.image] && r[idx.image].trim())
    .map(r => {
      const activeRaw = (idx.active >= 0 ? (r[idx.active] || 'true') : 'true').trim().toLowerCase();
      const isActive = idx.active < 0 ||
                       activeRaw === 'true' || activeRaw === 'yes' ||
                       activeRaw === '1' || activeRaw === 'да' ||
                       activeRaw === '';
      return {
        image:  (r[idx.image] || '').trim(),
        title:  (idx.title >= 0 ? (r[idx.title] || '').trim() : ''),
        link:   (idx.link  >= 0 ? (r[idx.link]  || '').trim() : ''),
        active: isActive,
      };
    })
    .filter(p => p.active);
}

const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
// Google Sheets (EU locale) exports dates as DD.MM.YYYY.
// native Date("12.04.2026") wrongly reads that as Dec 4 — parse day-first explicitly.
function parseSheetDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  // ISO: YYYY-MM-DD[ T| ]HH:MM[:SS]
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : 0, m[5] != null ? +m[5] : 0, m[6] != null ? +m[6] : 0);
  }
  // European: DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY (+ optional time)
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], m[4] != null ? +m[4] : 0, m[5] != null ? +m[5] : 0, m[6] != null ? +m[6] : 0);
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}
function formatDate(iso) {
  if (!iso) return '';
  const d = parseSheetDate(iso);
  if (!d || isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

function initials(nick) {
  const clean = nick.replace(/[^A-Za-zА-Яа-я0-9]/g, '');
  if (clean.length >= 2) return (clean[0] + clean[1]).toUpperCase();
  return (clean[0] || '?').toUpperCase();
}


const RANK_INFO = {
  epic:      { label: 'Эпическая',  symbol: icon('gem'), chance: '7%' },
  legendary: { label: 'Легендарка', symbol: icon('star', 'ic--fill'), chance: '1.5%' },
  artifact:  { label: 'Артефакт',   symbol: icon('sparkles', 'ic--fill'), chance: '0.5%' },
};

// Шанс из колонки chance: "2" / "0,5" -> "2%" / "0,5%"; с "%" или текстом — как вписано.
function formatChance(raw) {
  const s = (raw || '').trim();
  return /^\d+([.,]\d+)?$/.test(s) ? s + '%' : s;
}

// Звуки
let audioCtx = null;
let soundOn = true;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}
function playHoverSound(rank) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  const freqMap = { artifact: 1200, legendary: 900, epic: 700 };
  const freq = freqMap[rank] || 800;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.15);
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.start(now); osc.stop(now + 0.35);
}
function playUniqueSound() {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const baseTime = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const t = baseTime + i * 0.07;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(freq, t);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t); osc.stop(t + 0.55);
  });
}
const soundBtn = document.getElementById('sound-toggle');
function updateSoundButton() {
  if (soundOn) {
    soundBtn.classList.remove('off');
    soundBtn.innerHTML = icon('volume') + 'Звук вкл.';
  } else {
    soundBtn.classList.add('off');
    soundBtn.innerHTML = icon('volume-off') + 'Звук выкл.';
  }
}
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  if (soundOn) ensureAudio();
  updateSoundButton();
});
updateSoundButton();
document.addEventListener('click', () => { if (soundOn) ensureAudio(); }, { once: true });

function buildCard(w) {
  const info = RANK_INFO[w.rank];
  const avatarHtml = w.avatar
    ? `<div class="avatar" style="background-image:url('${esc(w.avatar)}');"></div>`
    : `<div class="avatar">${esc(initials(w.nick))}</div>`;
  const cardClasses = `card r-${esc(w.rank)}${w.unique ? ' unique' : ''}`;
  const frontContent = `
    ${w.rank === 'artifact' ? '<div class="shimmer-bg"></div>' : ''}
    <span class="rank-badge">${esc(info.label)}</span>
    <div class="avatar-wrap">${avatarHtml}</div>
    <p class="nick">${esc(w.nick)}</p>
    <p class="prize">${esc(w.prize)}</p>
    <div class="chance-row"><span class="chance">${info.symbol} ${esc(formatChance(w.chance) || info.chance)}</span></div>
    ${w.quote ? `<p class="quote">"${esc(w.quote)}"</p>` : '<p class="quote" style="opacity:0.3">—</p>'}
    <p class="date">${esc(formatDate(w.date))}</p>
  `;
  if (w.unique) {
    const backImage = w.prizeImage ? `style="background-image:url('${esc(w.prizeImage)}');"` : '';
    return `
      <div class="${cardClasses}" data-rank="${esc(w.rank)}" data-unique="1" data-nick="${esc(w.nick.toLowerCase())}">
        <span class="unique-mark">${icon('sparkles', 'ic--fill')}Unique${icon('sparkles', 'ic--fill')}</span>
        <div class="unique-inner">
          <div class="unique-face unique-front">${frontContent}</div>
          <div class="unique-face unique-back">
            <div class="prize-image" ${backImage}></div>
            <div class="prize-name">${esc(w.prize) || '&nbsp;'}</div>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="${cardClasses}" data-rank="${esc(w.rank)}" data-unique="0" data-nick="${esc(w.nick.toLowerCase())}">
      ${frontContent}
    </div>
  `;
}

function renderCards(winners) {
  const grid = document.getElementById('grid');
  const rankWeight = { artifact: 3, legendary: 2, epic: 1 };
  // Хронология: новые сверху. Даты сравниваем как даты, а не строки (DD.MM.YYYY
  // строкой сортировался бы по дню). Без даты — в конец. При равной дате:
  // ранг, затем строка ниже в таблице = добавлена позже.
  const time = w => { const d = parseSheetDate(w.date); return d && !isNaN(d) ? d.getTime() : -Infinity; };
  winners.forEach((w, i) => { w._t = time(w); w._i = i; });
  winners.sort((a, b) =>
    (b._t - a._t || 0) ||
    ((rankWeight[b.rank] || 0) - (rankWeight[a.rank] || 0)) ||
    (b._i - a._i));
  grid.innerHTML = winners.map(buildCard).join('');
  grid.querySelectorAll('.card').forEach(card => {
    const isUnique = card.dataset.unique === '1';
    card.addEventListener('mouseenter', () => {
      if (isUnique) playUniqueSound();
      else playHoverSound(card.dataset.rank);
    });
  });
  const counts = winners.reduce((acc, w) => {
    acc[w.rank] = (acc[w.rank] || 0) + 1;
    if (w.unique) acc.unique++;
    acc.all++;
    return acc;
  }, { all: 0, epic: 0, legendary: 0, artifact: 0, unique: 0 });
  document.getElementById('count-all').textContent       = counts.all;
  document.getElementById('count-unique').textContent    = counts.unique;
  document.getElementById('count-legendary').textContent = counts.legendary;
  document.getElementById('count-artifact').textContent  = counts.artifact;
}

function renderCurrentPrizes(prizes) {
  const container = document.getElementById('current-prizes');
  const track = document.getElementById('carousel-track');
  if (!prizes || prizes.length === 0) {
    container.style.display = 'none';
    return;
  }
  const defaultLink = siteProfile.twitchUrl; // канал стримера — из профиля (админка → «Настройки»)
  track.innerHTML = prizes.map(p => {
    const link = p.link || defaultLink;
    const titleAttr = p.title ? `title="${esc(p.title)}"` : '';
    const labelHtml = p.title ? `<div class="prize-banner-label">${esc(p.title)}</div>` : '';
    return `
      <a href="${esc(link)}" target="_blank" rel="noopener" class="prize-banner"
         style="background-image:url('${esc(p.image)}');" ${titleAttr}>
         ${labelHtml}
      </a>
    `;
  }).join('');
  container.style.display = 'block';
}

let currentFilter = 'all';
let currentSearch = '';
function applyFilters() {
  document.querySelectorAll('.card').forEach(card => {
    const rank = card.dataset.rank;
    const isUnique = card.dataset.unique === '1';
    const nick = card.dataset.nick;
    let matchesFilter;
    if (currentFilter === 'all') matchesFilter = true;
    else if (currentFilter === 'unique') matchesFilter = isUnique;
    else matchesFilter = rank === currentFilter;
    const matchesSearch = !currentSearch || nick.includes(currentSearch);
    card.classList.toggle('hidden', !(matchesFilter && matchesSearch));
  });
}
document.querySelectorAll('.f-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
});
document.getElementById('search-input').addEventListener('input', (e) => {
  currentSearch = e.target.value.trim().toLowerCase();
  applyFilters();
});

let viewersMap = {};

async function loadAll() {
  const status = document.getElementById('status');
  const grid = document.getElementById('grid');

  if (!CSV_URL || CSV_URL === 'PASTE_YOUR_WINNERS_CSV_URL_HERE') {
    status.classList.add('error');
    status.innerHTML = icon('alert') + ' Не настроена ссылка <code>CSV_URL</code>';
    return;
  }

  try {
    const [winnersRes, prizesRes, viewersRes] = await Promise.allSettled([
      siteData.fetch(CSV_URL),
      CURRENT_PRIZES_CSV_URL && CURRENT_PRIZES_CSV_URL !== 'PASTE_YOUR_CURRENT_PRIZES_CSV_URL_HERE'
        ? siteData.fetch(CURRENT_PRIZES_CSV_URL) : Promise.resolve(null),
      VIEWERS_CSV_URL && VIEWERS_CSV_URL !== 'PASTE_YOUR_VIEWERS_CSV_URL_HERE'
        ? siteData.fetch(VIEWERS_CSV_URL) : Promise.resolve(null),
    ]);

    // Viewers
    if (viewersRes.status === 'fulfilled' && viewersRes.value && viewersRes.value.ok) {
      const csv = await viewersRes.value.text();
      viewersMap = rowsToViewers(parseCSV(csv));
    }

    // Current prizes
    if (prizesRes.status === 'fulfilled' && prizesRes.value && prizesRes.value.ok) {
      const csv = await prizesRes.value.text();
      renderCurrentPrizes(rowsToCurrentPrizes(parseCSV(csv)));
    }

    // Winners
    if (winnersRes.status === 'rejected' || !winnersRes.value.ok) {
      throw new Error('Не удалось загрузить Winners');
    }
    const csv = await winnersRes.value.text();
    const winners = rowsToWinners(parseCSV(csv), viewersMap);

    if (winners.length === 0) {
      status.innerHTML = 'Пока никто не выбил Эпик / Легендарку / Артефакт. Скоро здесь будет первая карточка.';
      return;
    }

    renderCards(winners);
    applyFilters();
    status.style.display = 'none';
    grid.style.display = 'grid';
  } catch (err) {
    status.classList.add('error');
    status.innerHTML = icon('alert') + ' Ошибка: ' + esc(err.message);
  }
}

loadAll();
setInterval(loadAll, 60000);
