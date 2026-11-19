'use strict';
// Рулетка боли: колесо игр + колесо времени, одна кнопка крутит оба.
// Игры — колонка name в data/pain.json (правится на admin.html, вкладка «Боль»), обложки и подписи — pain-meta.json.
// Колёса рисует wheel-kit.js (как у рулетки заказов), цвета — бордовые.
const MINUTES = Object.freeze([60, 240, 480]);
const PAIN_DATA = 'data/pain.json';
const POINTER_ANGLE = 90;   // стрелка справа
const GAME_COLORS = ['#a3263c', '#6e1828', '#c23b52', '#561222', '#b02f46', '#7f1d31', '#cf4d66', '#651627'];
const TIME_COLORS = ['#a3263c', '#651627', '#c23b52'];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const key = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
let games = [], meta = {}, busy = false, loading = false;

function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Незакрытая кавычка в списке игр.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// Повторы и пустые строки пропускаем — у каждой уникальной игры равный шанс
function readGames(text) {
  const rows = parseCSV(text);
  const head = (rows[0] || []).map(h => h.trim());
  if (!['name', 'Название игры'].includes(head[0])) throw new Error('В data/pain.json нет колонки name.');
  const col = k => head.indexOf(k);
  const qi = col('quip'), oi = col('override');
  const seen = new Set(), list = [];
  for (const row of rows.slice(1)) {
    const name = (row[0] || '').trim().replace(/\s+/g, ' ');
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    list.push({name, quip: qi >= 0 ? (row[qi] || '').trim() : '', override: oi >= 0 ? (row[oi] || '').trim() : ''});
  }
  return list;
}
const coverOf = g => { const m = meta[key(g.name)] || {}; return m.cover || m.header || (/^https?:\/\//i.test(g.override) ? g.override : ''); };
const quipOf = g => g.quip || (meta[key(g.name)] || {}).quip || '';

function randomIndex(count) {
  // Без перекоса по модулю, даже если число вариантов не степень двойки
  const bound = Math.floor(4294967296 / count) * count;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= bound);
  return value[0] % count;
}
function formatTime(n) {
  if (n % 60) return `${n} мин`;
  const h = n / 60, tail = h % 100;
  const word = tail >= 11 && tail <= 14 ? 'часов' : h % 10 === 1 ? 'час' : h % 10 >= 2 && h % 10 <= 4 ? 'часа' : 'часов';
  return `${h} ${word}`;
}

// ============================================================
// Колесо на wheel-kit. Колёс на странице два, поэтому всё ищем внутри своего <svg>.
// ============================================================
const normalizeAngle = a => { const n = a % 360; return n < 0 ? n + 360 : n; };
function cubicBezier(y1, y2, t) { const inv = 1 - t, t2 = t * t; return 3 * inv * inv * t * y1 + 3 * inv * t2 * y2 + t2 * t; }
function easeOut(t) {   // та же кривая, что в CSS: cubic-bezier(0.17, 0.67, 0.2, 1)
  let low = 0, high = 1, mid = t;
  for (let i = 0; i < 20; i++) {
    const x = cubicBezier(0.17, 0.2, mid);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) low = mid; else high = mid;
    mid = (low + high) / 2;
  }
  return cubicBezier(0.67, 1, mid);
}
function crossed(prev, next, b) {   // колесо идёт по часовой — угол под стрелкой убывает
  if (prev >= next) return next < b && b <= prev;
  return b > next || b <= prev;
}
function sectorPath(r, a0, a1) {
  const s = (a0 - 90) * Math.PI / 180, e = (a1 - 90) * Math.PI / 180;
  return `M 50 50 L ${50 + Math.cos(s) * r} ${50 + Math.sin(s) * r} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${50 + Math.cos(e) * r} ${50 + Math.sin(e) * r} Z`;
}

function makeWheel({svg, area, colors, hubIcon, maxFont = 2.7}) {
  const w = {rotation: 0, live: 0, spinning: false, segments: [], labels: []};
  const pointer = area.querySelector('.wheel-pointer');
  const fx = WheelKit.mount({area, getRotation: () => w.live, isSpinning: () => w.spinning});

  function orient(rot) {
    for (const el of w.labels) {
      const base = +el.dataset.base;
      const flipped = normalizeAngle(base + rot) > 90 && normalizeAngle(base + rot) < 270 ? '1' : '0';
      if (el.dataset.flipped === flipped) continue;
      el.dataset.flipped = flipped;
      el.setAttribute('transform', `rotate(${flipped === '1' ? base + 180 : base} ${el.dataset.tx} ${el.dataset.ty})`);
      el.setAttribute('text-anchor', flipped === '1' ? 'start' : 'end');
    }
  }
  // Подпись идёт по радиусу, а сектор к центру сужается — подрезаем по реальной длине строки
  function fit() {
    const textR = WheelKit.WHEEL_R * 0.86;
    for (const el of w.labels) {
      const angle = +el.dataset.angle, fs = +el.getAttribute('font-size'), full = el.dataset.full;
      const maxLen = Math.max(3, textR - Math.max(10, (fs * 1.15) / (angle * 0.017453)));
      el.textContent = full;
      const measured = el.getComputedTextLength();
      if (!measured) {   // скрытая вкладка — мерить нечем, оцениваем по числу букв
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
  w.render = labels => {
    if (!labels.length) { svg.innerHTML = ''; w.segments = []; w.labels = []; return; }
    const kit = WheelKit.builder(), r = WheelKit.WHEEL_R, step = 360 / labels.length;
    w.segments = labels.map((label, i) => ({label, start: i * step, mid: (i + 0.5) * step, angle: step}));
    let content = '';
    w.segments.forEach((seg, i) => {
      // При нечётном числе первый и последний сектор соседи — сдвигаем цвет, чтобы не слились
      const color = colors[(i === labels.length - 1 && i % colors.length === 0 && i) ? 1 : i % colors.length];
      content += `<path d="${sectorPath(r, seg.start, seg.start + step)}" fill="${kit.fill(color)}" stroke="rgba(255,220,226,0.28)" stroke-width="0.18"/>`;
      const tr = r * 0.86, rad = (seg.mid - 90) * Math.PI / 180;
      const tx = 50 + Math.cos(rad) * tr, ty = 50 + Math.sin(rad) * tr, base = seg.mid - 90;
      const fs = Math.min(maxFont, Math.max(1.45, step * 0.4));
      content += `<text x="${tx}" y="${ty}" fill="#fff" font-size="${fs}" data-base="${base.toFixed(3)}" data-tx="${tx.toFixed(3)}"
        data-ty="${ty.toFixed(3)}" data-angle="${step.toFixed(4)}" data-full="${esc(seg.label)}" text-anchor="end" dominant-baseline="middle"
        transform="rotate(${base} ${tx} ${ty})" style="paint-order: stroke; stroke: rgba(30,0,10,0.6); stroke-width: 0.45; font-weight: 700; pointer-events: none;">${esc(seg.label)}</text>`;
    });
    svg.innerHTML = kit.frame({content, boundaries: w.segments.map(s => s.start), rotation: w.rotation, hubIcon});
    w.labels = [...svg.querySelectorAll('text[data-base]')];
    fit();
    orient(w.rotation);
  };
  w.spin = (index, seconds) => new Promise(resolve => {
    const seg = w.segments[index], group = svg.querySelector('#wheel-group');
    const cur = normalizeAngle(w.rotation), tgt = normalizeAngle(POINTER_ANGLE - seg.mid);
    let delta = tgt - cur; if (delta < 0) delta += 360;
    const from = w.rotation, to = w.rotation + 5 * 360 + delta;
    w.rotation = to; w.spinning = true;
    group.style.transition = `transform ${seconds}s cubic-bezier(0.17, 0.67, 0.2, 1)`;
    group.style.transform = `rotate(${to}deg)`;
    const bounds = w.segments.map(s => normalizeAngle(s.start)), t0 = performance.now();
    let last = normalizeAngle(POINTER_ANGLE - from), done = false;
    // Кадры могут не идти (вкладка за другим окном) — тогда крутку завершает таймер
    const finish = () => { if (done) return; done = true; w.spinning = false; w.live = to; orient(to); fx.burst(); resolve(); };
    setTimeout(finish, seconds * 1000 + 250);
    (function frame(now) {
      if (done) return;
      const t = Math.min((now - t0) / 1000 / seconds, 1);
      const rot = from + (to - from) * easeOut(t);
      w.live = rot; orient(rot);
      const onWheel = normalizeAngle(POINTER_ANGLE - rot);
      if (bounds.some(b => crossed(last, onWheel, b))) {
        pointer.classList.remove('ticking'); void pointer.offsetWidth; pointer.classList.add('ticking');
        WheelKit.sound.click();
      }
      last = onWheel;
      if (t < 1) requestAnimationFrame(frame); else finish();
    })(t0);
  });
  return w;
}

const gameWheel = makeWheel({svg: $('game-wheel'), area: $('game-area'), colors: GAME_COLORS, hubIcon: 'flame'});
const timeWheel = makeWheel({svg: $('time-wheel'), area: $('time-area'), colors: TIME_COLORS, hubIcon: 'hourglass', maxFont: 4.2});
WheelKit.sound.bind(document.querySelector('.sound-group'));


// ============================================================
// Мост донатов (pain-bridge на ПК стримера): копилки, крутки, таймер.
// Есть мост — крутить можно только оплаченную крутку, результат пишется в мост, таймер ставит он.
// Добавку времени по #время мост крутит сам, пока идёт таймер, — страница её показывает.
// Нет моста (страница открыта не на ПК стримера) — крутка как раньше, без учёта донатов.
// ============================================================
const BRIDGE = (() => {
  const b = new URLSearchParams(location.search).get('bridge') || '';
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(b) ? b : 'http://127.0.0.1:3777';
})();
const live = {s: null, at: 0, skew: 0, online: null, lastSpin: null, queue: [], playing: false};
const timerLeft = () => { const s = live.s; return s ? Math.max(0, s.timer.remainingMs - (s.timer.running ? performance.now() - live.at : 0)) : 0; };
const revealing = () => !!(live.s && live.s.spin && Date.now() - live.skew < live.s.spin.revealAt);
const clock = ms => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const rub = n => Number(n).toLocaleString('ru-RU', {maximumFractionDigits: 2}) + ' ₽';
function bridgePost(path) {
  return fetch(BRIDGE + path, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Pain-Bridge': '1'}, body: '{}'})
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Мост ответил ' + r.status); return j; },
      () => { throw new Error('Мост не отвечает.'); });
}
function listenBridge() {
  let es;
  try { es = new EventSource(BRIDGE + '/api/events'); } catch (_) { live.online = false; paintBridge(); return; }
  es.onerror = () => { live.online = false; paintBridge(); controls(); };
  es.onmessage = e => {
    const s = JSON.parse(e.data), first = !live.s;
    live.s = s; live.at = performance.now(); live.skew = Date.now() - s.now; live.online = true;
    const spin = s.spin;
    if (spin && spin.id !== live.lastSpin) {
      live.lastSpin = spin.id;
      // Свежую крутку проигрываем; ту, что была до открытия страницы, — только показываем итог
      if (revealing()) { live.queue.push(spin); playQueue(); }
      else if (first) showSpinStatic(spin);
    }
    paintBridge(); renderLog(); controls();
  };
}

function paintBridge() {
  const on = live.online === true && !!live.s;
  $('bank-panel').hidden = !on;
  $('bridge-dot').classList.toggle('on', on);
  if (!on) { $('timer-box').hidden = true; return; }
  const s = live.s, c = s.config;
  $('pain-sum').textContent = `${rub(s.painBank)} / ${rub(c.painPrice)}`;
  $('time-sum').textContent = `${rub(s.timeBank)} / ${rub(c.timePrice)}`;
  $('pain-bar').style.width = Math.min(100, s.painBank / c.painPrice * 100) + '%';
  $('time-bar').style.width = Math.min(100, s.timeBank / c.timePrice * 100) + '%';
  $('pain-cred').innerHTML = `Оплачено круток: <b class="${s.painCredits ? 'on' : ''}">${s.painCredits}</b>`;
  $('time-cred').innerHTML = `Оплачено добавок: <b class="${s.timeCredits ? 'on' : ''}">${s.timeCredits}</b>` +
    (s.timeCredits && !s.timer.running ? ' · прокрутятся после «Старт»' : '');
  tickTimer();
}
function tickTimer() {
  const s = live.s;
  if (!live.online || !s) return;
  const box = $('timer-box'), hide = revealing() || live.playing, left = timerLeft();
  box.hidden = !s.game;
  box.classList.toggle('running', s.timer.running && !hide);
  $('timer-game').textContent = hide ? 'Крутим…' : s.game ? s.game.name : '';
  $('timer-clock').textContent = hide ? '?:??:??' : clock(left);
  $('timer-state').textContent = hide ? '' : s.timer.running ? 'идёт' : left > 0 ? 'на паузе' : 'отыграно';
}
setInterval(() => { tickTimer(); if (live.online) { controls(); renderLog(); } }, 500);

// ============================================================
// Список, пул, история
// ============================================================
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function spinBlock() {   // почему нельзя крутить через мост (пусто — можно)
  const s = live.s;
  if (revealing() || live.playing) return 'Рулетка крутится…';
  if (!s.painCredits) return `Ждём ${rub(s.config.painPrice)} с меткой ${s.config.painTag}: копилка ${rub(s.painBank)}`;
  if (timerLeft() > 0) return `Крутка оплачена, но сначала доиграй «${s.game ? s.game.name : ''}»`;
  return '';
}
function controls() {
  const bridge = live.online === true && live.s;
  const block = bridge ? spinBlock() : '';
  $('spin').disabled = busy || loading || !games.length || !!block;
  $('spin-label').textContent = bridge && live.s.painCredits > 1 ? `Крутить боль · ${live.s.painCredits}` : 'Крутить боль';
  // Кровь в кнопке: доля копилки #боль, оплаченная крутка — до краёв
  const paid = !!(bridge && live.s.painCredits > 0);
  const fill = bridge ? (paid ? 100 : Math.min(100, live.s.painBank / live.s.config.painPrice * 100)) : 0;
  $('spin').style.setProperty('--blood', fill > 0 ? `calc(${fill.toFixed(1)}% + 7px)` : '0px');
  $('spin').classList.toggle('is-paid', paid);
  $('spin').title = bridge ? `Копилка ${live.s.config.painTag}: ${rub(live.s.painBank)} из ${rub(live.s.config.painPrice)}` : '';
  $('refresh').disabled = busy || loading;
  if (busy || loading || live.playing) return;
  if (!games.length) return;
  if (bridge) status(block || 'Крутка оплачена! Жми, когда все смотрят.');
  else if (live.online === false) status('Мост донатов не отвечает — крутка без учёта донатов.');
}
function renderPool() {
  const q = key($('pool-search').value);
  const shown = games.filter(g => !q || key(g.name).includes(q));
  $('pool-list').innerHTML = shown.map(g => {
    const cover = coverOf(g);
    return `<li title="${esc(g.name)}"><span class="pool-ava"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : esc([...g.name][0].toUpperCase())}</span><span class="pool-name">${esc(g.name)}</span></li>`;
  }).join('') || `<li class="pool-empty">${games.length ? 'Такой игры в пуле нет' : 'Пул пока пуст'}</li>`;
}
const formatCount = n => { const t = n % 100, d = n % 10; return t >= 11 && t <= 14 ? 'игр' : d === 1 ? 'игра' : d >= 2 && d <= 4 ? 'игры' : 'игр'; };
function renderGames() {
  gameWheel.render(games.map(g => g.name));
  $('game-empty').hidden = !!games.length;
  $('game-empty').textContent = 'Пул пока пуст — добавь игры в админке, вкладка «Боль»';
  $('top-stats').innerHTML = games.length
    ? `<b>${games.length}</b> ${formatCount(games.length)} в пуле · <b>1 000 ₽</b> с меткой #боль — крутка`
    : 'Пул пока пуст';
  renderPool();
}
const localHistory = [];
function renderLog() {
  // С мостом — его история (крутки, добавки, «отыграно»), без моста — крутки этой вкладки
  // Пока колесо крутится, свежую запись моста не показываем — иначе спойлер
  const hideFrom = (revealing() || live.playing) && live.s && live.s.spin ? live.s.spin.at : Infinity;
  const list = live.online && live.s ? live.s.history.filter(h => h.at < hideFrom).slice(0, 15).map(h => h.text) : localHistory.map(h => `${h.game} — ${h.time}`);
  $('log').innerHTML = list.length ? list.map((t, i) => `<div class="log-entry${i === 0 ? ' latest' : ''}">${esc(t)}</div>`).join('')
    : '<div class="log-empty">Пока ничего не крутили</div>';
}

async function load() {
  if (busy || loading) return;
  loading = true; controls(); status('Загружаем список…');
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const [res, m] = await Promise.all([
      siteData.fetch(PAIN_DATA, {signal: ctrl.signal}),
      fetch('pain-meta.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    if (!res.ok) throw new Error(`Список игр недоступен (HTTP ${res.status}).`);
    games = readGames(await res.text());
    meta = (m && m.games) || {};
    renderGames();
    if (!games.length) status('Пул пока пуст. Добавь игры в админке и нажми «Обновить».', true);
    else status('Всё готово.');
  } catch (error) {
    // Не даём крутить по старому списку, если обновить не вышло
    games = []; renderGames();
    status((error.name === 'AbortError' ? 'Сайт не ответил вовремя.' : error.message) + ' Нажми «Обновить», чтобы повторить.', true);
  } finally { clearTimeout(timer); loading = false; controls(); }
}

// ============================================================
// Крутка
// ============================================================
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = ms => new Promise(r => setTimeout(r, ms));
async function onSpinClick() {
  if (busy || loading || !games.length) return;
  WheelKit.sound.ensure();
  if (live.online && live.s) {
    // Решает мост: он вычтет крутку и поставит таймер, а анимацию пришлёт всем открытым страницам
    busy = true; controls();
    try { await bridgePost('/api/spin/game'); }
    catch (error) { status(error.message, true); }
    finally { busy = false; controls(); }
    return;
  }
  // Без моста: крутим здесь же
  busy = true; controls();
  try {
    const g = randomIndex(games.length), t = randomIndex(MINUTES.length);
    await playGame(games, g, MINUTES, t);
    localHistory.unshift({game: games[g].name, time: formatTime(MINUTES[t])});
    if (localHistory.length > 30) localHistory.length = 30;
    renderLog();
    showWinner({label: 'Боль назначена', game: games[g], title: games[g].name, chip: formatTime(MINUTES[t])});
    status('Приговор вынесен. Следующий донат — новая крутка.');
  } catch (error) {
    console.error(error); status('Не удалось докрутить. Попробуй ещё раз.', true);
  } finally { busy = false; controls(); }
}
// Игра, пауза, время. list — игры колеса (объекты с name), options — минуты колеса времени
async function playGame(list, g, options, t) {
  $('time-result').textContent = 'Сначала выберем игру'; $('time-result').classList.add('result--wait');
  status('Выбираем твою боль…');
  await gameWheel.spin(g, reduced() ? 0.4 : 6);
  status(`Игра: ${list[g].name}. Теперь — сколько терпеть.`);
  await pause(reduced() ? 100 : 900);
  timeWheel.render(options.map(formatTime));
  $('time-result').textContent = 'Сколько терпеть?..';
  await timeWheel.spin(t, reduced() ? 0.4 : 4.5);
  $('time-result').textContent = formatTime(options[t]); $('time-result').classList.remove('result--wait');
}
// Крутки из моста проигрываем по очереди
async function playQueue() {
  if (live.playing) return;
  live.playing = true; controls();
  try {
    while (live.queue.length) {
      const spin = live.queue.shift();
      hideWinner();
      if (spin.kind === 'game') {
        // Колесо — ровно тот список, по которому крутил мост
        if (spin.games.join('\n') !== games.map(g => g.name).join('\n')) {
          games = spin.games.map(name => games.find(g => key(g.name) === key(name)) || {name, quip: '', override: ''});
          renderGames();
        }
        await playGame(games, spin.gameIndex, spin.options, spin.timeIndex);
        status('Приговор вынесен. Таймер ждёт «Старт».');
        showWinner({label: 'Боль назначена', game: games[spin.gameIndex], title: spin.game, chip: formatTime(spin.minutes)}, stream() ? 15000 : 0);
      } else {
        timeWheel.render(spin.options.map(formatTime));
        status(`Додеп! Докидываем время к «${spin.game}»`);
        $('time-result').textContent = 'Сколько докинуть?..'; $('time-result').classList.add('result--wait');
        await timeWheel.spin(spin.timeIndex, reduced() ? 0.4 : 4.5);
        $('time-result').textContent = '+' + formatTime(spin.minutes); $('time-result').classList.remove('result--wait');
        const game = games.find(g => key(g.name) === key(spin.game)) || {name: spin.game, quip: '', override: ''};
        showWinner({label: spin.auto ? 'Додеп по донату' : 'Додеп принят', game, title: '+' + formatTime(spin.minutes), chip: `к «${spin.game}»`, noQuip: true}, 7000);
        status('Время добавлено.');
      }
    }
  } catch (error) { console.error(error); }
  finally { live.playing = false; controls(); renderLog(); }
}
// Открыли страницу после крутки — ставим колёса на последний итог без анимации
function showSpinStatic(spin) {
  timeWheel.render(spin.options.map(formatTime));
  timeWheel.rotation = normalizeAngle(POINTER_ANGLE - timeWheel.segments[spin.timeIndex].mid);
  timeWheel.render(spin.options.map(formatTime));
  $('time-result').textContent = (spin.kind === 'time' ? '+' : '') + formatTime(spin.minutes);
  $('time-result').classList.remove('result--wait');
}

let winnerTimer = 0;
function showWinner({label, game, title, chip, noQuip}, autoHideMs = 0) {
  $('winner-label').textContent = `✦ ${label} ✦`;
  $('winner-title').textContent = title;
  $('winner-time').textContent = chip;
  const quip = noQuip ? '' : quipOf(game);
  $('winner-quip').hidden = !quip; $('winner-quip').textContent = quip;
  const cover = $('winner-cover'), url = coverOf(game);
  cover.classList.remove('show'); cover.removeAttribute('src');
  if (url) { cover.onload = () => cover.classList.add('show'); cover.onerror = () => cover.classList.remove('show'); cover.src = url; }
  $('winner-overlay').classList.add('show');
  if (!stream()) $('winner-close').focus();
  confetti();
  fanfare();
  clearTimeout(winnerTimer);
  if (autoHideMs) winnerTimer = setTimeout(hideWinner, autoHideMs);
}
function hideWinner() { clearTimeout(winnerTimer); $('winner-overlay').classList.remove('show'); }
function confetti() {
  const box = $('confetti');
  box.innerHTML = ''; box.classList.add('active');
  const colors = ['#E8697C', '#a3263c', '#ffd6dc', '#FAC775', '#7a1428', '#ffffff'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.borderRadius = Math.random() < 0.4 ? '50%' : '2px';
    p.style.setProperty('--drift', (Math.random() * 200 - 100) + 'px');
    p.style.animationDuration = 2.2 + Math.random() * 2 + 's';
    p.style.animationDelay = Math.random() * 0.6 + 's';
    box.appendChild(p);
  }
  setTimeout(() => { box.classList.remove('active'); box.innerHTML = ''; }, 5200);
}
// Мрачные фанфары: минор вниз и удар
function fanfare() {
  if (!WheelKit.sound.enabled()) return;
  const ctx = WheelKit.sound.ensure(); if (!ctx) return;
  const t0 = ctx.currentTime;
  [[392, 0, 0.22], [311.13, 0.22, 0.22], [261.63, 0.44, 0.22], [196, 0.7, 0.9], [130.81, 0.7, 1.1]].forEach(([f, t, d]) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0 + t);
    gain.gain.setValueAtTime(0, t0 + t);
    gain.gain.linearRampToValueAtTime(0.13, t0 + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0 + t); osc.stop(t0 + t + d + 0.05);
  });
}

const stream = () => document.body.classList.contains('stream-mode');
function setStream(on) {
  document.body.classList.toggle('stream-mode', on);
  $('stream').setAttribute('aria-pressed', String(on));
  $('stream').lastChild.textContent = on ? 'Обычный режим' : 'Для стрима';
}
$('spin').addEventListener('click', onSpinClick);
$('refresh').addEventListener('click', load);
$('stream').addEventListener('click', () => setStream(!stream()));
$('pool-search').addEventListener('input', renderPool);
$('winner-close').addEventListener('click', hideWinner);
$('winner-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) hideWinner(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('winner-overlay').classList.contains('show')) hideWinner(); else if (stream()) setStream(false);
});
$('stream-exit').addEventListener('click', () => setStream(false));
if (new URLSearchParams(location.search).has('stream')) setStream(true);

timeWheel.render(MINUTES.map(formatTime));
renderLog();
load();
listenBridge();
// Подписи меряются по факту отрисовки — когда страницу открыли после входа по коду, перемеряем
new MutationObserver(() => { if (!$('pain-main').hidden) { renderGames(); timeWheel.render(timeWheel.segments.map(s => s.label)); } })
  .observe($('pain-main'), {attributes: true, attributeFilter: ['hidden']});
