'use strict';
// Games and durations are independent lists in columns A and B of the same tab.
const PAIN_CSV = 'https://docs.google.com/spreadsheets/d/1voGKd0Zx09_Io-Wb0F5uag9nKi5pME8LGbsyWwTVWOM/gviz/tq?tqx=out:csv&gid=827100001&headers=1';
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const palette = ['#8d4564','#555897','#ad704b','#487c87','#754d92','#9a5359','#687748','#455f95'];
let games = [], minutes = [], busy = false, loading = false, sound = true, audio;
let gameAngle = 0, timeAngle = 0;

function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
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
  if (quoted) throw new Error('Незакрытая кавычка в данных таблицы.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function readOptions(text) {
  if (/^\s*</.test(text)) throw new Error('Google вернул страницу вместо списка. Проверь публикацию вкладки.');
  const rows = parseCSV(text);
  if (rows[0]?.[0]?.trim() !== 'Название игры' || rows[0]?.[1]?.trim() !== 'Время (минуты)') {
    throw new Error('Не найдены столбцы «Название игры» и «Время (минуты)». Проверь первую строку вкладки.');
  }
  const names = new Map(), times = new Set(); let invalid = 0;
  for (const row of rows.slice(1)) {
    const name = (row[0] || '').trim().replace(/\s+/g, ' ');
    if (name && !names.has(name.toLocaleLowerCase('ru'))) names.set(name.toLocaleLowerCase('ru'), name);
    const value = (row[1] || '').trim();
    if (value) {
      const n = Number(value);
      if (/^\d+$/.test(value) && Number.isSafeInteger(n) && n > 0) times.add(n);
      else invalid++;
    }
  }
  return {games: [...names.values()], minutes: [...times], invalid};
}
function randomIndex(count) {
  // Rejection sampling avoids modulo bias, even when the list length is not a power of two.
  const bound = Math.floor(4294967296 / count) * count;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= bound);
  return value[0] % count;
}
function targetAngle(start, count, index, turns = 6) {
  const step = TAU / count;
  // The fixed pointer is at 12 o'clock, the winning sector lands on its centre.
  const final = ((-Math.PI / 2 - (index + .5) * step) % TAU + TAU) % TAU;
  const current = ((start % TAU) + TAU) % TAU;
  return start + turns * TAU + (final - current + TAU) % TAU;
}
function drawWheel(id, labels, angle) {
  const canvas = $(id), ctx = canvas.getContext('2d'), size = canvas.width, r = size / 2;
  ctx.clearRect(0, 0, size, size);
  if (!labels.length) {
    ctx.fillStyle = '#252c43'; ctx.beginPath(); ctx.arc(r,r,r-2,0,TAU); ctx.fill();
    ctx.fillStyle = '#aeb6cd'; ctx.font = `500 ${size*.035}px Segoe UI,sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('Список пока пуст',r,r*.65); return;
  }
  ctx.save(); ctx.translate(r,r); ctx.rotate(angle);
  const items = labels.length ? labels : ['Добавь варианты в таблицу'];
  const step = TAU / items.length;
  items.forEach((label, i) => {
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r-2,i*step,(i+1)*step); ctx.closePath();
    ctx.fillStyle = labels.length ? palette[i % palette.length] : '#252c43'; ctx.fill();
    ctx.strokeStyle = '#ffffff25'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.rotate((i+.5)*step); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#0008'; ctx.shadowBlur = 3;
    ctx.font = `600 ${Math.max(14,Math.min(30, size * .041, size * 1.3 / items.length))}px "Segoe UI",sans-serif`;
    let text = String(label), maxWidth = r * .72;
    while (text.length > 1 && ctx.measureText(text).width > maxWidth) text = text.slice(0,-1);
    if (text !== String(label)) text = text.slice(0,-1) + '…';
    ctx.fillText(text,r*.91,0); ctx.restore();
  });
  ctx.restore();
}
function formatTime(n) {
  if (n % 60) return `${n} мин`;
  const h = n / 60, tail = h % 100;
  const word = tail >= 11 && tail <= 14 ? 'часов' : h % 10 === 1 ? 'час' : h % 10 >= 2 && h % 10 <= 4 ? 'часа' : 'часов';
  return `${h} ${word}`;
}
function redraw() {
  drawWheel('gameWheel', games, gameAngle);
  drawWheel('timeWheel', minutes.map(formatTime), timeAngle);
}
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function controls() {
  $('spin').disabled = busy || loading || !games.length || !minutes.length;
  $('refresh').disabled = busy || loading;
}
function beep(frequency = 500, duration = .025) {
  if (!sound || !audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.frequency.value = frequency; osc.type = 'sine'; gain.gain.setValueAtTime(.055, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
}
async function load() {
  if (busy || loading) return;
  loading = true; controls(); status('Загружаем таблицу…');
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(PAIN_CSV + '&cache=' + Date.now(), {signal: ctrl.signal, cache: 'no-store'});
    if (!res.ok) throw new Error(`Google Sheets недоступен (HTTP ${res.status}).`);
    const options = readOptions(await res.text());
    games = options.games; minutes = options.minutes; redraw();
    $('entries').replaceChildren(...games.map(name => { const li = document.createElement('li'); li.textContent = name; return li; }));
    $('listSummary').textContent = `Игры и правила · ${games.length} в списке`;
    $('gameHint').textContent = games.length ? `${games.length} игр · равные шансы` : 'Добавь названия игр в столбец A';
    $('timeHint').textContent = minutes.length ? minutes.map(formatTime).join(' · ') : 'Добавь время в минутах в столбец B';
    let message = !games.length ? 'Список игр пока пуст. Добавь игры в таблицу и нажми «Обновить список».' : !minutes.length ? 'В таблице нет корректных вариантов времени. Впиши положительные целые числа в столбец B.' : 'Всё готово. После доната запусти рулетки одной кнопкой.';
    if (options.invalid) message += ` Некорректных вариантов времени пропущено: ${options.invalid}.`;
    status(message, !minutes.length || options.invalid > 0);
  } catch (error) {
    // Never allow a paid round to silently use stale data after a refresh failed.
    games = []; minutes = []; redraw(); $('entries').replaceChildren();
    $('listSummary').textContent = 'Игры и правила';
    $('gameHint').textContent = 'Не удалось загрузить игры'; $('timeHint').textContent = 'Нет данных';
    status((error.name === 'AbortError' ? 'Google Sheets не ответил вовремя.' : error.message) + ' Нажми «Обновить список», чтобы повторить.', true);
  } finally { clearTimeout(timer); loading = false; controls(); }
}
function animate(id, labels, start, index, duration) {
  const end = targetAngle(start, labels.length, index);
  return new Promise(resolve => {
    const began = performance.now(); let lastSector = -1;
    function frame(now) {
      const progress = Math.min(1,(now - began) / duration);
      const angle = start + (end-start)*(1-Math.pow(1-progress,4));
      const sector = Math.floor((angle+Math.PI/2)/(TAU/labels.length));
      if (sector !== lastSector) { beep(id === 'gameWheel' ? 460 : 700); lastSector = sector; }
      drawWheel(id, labels, angle);
      if (progress < 1) requestAnimationFrame(frame); else resolve(end % TAU);
    }
    requestAnimationFrame(frame);
  });
}
async function spin() {
  if (busy || loading || !games.length || !minutes.length) return;
  busy = true; controls(); $('verdict').hidden = true;
  $('gameResult').textContent = 'Выбираем твою боль…'; $('timeResult').textContent = 'Сначала выберем игру';
  $('spin').textContent = 'Выбираем игру…'; status('Крутится большая рулетка');
  try {
    try { const Audio = window.AudioContext || window.webkitAudioContext; if (!audio && Audio) audio = new Audio(); if (audio) audio.resume().catch(() => {}); } catch (_) { /* Audio is optional. */ }
    const g = randomIndex(games.length), t = randomIndex(minutes.length);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    gameAngle = await animate('gameWheel', games, gameAngle, g, reduced ? 350 : 6200);
    $('gameResult').textContent = games[g]; beep(820,.18);
    status('Игра выбрана. Теперь решаем, сколько играть.');
    await new Promise(resolve => setTimeout(resolve, reduced ? 100 : 1100));
    $('spin').textContent = 'Выбираем время…'; $('timeResult').textContent = 'Сколько терпеть?..';
    timeAngle = await animate('timeWheel', minutes.map(formatTime), timeAngle, t, reduced ? 350 : 4400);
    $('timeResult').textContent = formatTime(minutes[t]); beep(1000,.35);
    const result = `${games[g]} — ${formatTime(minutes[t])}`;
    $('verdictText').textContent = result; $('verdict').hidden = false;
    const li = document.createElement('li'); li.textContent = result; $('history').prepend(li);
    while ($('history').children.length > 30) $('history').lastElementChild.remove();
    $('historySection').hidden = false; status('Результат определён. Следующий донат — новый запуск.');
  } catch (_) { status('Не удалось завершить розыгрыш. Попробуй ещё раз.',true); }
  finally { busy = false; $('spin').textContent = 'Крутить за 1 000 ₽'; controls(); }
}
$('spin').addEventListener('click',spin);
$('refresh').addEventListener('click',load);
$('sound').addEventListener('click',() => { sound = !sound; $('sound').textContent = `Звук: ${sound ? 'вкл.' : 'выкл.'}`; $('sound').setAttribute('aria-pressed',String(sound)); });
$('stream').addEventListener('click',() => { const on = document.body.classList.toggle('stream-mode'); $('stream').textContent = on ? 'Обычный режим' : 'Режим для стрима'; $('stream').setAttribute('aria-pressed',String(on)); });
redraw(); load();
