// Код страницы chat-wheel.html (раздел chat-wheel). Подключается из chat-wheel.html.
// ============================================================
// Утилиты
// ============================================================
function initials(nick) {
  const clean = nick.replace(/[^A-Za-zА-Яа-я0-9]/g, '');
  if (clean.length >= 2) return (clean[0] + clean[1]).toUpperCase();
  return (clean[0] || '?').toUpperCase();
}
function agoText(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + 'с';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'м';
  return Math.floor(m / 60) + 'ч ' + (m % 60) + 'м';
}

// ============================================================
// Настройки (сохраняются в localStorage)
// ============================================================
const LS_KEY = 'chatwheel-settings-v1';
const settings = Object.assign({
  channel: siteProfile.channel,
  mode: 'activity',          // activity | keyword | manual
  windowMin: 10,             // 0 = всё время
  manualWindowMin: 0,        // окно списка в ручном наборе (своё, чтобы афк не прятались)
  keyword: 'хочу',
  subFilter: 'all',          // all | nosub | sub
  exMods: true,
  exVips: false,
  exBots: true,
  exBroadcaster: true,
  exCustom: '',
}, JSON.parse(localStorage.getItem(LS_KEY) || '{}'));

function saveSettings() {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

// ============================================================
// Состояние
// ============================================================
// login -> { login, name, lastMsg, isSub, isMod, isVip, isBroadcaster, keywordAt }
const users = new Map();
const manualExcluded = new Set();   // убранные вручную / победители
const manualPicked = new Set();     // режим «Вручную»: кого выбрали сами
let wheelList = [];                 // текущий список на колесе
let currentSegments = [];           // кусочки, нарисованные на колесе
let labelCache = [];                // подписи секторов (для подгонки и переворота)
let pendingRefresh = false;
let collecting = false;
let collectStart = null;            // timestamp начала сбора по слову
let currentRotation = 0;
let liveRotation = 0;               // угол колеса прямо сейчас, по кадрам анимации — по нему движутся блёстки
let isSpinning = false;
let eliminationMode = false;
let autoRunning = false;
let duration = 5;
let logEntries = [];
let feedVisible = true;

const SECTOR_COLORS = [
  '#7F77DD', '#FAC775', '#D85A30', '#97C459',
  '#5BA9E5', '#E599C2', '#B58FF5', '#F0B370',
  '#86D7C9', '#E58686', '#9CB870', '#5B7FE5'
];

// ============================================================
// Twitch IRC (анонимно, только чтение)
// ============================================================
let ws = null;
let wsWanted = false;      // хотим ли держать соединение
let reconnectTimer = null;
let reconnectDelay = 1000;
let joinedChannel = '';

function setConnStatus(state, text) {
  const dot = document.getElementById('conn-dot');
  dot.className = 'conn-dot' + (state === 'online' ? ' online' : state === 'connecting' ? ' connecting' : '');
  document.getElementById('conn-text').textContent = text;
}

function connect() {
  const chan = document.getElementById('channel-input').value.trim().toLowerCase().replace(/^#/, '');
  if (!chan) return;
  settings.channel = chan;
  saveSettings();
  wsWanted = true;
  openSocket(chan);
  updateConnectButton();
}

function killSocket() {
  if (!ws) return;
  ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
  try { ws.close(); } catch (e) {}
  ws = null;
}

function disconnect() {
  wsWanted = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  killSocket();
  setConnStatus('off', 'Отключено');
  updateConnectButton();
}

function openSocket(chan) {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  killSocket();
  setConnStatus('connecting', 'Подключение к #' + chan + '…');
  joinedChannel = chan;

  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
    ws.send('JOIN #' + chan);
  };

  ws.onmessage = (ev) => {
    ev.data.split('\r\n').forEach(line => { if (line) handleIRC(line); });
  };

  ws.onclose = () => {
    if (wsWanted) {
      setConnStatus('connecting', 'Переподключение…');
      reconnectTimer = setTimeout(() => openSocket(joinedChannel), reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    }
  };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}

function parseTags(raw) {
  const tags = {};
  raw.split(';').forEach(pair => {
    const i = pair.indexOf('=');
    const k = i < 0 ? pair : pair.slice(0, i);
    let v = i < 0 ? '' : pair.slice(i + 1);
    v = v.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\');
    tags[k] = v;
  });
  return tags;
}

function handleIRC(line) {
  if (line.startsWith('PING')) {
    ws.send('PONG :tmi.twitch.tv');
    return;
  }

  let tags = {};
  let rest = line;
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    tags = parseTags(rest.slice(1, sp));
    rest = rest.slice(sp + 1);
  }

  let prefix = '';
  if (rest.startsWith(':')) {
    const sp = rest.indexOf(' ');
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }

  const sp = rest.indexOf(' ');
  const command = sp < 0 ? rest : rest.slice(0, sp);
  const params = sp < 0 ? '' : rest.slice(sp + 1);

  if (command === '001') {
    setConnStatus('online', 'В чате #' + joinedChannel);
    reconnectDelay = 1000;
    updateStats();
    return;
  }

  if (command === 'RECONNECT') {
    try { ws.close(); } catch (e) {}
    return;
  }

  if (command === 'NOTICE') {
    const msg = params.split(' :')[1] || '';
    if (/login|auth/i.test(msg)) setConnStatus('off', 'Ошибка: ' + msg);
    return;
  }

  // Бан/таймаут — убираем из пула
  if (command === 'CLEARCHAT') {
    const target = (params.split(' :')[1] || '').trim().toLowerCase();
    if (target && users.has(target)) {
      users.delete(target);
      refreshAll();
    }
    return;
  }

  if (command === 'PRIVMSG') {
    const login = prefix.split('!')[0].toLowerCase();
    const colonIdx = params.indexOf(' :');
    const text = colonIdx < 0 ? '' : params.slice(colonIdx + 2);
    onChatMessage(login, tags, text);
  }
}

function onChatMessage(login, tags, text) {
  const badges = tags['badges'] || '';
  const now = Date.now();
  const user = users.get(login) || { login, keywordAt: 0 };

  user.name = tags['display-name'] || login;
  user.lastMsg = now;
  user.isSub = badges.includes('subscriber/') || badges.includes('founder/') || tags['subscriber'] === '1';
  user.isMod = tags['mod'] === '1' || badges.includes('moderator/');
  user.isVip = badges.includes('vip/') || tags['vip'] === '1';
  user.isBroadcaster = badges.includes('broadcaster/');

  // Кодовое слово: засчитываем только во время сбора
  if (collecting && settings.keyword &&
      text.toLowerCase().includes(settings.keyword.toLowerCase())) {
    user.keywordAt = now;
  }

  users.set(login, user);
  addFeedLine(user, text);
  refreshAll();
}

// ============================================================
// Отбор участников по фильтрам
// ============================================================
function customExcludeSet() {
  return new Set(
    settings.exCustom.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
}

// Исключения и сапка — общие для всех режимов набора.
// ignoreManualExcluded нужен окну ручного набора: убранного крестиком
// должно быть видно, иначе его уже не вернуть.
function passesCommonFilters(u, customEx, ignoreManualExcluded) {
  if (!ignoreManualExcluded && manualExcluded.has(u.login)) return false;
  if (settings.exBroadcaster && (u.isBroadcaster || u.login === joinedChannel)) return false;
  if (settings.exMods && u.isMod) return false;
  if (settings.exVips && u.isVip) return false;
  if (settings.exBots && KNOWN_BOTS.includes(u.login)) return false;
  if (customEx.has(u.login)) return false;

  if (settings.subFilter === 'nosub' && u.isSub) return false;
  if (settings.subFilter === 'sub' && !u.isSub) return false;
  return true;
}

function isEligible(u, customEx) {
  if (!passesCommonFilters(u, customEx, false)) return false;

  if (settings.mode === 'keyword') {
    if (!collectStart || u.keywordAt < collectStart) return false;
  } else if (settings.mode === 'manual') {
    if (!manualPicked.has(u.login)) return false;
  } else {
    if (settings.windowMin > 0 &&
        Date.now() - u.lastMsg > settings.windowMin * 60 * 1000) return false;
  }
  return true;
}

function computeEligible() {
  const customEx = customExcludeSet();
  const list = [];
  users.forEach(u => { if (isEligible(u, customEx)) list.push(u); });
  list.sort((a, b) => a.login.localeCompare(b.login));
  return list;
}

function refreshAll() {
  renderParticipants();
  updateManualSummary();
  if (isPickerOpen()) renderPicker();
  if (isSpinning) { pendingRefresh = true; return; }
  // В режиме выбывания состав колеса заморожен — чат его не меняет
  if (eliminationMode) { updateStats(); return; }
  wheelList = computeEligible();
  renderWheel();
  updateStats();
}

// Активность истекает сама по себе — обновляем раз в 5 секунд
setInterval(() => { if (!isSpinning) refreshAll(); }, 5000);

// ============================================================
// Рендер списка участников и ленты чата
// ============================================================
function badgeStr(u) {
  let s = '';
  if (u.isBroadcaster) s += `<span title="Стример" style="color:#F38787">${icon('video')}</span>`;
  if (u.isMod) s += `<span title="Модератор" style="color:#97C459">${icon('shield')}</span>`;
  if (u.isVip) s += `<span title="VIP" style="color:#E58CC0">${icon('gem')}</span>`;
  if (u.isSub) s += `<span title="Подписчик" style="color:#C5A9F8">${icon('star', 'ic--fill')}</span>`;
  return s;
}

function renderParticipants() {
  const box = document.getElementById('participants');
  const eligible = computeEligible();
  document.getElementById('p-count').textContent = eligible.length;
  document.getElementById('seen-count').textContent = 'видели в чате: ' + users.size;

  if (eligible.length === 0) {
    box.innerHTML = '<div class="p-empty">' +
      (users.size === 0 ? 'Подключись к чату — участники появятся сами'
                        : 'Никто не проходит по фильтрам') + '</div>';
    return;
  }

  box.innerHTML = eligible.map((u, i) => `
    <div class="p-row">
      <span class="p-color" style="background:${SECTOR_COLORS[i % SECTOR_COLORS.length]}"></span>
      <span class="p-nick">${esc(u.name)}</span>
      <span class="p-badges">${badgeStr(u)}</span>
      <span class="p-ago">${agoText(u.lastMsg)}</span>
      <button class="p-remove" data-login="${esc(u.login)}" title="Исключить">✕</button>
    </div>
  `).join('');

  box.querySelectorAll('.p-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      // В ручном наборе крестик просто снимает выбор, в остальных режимах — исключает из пула
      if (settings.mode === 'manual') manualPicked.delete(btn.dataset.login);
      else manualExcluded.add(btn.dataset.login);
      refreshAll();
    });
  });
}

// ============================================================
// Ручной набор: окно со всеми, кого видели в чате
// ============================================================
function isPickerOpen() {
  return document.getElementById('picker-overlay').classList.contains('show');
}

// Кого показываем в окне: общие фильтры + своё окно активности + поиск
function pickerCandidates() {
  const customEx = customExcludeSet();
  const q = (document.getElementById('picker-search').value || '').trim().toLowerCase();
  const win = settings.manualWindowMin;
  const list = [];
  users.forEach(u => {
    if (!passesCommonFilters(u, customEx, true)) return;
    if (win > 0 && Date.now() - u.lastMsg > win * 60 * 1000) return;
    if (q && !u.name.toLowerCase().includes(q) && !u.login.includes(q)) return;
    list.push(u);
  });
  list.sort((a, b) => a.login.localeCompare(b.login));
  return list;
}

function renderPicker() {
  const box = document.getElementById('picker-list');
  const list = pickerCandidates();

  document.getElementById('picker-count').innerHTML =
    'Выбрано: <b>' + manualPicked.size + '</b> · в списке: ' + list.length + ' из ' + users.size;

  if (list.length === 0) {
    box.innerHTML = '<div class="picker-empty">' + (users.size === 0
      ? 'Подключись к чату — сюда попадут все, кто напишет хоть раз'
      : 'Под поиск и фильтры никто не подходит') + '</div>';
    return;
  }

  // Чат идёт своим чередом и перерисовывает список — держим прокрутку на месте
  const scroll = box.scrollTop;
  box.innerHTML = list.map(u => `
    <button class="pick-row${manualPicked.has(u.login) ? ' picked' : ''}" data-login="${esc(u.login)}">
      <span class="pick-mark">${manualPicked.has(u.login) ? '✓' : '+'}</span>
      <span class="pick-nick">${esc(u.name)}</span>
      <span class="pick-badges">${badgeStr(u)}</span>
      <span class="pick-ago">${agoText(u.lastMsg)}</span>
    </button>
  `).join('');
  box.scrollTop = scroll;

  box.querySelectorAll('.pick-row').forEach(btn => {
    btn.addEventListener('click', () => toggleManual(btn.dataset.login));
  });
}

function toggleManual(login) {
  if (manualPicked.has(login)) {
    manualPicked.delete(login);
  } else {
    manualPicked.add(login);
    manualExcluded.delete(login);   // выбрали заново — снимаем прежний крестик
  }
  refreshAll();
}

function updateManualSummary() {
  document.getElementById('manual-summary').innerHTML = manualPicked.size === 0
    ? 'Пока никого не выбрано'
    : 'Выбрано: <b>' + manualPicked.size + '</b>';
}

function openPicker() {
  document.getElementById('picker-overlay').classList.add('show');
  renderPicker();
  document.getElementById('picker-search').focus();
}
function closePicker() {
  document.getElementById('picker-overlay').classList.remove('show');
}

document.getElementById('btn-manual-open').addEventListener('click', openPicker);
document.getElementById('picker-close').addEventListener('click', closePicker);
document.getElementById('picker-done').addEventListener('click', closePicker);
document.getElementById('picker-overlay').addEventListener('click', e => {
  if (e.target.id === 'picker-overlay') closePicker();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isPickerOpen()) closePicker(); });
document.getElementById('picker-search').addEventListener('input', renderPicker);

document.getElementById('picker-all').addEventListener('click', () => {
  pickerCandidates().forEach(u => { manualPicked.add(u.login); manualExcluded.delete(u.login); });
  refreshAll();
});
document.getElementById('picker-none').addEventListener('click', () => {
  manualPicked.clear();
  refreshAll();
});

document.querySelectorAll('#manual-window-group .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#manual-window-group .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.manualWindowMin = parseInt(btn.dataset.min, 10);
    saveSettings();
    renderPicker();
  });
});

const FEED_MAX = 60;
function addFeedLine(user, text) {
  if (!feedVisible) return;
  const feed = document.getElementById('chat-feed');
  const div = document.createElement('div');
  const customEx = customExcludeSet();
  div.className = 'chat-line' + (isEligible(user, customEx) ? ' eligible-msg' : '');
  div.innerHTML = `<span class="cn">${esc(user.name)}:</span> ${esc(text)}`;
  feed.appendChild(div);
  while (feed.children.length > FEED_MAX) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;
}

// ============================================================
// Звук: щелчки стрелки — wheel-kit.js, фанфары — свои
// ============================================================
// Щелчок стрелки — на выбор (Дерево / Мягкий / Шарик / Выкл), общий
// для всех рулеток: wheel-kit.js. «Выкл» глушит и фанфары.
const playClick = () => WheelKit.sound.click();

function playFanfare() {
  if (!WheelKit.sound.enabled()) return;
  const audioCtx = WheelKit.sound.ensure();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const notes = [
    { f: 261.63, t: 0.00, dur: 0.18 },
    { f: 329.63, t: 0.18, dur: 0.18 },
    { f: 392.00, t: 0.36, dur: 0.18 },
    { f: 523.25, t: 0.54, dur: 0.40 },
    { f: 659.25, t: 1.00, dur: 0.20 },
    { f: 783.99, t: 1.20, dur: 0.20 },
    { f: 1046.5, t: 1.45, dur: 0.80 },
  ];
  notes.forEach(n => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(n.f, t0 + n.t);
    gain.gain.setValueAtTime(0, t0 + n.t);
    gain.gain.linearRampToValueAtTime(0.12, t0 + n.t + 0.02);
    gain.gain.linearRampToValueAtTime(0.10, t0 + n.t + n.dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.t + n.dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0 + n.t); osc.stop(t0 + n.t + n.dur + 0.05);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(n.f / 2, t0 + n.t);
    gain2.gain.setValueAtTime(0, t0 + n.t);
    gain2.gain.linearRampToValueAtTime(0.06, t0 + n.t + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, t0 + n.t + n.dur);
    osc2.connect(gain2); gain2.connect(audioCtx.destination);
    osc2.start(t0 + n.t); osc2.stop(t0 + n.t + n.dur + 0.05);
  });
  const chordStart = t0 + 1.45;
  [523.25, 659.25, 783.99, 1046.5].forEach(f => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, chordStart);
    gain.gain.setValueAtTime(0, chordStart);
    gain.gain.linearRampToValueAtTime(0.05, chordStart + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.0);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(chordStart); osc.stop(chordStart + 1.05);
  });
}

// ============================================================
// Колесо (равные доли — один зритель, один шанс)
//
// Когда участников мало, каждый получает несколько тонких кусочков
// вперемешку: шансы те же, но по замедлению колеса не предугадать,
// кто выпадет. Логика из picker.html.
// ============================================================
const SPLIT_BELOW = 10;
const MIN_SLICE_ANGLE = 4;
const MAX_PARTS = 6;   // шире сектор — больше влезает в подпись

function computeSegments() {
  const n = wheelList.length;
  if (n === 0) return [];
  const share = 360 / n;                       // все участники равны

  const shares = wheelList.map((u, i) => ({ user: u, userIndex: i, angle: share }));
  const splitOn = n > 1 && n < SPLIT_BELOW;
  shares.forEach(s => {
    s.parts = splitOn ? Math.max(1, Math.min(MAX_PARTS, Math.floor(s.angle / MIN_SLICE_ANGLE))) : 1;
  });

  const ordered = [];
  shares.forEach((s, i) => {
    const offset = (i * 0.37) % 1;
    for (let j = 0; j < s.parts; j++) {
      ordered.push({ user: s.user, userIndex: s.userIndex, angle: s.angle / s.parts, key: (j + offset) / s.parts });
    }
  });
  ordered.sort((a, b) => a.key - b.key);

  let cumulative = 0;
  return ordered.map(s => {
    const startAngle = cumulative;
    cumulative += s.angle;
    return {
      user: s.user, userIndex: s.userIndex, angle: s.angle,
      startAngle: startAngle, endAngle: cumulative,
      midAngle: startAngle + s.angle / 2,
    };
  });
}

// Колесо целиком (обод, штырьки, блик, ступица) собирает wheel-kit.js
const WHEEL_R = WheelKit.WHEEL_R;

function renderWheel() {
  const svg = document.getElementById('wheel');
  if (wheelList.length === 0) {
    labelCache = [];
    currentSegments = [];
    svg.innerHTML = `<text x="50" y="50" text-anchor="middle" dominant-baseline="middle"
                      fill="rgba(255,255,255,0.4)" font-size="5">Нет участников</text>`;
    return;
  }

  const segments = computeSegments();
  currentSegments = segments;
  liveRotation = currentRotation;
  let groupContent = '';
  const kit = WheelKit.builder();
  const cx = 50, cy = 50, r = WHEEL_R;

  if (segments.length === 1) {
    const u = segments[0].user;
    groupContent = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${kit.fill(SECTOR_COLORS[0])}"/>
      <text x="${cx}" y="${cy - 10}" fill="#0a0e1a" font-size="5" text-anchor="middle"
        style="font-weight: 700;">${esc(u.name)}</text>`;
  } else {
    segments.forEach(seg => {
      // Цвет закреплён за участником: его кусочки узнаваемы, а соседние
      // всегда принадлежат разным людям
      let color = SECTOR_COLORS[seg.userIndex % SECTOR_COLORS.length];
      // Чтобы первый и последний участник не слились цветом
      if (seg.userIndex === wheelList.length - 1 && wheelList.length > 2 &&
          color === SECTOR_COLORS[0]) {
        color = SECTOR_COLORS[1];
      }
      groupContent += `<path d="${sectorPath(cx, cy, r, seg.startAngle, seg.endAngle)}" fill="${kit.fill(color)}" stroke="rgba(255,255,255,0.32)" stroke-width="0.18" data-user="${seg.userIndex}"/>`;

      if (seg.angle >= 2) {
        // Подпись по радиусу от края к центру, как в picker.html
        const textRadius = r * 0.86;
        const rad = (seg.midAngle - 90) * Math.PI / 180;
        const tx = cx + Math.cos(rad) * textRadius;
        const ty = cy + Math.sin(rad) * textRadius;
        const baseRot = seg.midAngle - 90;
        const fontSize = Math.min(2.7, Math.max(1.45, seg.angle * 0.4));
        groupContent += `<text x="${tx}" y="${ty}" fill="#0a0e1a" font-size="${fontSize}"
          data-base="${baseRot.toFixed(3)}" data-tx="${tx.toFixed(3)}" data-ty="${ty.toFixed(3)}"
          data-angle="${seg.angle.toFixed(4)}" data-full="${esc(seg.user.name)}"
          text-anchor="end" dominant-baseline="middle"
          transform="rotate(${baseRot} ${tx} ${ty})"
          style="paint-order: stroke; stroke: rgba(255,255,255,0.6); stroke-width: 0.5;
                 font-weight: 700; pointer-events: none;">${esc(seg.user.name)}</text>`;
      }
    });
  }

  svg.innerHTML = kit.frame({
    content: groupContent,
    boundaries: segments.length > 1 ? segments.map(s => s.startAngle) : [],
    rotation: currentRotation,
    hubIcon: 'wheel',
  });
  labelCache = svg.querySelectorAll('#wheel-group text[data-base]');
  fitLabels();
  updateLabelOrientation(currentRotation);
}

// Подгонка длины подписей: сектор сужается к центру, поэтому меряем
// реальную длину строки через getComputedTextLength() и подрезаем
// двоичным поиском (по числу символов нельзя — кириллица и латиница
// разной ширины). Логика из picker.html.
function fitLabels() {
  const textR = WHEEL_R * 0.86;
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

    // В скрытой вкладке браузер не размечает SVG и возвращает 0 —
    // оцениваем по числу символов (≈0.65 кегля на символ)
    if (!measured) {
      const maxChars = Math.max(3, Math.floor(maxLen / (fs * 0.65)));
      if (full.length > maxChars) el.textContent = full.slice(0, maxChars - 1).trimEnd() + '…';
      continue;
    }
    if (measured <= maxLen) continue;

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

function sectorPath(cx, cy, r, startAngle, endAngle) {
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;
  const x1 = cx + Math.cos(startRad) * r;
  const y1 = cy + Math.sin(startRad) * r;
  const x2 = cx + Math.cos(endRad) * r;
  const y2 = cy + Math.sin(endRad) * r;
  const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

// ============================================================
// Розыгрыш
// ============================================================
function pickWinnerIndex() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % wheelList.length;
}

const POINTER_ANGLE = 90;   // стрелка справа: ник победителя горизонтален

// final — последняя крутка авто-выбывания (двое на колесе), см. WheelKit.finalSpin
async function spin(callback, dur = duration, final = false) {
  if (isSpinning) return;
  if (wheelList.length === 0) return;
  if (wheelList.length === 1) {
    if (callback) await callback(0);
    return;
  }

  isSpinning = true;
  setControlsDisabled(true);

  const segments = currentSegments.length ? currentSegments : computeSegments();
  const winnerIdx = pickWinnerIndex();

  if (final && wheelList.length === 2) {
    // Финал: без замедления, резкий тормоз, а иногда и проскальзывание — wheel-kit.js
    currentRotation = await WheelKit.finalSpin({
      group: document.getElementById('wheel-group'),
      segments, keyOf: s => s.userIndex, target: winnerIdx,
      startRot: currentRotation, pointer: POINTER_ANGLE,
      onRotate: r => { liveRotation = r; updateLabelOrientation(r); },
      onTick: triggerTick,
      onStop: () => wheelFx.burst(),
    });
  } else {
    // У победителя может быть несколько кусочков — останавливаемся на случайном
    const slices = segments.filter(s => s.userIndex === winnerIdx);
    let chosen = slices[0];
    if (slices.length > 1) {
      const p = new Uint32Array(1); crypto.getRandomValues(p);
      chosen = slices[p[0] % slices.length];
    }
    if (!chosen) { isSpinning = false; setControlsDisabled(false); return; }

    let baseTarget = POINTER_ANGLE - chosen.midAngle;
    const minRotations = 4;
    let currentNormalized = ((currentRotation % 360) + 360) % 360;
    let targetNormalized = ((baseTarget % 360) + 360) % 360;
    let delta = targetNormalized - currentNormalized;
    if (delta < 0) delta += 360;
    const finalRotation = currentRotation + minRotations * 360 + delta;
    const startRotation = currentRotation;
    currentRotation = finalRotation;

    const group = document.getElementById('wheel').querySelector('#wheel-group');
    group.style.transition = `transform ${dur}s cubic-bezier(0.17, 0.67, 0.2, 1)`;
    group.style.transform = `rotate(${finalRotation}deg)`;

    await trackPointerTicks(startRotation, finalRotation, dur, segments);
    liveRotation = finalRotation;
    updateLabelOrientation(finalRotation);
    await new Promise(resolve => setTimeout(resolve, 100));
    wheelFx.burst();
  }

  // Результат применяем до разблокировки кнопок: вспышка вылетающего
  // участника идёт ещё полсекунды, и новая крутка в это время сломала бы выбывание
  if (callback) await callback(winnerIdx);
  isSpinning = false;
  setControlsDisabled(false);
  if (pendingRefresh) { pendingRefresh = false; }
}

// Стрелка и блёстки «в масле» вокруг колеса — wheel-kit.js
const wheelFx = WheelKit.mount({
  area: document.querySelector('.wheel-area'),
  getRotation: () => liveRotation,
  isSpinning: () => isSpinning,
});

function cubicBezier(x1, y1, x2, y2, t) {
  const inv = 1 - t;
  const t2 = t * t, t3 = t2 * t;
  return 3 * inv * inv * t * y1 + 3 * inv * t2 * y2 + t3;
}
function cubicBezierX(x1, x2, t) {
  const inv = 1 - t;
  const t2 = t * t, t3 = t2 * t;
  return 3 * inv * inv * t * x1 + 3 * inv * t2 * x2 + t3;
}
function easeOutBezier(t) {
  const x1 = 0.17, x2 = 0.2;
  let low = 0, high = 1, mid = t;
  for (let i = 0; i < 20; i++) {
    const x = cubicBezierX(x1, x2, mid);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) low = mid; else high = mid;
    mid = (low + high) / 2;
  }
  return cubicBezier(x1, 0.67, x2, 1, mid);
}
function normalizeAngle(angle) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
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
  let lastPointerOnWheel = normalizeAngle(POINTER_ANGLE - startRot);
  const decreasing = totalDelta > 0;

  return new Promise(resolve => {
    function frame(now) {
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(elapsed / dur, 1);
      const eased = easeOutBezier(t);
      const currentRot = startRot + totalDelta * eased;
      liveRotation = currentRot;
      updateLabelOrientation(currentRot);
      const pointerOnWheel = normalizeAngle(POINTER_ANGLE - currentRot);
      for (const boundary of boundaries) {
        if (boundaryCrossed(lastPointerOnWheel, pointerOnWheel, boundary, decreasing)) {
          triggerTick();
        }
      }
      lastPointerOnWheel = pointerOnWheel;
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function triggerTick() {
  const pointer = document.getElementById('wheel-pointer');
  pointer.classList.remove('ticking');
  void pointer.offsetWidth;
  pointer.classList.add('ticking');
  playClick();
}

// В авто-режиме всё, кроме кнопки «Стоп», заблокировано и между крутками
function setControlsDisabled(disabled) {
  const lock = disabled || autoRunning;
  document.getElementById('btn-single').disabled = lock;
  document.getElementById('btn-elim').disabled = lock;
  document.getElementById('btn-reset').disabled = lock;
  document.querySelectorAll('.duration-btn[data-dur]').forEach(b => b.disabled = lock);
  document.getElementById('btn-auto').disabled = autoRunning ? false : disabled;
}

// ============================================================
// Победитель
// ============================================================
let lastWinner = null;

function showWinner(user) {
  lastWinner = user;
  const avatar = document.getElementById('winner-avatar');
  avatar.textContent = initials(user.name);
  document.getElementById('winner-nick').textContent = user.name;
  document.getElementById('winner-sub').innerHTML =
    user.isSub ? icon('star', 'ic--fill') + ' С подпиской' : 'Без подписки';
  document.getElementById('winner-overlay').classList.add('show');
  launchConfetti();
  playFanfare();
}

function hideWinner() {
  document.getElementById('winner-overlay').classList.remove('show');
  stopConfetti();
  refreshAll();
}
document.getElementById('winner-close-btn').addEventListener('click', hideWinner);
document.getElementById('winner-remove-btn').addEventListener('click', () => {
  if (lastWinner) manualExcluded.add(lastWinner.login);
  hideWinner();
});

function launchConfetti() {
  const container = document.getElementById('confetti');
  container.classList.add('active');
  container.innerHTML = '';
  const goldColors = ['#FAC775', '#FFD700', '#FFE194', '#F0B370', '#FFCC33', '#FFFFFF'];
  const shapes = ['rect', 'circle', 'star'];
  for (let i = 0; i < 120; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const color = goldColors[Math.floor(Math.random() * goldColors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = 8 + Math.random() * 10;
    const drift = (Math.random() - 0.5) * 400;
    const dur = 3 + Math.random() * 2.5;
    const delay = Math.random() * 0.6;
    piece.style.left = (Math.random() * 100) + 'vw';
    piece.style.width = size + 'px';
    piece.style.height = size + 'px';
    piece.style.backgroundColor = color;
    piece.style.boxShadow = `0 0 ${size}px ${color}`;
    piece.style.setProperty('--drift', drift + 'px');
    piece.style.animationDuration = dur + 's';
    piece.style.animationDelay = delay + 's';
    if (shape === 'circle') piece.style.borderRadius = '50%';
    else if (shape === 'star') {
      piece.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    }
    container.appendChild(piece);
  }
  setTimeout(() => {
    if (container.classList.contains('active')) container.innerHTML = '';
  }, 6000);
}
function stopConfetti() {
  const container = document.getElementById('confetti');
  container.classList.remove('active');
  container.innerHTML = '';
}

// place — занятое место: кто выбыл первым из 20, тот на 20-м месте
function addLogEntry(text, isWinner, place) {
  logEntries.push({ text, isWinner, place });
  renderLog();
}

function renderLog() {
  const logEl = document.getElementById('log');
  const entries = document.getElementById('log-entries');
  if (logEntries.length === 0) {
    entries.innerHTML = '<div class="p-empty">Крути колесо — выбывшие появятся здесь</div>';
    logEl.classList.remove('has-entries');
    return;
  }
  // Новые записи сверху
  entries.innerHTML = logEntries.map(e => `
    <div class="log-entry${e.isWinner ? ' winner' : ''}">
      <span class="num">${e.isWinner ? icon('trophy') : '#' + e.place}</span>${esc(e.text)}
    </div>
  `).reverse().join('');
  logEl.classList.add('has-entries');
  entries.scrollTop = 0;
}

// Правая колонка: настройки или история. Каждая прокрутка на выбывание
// разворачивает историю, кнопка в её заголовке переключает панели вручную
function setSidePanel(mode) {
  const inHistory = mode === 'history';
  document.getElementById('layout').classList.toggle('history-view', inHistory);
  document.getElementById('history-toggle').innerHTML =
    icon('sliders') + (inHistory ? ' показать настройки' : ' скрыть настройки');
}
document.getElementById('history-toggle').addEventListener('click', () => {
  const inHistory = document.getElementById('layout').classList.contains('history-view');
  setSidePanel(inHistory ? 'settings' : 'history');
});

function updateStats() {
  const el = document.getElementById('app-stats');
  if (!wsWanted) { el.textContent = 'Не подключено'; return; }
  el.textContent = `На колесе: ${wheelList.length}  •  Видели в чате: ${users.size}`;
}

// ============================================================
// Привязка UI
// ============================================================
function updateConnectButton() {
  document.getElementById('btn-connect').textContent = wsWanted ? 'Отключить' : 'Подключить';
}

document.getElementById('btn-connect').addEventListener('click', () => {
  if (wsWanted) disconnect(); else connect();
});
document.getElementById('channel-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { if (wsWanted) disconnect(); connect(); }
});

// Режим набора
document.querySelectorAll('#mode-group .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#mode-group .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.mode = btn.dataset.mode;
    saveSettings();
    showModeBlocks();
    refreshAll();
    // Переключились на ручной набор — сразу открываем окно выбора
    if (settings.mode === 'manual') openPicker();
  });
});

function showModeBlocks() {
  document.getElementById('activity-block').style.display = settings.mode === 'activity' ? '' : 'none';
  document.getElementById('keyword-block').style.display = settings.mode === 'keyword' ? '' : 'none';
  document.getElementById('manual-block').style.display = settings.mode === 'manual' ? '' : 'none';
}

// Окно активности
document.querySelectorAll('#window-group .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#window-group .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.windowMin = parseInt(btn.dataset.min, 10);
    saveSettings();
    refreshAll();
  });
});

// Кодовое слово
document.getElementById('keyword-input').addEventListener('input', e => {
  settings.keyword = e.target.value.trim();
  saveSettings();
});
document.getElementById('btn-collect').addEventListener('click', () => {
  const btn = document.getElementById('btn-collect');
  const banner = document.getElementById('collect-banner');
  if (!collecting) {
    collecting = true;
    collectStart = Date.now();
    // Новый сбор — старые отметки слова не считаются (keywordAt < collectStart)
    btn.textContent = 'Стоп';
    btn.classList.remove('primary');
    btn.classList.add('danger');
    banner.classList.add('on');
    banner.textContent = 'Идёт сбор — пишите «' + settings.keyword + '» в чат!';
  } else {
    collecting = false;
    btn.textContent = 'Начать сбор';
    btn.classList.add('primary');
    btn.classList.remove('danger');
    banner.classList.remove('on');
  }
  refreshAll();
});

// Фильтр подписки
document.querySelectorAll('#sub-group .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sub-group .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.subFilter = btn.dataset.sub;
    saveSettings();
    refreshAll();
  });
});

// Чекбоксы
[['ex-mods','exMods'],['ex-vips','exVips'],['ex-bots','exBots'],['ex-broadcaster','exBroadcaster']]
.forEach(([id, key]) => {
  document.getElementById(id).addEventListener('change', e => {
    settings[key] = e.target.checked;
    saveSettings();
    refreshAll();
  });
});

// Свой список исключений
document.getElementById('ex-custom').addEventListener('input', e => {
  settings.exCustom = e.target.value;
  saveSettings();
  refreshAll();
});

// Лента чата
document.getElementById('feed-toggle').addEventListener('click', () => {
  feedVisible = !feedVisible;
  document.getElementById('chat-feed').style.display = feedVisible ? '' : 'none';
  document.getElementById('feed-toggle').textContent = feedVisible ? 'скрыть' : 'показать';
});

// Длительность и звук
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

WheelKit.sound.bind(document.querySelector('.sound-group'));

function exitElimination() {
  eliminationMode = false;
  document.getElementById('btn-elim').innerHTML = icon('swords') + ' Режим выбывания';
  document.getElementById('layout').classList.remove('elim-active');
}

// Один победитель
document.getElementById('btn-single').addEventListener('click', () => {
  if (eliminationMode) {
    if (!confirm('Активен режим выбывания. Прервать его и крутить одиночный розыгрыш?')) return;
    exitElimination();
  }
  wheelList = computeEligible();
  renderWheel();
  updateStats();
  if (wheelList.length === 0) return;
  spin(winnerIdx => {
    const winner = wheelList[winnerIdx];
    addLogEntry(winner.name + (winner.isSub ? ' · саб' : ''), true);
    showWinner(winner);
  });
});

// Режим выбывания: состав фиксируется в момент старта,
// новые сообщения из чата колесо уже не меняют
function startElimination() {
  if (eliminationMode) return true;
  wheelList = computeEligible();
  if (wheelList.length < 2) return false;
  eliminationMode = true;
  renderWheel();
  updateStats();
  document.getElementById('layout').classList.add('elim-active');
  document.getElementById('btn-elim').innerHTML = icon('swords') + ' Крутить (выбывание)';
  return true;
}

function finishElimination() {
  const winner = wheelList[0];
  addLogEntry('ПОБЕДИТЕЛЬ: ' + winner.name + (winner.isSub ? ' · саб' : ''), true);
  exitElimination();
  showWinner(winner);
}

// Выпавший участник вспыхивает и вылетает; когда остаётся один — он победитель
async function eliminateAt(idx) {
  if (wheelList.length === 1) { finishElimination(); return; }
  await WheelKit.flash(`path[data-user="${idx}"]`);
  const out = wheelList[idx];
  addLogEntry('Выбыл: ' + out.name, false, wheelList.length);
  wheelList.splice(idx, 1);
  renderWheel();
  updateStats();
  if (wheelList.length === 1) {
    // Пауза перед объявлением: кнопки заперты (крутка ещё «идёт»),
    // чтобы лишний клик не записал победителя дважды
    await new Promise(r => setTimeout(r, 700));
    finishElimination();
  }
}

document.getElementById('btn-elim').addEventListener('click', () => {
  if (!startElimination()) return;
  // На время прокрутки настройки не нужны — справа история выбывших
  setSidePanel('history');
  spin(eliminateAt, duration, WheelKit.finalInManual());
});

// ------------------------------------------------------------
// Авто-выбывание: колесо само крутит и выкидывает по одному.
// Темп (3с → 5с → 10с → особый финал) — WheelKit.AUTO_PHASES.
// ------------------------------------------------------------
let autoWake = null;          // прерывает паузу между крутками при «Стоп»
let manualDuration = duration;

function autoPause(sec) {
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
  if (!startElimination()) return;
  setSidePanel('history');
  autoRunning = true;
  manualDuration = duration;
  const btn = document.getElementById('btn-auto');
  btn.classList.add('running');
  btn.innerHTML = icon('stop') + ' Стоп авто';
  setControlsDisabled(false);

  let first = true;
  while (autoRunning && eliminationMode && wheelList.length > 1) {
    const ph = WheelKit.autoPhase(wheelList.length);
    if (!first) {
      await autoPause(ph.pause);
      if (!autoRunning || !eliminationMode) break;
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
}

document.getElementById('btn-auto').addEventListener('click', () => {
  if (autoRunning) {
    // Идущая крутка доедет и выкинет своего участника, дальше — ручной режим
    stopAuto();
    if (isSpinning) document.getElementById('btn-auto').innerHTML = icon('stop') + ' Остановится после крутки';
    return;
  }
  if (isSpinning) return;
  runAuto();
});

// Сброс: вернуть исключённых, прервать выбывание, очистить историю
document.getElementById('btn-reset').addEventListener('click', () => {
  if (manualExcluded.size === 0 && logEntries.length === 0 && !eliminationMode) return;
  if (!confirm('Сбросить розыгрыш? Вернутся исключённые, прервётся выбывание, очистится история.')) return;
  manualExcluded.clear();
  logEntries = [];
  renderLog();
  exitElimination();
  setSidePanel('settings');
  refreshAll();
});

// ============================================================
// Инициализация из настроек
// ============================================================
function initFromSettings() {
  document.getElementById('channel-input').value = settings.channel || siteProfile.channel;
  document.getElementById('keyword-input').value = settings.keyword || 'хочу';
  document.getElementById('ex-custom').value = settings.exCustom || '';
  document.getElementById('ex-mods').checked = settings.exMods;
  document.getElementById('ex-vips').checked = settings.exVips;
  document.getElementById('ex-bots').checked = settings.exBots;
  document.getElementById('ex-broadcaster').checked = settings.exBroadcaster;

  document.querySelectorAll('#mode-group .seg-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === settings.mode));
  showModeBlocks();
  updateManualSummary();

  document.querySelectorAll('#window-group .seg-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.min, 10) === settings.windowMin));

  document.querySelectorAll('#manual-window-group .seg-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.min, 10) === settings.manualWindowMin));

  document.querySelectorAll('#sub-group .seg-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sub === settings.subFilter));

  renderWheel();
}

initFromSettings();

// Вход: код стримера или токен GitHub (github.js → siteGit.gate)
function unlock() {
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('layout').classList.add('unlocked');
}
siteGit.gate(unlock);
