// Код страницы picker.html (раздел picker). Подключается из picker.html.
// ============================================================
// Утилиты
// ============================================================



// ============================================================
// Разбор таблиц
// ============================================================
const TITLE_HINTS  = ['title','название','назва','тайтл','фильм','аниме','сериал','игра','name'];
const WHO_HINTS    = ['nick','заказчик','заказ','ник','зритель','user','кто','автор'];
const STATUS_HINTS = ['status','статус'];
const TYPE_HINTS   = ['type','format','формат','тип'];
const COVER_HINTS  = ['cover','обложка','постер','poster'];
const LINK_HINTS   = ['url','ссылка','link'];

function findCol(headers, hints) {
  for (let i = 0; i < headers.length; i++) {
    for (const hint of hints) if (headers[i].indexOf(hint) >= 0) return i;
  }
  return -1;
}

// Приводим статус к одному из трёх. Пустое и незнакомое = «ещё не смотрели».
function normStatus(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (s.indexOf('watched') >= 0 || s.indexOf('смотрел') >= 0 || s.indexOf('готов') >= 0) return 'watched';
  if (s.indexOf('watching') >= 0 || s.indexOf('смотрим') >= 0 || s.indexOf('процесс') >= 0) return 'watching';
  return 'pending';
}

function rowsToItems(rows, source) {
  if (rows.length < 1) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  let titleIdx  = findCol(headers, TITLE_HINTS);
  let whoIdx    = findCol(headers, WHO_HINTS);
  const statIdx = findCol(headers, STATUS_HINTS);
  const typeIdx = findCol(headers, TYPE_HINTS);
  // cover_url тоже содержит 'url', поэтому обложку ищем раньше ссылки
  const coverIdx = findCol(headers, COVER_HINTS);
  let linkIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    if (i === coverIdx) continue;
    if (LINK_HINTS.some(h => headers[i].indexOf(h) >= 0)) { linkIdx = i; break; }
  }
  if (titleIdx < 0) titleIdx = 0;
  if (whoIdx < 0)   whoIdx = headers.length > 1 ? 1 : -1;

  const cell = (r, i) => (i >= 0 && r[i] ? r[i].trim() : '');

  return rows.slice(1)
    .filter(r => cell(r, titleIdx))
    .map(r => ({
      title:  cell(r, titleIdx),
      who:    cell(r, whoIdx),
      status: normStatus(cell(r, statIdx)),
      type:   cell(r, typeIdx).toLowerCase(),
      cover:  cell(r, coverIdx),
      link:   cell(r, linkIdx),
      source: source.id,
    }));
}

// ============================================================
// Загрузка
// ============================================================
let allItems = [];
let viewers = {};                 // ник (lowercase) → {nick, avatar}
const srcState = {};

// Google иногда отдаёт опубликованный лист по минуте и дольше.
// Без таймаута зависший запрос держит страницу бесконечно.
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadSource(source) {
  const st = srcState[source.id];
  try {
    const items = rowsToItems(parseCSV(await siteData.text(source.csv, { signal: AbortSignal.timeout(20000) })), source);
    st.note = '';
    return items;
  } catch (e) {
    st.note = 'ошибка загрузки';
    st.error = true;
    return [];
  }
}

async function loadViewers() {
  try {
    const res = await siteData.fetch(VIEWERS_CSV_URL, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return false;
    const rows = parseCSV(await res.text());
    if (rows.length < 2) return false;
    const h = rows[0].map(x => x.trim().toLowerCase());
    const nickIdx = h.indexOf('nick') >= 0 ? h.indexOf('nick') : 0;
    const avaIdx  = findCol(h, ['avatar','аватар']);
    rows.slice(1).forEach(r => {
      const n = (r[nickIdx] || '').trim();
      if (!n) return;
      viewers[n.toLowerCase()] = { nick: n, avatar: avaIdx >= 0 ? (r[avaIdx] || '').trim() : '' };
    });
    return true;
  } catch (e) { /* аватарки не критичны */ }
  return false;
}

function avatarOf(nick) {
  const v = viewers[(nick || '').toLowerCase()];
  return v && /^https?:\/\//i.test(v.avatar) ? v.avatar : '';
}

async function loadAll() {
  // Что включено при открытии — из админки; дальше галочки живут своей жизнью
  await WheelKit.ready;
  await siteModules.ready;
  // Выключенный в админке раздел в рулетку не попадает
  for (let i = SOURCES.length - 1; i >= 0; i--) if (!siteModules.on(SOURCES[i].id)) SOURCES.splice(i, 1);
  const srcOn = WheelKit.list('picker_sources'), statOn = WheelKit.list('picker_statuses');
  SOURCES.forEach(s => { if (!srcState[s.id]) srcState[s.id] = { on: srcOn.includes(s.id) }; srcState[s.id].error = false; });
  STATUSES.forEach(s => { if (!(s.id in statState)) statState[s.id] = statOn.includes(s.id); });

  // Аватарки — украшение, и лежат они в отдельном листе, который
  // Google порой отдаёт по минуте. Не держим из-за них колесо:
  // грузим параллельно и дорисовываем, когда придут.
  loadViewers().then(ok => { if (ok) renderPeople(); });

  const lists = await Promise.all(SOURCES.map(loadSource));

  allItems = [];
  SOURCES.forEach((s, i) => {
    srcState[s.id].count = lists[i].length;
    allItems = allItems.concat(lists[i]);
  });

  const known = new Set(allItems.map(i => i.who).filter(Boolean));
  Object.keys(whoState).forEach(k => { if (!known.has(k)) delete whoState[k]; });
  // Заказчики при открытии сняты: на колесо их добавляет сбор из чата
  // или галочки вручную. Новые после «Перезагрузить» — тоже сняты.
  known.forEach(w => { if (!(w in whoState)) whoState[w] = false; });

  renderSources();
  renderStatuses();
  renderTypes();
  renderPeople();
  rebuildWheel();
}

// ============================================================
// Фильтры
// ============================================================
const whoState = {};
const statState = {};
const typeState = {};
let whoQuery = '';

function visibleItems() {
  return allItems.filter(it =>
    srcState[it.source] && srcState[it.source].on &&
    statState[it.status] !== false &&
    typeState[it.type] !== false &&
    (!it.who || whoState[it.who] !== false)
  );
}

function typeLabel(t) {
  return TYPE_LABELS[t] || { name: t, icon: 'square' };
}

function srcById(id) { return SOURCES.find(s => s.id === id); }

function renderSources() {
  document.getElementById('sources-list').innerHTML = SOURCES.map(s => {
    const st = srcState[s.id];
    const note = st.note ? `<div class="src-status${st.error ? ' err' : ''}">${esc(st.note)}</div>` : '';
    return `
      <div class="row ${st.on ? 'on' : 'off'}" data-src="${s.id}" style="--sw:${s.color}">
        <span class="box"></span>
        <span class="row-label" style="color:${s.color}">${icon(s.icon)} ${esc(s.name)}</span>
        <span class="row-count">${st.count != null ? st.count : '—'}</span>
      </div>${note}`;
  }).join('');

  document.querySelectorAll('[data-src]').forEach(el => {
    el.addEventListener('click', () => {
      srcState[el.dataset.src].on = !srcState[el.dataset.src].on;
      renderSources(); renderStatuses(); renderTypes(); renderPeople(); rebuildWheel();
    });
  });
}

function renderStatuses() {
  const counts = {};
  allItems.forEach(it => {
    if (!srcState[it.source] || !srcState[it.source].on) return;
    counts[it.status] = (counts[it.status] || 0) + 1;
  });
  document.getElementById('status-list').innerHTML = STATUSES.map(s => `
    <div class="row ${statState[s.id] !== false ? 'on' : 'off'}" data-stat="${s.id}">
      <span class="box"></span>
      <span class="row-label">${s.icon} ${esc(s.name)}</span>
      <span class="row-count">${counts[s.id] || 0}</span>
    </div>`).join('');

  document.querySelectorAll('[data-stat]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.stat;
      statState[id] = statState[id] === false;
      renderStatuses(); renderTypes(); renderPeople(); rebuildWheel();
    });
  });
}

// Типы строим по тому, что реально есть в включённых источниках.
// Панель прячется, если типов нет вообще (например, остались только игры).
function renderTypes() {
  const counts = {};
  allItems.forEach(it => {
    if (!srcState[it.source] || !srcState[it.source].on) return;
    if (statState[it.status] === false) return;
    counts[it.type] = (counts[it.type] || 0) + 1;
  });
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const panel = document.getElementById('types-panel');

  // Один-единственный тип фильтровать не по чему — прячем панель
  if (keys.length < 2) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  document.getElementById('types-list').innerHTML = keys.map(t => {
    const L = typeLabel(t);
    return `
      <div class="row ${typeState[t] !== false ? 'on' : 'off'}" data-type="${esc(t)}">
        <span class="box"></span>
        <span class="row-label">${icon(L.icon)} ${esc(L.name)}</span>
        <span class="row-count">${counts[t]}</span>
      </div>`;
  }).join('');

  document.querySelectorAll('[data-type]').forEach(el => {
    el.addEventListener('click', () => {
      const t = el.dataset.type;
      typeState[t] = typeState[t] === false;
      renderTypes(); renderPeople(); rebuildWheel();
    });
  });
}

function renderPeople() {
  const counts = {};
  allItems.forEach(it => {
    if (!it.who) return;
    if (!srcState[it.source] || !srcState[it.source].on) return;
    if (statState[it.status] === false) return;
    if (typeState[it.type] === false) return;
    counts[it.who] = (counts[it.who] || 0) + 1;
  });
  // Во время сбора записавшиеся поднимаются наверх — сразу видно, кто в игре
  const onFirst = (a, b) => collecting ? (whoState[b] !== false) - (whoState[a] !== false) : 0;
  let names = Object.keys(counts).sort((a, b) => onFirst(a, b) || counts[b] - counts[a] || a.localeCompare(b, 'ru'));
  if (whoQuery) names = names.filter(n => n.toLowerCase().indexOf(whoQuery) >= 0);

  const list = document.getElementById('people-list');
  if (names.length === 0) {
    list.innerHTML = `<div class="empty-note">${whoQuery ? 'Никого не нашли' : 'Выбери источник — здесь появятся заказчики'}</div>`;
    return;
  }
  list.innerHTML = names.map(n => {
    const ava = avatarOf(n);
    return `
      <div class="row ${whoState[n] !== false ? 'on' : 'off'}${justJoined.has(n.toLowerCase()) ? ' joined' : ''}" data-who="${esc(n)}">
        <span class="box"></span>
        <span class="row-ava" ${ava ? `style="background-image:url('${esc(ava)}')"` : ''}></span>
        <span class="row-label">${esc(n)}</span>
        <span class="row-count">${counts[n]}</span>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-who]').forEach(el => {
    el.addEventListener('click', () => {
      const n = el.dataset.who;
      whoState[n] = whoState[n] === false;
      renderPeople(); rebuildWheel();
    });
  });
}

// ============================================================
// Сбор участников из чата Twitch
//
// Анонимное подключение к IRC-чату (только чтение, без логина).
// «Собрать» снимает всех заказчиков, дальше каждый, кто написал
// «я», включается сам. Первая крутка закрывает сбор — иначе
// пересборка колеса посреди выбывания сбросила бы его.
// ============================================================
let collecting = false;
let chatWs = null, chatReconnect = null, chatDelay = 1000;
const justJoined = new Set();        // подсветка только что записавшихся (lowercase)
const chatSeen = new Set();          // кто уже писал «я» в этом сборе (login)

function setConnStatus(state, text) {
  document.getElementById('conn-dot').className = 'conn-dot' + (state ? ' ' + state : '');
  document.getElementById('conn-text').textContent = text;
}

function updateCollectUi() {
  const btn = document.getElementById('btn-collect');
  btn.classList.toggle('running', collecting);
  btn.innerHTML = collecting ? icon('stop') + ' Закрыть сбор' : icon('message') + ' Собрать из чата';
  const words = JOIN_WORDS.map(w => `<b>«${esc(w)}»</b>`).join(' или ');
  document.getElementById('collect-hint').innerHTML = collecting
    ? `Заказчики пишут ${words} в чат — и их заказы появляются на колесе. Первая крутка закроет сбор.`
    : `Снимет всех заказчиков и будет добавлять тех, кто напишет ${words} в чат #${esc(siteProfile.channel)}.`;
}

function addCollectLine(name, ok, why) {
  const feed = document.getElementById('collect-feed');
  const line = document.createElement('div');
  line.className = 'collect-line' + (ok ? ' in' : '');
  line.innerHTML = `${icon(ok ? 'check' : 'x')}<span class="nick">${esc(name)}</span><span class="why">${esc(why)}</span>`;
  feed.prepend(line);
}

function closeChat() {
  if (chatReconnect) { clearTimeout(chatReconnect); chatReconnect = null; }
  if (!chatWs) return;
  chatWs.onopen = chatWs.onmessage = chatWs.onclose = chatWs.onerror = null;
  try { chatWs.close(); } catch (e) {}
  chatWs = null;
}

function openChat() {
  closeChat();
  setConnStatus('connecting', 'Подключение к чату…');
  const ws = chatWs = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags');
    ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
    ws.send('JOIN #' + siteProfile.channel);
  };
  ws.onmessage = ev => ev.data.split('\r\n').forEach(line => { if (line) handleChatLine(line); });
  ws.onclose = () => {
    if (!collecting) return;
    setConnStatus('connecting', 'Переподключение…');
    chatReconnect = setTimeout(openChat, chatDelay);
    chatDelay = Math.min(chatDelay * 2, 15000);
  };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}

function handleChatLine(line) {
  if (line.startsWith('PING')) { chatWs.send('PONG :tmi.twitch.tv'); return; }
  let tags = '', rest = line;
  if (rest[0] === '@') { const sp = rest.indexOf(' '); tags = rest.slice(1, sp); rest = rest.slice(sp + 1); }
  let prefix = '';
  if (rest[0] === ':') { const sp = rest.indexOf(' '); prefix = rest.slice(1, sp); rest = rest.slice(sp + 1); }
  const sp = rest.indexOf(' ');
  const command = sp < 0 ? rest : rest.slice(0, sp);
  const params = sp < 0 ? '' : rest.slice(sp + 1);

  if (command === 'JOIN') {
    chatDelay = 1000;
    setConnStatus('online', 'Слушаю чат #' + siteProfile.channel);
  } else if (command === 'RECONNECT') {
    try { chatWs.close(); } catch (e) {}
  } else if (command === 'PRIVMSG') {
    const login = prefix.split('!')[0].toLowerCase();
    const m = /(?:^|;)display-name=([^;]*)/.exec(tags);
    const name = (m && m[1].replace(/\\s/g, ' ')) || login;
    const i = params.indexOf(' :');
    onChatMessage(login, name, i < 0 ? '' : params.slice(i + 2));
  }
}

function isJoinMessage(text) {
  // ACTION (/me) приходит обёрнутым в \x01 — снимаем обёртку
  const t = text.replace(/^\x01ACTION |\x01$/g, '').trim().toLowerCase();
  const raw = t.split(/\s+/)[0] || '';
  const first = raw.replace(/[!?.,:;)+]+$/, '');
  // Слово целиком («+» тоже годится как слово) или без знаков на конце («я!»)
  return JOIN_WORDS.some(w => raw === w.toLowerCase() || first === w.toLowerCase());
}

function onChatMessage(login, name, text) {
  if (!collecting || !isJoinMessage(text) || chatSeen.has(login)) return;
  chatSeen.add(login);

  // Ник в таблицах записан как придётся (SI_ve / Si_ve) — сравниваем без регистра
  const keys = Object.keys(whoState).filter(k => k.toLowerCase().replace(/^@/, '') === login);
  if (!keys.length) { addCollectLine(name, false, 'нет заказов'); return; }

  keys.forEach(k => whoState[k] = true);
  const n = visibleItems().filter(it => it.who && it.who.toLowerCase() === login).length;
  addCollectLine(name, n > 0, n > 0 ? n + ' ' + plural(n, 'заказ', 'заказа', 'заказов') : 'нет заказов в фильтре');

  justJoined.add(login);
  setTimeout(() => justJoined.delete(login), 2500);
  renderPeople(); rebuildWheel();
}

function startCollect() {
  collecting = true;
  chatSeen.clear();
  document.getElementById('collect-feed').innerHTML = '';
  hideWinner();
  Object.keys(whoState).forEach(k => whoState[k] = false);
  renderPeople(); rebuildWheel();
  updateCollectUi();
  chatDelay = 1000;
  openChat();
}

function stopCollect(reason) {
  if (!collecting) return;
  collecting = false;
  closeChat();
  const n = document.querySelectorAll('#collect-feed .collect-line.in').length;
  setConnStatus('', (reason || 'Сбор закрыт') + ` · записались: ${n}`);
  updateCollectUi();
  renderPeople();
}

document.getElementById('btn-collect').addEventListener('click', () => {
  if (collecting) stopCollect(); else startCollect();
});
updateCollectUi();
WheelKit.ready.then(() => {
  const words = WheelKit.list('picker_join_words').map(w => w.toLowerCase());
  if (words.length) JOIN_WORDS = words;
  updateCollectUi();
});

document.getElementById('who-search').addEventListener('input', e => {
  whoQuery = e.target.value.trim().toLowerCase();
  renderPeople();
});
document.getElementById('who-all').addEventListener('click', () => {
  Object.keys(whoState).forEach(k => whoState[k] = true);
  renderPeople(); rebuildWheel();
});
document.getElementById('who-none').addEventListener('click', () => {
  Object.keys(whoState).forEach(k => whoState[k] = false);
  renderPeople(); rebuildWheel();
});

// ============================================================
// Состояние колеса
// ============================================================
let activeItems = [];
let currentSegments = [];
let labelCache = [];
let currentRotation = 0;
let liveRotation = 0;       // угол колеса прямо сейчас, по кадрам анимации — по нему движутся блёстки
let isSpinning = false;
let duration = 5;
let eliminationMode = false;
let autoRunning = false;
let wheelGen = 0;          // растёт при пересборке колеса — старая крутка результат не применяет
let log = [];

// Когда вариантов мало, каждый получает несколько тонких кусочков
// вперемешку: шансы те же, но по колесу не предугадать результат
const SPLIT_BELOW = 10;
const MIN_SLICE_ANGLE = 4;
const MAX_PARTS = 6;   // шире сектор — больше влезает в подпись

function rebuildWheel() {
  wheelGen++;
  stopAuto();
  activeItems = visibleItems();
  setEliminationUi(false);
  log = [];
  document.getElementById('log-entries').innerHTML = '';
  document.getElementById('log').classList.remove('has-entries');
  currentRotation = 0;
  renderWheel();
  updateStats();
}

function updateStats() {
  const total = activeItems.length;
  const bySrc = SOURCES.filter(s => srcState[s.id] && srcState[s.id].on)
    .map(s => `${icon(s.icon)} ${activeItems.filter(i => i.source === s.id).length}`).join(' · ');
  document.getElementById('top-stats').innerHTML =
    `<b>${total}</b> ${plural(total,'вариант','варианта','вариантов')}${bySrc ? ' &nbsp;•&nbsp; ' + bySrc : ''}`;
  const empty = document.getElementById('wheel-empty');
  empty.style.display = total === 0 ? 'flex' : 'none';
  if (total === 0) {
    const anySrc = SOURCES.some(s => srcState[s.id] && srcState[s.id].on);
    const anyWho = Object.keys(whoState).some(k => whoState[k]);
    empty.innerHTML = !anySrc ? 'Выбери источники слева —<br>варианты появятся на колесе'
      : !anyWho ? (collecting ? 'Ждём «я» в чате…' : 'Нажми «Собрать из чата»<br>или отметь заказчиков слева')
      : 'Под эти фильтры<br>ничего не подходит';
  }
  ['btn-single','btn-elim'].forEach(id => { document.getElementById(id).disabled = total === 0 || isSpinning || autoRunning; });
  document.getElementById('btn-auto').disabled = !autoRunning && (total === 0 || isSpinning);
}

// ============================================================
// Раскладка секторов
// ============================================================
function computeSegments() {
  const n = activeItems.length;
  if (n === 0) return [];
  const share = 360 / n;                       // все варианты равны

  const shares = activeItems.map((it, i) => ({ item: it, itemIndex: i, angle: share }));
  const splitOn = n > 1 && n < SPLIT_BELOW;
  shares.forEach(s => {
    s.parts = splitOn ? Math.max(1, Math.min(MAX_PARTS, Math.floor(s.angle / MIN_SLICE_ANGLE))) : 1;
  });

  const ordered = [];
  shares.forEach((s, i) => {
    const offset = (i * 0.37) % 1;
    for (let j = 0; j < s.parts; j++) {
      ordered.push({ item: s.item, itemIndex: s.itemIndex, angle: s.angle / s.parts, key: (j + offset) / s.parts });
    }
  });
  ordered.sort((a, b) => a.key - b.key);

  let cumulative = 0;
  return ordered.map(s => {
    const startAngle = cumulative;
    cumulative += s.angle;
    return {
      item: s.item, itemIndex: s.itemIndex, angle: s.angle,
      startAngle: startAngle, endAngle: cumulative,
      midAngle: startAngle + s.angle / 2,
    };
  });
}

function sectorPath(cx, cy, r, startAngle, endAngle) {
  const s = (startAngle - 90) * Math.PI / 180, e = (endAngle - 90) * Math.PI / 180;
  const x1 = cx + Math.cos(s) * r, y1 = cy + Math.sin(s) * r;
  const x2 = cx + Math.cos(e) * r, y2 = cy + Math.sin(e) * r;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${(endAngle - startAngle) > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

// Колесо целиком (обод, штырьки, блик, ступица) собирает wheel-kit.js
const WHEEL_R = WheelKit.WHEEL_R;

function renderWheel() {
  const svg = document.getElementById('wheel');
  if (activeItems.length === 0) { currentSegments = []; labelCache = []; svg.innerHTML = ''; return; }

  const segments = computeSegments();
  currentSegments = segments;
  liveRotation = currentRotation;

  let content = '';
  const kit = WheelKit.builder();
  const cx = 50, cy = 50, r = WHEEL_R;
  segments.forEach(seg => {
    const base = srcById(seg.item.source);
    // Яркость слегка гуляет, чтобы соседние сектора одного источника отличались
    const color = WheelKit.shade(base ? base.color : '#888', ((seg.itemIndex % 3) - 1) * 18);
    content += `<path d="${sectorPath(cx, cy, r, seg.startAngle, seg.endAngle)}" fill="${kit.fill(color)}" stroke="rgba(255,255,255,0.32)" stroke-width="0.18" data-item="${seg.itemIndex}"/>`;

    if (seg.angle >= 2) {
      const textRadius = r * 0.86;
      const rad = (seg.midAngle - 90) * Math.PI / 180;
      const tx = cx + Math.cos(rad) * textRadius, ty = cy + Math.sin(rad) * textRadius;
      const baseRot = seg.midAngle - 90;
      const fontSize = Math.min(2.7, Math.max(1.45, seg.angle * 0.4));
      // Полный текст пишем как есть — подрежет fitLabels() по факту замера
      content += `<text x="${tx}" y="${ty}" fill="#0a0e1a" font-size="${fontSize}"
        data-base="${baseRot.toFixed(3)}" data-tx="${tx.toFixed(3)}" data-ty="${ty.toFixed(3)}"
        data-angle="${seg.angle.toFixed(4)}" data-full="${esc(seg.item.title)}"
        text-anchor="end" dominant-baseline="middle"
        transform="rotate(${baseRot} ${tx} ${ty})"
        style="paint-order: stroke; stroke: rgba(255,255,255,0.6); stroke-width: 0.5;
               font-weight: 700; pointer-events: none;">${esc(seg.item.title)}</text>`;
    }
  });

  svg.innerHTML = kit.frame({
    content,
    boundaries: segments.map(s => s.startAngle),
    rotation: currentRotation,
    hubIcon: 'dice',
  });

  labelCache = svg.querySelectorAll('#wheel-group text[data-base]');
  fitLabels();
  updateLabelOrientation(currentRotation);
}

// ============================================================
// Подгонка длины подписей
//
// Подписи идут по радиусу, а сектор к центру сужается: его ширина
// на радиусе r равна r * угол(рад). Слишком длинная строка доезжает
// туда, где ширины уже не хватает, и налезает на соседние сектора.
//
// Считать длину по числу символов нельзя — кириллица, латиница и
// цифры имеют разную ширину. Поэтому меряем реальную длину строки
// через getComputedTextLength() и подрезаем двоичным поиском.
// ============================================================
function fitLabels() {
  const textR = WHEEL_R * 0.86;     // радиус, на котором заканчивается подпись
  for (let i = 0; i < labelCache.length; i++) {
    const el = labelCache[i];
    const angle = parseFloat(el.dataset.angle);
    const fs = parseFloat(el.getAttribute('font-size'));
    const full = el.dataset.full || '';

    // Глубже этого радиуса буквы уже не помещаются между соседями
    const rMin = Math.max(10, (fs * 1.15) / (angle * 0.017453));
    const maxLen = Math.max(3, textR - rMin);

    el.textContent = full;
    const measured = el.getComputedTextLength();

    // В скрытой вкладке браузер не размечает SVG и возвращает 0 — мерить
    // нечего, оцениваем по числу символов (≈0.65 кегля на символ).
    if (!measured) {
      const maxChars = Math.max(3, Math.floor(maxLen / (fs * 0.65)));
      if (full.length > maxChars) el.textContent = full.slice(0, maxChars - 1).trimEnd() + '…';
      continue;
    }
    if (measured <= maxLen) continue;                     // влезло целиком

    let lo = 0, hi = full.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      el.textContent = full.slice(0, mid).trimEnd() + '…';
      if (el.getComputedTextLength() <= maxLen) lo = mid; else hi = mid - 1;
    }
    el.textContent = lo > 0 ? full.slice(0, lo).trimEnd() + '…' : '';
  }
}

// Подписи крутятся вместе с колесом — переворачиваем их на лету,
// чтобы к стрелке ни одна не подъехала вверх ногами
function updateLabelOrientation(rotDeg) {
  for (let i = 0; i < labelCache.length; i++) {
    const el = labelCache[i];
    const base = parseFloat(el.dataset.base);
    const onScreen = (((base + rotDeg) % 360) + 360) % 360;
    const flipped = (onScreen > 90 && onScreen < 270) ? '1' : '0';
    if (el.dataset.flipped === flipped) continue;
    el.dataset.flipped = flipped;
    el.setAttribute('transform', `rotate(${flipped === '1' ? base + 180 : base} ${el.dataset.tx} ${el.dataset.ty})`);
    el.setAttribute('text-anchor', flipped === '1' ? 'start' : 'end');
  }
}

// ============================================================
// Прокрутка
// ============================================================
const POINTER_ANGLE = 90;   // стрелка справа: ник победителя горизонтален

function pickWinnerIndex() {
  const n = activeItems.length;
  if (n === 0) return -1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor((buf[0] / 0x100000000) * n);
}

function cubicBezier(y1, y2, t) { const inv = 1 - t, t2 = t * t; return 3*inv*inv*t*y1 + 3*inv*t2*y2 + t2*t; }
function cubicBezierX(x1, x2, t) { const inv = 1 - t, t2 = t * t; return 3*inv*inv*t*x1 + 3*inv*t2*x2 + t2*t; }
function easeOutBezier(t) {
  let low = 0, high = 1, mid = t;
  for (let i = 0; i < 20; i++) {
    const x = cubicBezierX(0.17, 0.2, mid);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) low = mid; else high = mid;
    mid = (low + high) / 2;
  }
  return cubicBezier(0.67, 1, mid);
}
function normalizeAngle(a) { const n = a % 360; return n < 0 ? n + 360 : n; }
function boundaryCrossed(prev, next, boundary, decreasing) {
  if (decreasing) {
    if (prev >= next) return next < boundary && boundary <= prev;
    return boundary > next || boundary <= prev;
  }
  if (next >= prev) return prev < boundary && boundary <= next;
  return boundary > prev || boundary <= next;
}

async function trackPointerTicks(startRot, endRot, dur, segments) {
  const startTime = performance.now();
  const totalDelta = endRot - startRot;
  const boundaries = segments.map(s => normalizeAngle(s.startAngle));
  let last = normalizeAngle(POINTER_ANGLE - startRot);
  const decreasing = totalDelta > 0;
  return new Promise(resolve => {
    function frame(now) {
      const t = Math.min((now - startTime) / 1000 / dur, 1);
      const currentRot = startRot + totalDelta * easeOutBezier(t);
      liveRotation = currentRot;
      updateLabelOrientation(currentRot);
      const onWheel = normalizeAngle(POINTER_ANGLE - currentRot);
      for (const b of boundaries) if (boundaryCrossed(last, onWheel, b, decreasing)) triggerTick();
      last = onWheel;
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function triggerTick() {
  const p = document.getElementById('wheel-pointer');
  p.classList.remove('ticking');
  void p.offsetWidth;
  p.classList.add('ticking');
  playClick();
}

// В авто-режиме всё, кроме кнопки «Стоп», заблокировано и между крутками
function setControlsDisabled(d) {
  const lock = d || autoRunning;
  ['btn-single','btn-elim','btn-reset','btn-reload'].forEach(id => document.getElementById(id).disabled = lock);
  document.querySelectorAll('.duration-btn[data-dur]').forEach(b => b.disabled = lock);
  document.getElementById('btn-auto').disabled = autoRunning ? false : d;
}

// final — последняя крутка авто-выбывания (двое на колесе), см. WheelKit.finalSpin
async function spin(callback, dur = duration, final = false) {
  if (isSpinning || activeItems.length === 0) return;
  if (collecting) stopCollect('Сбор закрыт: крутим');
  if (activeItems.length === 1) { if (callback) callback(0); return; }

  isSpinning = true;
  setControlsDisabled(true);
  const gen = wheelGen;

  const segments = currentSegments.length ? currentSegments : computeSegments();
  const winnerIdx = pickWinnerIndex();

  if (final && activeItems.length === 2) {
    // Финал: без замедления, резкий тормоз, а иногда и проскальзывание — wheel-kit.js
    currentRotation = await WheelKit.finalSpin({
      group: document.getElementById('wheel-group'),
      segments, keyOf: s => s.itemIndex, target: winnerIdx,
      startRot: currentRotation, pointer: POINTER_ANGLE,
      onRotate: r => { liveRotation = r; updateLabelOrientation(r); },
      onTick: triggerTick,
      onStop: () => wheelFx.burst(),
    });
  } else {
    // У победителя может быть несколько кусочков — останавливаемся на случайном
    const slices = segments.filter(s => s.itemIndex === winnerIdx);
    let chosen = slices[0];
    if (slices.length > 1) {
      const p = new Uint32Array(1); crypto.getRandomValues(p);
      chosen = slices[p[0] % slices.length];
    }
    if (!chosen) { isSpinning = false; setControlsDisabled(false); return; }

    const cur = ((currentRotation % 360) + 360) % 360;
    const tgt = (((POINTER_ANGLE - chosen.midAngle) % 360) + 360) % 360;
    let delta = tgt - cur; if (delta < 0) delta += 360;
    const startRotation = currentRotation;
    const finalRotation = currentRotation + 4 * 360 + delta;
    currentRotation = finalRotation;

    const group = document.querySelector('#wheel-group');
    group.style.transition = `transform ${dur}s cubic-bezier(0.17, 0.67, 0.2, 1)`;
    group.style.transform = `rotate(${finalRotation}deg)`;

    await trackPointerTicks(startRotation, finalRotation, dur, segments);
    liveRotation = finalRotation;
    updateLabelOrientation(finalRotation);
    await new Promise(r => setTimeout(r, 100));
    if (gen === wheelGen) wheelFx.burst();
  }

  // Пока крутилось, колесо пересобрали фильтрами — индекс уже про другой список.
  // Результат применяем до разблокировки кнопок: вспышка вылетающего сектора
  // идёт ещё полсекунды, и новая крутка в это время сломала бы выбывание.
  if (gen === wheelGen && callback) await callback(winnerIdx);
  isSpinning = false;
  setControlsDisabled(false);
  updateStats();
}

// Вылетающий вариант вспыхивает на всех своих кусочках
const flashItem = idx => WheelKit.flash(`path[data-item="${idx}"]`);

// Стрелка и блёстки «в масле» вокруг колеса — wheel-kit.js
const wheelFx = WheelKit.mount({
  area: document.querySelector('.wheel-area'),
  getRotation: () => liveRotation,
  isSpinning: () => isSpinning,
});

// ============================================================
// Звук
// ============================================================
// Щелчок стрелки — на выбор (Дерево / Мягкий / Шарик / Выкл), общий
// для всех рулеток: wheel-kit.js. «Выкл» глушит и фанфары.
const playClick = () => WheelKit.sound.click();
WheelKit.sound.bind(document.querySelector('.sound-group'));

function playFanfare() {
  if (!WheelKit.sound.enabled()) return;
  const audioCtx = WheelKit.sound.ensure(); if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [[261.63,0,0.18],[329.63,0.18,0.18],[392,0.36,0.18],[523.25,0.54,0.4],
   [659.25,1.0,0.2],[783.99,1.2,0.2],[1046.5,1.45,0.8]].forEach(([f,t,d]) => {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0 + t);
    gain.gain.setValueAtTime(0, t0 + t);
    gain.gain.linearRampToValueAtTime(0.12, t0 + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0 + t); osc.stop(t0 + t + d + 0.05);
  });
}
// ============================================================
// Победитель
// ============================================================
function showWinner(item) {
  const s = srcById(item.source);
  const cat = document.getElementById('winner-cat');
  cat.innerHTML = s ? `${icon(s.icon)} ${esc(s.name)}` : '';
  cat.style.color = s ? s.color : '#fff';

  document.getElementById('winner-title').textContent = item.title;
  document.getElementById('winner-who-text').textContent = item.who ? `заказ: ${item.who}` : '';

  const ava = document.getElementById('winner-who-ava');
  const url = avatarOf(item.who);
  if (url) { ava.style.backgroundImage = `url('${url}')`; ava.classList.add('show'); }
  else { ava.classList.remove('show'); ava.style.backgroundImage = ''; }

  // Обложка: показываем только если картинка реально загрузилась
  const cover = document.getElementById('winner-cover');
  cover.classList.remove('show');
  cover.removeAttribute('src');
  if (item.cover && /^https?:\/\//i.test(item.cover)) {
    cover.onload  = () => cover.classList.add('show');
    cover.onerror = () => cover.classList.remove('show');
    cover.src = item.cover;
  }

  const link = document.getElementById('winner-link');
  if (item.link && /^https?:\/\//i.test(item.link)) {
    link.href = item.link; link.classList.add('show');
  } else {
    link.classList.remove('show'); link.removeAttribute('href');
  }

  document.getElementById('winner-overlay').classList.add('show');
  launchConfetti();
  playFanfare();
}
function hideWinner() {
  document.getElementById('winner-overlay').classList.remove('show');
  const c = document.getElementById('confetti');
  c.classList.remove('active'); c.innerHTML = '';
}
document.getElementById('winner-close-btn').addEventListener('click', hideWinner);

function launchConfetti() {
  const c = document.getElementById('confetti');
  c.classList.add('active'); c.innerHTML = '';
  const colors = ['#FAC775','#E58CC0','#6FB7E8','#9B8CE8','#FFE194','#ffffff'];
  for (let i = 0; i < 120; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 8 + Math.random() * 10;
    p.style.left = (Math.random() * 100) + 'vw';
    p.style.width = size + 'px'; p.style.height = size + 'px';
    const col = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = col;
    p.style.boxShadow = `0 0 ${size}px ${col}`;
    p.style.setProperty('--drift', ((Math.random() - 0.5) * 400) + 'px');
    p.style.animationDuration = (3 + Math.random() * 2.5) + 's';
    p.style.animationDelay = (Math.random() * 0.6) + 's';
    const shape = Math.floor(Math.random() * 3);
    if (shape === 1) p.style.borderRadius = '50%';
    else if (shape === 2) p.style.clipPath = 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';
    c.appendChild(p);
  }
  setTimeout(() => { if (c.classList.contains('active')) c.innerHTML = ''; }, 6000);
}

// ============================================================
// История
// ============================================================
// place — место в выбывании: первый вылетевший из N получает #N,
// последний — #2, победитель — кубок (#1)
function addLogEntry(item, isWinner, place) {
  log.push({ item, isWinner, place });
  document.getElementById('log-entries').innerHTML = log.map((e, i) => `
    <div class="log-entry${e.isWinner ? ' winner' : ''}${i === log.length - 1 ? ' latest fresh' : ''}">
      <span class="num">${e.isWinner ? icon('trophy') : '#' + e.place}</span>${e.isWinner ? '' : 'Выбыл: '}${esc(e.item.title)}
      ${e.item.who ? `<div class="log-who">заказ: ${esc(e.item.who)}</div>` : ''}
    </div>`).reverse().join('');
  const l = document.getElementById('log');
  l.classList.add('has-entries');
}

// ============================================================
// Кнопки
// ============================================================
function highlightDuration(sec) {
  document.querySelectorAll('.duration-btn[data-dur]').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.dur, 10) === sec));
}
document.querySelectorAll('.duration-btn[data-dur]').forEach(btn => {
  btn.addEventListener('click', () => {
    duration = parseInt(btn.dataset.dur, 10);
    highlightDuration(duration);
  });
});

// ============================================================
// Выбывание (ручное и авто)
// ============================================================
function setEliminationUi(on) {
  eliminationMode = on;
  document.getElementById('btn-elim').innerHTML = icon('swords') + (on ? ' Крутить (выбывание)' : ' Режим выбывания');
}

function finishElimination() {
  if (!activeItems.length) return;
  const w = activeItems[0];
  addLogEntry(w, true); showWinner(w);
  setEliminationUi(false);
}

// Выкидываем выпавший вариант; когда остаётся один — он победитель
async function eliminateAt(idx) {
  if (activeItems.length === 1) { finishElimination(); return; }
  const gen = wheelGen;
  await flashItem(idx);
  if (gen !== wheelGen) return;
  addLogEntry(activeItems[idx], false, activeItems.length);
  activeItems.splice(idx, 1);
  updateStats();
  renderWheel();
  if (activeItems.length === 1) {
    const gen = wheelGen;
    setTimeout(() => { if (gen === wheelGen) finishElimination(); }, 700);
  }
}

document.getElementById('btn-single').addEventListener('click', () => {
  if (eliminationMode) {
    if (!confirm('Активен режим выбывания. Прервать и выбрать одного?')) return;
    setEliminationUi(false);
  }
  spin(idx => { const w = activeItems[idx]; addLogEntry(w, true); showWinner(w); });
});

document.getElementById('btn-elim').addEventListener('click', () => {
  if (!eliminationMode) setEliminationUi(true);
  spin(eliminateAt, duration, WheelKit.finalInManual());
});

// ------------------------------------------------------------
// Авто-выбывание: колесо само крутит и выкидывает по одному.
// Темп (3с → 5с → 10с → особый финал) — WheelKit.AUTO_PHASES.
// ------------------------------------------------------------
let autoWake = null;          // прерывает паузу между крутками при «Стоп»
let manualDuration = duration;

function pause(sec) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); autoWake = null; resolve(); };
    const timer = setTimeout(done, sec * 1000);
    autoWake = done;
  });
}

function stopAuto() {
  if (!autoRunning) return;
  autoRunning = false;
  if (autoWake) autoWake();
}

async function runAuto() {
  autoRunning = true;
  manualDuration = duration;
  const btn = document.getElementById('btn-auto');
  btn.classList.add('running');
  btn.innerHTML = icon('stop') + ' Стоп авто';
  setEliminationUi(true);
  setControlsDisabled(false);
  updateStats();

  const gen = wheelGen;
  let first = true;
  while (autoRunning && gen === wheelGen && activeItems.length > 1) {
    const n = activeItems.length;
    const ph = WheelKit.autoPhase(n);
    if (!first) {
      await pause(ph.pause);
      if (!autoRunning || gen !== wheelGen) break;
    }
    first = false;
    highlightDuration(ph.spin);
    await spin(eliminateAt, ph.spin, ph.final);
  }

  autoRunning = false;
  autoWake = null;
  btn.classList.remove('running');
  btn.innerHTML = icon('bot') + ' Авто-выбывание';
  duration = manualDuration;
  highlightDuration(duration);
  setControlsDisabled(isSpinning);
  updateStats();
}

document.getElementById('btn-auto').addEventListener('click', () => {
  if (autoRunning) {
    // Идущая крутка доедет и выкинет свой вариант, дальше — ручной режим
    stopAuto();
    if (isSpinning) document.getElementById('btn-auto').innerHTML = icon('stop') + ' Остановится после крутки';
    return;
  }
  if (activeItems.length === 0 || isSpinning) return;
  if (activeItems.length === 1) { finishElimination(); return; }
  runAuto();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Сбросить? Все выбывшие вернутся, история очистится.')) return;
  hideWinner();
  rebuildWheel();
});

document.getElementById('btn-reload').addEventListener('click', async () => {
  const b = document.getElementById('btn-reload');
  b.disabled = true; b.innerHTML = icon('hourglass') + ' Загрузка…';
  await loadAll();
  b.disabled = false; b.innerHTML = icon('refresh') + ' Перезагрузить';
});

loadAll();
