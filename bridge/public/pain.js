'use strict';
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const palette = ['#8d4564', '#555897', '#ad704b', '#487c87', '#754d92', '#9a5359', '#687748', '#455f95'];
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* не критично */ } },
};

let S = null, games = [], animating = false, lastSpinId = null;
let gameAngle = 0, timeAngle = 0, timeLabels = [], lastHidden = null;
let sound = store.get('pain.sound') !== 'off', audio;

function drawWheel(id, labels, angle) {
  const canvas = $(id), ctx = canvas.getContext('2d'), size = canvas.width, r = size / 2;
  ctx.clearRect(0, 0, size, size);
  if (!labels.length) {
    ctx.fillStyle = '#252c43'; ctx.beginPath(); ctx.arc(r, r, r - 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#aeb6cd'; ctx.font = `500 ${size * .035}px Segoe UI,sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('Список пока пуст', r, r * .65); return;
  }
  ctx.save(); ctx.translate(r, r); ctx.rotate(angle);
  const step = TAU / labels.length;
  labels.forEach((label, i) => {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 2, i * step, (i + 1) * step); ctx.closePath();
    ctx.fillStyle = palette[i % palette.length]; ctx.fill();
    ctx.strokeStyle = '#ffffff25'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.rotate((i + .5) * step); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#0008'; ctx.shadowBlur = 3;
    ctx.font = `600 ${Math.max(14, Math.min(30, size * .041, size * 1.3 / labels.length))}px "Segoe UI",sans-serif`;
    let text = String(label);
    const maxWidth = r * .72;
    while (text.length > 1 && ctx.measureText(text).width > maxWidth) text = text.slice(0, -1);
    if (text !== String(label)) text = text.slice(0, -1) + '…';
    ctx.fillText(text, r * .91, 0); ctx.restore();
  });
  ctx.restore();
}
function targetAngle(start, count, index, turns = 6) {
  const step = TAU / count;
  // Указатель стоит на 12 часах, выигравший сектор встаёт центром под него.
  const final = ((-Math.PI / 2 - (index + .5) * step) % TAU + TAU) % TAU;
  const current = ((start % TAU) + TAU) % TAU;
  return start + turns * TAU + (final - current + TAU) % TAU;
}
function beep(frequency = 500, duration = .025) {
  if (!sound || !audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.frequency.value = frequency; osc.type = 'sine'; gain.gain.setValueAtTime(.055, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
}
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    if (audio) audio.resume().catch(() => {});
  } catch (_) { /* звук необязателен */ }
}
function animate(id, labels, start, index, duration) {
  const end = targetAngle(start, labels.length, index);
  return new Promise(resolve => {
    const began = performance.now(); let lastSector = -1;
    function frame(now) {
      const progress = Math.min(1, (now - began) / duration);
      const angle = start + (end - start) * (1 - Math.pow(1 - progress, 4));
      const sector = Math.floor((angle + Math.PI / 2) / (TAU / labels.length));
      if (sector !== lastSector) { beep(id === 'gameWheel' ? 460 : 700); lastSector = sector; }
      drawWheel(id, labels, angle);
      if (progress < 1) requestAnimationFrame(frame); else resolve(end % TAU);
    }
    requestAnimationFrame(frame);
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }

async function playSpin(spin) {
  animating = true; render();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('verdict').hidden = true;
  timeLabels = spin.options.map(Bridge.minutes);
  if (spin.kind === 'game') {
    games = spin.games;
    $('gameResult').textContent = 'Выбираем твою боль…'; $('timeResult').textContent = 'Сначала выберем игру';
    status('Крутится большая рулетка');
    gameAngle = await animate('gameWheel', games, gameAngle, spin.gameIndex, reduced ? 350 : 6200);
    $('gameResult').textContent = spin.game; beep(820, .18);
    status('Игра выбрана. Теперь решаем, сколько играть.');
    await wait(reduced ? 100 : 1100);
  } else {
    status(`Докидываем время к «${spin.game}»`);
  }
  $('timeResult').textContent = 'Сколько терпеть?..';
  timeAngle = await animate('timeWheel', timeLabels, timeAngle, spin.timeIndex, reduced ? 350 : 4400);
  $('timeResult').textContent = (spin.kind === 'time' ? '+' : '') + Bridge.minutes(spin.minutes); beep(1000, .35);
  $('verdictLabel').textContent = spin.kind === 'game' ? 'ШЕКЕЛИ ПРИНЯТЫ · СУДЬБА РЕШЕНА' : 'ДОДЕП ПРИНЯТ · ТЕРПИМ ДОЛЬШЕ';
  $('verdictText').textContent = spin.kind === 'game'
    ? `${spin.game} — ${Bridge.minutes(spin.minutes)}`
    : `+${Bridge.minutes(spin.minutes)} к «${spin.game}»`;
  $('verdict').hidden = false;
  status('Результат определён.');
  animating = false; render();
}

// Показываем последний результат без анимации (при открытии страницы).
function showSpinStatic(spin) {
  timeLabels = spin.options.map(Bridge.minutes);
  if (spin.kind === 'game') {
    if (spin.games) games = spin.games;
    gameAngle = targetAngle(0, games.length, spin.gameIndex, 0);
  }
  timeAngle = targetAngle(0, timeLabels.length, spin.timeIndex, 0);
  $('gameResult').textContent = S.game?.name || spin.game;
  $('timeResult').textContent = (spin.kind === 'time' ? '+' : '') + Bridge.minutes(spin.minutes);
}

function render() {
  if (!S) return;
  const c = S.config;
  $('painTag').textContent = c.painTag; $('timeTag').textContent = c.timeTag;
  $('painSum').textContent = `${Bridge.rub(S.painBank)} / ${Bridge.rub(c.painPrice)}`;
  $('timeSum').textContent = `${Bridge.rub(S.timeBank)} / ${Bridge.rub(c.timePrice)}`;
  $('painBar').style.width = `${Math.min(100, S.painBank / c.painPrice * 100)}%`;
  $('timeBar').style.width = `${Math.min(100, S.timeBank / c.timePrice * 100)}%`;
  $('painCredits').textContent = S.painCredits; $('painCreditsBox').classList.toggle('has', S.painCredits > 0);
  $('timeCredits').textContent = S.timeCredits; $('timeCreditsBox').classList.toggle('has', S.timeCredits > 0);

  if (!animating) {
    drawWheel('gameWheel', games, gameAngle);
    drawWheel('timeWheel', timeLabels.length ? timeLabels : c.gameMinutes.map(Bridge.minutes), timeAngle);
  }
  $('gameHint').textContent = games.length ? `${games.length} игр · равные шансы` : 'Добавь названия игр в таблицу';
  $('timeHint').textContent = `Игра: ${c.gameMinutes.map(Bridge.minutes).join(' · ')}` +
    (c.extraMinutes.join() !== c.gameMinutes.join() ? ` · Добавка: ${c.extraMinutes.map(Bridge.minutes).join(' · ')}` : '');

  const hidden = animating || Bridge.revealing(S);
  const left = Bridge.timerLeft(S);
  $('spinGame').disabled = hidden || S.painCredits < 1 || left > 0 || !games.length;
  $('spinGame').textContent = `Крутить игру · оплачено ${S.painCredits}`;
  $('spinTime').disabled = hidden || S.timeCredits < 1 || !S.game;
  $('spinTime').textContent = `Крутить время · оплачено ${S.timeCredits}`;
  $('timerToggle').disabled = hidden || (!S.timer.running && left <= 0);
  $('timerToggle').textContent = S.timer.running ? '⏸ Пауза' : '▶ Старт';

  if (!animating && !Bridge.revealing(S)) {
    if (S.painCredits > 0 && left > 0) status(`Крутка игры оплачена, но ждёт: сначала доиграй «${S.game?.name}».`);
    else if (S.painCredits > 0 && !games.length) status('Крутка оплачена, но список игр пуст.', true);
    else if (S.painCredits > 0 || S.timeCredits > 0) status('Есть оплаченные крутки — жми, когда будешь готов.');
    else if (!$('status').classList.contains('error')) status(`Ждём донаты с метками ${c.painTag} и ${c.timeTag}.`);
  }

  $('history').replaceChildren(...S.history.map(h => {
    const li = document.createElement('li');
    li.textContent = `${new Date(h.at).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})} — ${h.text}`;
    return li;
  }));
  renderTimer();
}
function renderTimer() {
  if (!S) return;
  const box = $('timerBox'), hidden = animating || Bridge.revealing(S);
  // Момент раскрытия итога наступает без события с сервера — перерисовываем кнопки сами.
  if (hidden !== lastHidden) { lastHidden = hidden; render(); return; }
  const left = Bridge.timerLeft(S);
  box.classList.toggle('running', S.timer.running && !hidden);
  if (hidden) {
    $('timerGame').textContent = 'Крутим…'; $('timerClock').textContent = '?:??:??'; $('timerState').textContent = '';
    return;
  }
  $('timerGame').textContent = S.game ? S.game.name : 'Игра ещё не выбрана';
  $('timerClock').textContent = Bridge.clock(left);
  $('timerState').textContent = !S.game ? '' : S.timer.running ? 'Идёт' : left > 0 ? 'На паузе' : 'Отыграно';
}
setInterval(renderTimer, 250);

async function loadGames() {
  try {
    games = (await Bridge.api('/api/games')).games;
    render();
  } catch (error) { status(error.message, true); render(); }
}
async function action(fn) {
  try { status(''); await fn(); } catch (error) { status(error.message, true); }
}

Bridge.listen(state => {
  const prev = S; S = state; $('offline').hidden = true;
  const spin = S.spin;
  if (spin && spin.id !== lastSpinId) {
    lastSpinId = spin.id;
    // Нераскрытая крутка — анимируем; старую (при открытии страницы) просто показываем.
    if (Bridge.revealing(S)) { playSpin(spin); return; }
    showSpinStatic(spin);
  }
  if (prev && prev.status.sheet.text !== S.status.sheet.text && S.status.sheet.state === 'online' && !animating) loadGames();
  render();
}, online => { $('offline').hidden = online; });

$('spinGame').addEventListener('click', () => { unlockAudio(); action(() => Bridge.api('/api/spin/game', {})); });
$('spinTime').addEventListener('click', () => { unlockAudio(); action(() => Bridge.api('/api/spin/time', {})); });
$('timerToggle').addEventListener('click', () => action(() => Bridge.api('/api/timer', {action: S.timer.running ? 'pause' : 'start'})));
$('timerReset').addEventListener('click', () => {
  if (confirm('Сбросить таймер в ноль? Игра будет считаться отыгранной.')) action(() => Bridge.api('/api/timer', {action: 'reset'}));
});
$('timerSet').addEventListener('click', () => action(() => Bridge.api('/api/timer', {action: 'set', hours: $('setHours').value || 0, minutes: $('setMinutes').value || 0})));
$('refresh').addEventListener('click', () => action(loadGames));
$('sound').addEventListener('click', () => {
  sound = !sound; store.set('pain.sound', sound ? 'on' : 'off'); if (sound) unlockAudio();
  $('sound').textContent = `Звук: ${sound ? 'вкл.' : 'выкл.'}`; $('sound').setAttribute('aria-pressed', String(sound));
});
$('sound').textContent = `Звук: ${sound ? 'вкл.' : 'выкл.'}`;
function setStream(on) {
  document.body.classList.toggle('stream-mode', on);
  $('stream').textContent = on ? 'Обычный режим' : 'Режим для стрима';
  $('stream').setAttribute('aria-pressed', String(on));
}
$('stream').addEventListener('click', () => setStream(!document.body.classList.contains('stream-mode')));
if (new URLSearchParams(location.search).has('stream')) { setStream(true); unlockAudio(); }
document.addEventListener('pointerdown', unlockAudio, {once: true});
loadGames();
