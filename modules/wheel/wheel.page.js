// Код страницы wheel.html (раздел wheel). Подключается из wheel.html.
// ============================================================
// Разбор билетов и зрителей (parseCSV — в core.js)
// ============================================================

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
      const viewerKey = nick.toLowerCase();
      const viewer = viewersMap[viewerKey] || {};
      return {
        nick:   nick,
        avatar: viewer.avatar || '',
        silver: silver,
        gold:   gold,
        score:  gold * 5 + silver,
      };
    })
    .filter(t => t.score > 0);
}

function rowsToViewers(rows) {
  if (rows.length < 2) return {};
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const nickIdx = headers.indexOf('nick');
  const avatarIdx = headers.indexOf('avatar_url');
  const steamIdx = headers.indexOf('steam_nick');
  if (nickIdx < 0) return {};
  const map = {};
  rows.slice(1).forEach(r => {
    if (r.length > 0 && r[nickIdx] && r[nickIdx].trim()) {
      const nick = r[nickIdx].trim();
      map[nick.toLowerCase()] = {
        nick: nick,
        avatar: avatarIdx >= 0 ? (r[avatarIdx] || '').trim() : '',
        steam:  steamIdx  >= 0 ? (r[steamIdx]  || '').trim() : '',
      };
    }
  });
  return map;
}

function initials(nick) {
  const clean = nick.replace(/[^A-Za-zА-Яа-я0-9]/g, '');
  if (clean.length >= 2) return (clean[0] + clean[1]).toUpperCase();
  return (clean[0] || '?').toUpperCase();
}

// ============================================================
// Состояние
// ============================================================
let allTickets = [];
let activeTickets = [];
let viewersMap = {};
let currentRotation = 0;
let isSpinning = false;
let duration = 5;
let eliminationMode = false;
let log = [];
let soundOn = true;

const SECTOR_COLORS = [
  '#7F77DD', '#FAC775', '#D85A30', '#97C459',
  '#5BA9E5', '#E599C2', '#B58FF5', '#F0B370',
  '#86D7C9', '#E58686', '#9CB870', '#5B7FE5'
];

// ============================================================
// Web Audio: клики, фанфары
// ============================================================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}

// Короткий механический клик (стрелка прошла грань сектора)
function playClick() {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // Короткий шумовой "tick" + высокий пик
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(now); osc.stop(now + 0.08);
}

// Развёрнутая мини-мелодия победителя (~3 секунды)
function playFanfare() {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;

  // C-мажор: C, E, G, C, E, G, C (верхний)
  // Триумфальный мотив: восходящий аккорд → задержка → высокий триумф
  const notes = [
    { f: 261.63, t: 0.00, dur: 0.18 }, // C4
    { f: 329.63, t: 0.18, dur: 0.18 }, // E4
    { f: 392.00, t: 0.36, dur: 0.18 }, // G4
    { f: 523.25, t: 0.54, dur: 0.40 }, // C5 — длинная
    { f: 659.25, t: 1.00, dur: 0.20 }, // E5
    { f: 783.99, t: 1.20, dur: 0.20 }, // G5
    { f: 1046.5, t: 1.45, dur: 0.80 }, // C6 — финальная триумфальная
  ];

  notes.forEach(n => {
    // Основной тон
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

    // Октава ниже для "богатства" звука
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

  // Финальный "сияющий" аккорд из C-мажора + блёстки
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

const soundBtn = document.getElementById('sound-toggle');
function updateSoundButton() {
  if (soundOn) {
    soundBtn.classList.remove('off');
    soundBtn.innerHTML = icon('volume') + ' Звук вкл.';
  } else {
    soundBtn.classList.add('off');
    soundBtn.innerHTML = icon('volume-off') + ' Звук выкл.';
  }
}
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  if (soundOn) ensureAudio();
  updateSoundButton();
});
updateSoundButton();
document.addEventListener('click', () => { if (soundOn) ensureAudio(); }, { once: true });

// ============================================================
// Загрузка
// ============================================================
async function loadData() {
  try {
    const [ticketsRes, viewersRes] = await Promise.all([
      siteData.fetch(TICKETS_CSV_URL),
      siteData.fetch(VIEWERS_CSV_URL),
    ]);
    if (!ticketsRes.ok) throw new Error('Tickets HTTP ' + ticketsRes.status);
    // viewers — опционально, ошибку игнорируем
    let viewersRows = [];
    if (viewersRes.ok) viewersRows = parseCSV(await viewersRes.text());

    const ticketsRows = parseCSV(await ticketsRes.text());

    viewersMap = rowsToViewers(viewersRows);
    allTickets = rowsToTickets(ticketsRows, viewersMap);
    return true;
  } catch (err) {
    document.getElementById('gate-error').textContent = 'Ошибка загрузки: ' + err.message;
    return false;
  }
}

// Вход: код стримера или токен GitHub (github.js → siteGit.gate). Сначала грузим билеты.
let dataLoaded = false;

function unlock() {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  activeTickets = [...allTickets];
  renderWheel();
  updateStats();
}
siteGit.gate(async () => {
  if (!dataLoaded) {
    if (!(await loadData())) return false;
    dataLoaded = true;
  }
  unlock();
});

// ============================================================
// Расчёт углов секторов
// Возвращает массив { ticket, startAngle, endAngle, midAngle, angle }
// ============================================================
function computeSegments() {
  const totalScore = activeTickets.reduce((s, t) => s + t.score, 0);
  if (totalScore === 0) return [];
  const MIN_ANGLE = 1.5;
  let segments = activeTickets.map(t => ({
    ticket: t,
    angle: (t.score / totalScore) * 360,
  }));
  const tooThin = segments.filter(s => s.angle < MIN_ANGLE);
  if (tooThin.length > 0 && tooThin.length < segments.length) {
    const deficit = tooThin.reduce((sum, s) => sum + (MIN_ANGLE - s.angle), 0);
    const big = segments.filter(s => s.angle >= MIN_ANGLE);
    const bigTotal = big.reduce((sum, s) => sum + s.angle, 0);
    big.forEach(s => { s.angle -= (s.angle / bigTotal) * deficit; });
    tooThin.forEach(s => { s.angle = MIN_ANGLE; });
  }
  let cumulative = 0;
  return segments.map(s => {
    const startAngle = cumulative;
    cumulative += s.angle;
    const endAngle = cumulative;
    return {
      ticket: s.ticket,
      angle: s.angle,
      startAngle: startAngle,
      endAngle: endAngle,
      midAngle: (startAngle + endAngle) / 2,
    };
  });
}

// ============================================================
// Рендер колеса
// ============================================================
function renderWheel() {
  const svg = document.getElementById('wheel');
  if (activeTickets.length === 0) {
    svg.innerHTML = `<text x="50" y="50" text-anchor="middle" dominant-baseline="middle"
                      fill="rgba(255,255,255,0.4)" font-size="6">Нет участников</text>`;
    return;
  }

  const segments = computeSegments();
  if (segments.length === 0) return;

  let groupContent = '';
  const cx = 50, cy = 50, r = 48;

  segments.forEach((seg, i) => {
    const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
    const path = sectorPath(cx, cy, r, seg.startAngle, seg.endAngle);

    const textRadius = r * 0.65;
    const textRad = (seg.midAngle - 90) * Math.PI / 180;
    const tx = cx + Math.cos(textRad) * textRadius;
    const ty = cy + Math.sin(textRad) * textRadius;
    const fontSize = Math.min(3.5, Math.max(1.4, seg.angle / 8));
    let displayNick = seg.ticket.nick;
    const maxChars = Math.max(4, Math.floor(seg.angle / 1.5));
    if (displayNick.length > maxChars) displayNick = displayNick.substring(0, maxChars - 1) + '…';
    const showText = seg.angle >= 2;

    groupContent += `<path d="${path}" fill="${color}" stroke="#0a0e1a" stroke-width="0.2"/>`;
    if (showText) {
      groupContent += `<text x="${tx}" y="${ty}" fill="#fff" font-size="${fontSize}"
                       text-anchor="middle" dominant-baseline="middle"
                       transform="rotate(${seg.midAngle} ${tx} ${ty})"
                       style="text-shadow: 0 1px 2px rgba(0,0,0,0.8); pointer-events: none;">${esc(displayNick)}</text>`;
    }
  });

  svg.innerHTML = `
    <g id="wheel-group" style="transform-origin: 50% 50%; transform: rotate(${currentRotation}deg); transition: none;">
      ${groupContent}
    </g>
    <circle cx="50" cy="50" r="6" fill="#0a0e1a" stroke="#FAC775" stroke-width="0.5"/>
  `;
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
// Логика розыгрыша
// ============================================================
function pickWinnerIndex() {
  const total = activeTickets.reduce((s, t) => s + t.score, 0);
  if (total === 0) return -1;
  // Криптографически стойкий рандом вместо Math.random()
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const rand = (buf[0] / 0x100000000) * total;
  let acc = 0;
  for (let i = 0; i < activeTickets.length; i++) {
    acc += activeTickets[i].score;
    if (rand < acc) return i;
  }
  return activeTickets.length - 1;
}

// Стрелка указывает ВНИЗ из верхней позиции = угол 0° (12 часов в нашей системе координат)
const POINTER_ANGLE = 0;

async function spin(callback) {
  if (isSpinning) return;
  if (activeTickets.length === 0) return;
  if (activeTickets.length === 1) {
    if (callback) callback(0);
    return;
  }

  isSpinning = true;
  setControlsDisabled(true);

  const segments = computeSegments();
  const winnerIdx = pickWinnerIndex();
  const targetCenterAngle = segments[winnerIdx].midAngle;

  // Хотим: (targetCenterAngle + R) % 360 === POINTER_ANGLE (== 0)
  let baseTarget = POINTER_ANGLE - targetCenterAngle;
  const minRotations = 4;
  let currentNormalized = ((currentRotation % 360) + 360) % 360;
  let targetNormalized = ((baseTarget % 360) + 360) % 360;
  let delta = targetNormalized - currentNormalized;
  if (delta < 0) delta += 360;
  const finalRotation = currentRotation + minRotations * 360 + delta;
  const startRotation = currentRotation;
  currentRotation = finalRotation;

  // Запускаем CSS-анимацию
  const group = document.getElementById('wheel').querySelector('#wheel-group');
  group.style.transition = `transform ${duration}s cubic-bezier(0.17, 0.67, 0.2, 1)`;
  group.style.transform = `rotate(${finalRotation}deg)`;

  // Параллельно отслеживаем пересечения границ секторов через requestAnimationFrame.
  // Используем ту же ease-out функцию для расчёта текущего угла.
  await trackPointerTicks(startRotation, finalRotation, duration, segments);

  await new Promise(resolve => setTimeout(resolve, 100)); // небольшая пауза
  isSpinning = false;
  setControlsDisabled(false);
  if (callback) callback(winnerIdx);
}

// Точное вычисление cubic-bezier(0.17, 0.67, 0.2, 1)
function cubicBezier(x1, y1, x2, y2, t) {
  const inv = 1 - t;
  const t2 = t * t;
  const t3 = t2 * t;
  return 3 * inv * inv * t * y1 + 3 * inv * t2 * y2 + t3;
}

function cubicBezierX(x1, x2, t) {
  const inv = 1 - t;
  const t2 = t * t;
  const t3 = t2 * t;
  return 3 * inv * inv * t * x1 + 3 * inv * t2 * x2 + t3;
}

function easeOutBezier(t) {
  const x1 = 0.17;
  const y1 = 0.67;
  const x2 = 0.2;
  const y2 = 1;
  let low = 0;
  let high = 1;
  let mid = t;

  for (let i = 0; i < 20; i++) {
    const x = cubicBezierX(x1, x2, mid);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) low = mid;
    else high = mid;
    mid = (low + high) / 2;
  }

  return cubicBezier(x1, y1, x2, y2, mid);
}

function normalizeAngle(angle) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function boundaryCrossed(prev, next, boundary, decreasing) {
  if (decreasing) {
    if (prev >= next) {
      return next < boundary && boundary <= prev;
    }
    return boundary > next || boundary <= prev;
  }
  if (next >= prev) {
    return prev < boundary && boundary <= next;
  }
  return boundary > prev || boundary <= next;
}

async function trackPointerTicks(startRot, endRot, dur, segments) {
  const startTime = performance.now();
  const totalDelta = endRot - startRot;
  const pointer = document.getElementById('wheel-pointer');
  const boundaries = segments.map(s => normalizeAngle(s.startAngle));
  let lastPointerOnWheel = normalizeAngle(POINTER_ANGLE - startRot);
  const decreasing = totalDelta > 0;

  return new Promise(resolve => {
    function frame(now) {
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(elapsed / dur, 1);
      const eased = easeOutBezier(t);
      const currentRot = startRot + totalDelta * eased;
      const pointerOnWheel = normalizeAngle(POINTER_ANGLE - currentRot);

      for (const boundary of boundaries) {
        if (boundaryCrossed(lastPointerOnWheel, pointerOnWheel, boundary, decreasing)) {
          triggerTick();
        }
      }

      lastPointerOnWheel = pointerOnWheel;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function triggerTick() {
  const pointer = document.getElementById('wheel-pointer');
  // Перезапускаем анимацию
  pointer.classList.remove('ticking');
  void pointer.offsetWidth; // принудительный reflow
  pointer.classList.add('ticking');
  playClick();
}

function setControlsDisabled(disabled) {
  document.getElementById('btn-single').disabled = disabled;
  document.getElementById('btn-elim').disabled = disabled;
  document.getElementById('btn-reset').disabled = disabled;
  document.getElementById('btn-reload').disabled = disabled;
  document.querySelectorAll('.duration-btn').forEach(b => b.disabled = disabled);
}

// ============================================================
// Победитель (с конфетти и фанфарами)
// ============================================================
function showWinner(ticket) {
  const overlay = document.getElementById('winner-overlay');
  const avatar = document.getElementById('winner-avatar');
  if (ticket.avatar) {
    avatar.style.backgroundImage = `url('${ticket.avatar}')`;
    avatar.textContent = '';
  } else {
    avatar.style.backgroundImage = '';
    avatar.textContent = initials(ticket.nick);
  }
  document.getElementById('winner-nick').textContent = ticket.nick;
  const parts = [];
  if (ticket.silver > 0) parts.push(`<span style="color:#D8D8E0">${icon('ticket')} ${ticket.silver}</span>`);
  if (ticket.gold > 0) parts.push(`<span style="color:#FAC775">${icon('ticket')} ${ticket.gold}</span>`);
  document.getElementById('winner-tickets').innerHTML = parts.join('&emsp;');
  overlay.classList.add('show');

  // Конфетти + фанфары
  launchConfetti();
  playFanfare();
}

function hideWinner() {
  document.getElementById('winner-overlay').classList.remove('show');
  stopConfetti();
}
document.getElementById('winner-close-btn').addEventListener('click', hideWinner);

// Конфетти — золотые блёстки
function launchConfetti() {
  const container = document.getElementById('confetti');
  container.classList.add('active');
  container.innerHTML = '';

  // Палитра золотых оттенков
  const goldColors = ['#FAC775', '#FFD700', '#FFE194', '#F0B370', '#FFCC33', '#FFFFFF'];
  const shapes = ['rect', 'circle', 'star'];
  const numPieces = 120;

  for (let i = 0; i < numPieces; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const color = goldColors[Math.floor(Math.random() * goldColors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = 8 + Math.random() * 10;
    const drift = (Math.random() - 0.5) * 400; // px горизонтального дрифта
    const duration = 3 + Math.random() * 2.5; // секунды
    const delay = Math.random() * 0.6;

    piece.style.left = (Math.random() * 100) + 'vw';
    piece.style.width = size + 'px';
    piece.style.height = size + 'px';
    piece.style.backgroundColor = color;
    piece.style.boxShadow = `0 0 ${size}px ${color}`;
    piece.style.setProperty('--drift', drift + 'px');
    piece.style.animationDuration = duration + 's';
    piece.style.animationDelay = delay + 's';

    if (shape === 'circle') piece.style.borderRadius = '50%';
    else if (shape === 'star') {
      piece.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    }

    container.appendChild(piece);
  }

  // Авто-остановка через 6 секунд (всё к этому моменту упадёт за экран)
  setTimeout(() => {
    if (container.classList.contains('active')) {
      container.innerHTML = '';
    }
  }, 6000);
}

function stopConfetti() {
  const container = document.getElementById('confetti');
  container.classList.remove('active');
  container.innerHTML = '';
}

function addLogEntry(text, isWinner) {
  log.push({ text, isWinner });
  const logEl = document.getElementById('log');
  const entries = document.getElementById('log-entries');
  entries.innerHTML = log.map((e, i) => `
    <div class="log-entry${e.isWinner ? ' winner' : ''}">
      <span class="num">${e.isWinner ? icon('trophy') : '#' + (i + 1)}</span>${esc(e.text)}
    </div>
  `).join('');
  logEl.classList.add('has-entries');
  entries.scrollTop = entries.scrollHeight;
}

function updateStats() {
  const total = activeTickets.length;
  const totalScore = activeTickets.reduce((s, t) => s + t.score, 0);
  document.getElementById('app-stats').textContent =
    `Участников: ${total}  •  Всего билетов: ${totalScore}`;
  document.getElementById('elim-remaining').textContent = total;
}

// ============================================================
// Кнопки
// ============================================================
document.querySelectorAll('.duration-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    duration = parseInt(btn.dataset.dur, 10);
  });
});

document.getElementById('btn-single').addEventListener('click', () => {
  if (eliminationMode) {
    if (!confirm('Активен режим выбывания. Прервать его и крутить одиночный розыгрыш?')) return;
    eliminationMode = false;
    document.getElementById('elimination-status').classList.remove('active');
    document.getElementById('btn-elim').innerHTML = icon('swords') + ' Режим выбывания';
  }
  spin((winnerIdx) => {
    const winner = activeTickets[winnerIdx];
    addLogEntry(winner.nick + ' (' + winner.score + ' билетов)', true);
    showWinner(winner);
  });
});

document.getElementById('btn-elim').addEventListener('click', () => {
  if (!eliminationMode) {
    eliminationMode = true;
    document.getElementById('elimination-status').classList.add('active');
    document.getElementById('btn-elim').innerHTML = icon('swords') + ' Крутить (выбывание)';
  }
  spin((eliminatedIdx) => {
    const eliminated = activeTickets[eliminatedIdx];
    if (activeTickets.length === 1) {
      const winner = activeTickets[0];
      addLogEntry('ПОБЕДИТЕЛЬ: ' + winner.nick + ' (' + winner.score + ' билетов)', true);
      showWinner(winner);
      eliminationMode = false;
      document.getElementById('elimination-status').classList.remove('active');
      document.getElementById('btn-elim').innerHTML = icon('swords') + ' Режим выбывания';
      return;
    }
    addLogEntry('Выбыл: ' + eliminated.nick + ' (' + eliminated.score + ' билетов)', false);
    activeTickets.splice(eliminatedIdx, 1);
    updateStats();
    renderWheel();
    if (activeTickets.length === 1) {
      setTimeout(() => {
        const winner = activeTickets[0];
        addLogEntry('ПОБЕДИТЕЛЬ: ' + winner.nick + ' (' + winner.score + ' билетов)', true);
        showWinner(winner);
        eliminationMode = false;
        document.getElementById('elimination-status').classList.remove('active');
        document.getElementById('btn-elim').innerHTML = icon('swords') + ' Режим выбывания';
      }, 700);
    }
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Сбросить розыгрыш? Все выбывшие вернутся, лог очистится.')) return;
  activeTickets = [...allTickets];
  log = [];
  document.getElementById('log-entries').innerHTML = '';
  document.getElementById('log').classList.remove('has-entries');
  eliminationMode = false;
  document.getElementById('elimination-status').classList.remove('active');
  document.getElementById('btn-elim').innerHTML = icon('swords') + ' Режим выбывания';
  currentRotation = 0;
  const group = document.getElementById('wheel').querySelector('#wheel-group');
  if (group) {
    group.style.transition = 'none';
    group.style.transform = 'rotate(0deg)';
  }
  hideWinner();
  renderWheel();
  updateStats();
});

document.getElementById('btn-reload').addEventListener('click', async () => {
  const btn = document.getElementById('btn-reload');
  btn.disabled = true;
  btn.innerHTML = icon('hourglass') + ' Загрузка...';
  const ok = await loadData();
  if (ok) {
    activeTickets = [...allTickets];
    log = [];
    document.getElementById('log-entries').innerHTML = '';
    document.getElementById('log').classList.remove('has-entries');
    eliminationMode = false;
    document.getElementById('elimination-status').classList.remove('active');
    document.getElementById('btn-elim').innerHTML = icon('swords') + ' Режим выбывания';
    currentRotation = 0;
    const group = document.getElementById('wheel').querySelector('#wheel-group');
    if (group) {
      group.style.transition = 'none';
      group.style.transform = 'rotate(0deg)';
    }
    renderWheel();
    updateStats();
  }
  btn.disabled = false;
  btn.innerHTML = icon('refresh') + ' Перезагрузить билеты';
});
