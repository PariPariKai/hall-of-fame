// Код страницы screen.html (раздел screen). Подключается из screen.html.
(function () {
'use strict';

// ===================== параметры =====================
const qs = new URLSearchParams(location.search);
const SCREEN = ['start', 'brb', 'end'].includes(qs.get('s')) ? qs.get('s') : 'start';
const DEMO = qs.has('demo');
const DEFAULTS = {
  start: { title: 'Стрим начинается', sub: '', timer: '5', timer_done: 'Вот-вот начнём', chat: 'TRUE', every: '35', pos: 'top', bg: 'video' },
  brb: { title: 'Скоро вернусь', sub: '', timer: '0', timer_done: 'Уже иду', chat: 'TRUE', every: '40', pos: 'top', bg: 'pixel' },
  end: { title: 'Стрим окончен', sub: 'Спасибо, что были сегодня', timer: '0', timer_done: '', chat: 'TRUE', every: '45', pos: 'top', bg: 'video' },
};
const COMMON = { life: '10', max: '7', ignore: 'nightbot, streamelements, moobot, fossabot, wizebot, streamlabs, soundalerts, sery_bot, commanderroot' };

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const truthy = s => /^(true|yes|1|да)$/i.test(String(s || '').trim());
const num = (s, d) => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(n) ? n : d; };

// ===================== настройки с сайта =====================
let cfg = Object.assign({}, DEFAULTS[SCREEN], COMMON);
let phrases = [];
let channel = (qs.get('channel') || '').toLowerCase().replace(/^#/, '');

const loadJSON = path => hof.json(path, { fresh: true }); // оверлей висит часами — читаем мимо кэша
async function loadSettings() {
  try {
    const [c, s] = await Promise.all([loadJSON('data/config.json'), loadJSON('data/screens.json')]);
    const kv = hof.kv(c);
    const next = Object.assign({}, DEFAULTS[SCREEN], COMMON);
    Object.keys(DEFAULTS[SCREEN]).forEach(k => { const v = kv[`screen_${SCREEN}_${k}`]; if (v != null && v !== '') next[k] = v; });
    // подпись и текст после отсчёта можно и стереть — пустое значение тоже настройка
    ['sub', 'timer_done'].forEach(k => { if (`screen_${SCREEN}_${k}` in kv) next[k] = kv[`screen_${SCREEN}_${k}`]; });
    Object.keys(COMMON).forEach(k => { const v = kv['screen_' + k]; if (v != null && v !== '') next[k] = v; });
    cfg = next;
    phrases = (s.items || []).filter(p => (p.screen === SCREEN || p.screen === 'all') && String(p.text || '').trim() &&
      (String(p.active || '').trim() === '' || truthy(p.active)));
    if (!qs.get('channel')) {
      const m = String(kv.streamer_twitch_url || '').match(/twitch\.tv\/([\w]+)/i);
      channel = m ? m[1].toLowerCase() : channel;
    }
  } catch (e) {
    console.warn('Настройки не загрузились, работаю на прежних', e);
  }
  if (!channel) channel = 'pariparikai';
  applyHead();
  phraseBag = phraseBag.filter(p => phrases.includes(p));
}

// ===================== надпись и отсчёт =====================
let shownTitle = null;
function applyHead() {
  const head = $('head');
  head.className = 'head head--' + (['top', 'center', 'bottom'].includes(cfg.pos) ? cfg.pos : 'top') + ' is-on';
  if (cfg.title !== shownTitle) {
    shownTitle = cfg.title;
    $('title').innerHTML = Array.from(cfg.title).map((ch, i) => `<span class="ch" style="--i:${i}">${esc(ch)}</span>`).join('');
  }
  $('sub').textContent = cfg.sub || '';
  $('sub').hidden = !cfg.sub;
  applyBg(qs.get('bg') || cfg.bg);
  tick();
}

// Фон: прозрачный (видео — в OBS под источником) или живой пиксельный город
let city = null;
function applyBg(bg) {
  const pixel = bg === 'pixel' && window.PixelCity;
  document.body.classList.toggle('px', !!pixel);
  $('city').hidden = !pixel;
  if (pixel && !city) city = PixelCity.start($('city'));
  if (!pixel && city) { city.stop(); city = null; }
}

let timerFrom = Date.now();
function tick() {
  const mins = num(cfg.timer, 0), el = $('timer');
  if (mins <= 0) { el.hidden = true; return; }
  el.hidden = false;
  const left = Math.ceil((timerFrom + mins * 60000 - Date.now()) / 1000);
  if (left > 0) {
    el.classList.remove('is-done');
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  } else {
    el.classList.add('is-done');
    el.textContent = cfg.timer_done || '';
    el.hidden = !cfg.timer_done;
  }
}
setInterval(tick, 250);
// OBS сообщает, когда сцену с источником включили: отсчёт — заново
window.addEventListener('obsSourceActiveChanged', e => { if (e.detail && e.detail.active) { timerFrom = Date.now(); tick(); } });

// ===================== пузыри =====================
const stage = $('stage');
const live = [];   // { el, kind, msgId, login, rect }
const queue = [];  // ждут свободного места: { kind, ... }
const life = () => Math.max(3, num(cfg.life, 10)) * 1000;
const maxOnScreen = () => Math.max(1, Math.round(num(cfg.max, 7)));

// Спокойные «неоновые» оттенки ночного города
const HUES = [195, 210, 265, 285, 320, 340, 30, 45, 165];
const pickHue = () => HUES[Math.floor(Math.random() * HUES.length)] + Math.round(rand(-8, 8));

function headRect() {
  const r = $('head').getBoundingClientRect();
  const pad = 24;
  return { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
}
const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

// Случайное место, где пузырь не наезжает на надпись и другие пузыри
function findSpot(w, h) {
  const W = innerWidth, H = innerHeight, mx = W * 0.03, my = H * 0.04, gap = 14;
  const bottom = city ? H * 0.885 : H - my; // на пиксельном фоне не закрываем крышу с котом и кружкой
  const busy = live.map(b => b.rect).concat(shownTitle ? [headRect()] : []);
  for (let i = 0; i < 60; i++) {
    const x = rand(mx, W - mx - w), y = rand(my, bottom - h);
    const r = { l: x - gap, t: y - gap, r: x + w + gap, b: y + h + gap };
    if (!busy.some(b => hit(r, b))) return { x, y, rect: r };
  }
  return null;
}

function show(item) {
  const el = document.createElement('div');
  const h = pickHue();
  el.className = 'bub' + (item.kind === 'note' ? ' bub--note' : '') + (item.first ? ' bub--first' : '');
  el.style.setProperty('--h', h);
  el.style.setProperty('--tail', Math.round(rand(22, 78)) + '%');
  const ms = item.kind === 'note' ? Math.min(20000, Math.max(life(), 4000 + [...item.text].length * 70)) : life();
  el.style.setProperty('--life', (ms / 1000 + 1) + 's');
  el.innerHTML = item.kind === 'note'
    ? `<div class="bub__body">${item.label ? `<span class="bub__label">${esc(item.label)}</span>` : ''}<span class="bub__text">${esc(item.text)}</span></div>`
    : `<div class="bub__body"><span class="bub__nick" style="color:${item.color}">${esc(item.nick)}${item.first ? '<span class="bub__badge">впервые в чате</span>' : ''}</span>` +
      `<span class="bub__text">${item.html}</span><span class="bub__dot"></span></div>`;
  stage.appendChild(el);
  // огонёк под хвостиком тоже занимает место
  const w = el.offsetWidth, hh = el.offsetHeight + (item.kind === 'note' ? 0 : 28);
  const spot = findSpot(w, hh);
  if (!spot) { el.remove(); return false; }
  el.style.left = spot.x + 'px';
  el.style.top = spot.y + 'px';
  el.classList.add('is-placed');
  const b = { el, kind: item.kind, msgId: item.msgId, login: item.login, rect: spot.rect };
  live.push(b);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
  b.timer = setTimeout(() => hide(b), ms);
  return true;
}
function hide(b) {
  if (b.gone) return;
  b.gone = true;
  clearTimeout(b.timer);
  b.el.classList.add('is-out');
  // место освобождаем сразу — пока пузырь тает, рядом может появиться следующий
  setTimeout(() => { const i = live.indexOf(b); if (i >= 0) live.splice(i, 1); }, 500);
  setTimeout(() => b.el.remove(), 1200);
}

// Раз в полсекунды — следующий из очереди, если есть место (фразы стримера вперёд чата)
setInterval(() => {
  if (!queue.length || live.filter(b => !b.gone).length >= maxOnScreen()) return;
  const i = queue.findIndex(q => q.kind === 'note');
  const item = queue[i >= 0 ? i : 0];
  if (show(item)) queue.splice(queue.indexOf(item), 1);
}, 500);
function enqueue(item) {
  queue.push(item);
  // чат несётся быстрее, чем пузыри успевают жить, — старые сообщения из очереди выбрасываем
  const chat = queue.filter(q => q.kind === 'chat');
  if (chat.length > 10) queue.splice(queue.indexOf(chat[0]), 1);
}

// ===================== фразы из админки =====================
let phraseBag = [];
function nextPhrase() {
  if (!phrases.length) return null;
  if (!phraseBag.length) {
    phraseBag = phrases.slice().sort(() => Math.random() - 0.5);
    // та же фраза два раза подряд — не надо
    if (phraseBag.length > 1 && phraseBag[0] === lastPhrase) phraseBag.push(phraseBag.shift());
  }
  return (lastPhrase = phraseBag.shift());
}
let lastPhrase = null;
function schedulePhrase(first) {
  const every = num(cfg.every, 35) * (DEMO ? 0.3 : 1);
  if (every <= 0) { setTimeout(() => schedulePhrase(), 15000); return; } // фразы выключены — проверим позже
  setTimeout(() => {
    const p = nextPhrase();
    if (p && !queue.some(q => q.kind === 'note')) enqueue({ kind: 'note', text: String(p.text).trim(), label: String(p.label || '').trim() });
    schedulePhrase();
  }, first ? Math.min(every, 8) * 1000 : every * rand(0.8, 1.2) * 1000);
}

// ===================== чат Twitch (анонимно, только чтение) =====================
let ws = null, wsChan = '', reconnectDelay = 1000;
function connect() {
  if (ws) { ws.onclose = null; try { ws.close(); } catch (e) { /* уже закрыт */ } }
  wsChan = channel;
  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
    ws.send('JOIN #' + wsChan);
  };
  ws.onmessage = ev => ev.data.split('\r\n').forEach(line => { if (line) onLine(line); });
  ws.onclose = () => { setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(reconnectDelay * 2, 30000); };
  ws.onerror = () => { try { ws.close(); } catch (e) { /* закроется сам */ } };
}
function parseTags(raw) {
  const tags = {};
  raw.split(';').forEach(pair => {
    const i = pair.indexOf('=');
    tags[i < 0 ? pair : pair.slice(0, i)] = i < 0 ? '' : pair.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\');
  });
  return tags;
}
function onLine(line) {
  if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return; }
  let tags = {}, rest = line, prefix = '';
  if (rest[0] === '@') { const sp = rest.indexOf(' '); tags = parseTags(rest.slice(1, sp)); rest = rest.slice(sp + 1); }
  if (rest[0] === ':') { const sp = rest.indexOf(' '); prefix = rest.slice(1, sp); rest = rest.slice(sp + 1); }
  const sp = rest.indexOf(' ');
  const cmd = sp < 0 ? rest : rest.slice(0, sp);
  const params = sp < 0 ? '' : rest.slice(sp + 1);
  const text = params.includes(' :') ? params.slice(params.indexOf(' :') + 2) : '';
  if (cmd === '001') { reconnectDelay = 1000; return; }
  if (cmd === 'RECONNECT') { try { ws.close(); } catch (e) { /* переподключимся */ } return; }
  // Модератор удалил сообщение / забанил — убираем с экрана
  if (cmd === 'CLEARMSG') { drop(b => b.msgId === tags['target-msg-id']); return; }
  if (cmd === 'CLEARCHAT') { const who = text.trim().toLowerCase(); drop(b => b.kind === 'chat' && (!who || b.login === who)); return; }
  if (cmd !== 'PRIVMSG' || !truthy(cfg.chat)) return;
  onChat(tags, prefix.split('!')[0].toLowerCase(), text);
}
function drop(fn) {
  live.filter(fn).forEach(hide);
  for (let i = queue.length - 1; i >= 0; i--) if (fn(queue[i])) queue.splice(i, 1);
}

const LINK = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(ru|com|tv|net|org|gg|ly|io|me|su|xyz|info|рф)\b/i;
const MAX_LEN = 160;
function onChat(tags, login, raw) {
  let text = raw;
  const action = /^\u0001ACTION (.*)\u0001$/.exec(text);
  if (action) text = action[1];
  const ignore = String(cfg.ignore || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  if (ignore.includes(login) || !text.trim() || text.trim()[0] === '!' || LINK.test(text)) return;
  const nick = tags['display-name'] || login;
  const first = tags['first-msg'] === '1';
  enqueue({ kind: 'chat', login, nick, first, msgId: tags.id, color: nickColor(tags.color, login), html: renderText(text, tags.emotes) });
}

// Текст со смайликами Twitch: позиции в теге emotes — в символах (code points)
function renderText(text, emotesTag) {
  const chars = Array.from(text);
  const at = {};
  String(emotesTag || '').split('/').filter(Boolean).forEach(part => {
    const [id, ranges] = part.split(':');
    (ranges || '').split(',').forEach(r => { const [a, b] = r.split('-').map(Number); if (isFinite(a) && isFinite(b)) at[a] = { end: b, id }; });
  });
  let out = '', buf = '', i = 0, len = 0;
  while (i < chars.length && len < MAX_LEN) {
    const e = at[i];
    if (e) {
      out += esc(buf); buf = '';
      out += `<img class="emote" alt="" src="https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(e.id)}/default/dark/2.0">`;
      i = e.end + 1; len += 3;
    } else { buf += chars[i]; i++; len++; }
  }
  out += esc(buf);
  return out + (i < chars.length ? '…' : '');
}

// Цвет ника из Twitch, но не темнее, чем читается на тёмном пузыре
function nickColor(hex, login) {
  let h, s, l;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (m) {
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    l = (mx + mn) / 2;
    s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    h = !d ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  } else {
    h = [...login].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7); s = 0.7; l = 0.7;
  }
  return `hsl(${Math.round((h + 360) % 360)}, ${Math.round(Math.min(s, 0.9) * 100)}%, ${Math.round(Math.max(l, 0.68) * 100)}%)`;
}

// ===================== предпросмотр =====================
function demo() {
  document.body.classList.add('demo');
  const lights = document.createElement('div');
  lights.className = 'demo-lights';
  lights.innerHTML = Array.from({ length: 140 }, () => {
    const y = rand(45, 98), s = rand(1.5, 3.5);
    return `<i style="left:${rand(0, 100)}%;top:${y}%;width:${s}px;height:${s}px;opacity:${rand(.3, .9).toFixed(2)}"></i>`;
  }).join('');
  document.body.prepend(lights);
  const note = document.createElement('div');
  note.className = 'demo-note';
  note.textContent = 'Предпросмотр: чат ненастоящий, фразы чаще обычного. В OBS — без «&demo».';
  document.body.appendChild(note);
  const nicks = [['Lunatik_77', '#FF4500'], ['kotofey', '#1E90FF'], ['Nyashka', '#FF69B4'], ['dedinside', ''], ['Barmaley', '#9ACD32'], ['night_owl', '#8A2BE2'], ['PetrovichTV', '#DAA520']];
  const lines = ['привет!', 'всем ку', 'о, город ночью', 'кто там в футбол играет', 'ждём', 'чай налит, я готов', 'какой вайб', 'привет с Урала',
    'что сегодня смотрим?', 'а это где снято?', 'добрый вечер', 'зашёл на огонёк', 'машинки едут', 'красиво'];
  const fake = () => {
    if (truthy(cfg.chat)) {
      const [nick, color] = nicks[Math.floor(Math.random() * nicks.length)];
      onChat({ 'display-name': nick, color, 'first-msg': Math.random() < 0.1 ? '1' : '0', id: String(Math.random()) }, nick.toLowerCase(),
        lines[Math.floor(Math.random() * lines.length)]);
    }
    setTimeout(fake, rand(900, 2600));
  };
  fake();
}

// ===================== обновление самой страницы =====================
// Свежая копия с сайта (мимо кэша) с другой VERSION — перезагружаемся с меткой в адресе, которой нет в кэше.
// Метка _v свежее двух минут — не дёргаемся, чтобы разные узлы CDN не устроили перезагрузки по кругу.
async function checkVersion() {
  if (location.protocol === 'file:') return;
  try {
    const html = await (await fetch(location.pathname + '?t=' + Date.now(), { cache: 'no-store' })).text();
    const m = /const VERSION = '([^']+)'/.exec(html);
    if (!m || m[1] === VERSION) return;
    const since = Date.now() - (+qs.get('_v') || 0);
    if (since < 120000) return;
    qs.set('_v', Date.now());
    location.replace(location.pathname + '?' + qs.toString());
  } catch (e) { /* сайт недоступен — работаем на том, что есть */ }
}

// Источник не 16:9 (в OBS по умолчанию 800×600, а потом его растягивают) — всё вытянется. Подсказываем на полминуты.
function checkSize() {
  const ratio = innerWidth / innerHeight;
  if (!innerHeight || Math.abs(ratio / (16 / 9) - 1) < 0.03) return;
  const el = document.createElement('div');
  el.className = 'size-warn';
  el.textContent = `Размер источника ${innerWidth}×${innerHeight} — картинка растянется. В свойствах источника поставь ширину 1920 и высоту 1080, ` +
    'потом ПКМ по источнику → Преобразование → Сбросить преобразование.';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 1200); }, 30000);
}

// ===================== запуск =====================
checkSize();
checkVersion();
setInterval(checkVersion, 5 * 60000);
loadSettings().then(() => {
  if (DEMO) demo(); else connect();
  // Будим сервис истории чата: рулетка наказаний (court.html) берёт из него, кто писал и кого мутили до её открытия.
  // Сервис слушает канал сутки после последнего обращения, а заставка стоит в начале каждого стрима.
  if (!DEMO) fetch('https://recent-messages.robotty.de/api/v2/recent-messages/' + channel + '?limit=1').catch(() => {});
  schedulePhrase(true);
  setInterval(loadSettings, 60000);
  // сменили канал на сайте — переподключаемся
  setInterval(() => { if (!DEMO && channel !== wsChan) connect(); }, 60000);
});
})();
