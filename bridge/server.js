'use strict';
// «Боль стримера» — локальный мост донатов.
// Слушает DonationAlerts и DonateX, копит донаты с метками #боль / #время,
// хранит оплаченные крутки и таймер, отдаёт страницы рулетки, оверлея и админки.
// Работает только на 127.0.0.1: токены никогда не уходят на публичный сайт.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const STATE_FILE = path.join(DATA, 'state.json');
const DA_TOKEN_FILE = path.join(DATA, 'da-token.json');
const LOG_FILE = path.join(DATA, 'bridge.log');
fs.mkdirSync(DATA, {recursive: true});

// ---------- утилиты ----------

try { if (fs.statSync(LOG_FILE).size > 2e6) fs.renameSync(LOG_FILE, LOG_FILE + '.old'); } catch (_) { /* лога ещё нет */ }
function log(...parts) {
  const line = `[${new Date().toLocaleString('ru-RU')}] ${parts.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) { /* лог не критичен */ }
}
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); }
  catch (error) {
    if (error.code !== 'ENOENT') log('Не удалось прочитать', path.basename(file) + ':', error.message);
    return fallback;
  }
}
function writeJSON(file, value) {
  // Пишем во временный файл и переименовываем: при сбое питания старый файл останется целым.
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
const round2 = n => Math.round(n * 100) / 100;
const norm = s => String(s || '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
function randomIndex(count) {
  const bound = Math.floor(4294967296 / count) * count;
  let value;
  do { value = crypto.randomBytes(4).readUInt32LE(0); } while (value >= bound);
  return value % count;
}
async function fetchWithTimeout(url, options = {}, ms = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, {...options, signal: ctrl.signal}); }
  finally { clearTimeout(timer); }
}

// ---------- настройки ----------

const DEFAULT_CONFIG = {
  port: 3777,
  painPrice: 1000,
  timePrice: 250,
  painTag: '#боль',
  timeTag: '#время',
  gameMinutes: [60, 240, 480],
  extraMinutes: [60, 240, 480],
  countTestDonations: false,
  // Адрес сайта (GitHub Pages) — отсюда мост берёт список игр «Боли», сюда отправляет /pain и только ему открывает API.
  // Правится на localhost:3777/admin → «Сайт».
  siteUrl: 'https://pariparikai.github.io/hall-of-fame/',
  // Список игр «Боли»: пусто — data/pain.json на сайте из siteUrl. Старая ссылка на CSV таблицы тоже читается.
  sheetCsv: '',
  donationAlerts: {clientId: '', clientSecret: ''},
  donatex: {token: ''},
};
function loadConfig() {
  const raw = readJSON(CONFIG_FILE, {});
  const cfg = {...DEFAULT_CONFIG, ...raw,
    donationAlerts: {...DEFAULT_CONFIG.donationAlerts, ...raw.donationAlerts},
    donatex: {...DEFAULT_CONFIG.donatex, ...raw.donatex}};
  if (!fs.existsSync(CONFIG_FILE)) writeJSON(CONFIG_FILE, cfg);
  return cfg;
}
let config = loadConfig();
const PORT = Number(process.env.PAIN_PORT) || config.port;
const ORIGIN = `http://localhost:${PORT}`;
const DA_REDIRECT = `${ORIGIN}/da/callback`;
const DA_SCOPES = 'oauth-user-show oauth-donation-subscribe oauth-donation-index';

// ---------- состояние ----------

const DEFAULT_STATE = {
  painBank: 0, timeBank: 0, painCredits: 0, timeCredits: 0,
  game: null,                                   // {name, baseMinutes, extraMinutes, at}
  timer: {remainingMs: 0, runningSince: null},  // идёт, если runningSince задан
  spin: null, history: [], donations: [],
  seen: {}, baselined: {}, aliveAt: 0,
};
let state = {...DEFAULT_STATE, ...readJSON(STATE_FILE, {})};
const status = {
  da: {state: 'off', text: 'Не настроено'},
  dx: {state: 'off', text: 'Не настроено'},
  sheet: {state: 'off', text: 'Ещё не загружалась'},
};

// Если ПК выключили при идущем таймере — ставим на паузу в момент последнего сохранения,
// чтобы время простоя не съело таймер.
if (state.timer.runningSince) {
  const spent = Math.max(0, (state.aliveAt || state.timer.runningSince) - state.timer.runningSince);
  state.timer = {remainingMs: Math.max(0, state.timer.remainingMs - spent), runningSince: null};
  log('Таймер шёл при выключении — поставлен на паузу.');
}

function save() {
  state.aliveAt = Date.now();
  try { writeJSON(STATE_FILE, state); } catch (error) { log('Ошибка сохранения состояния:', error.message); }
}
function changed() { save(); broadcast(); }

function timerLeft(now = Date.now()) {
  const t = state.timer;
  return Math.max(0, t.remainingMs - (t.runningSince ? now - t.runningSince : 0));
}
function setTimer(ms, running) {
  ms = Math.max(0, Math.round(ms));
  state.timer = {remainingMs: ms, runningSince: running && ms > 0 ? Date.now() : null};
}
setInterval(() => {
  if (!state.timer.runningSince) return;
  if (timerLeft() <= 0) {
    setTimer(0, false);
    log(`Таймер дошёл до нуля: «${state.game?.name}» отыграна.`);
    pushHistory('done', `Отыграно: ${state.game?.name}`);
    changed();
  } else if (state.timeCredits > 0 && state.game && !spinBusy()) {
    // Пока таймер идёт, оплаченные крутки #время крутятся сами (по одной, после каждой — пауза на анимацию).
    // На паузе крутки ждут и прокрутятся после «Старт».
    try { spinTime(true); } catch (error) { log('Автодобавка времени:', error.message); }
  } else if (Date.now() - state.aliveAt > 10000) save();
}, 1000);

function pushHistory(kind, text) {
  state.history.unshift({kind, text, at: Date.now()});
  state.history.length = Math.min(state.history.length, 100);
}

// ---------- донаты ----------

function trimSeen() {
  const keys = Object.keys(state.seen);
  for (let i = 0; i < keys.length - 5000; i++) delete state.seen[keys[i]];
}
function detectTag(message) {
  const m = norm(message);
  const p = m.indexOf(norm(config.painTag)), t = m.indexOf(norm(config.timeTag));
  if (p < 0 && t < 0) return null;
  if (p < 0) return 'time';
  if (t < 0) return 'pain';
  return p < t ? 'pain' : 'time';
}
// d: {id, username, message, rub, isTest}. Возвращает true, если донат пошёл в копилку.
function handleDonation(source, d, {count = true, forceTag = null} = {}) {
  const key = `${source}:${d.id}`;
  if (state.seen[key]) return false;
  state.seen[key] = Date.now();
  trimSeen();
  if (!count) return false;
  const tag = forceTag || detectTag(d.message);
  if (!tag) { save(); return false; }
  if (d.isTest && !config.countTestDonations) { log(`Тестовый донат ${key} пропущен.`); save(); return false; }
  const rub = round2(Number(d.rub));
  if (!(rub > 0)) { log(`Донат ${key} с меткой, но без суммы в рублях — пропущен.`); save(); return false; }

  const entry = {key, source, username: String(d.username || 'Аноним').slice(0, 60),
    message: String(d.message || '').slice(0, 300), rub, tag, at: Date.now()};
  if (tag === 'pain') {
    state.painBank = round2(state.painBank + rub);
    if (state.painBank >= config.painPrice) {
      const n = Math.floor(state.painBank / config.painPrice);
      const rest = round2(state.painBank - n * config.painPrice);
      state.painCredits += n; state.painBank = 0; entry.painCredits = n;
      // Остаток после полной крутки уходит в копилку времени.
      if (rest > 0) { state.timeBank = round2(state.timeBank + rest); entry.overflow = rest; }
    }
  } else {
    state.timeBank = round2(state.timeBank + rub);
  }
  if (state.timeBank >= config.timePrice) {
    const n = Math.floor(state.timeBank / config.timePrice);
    state.timeCredits += n; state.timeBank = round2(state.timeBank - n * config.timePrice); entry.timeCredits = n;
  }
  state.donations.unshift(entry);
  state.donations.length = Math.min(state.donations.length, 200);
  log(`Донат ${key}: ${entry.username} ${rub} ₽ ${tag === 'pain' ? config.painTag : config.timeTag}` +
    (entry.painCredits ? ` → +${entry.painCredits} крутка игры` : '') +
    (entry.overflow ? `, остаток ${entry.overflow} ₽ в копилку времени` : '') +
    (entry.timeCredits ? ` → +${entry.timeCredits} крутка времени` : ''));
  changed();
  return true;
}
// Первое подключение источника: всё, что уже было, помечаем как учтённое,
// чтобы старые донаты не насыпали круток задним числом.
function catchUp(source, list) {
  if (!state.baselined[source]) {
    for (const d of list) state.seen[`${source}:${d.id}`] = Date.now();
    state.baselined[source] = true; trimSeen(); save();
    log(`${source}: первое подключение, ${list.length} старых донатов помечены как учтённые.`);
    return;
  }
  let added = 0;
  for (const d of list) if (handleDonation(source, d)) added++;
  if (added) log(`${source}: догнали ${added} донатов, пришедших без моста.`);
}

// ---------- DonationAlerts ----------

const da = {gen: 0, ws: null, ping: null, retry: 0, timer: null};
const readDaToken = () => readJSON(DA_TOKEN_FILE, null);

async function daTokenRequest(params) {
  const body = new URLSearchParams({...params,
    client_id: config.donationAlerts.clientId, client_secret: config.donationAlerts.clientSecret});
  const res = await fetchWithTimeout('https://www.donationalerts.com/oauth/token', {method: 'POST', body});
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`DonationAlerts не выдал токен (HTTP ${res.status}${json.message ? ': ' + json.message : ''})`);
  const token = {access_token: json.access_token, refresh_token: json.refresh_token,
    expires_at: Date.now() + (Number(json.expires_in) || 0) * 1000};
  writeJSON(DA_TOKEN_FILE, token);
  return token;
}
async function daRefresh() {
  const token = readDaToken();
  if (!token?.refresh_token) throw new Error('Нет refresh-токена, подключи DonationAlerts заново.');
  log('DonationAlerts: обновляем токен.');
  return daTokenRequest({grant_type: 'refresh_token', refresh_token: token.refresh_token, scope: DA_SCOPES});
}
async function daApi(pathname, options = {}, retried = false) {
  let token = readDaToken();
  if (!token) throw new Error('DonationAlerts не подключён.');
  if (token.expires_at && token.expires_at - Date.now() < 86400000 && token.refresh_token) token = await daRefresh();
  const res = await fetchWithTimeout('https://www.donationalerts.com' + pathname,
    {...options, headers: {...options.headers, Authorization: 'Bearer ' + token.access_token}});
  if (res.status === 401 && !retried) { await daRefresh(); return daApi(pathname, options, true); }
  if (!res.ok) throw new Error(`DonationAlerts API ${pathname}: HTTP ${res.status}`);
  return res.json();
}
function daMap(d) {
  const rub = d.amount_in_user_currency ?? (d.currency === 'RUB' ? d.amount : NaN);
  return {id: d.id, username: d.username, message: d.message, rub, isTest: false};
}
function daStop() {
  da.gen++;
  clearInterval(da.ping); clearTimeout(da.timer);
  if (da.ws) { try { da.ws.close(); } catch (_) { /* уже закрыт */ } da.ws = null; }
}
const DA_FALLBACK_TEXT = 'Мгновенные уведомления DonationAlerts сбоят на их стороне — проверяем донаты раз в 45 с.';
let daPollOkAt = 0;
function daSchedule(gen, reason) {
  if (gen !== da.gen) return;
  clearInterval(da.ping);
  const delay = Math.min(60000, 2000 * 2 ** da.retry++);
  status.da = Date.now() - daPollOkAt < 100000
    ? {state: 'connecting', text: DA_FALLBACK_TEXT}
    : {state: 'error', text: `${reason} Переподключение через ${Math.round(delay / 1000)} с.`};
  broadcast();
  da.timer = setTimeout(() => { if (gen === da.gen) daConnect(); }, delay);
}
async function daConnect() {
  daStop();
  const gen = da.gen;
  if (!config.donationAlerts.clientId || !config.donationAlerts.clientSecret) {
    status.da = {state: 'off', text: 'Впиши ID и ключ приложения в настройках.'}; broadcast(); return;
  }
  if (!readDaToken()) { status.da = {state: 'off', text: 'Нажми «Подключить DonationAlerts».'}; broadcast(); return; }
  status.da = {state: 'connecting', text: 'Подключаемся…'}; broadcast();
  try {
    const user = (await daApi('/api/v1/user/oauth')).data;
    if (gen !== da.gen) return;
    const list = (await daApi('/api/v1/alerts/donations')).data || [];
    catchUp('da', list.map(daMap).reverse());
    const channel = `$alerts:donation_${user.id}`;
    const ws = new WebSocket('wss://centrifugo.donationalerts.com/connection/websocket');
    da.ws = ws;
    let pingId = 100;
    ws.onopen = () => ws.send(JSON.stringify({params: {token: user.socket_connection_token}, id: 1}));
    ws.onmessage = async event => {
      try {
        for (const line of String(event.data).split('\n')) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.error) throw new Error(`Centrifugo: ${msg.error.message || JSON.stringify(msg.error)}`);
          if (msg.id === 1 && msg.result?.client) {
            const sub = await daApi('/api/v1/centrifuge/subscribe', {method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({channels: [channel], client: msg.result.client})});
            const token = sub.channels?.find(c => c.channel === channel)?.token;
            if (!token) throw new Error('DonationAlerts не выдал токен канала.');
            ws.send(JSON.stringify({params: {channel, token}, method: 1, id: 2}));
          } else if (msg.id === 2) {
            da.retry = 0;
            status.da = {state: 'online', text: `Онлайн · ${user.name || user.code || 'аккаунт ' + user.id}`};
            log('DonationAlerts: подключено, слушаем донаты.'); broadcast();
            clearInterval(da.ping);
            da.ping = setInterval(() => { try { ws.send(JSON.stringify({method: 7, id: ++pingId})); } catch (_) { /* закроется само */ } }, 25000);
          } else if (msg.result?.channel === channel && msg.result.data?.data) {
            handleDonation('da', daMap(msg.result.data.data));
          }
        }
      } catch (error) {
        log('DonationAlerts:', error.message);
        try { ws.close(); } catch (_) { /* уже закрыт */ }
      }
    };
    ws.onclose = event => {
      if (da.ws !== ws) return;
      log(`DonationAlerts: WebSocket закрыт (код ${event.code}${event.reason ? ', ' + event.reason : ''}).`);
      daSchedule(gen, 'Соединение потеряно.');
    };
    ws.onerror = () => { /* onclose всё обработает */ };
  } catch (error) {
    log('DonationAlerts:', error.message);
    daSchedule(gen, error.message);
  }
}

// Запасной режим: пока мгновенные уведомления DonationAlerts не работают (у них бывает ошибка 3004),
// раз в 45 секунд забираем список последних донатов по обычному API — донаты не теряются, приходят с задержкой.
let daPolling = false;
setInterval(async () => {
  if (daPolling || status.da.state === 'online' || !readDaToken() || !config.donationAlerts.clientId) return;
  daPolling = true;
  try {
    const list = (await daApi('/api/v1/alerts/donations')).data || [];
    catchUp('da', list.map(daMap).reverse());
    daPollOkAt = Date.now();
    if (status.da.state !== 'online') {
      status.da = {state: 'connecting', text: DA_FALLBACK_TEXT};
      broadcast();
    }
  } catch (error) {
    log('DonationAlerts (запасной режим):', error.message);
  } finally { daPolling = false; }
}, 45000);

// ---------- DonateX (SignalR поверх WebSocket, JSON-протокол) ----------

const dx = {gen: 0, ws: null, ping: null, retry: 0, timer: null};
const RS = '\x1e';
function dxMap(d) {
  return {id: d.id, username: d.username, message: d.message, rub: d.amountInRub ?? d.amount, isTest: !!d.isTest};
}
function dxStop() {
  dx.gen++;
  clearInterval(dx.ping); clearTimeout(dx.timer);
  if (dx.ws) { try { dx.ws.close(); } catch (_) { /* уже закрыт */ } dx.ws = null; }
}
function dxSchedule(gen, reason) {
  if (gen !== dx.gen) return;
  clearInterval(dx.ping);
  const delay = Math.min(60000, 2000 * 2 ** dx.retry++);
  status.dx = {state: 'error', text: `${reason} Переподключение через ${Math.round(delay / 1000)} с.`};
  broadcast();
  dx.timer = setTimeout(() => { if (gen === dx.gen) dxConnect(); }, delay);
}
async function dxConnect() {
  dxStop();
  const gen = dx.gen, token = config.donatex.token.trim();
  // Без токена DonateX выключен (стример им не пользуется — вывод денег только в РФ). Вписал токен в админке — включится сам.
  if (!token) { status.dx = {state: 'disabled', text: 'Отключён'}; broadcast(); return; }
  status.dx = {state: 'connecting', text: 'Подключаемся…'}; broadcast();
  const q = encodeURIComponent(token);
  try {
    const res = await fetchWithTimeout(`https://donatex.gg/api/v1/donations?skip=0&take=50&token=${q}`);
    if (res.status === 401 || res.status === 403) throw new Error('DonateX отклонил токен. Проверь его в настройках.');
    if (!res.ok) throw new Error(`DonateX API: HTTP ${res.status}`);
    const list = await res.json();
    if (gen !== dx.gen) return;
    catchUp('dx', (Array.isArray(list) ? list : []).map(dxMap).reverse());

    const hub = 'https://donatex.gg/api/public-donations-hub';
    const neg = await fetchWithTimeout(`${hub}/negotiate?negotiateVersion=1&access_token=${q}`, {method: 'POST'});
    if (!neg.ok) throw new Error(`DonateX negotiate: HTTP ${neg.status}`);
    const info = await neg.json();
    const id = info.connectionToken || info.connectionId;
    if (!id) throw new Error('DonateX не выдал id соединения.');
    const ws = new WebSocket(`wss://donatex.gg/api/public-donations-hub?id=${encodeURIComponent(id)}&access_token=${q}`);
    dx.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({protocol: 'json', version: 1}) + RS);
    ws.onmessage = event => {
      try {
        const text = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
        for (const part of text.split(RS)) {
          if (!part.trim()) continue;
          const msg = JSON.parse(part);
          if (msg.type === undefined) {
            if (msg.error) throw new Error(`DonateX handshake: ${msg.error}`);
            dx.retry = 0;
            status.dx = {state: 'online', text: 'Онлайн'};
            log('DonateX: подключено, слушаем донаты.'); broadcast();
            clearInterval(dx.ping);
            dx.ping = setInterval(() => { try { ws.send(JSON.stringify({type: 6}) + RS); } catch (_) { /* закроется само */ } }, 15000);
          } else if (msg.type === 1 && msg.target === 'DonationCreated' && msg.arguments?.[0]) {
            handleDonation('dx', dxMap(msg.arguments[0]));
          } else if (msg.type === 7) {
            throw new Error(`DonateX закрыл соединение${msg.error ? ': ' + msg.error : ''}.`);
          }
        }
      } catch (error) {
        log('DonateX:', error.message);
        try { ws.close(); } catch (_) { /* уже закрыт */ }
      }
    };
    ws.onclose = () => { if (dx.ws === ws) dxSchedule(gen, 'Соединение потеряно.'); };
    ws.onerror = () => { /* onclose всё обработает */ };
  } catch (error) {
    log('DonateX:', error.name === 'AbortError' ? 'таймаут' : error.message);
    dxSchedule(gen, error.name === 'AbortError' ? 'DonateX не ответил вовремя.' : error.message);
  }
}

// ---------- список игр (data/pain.json на сайте) ----------

function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
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
async function loadGames() {
  try {
    const src = painListUrl();
    if (!src) throw new Error('Не задан адрес сайта (localhost:3777/admin → «Сайт»).');
    const res = await fetchWithTimeout(src + (src.includes('?') ? '&' : '?') + 'cache=' + Date.now(), {cache: 'no-store'});
    if (!res.ok) throw new Error(`Список игр недоступен (HTTP ${res.status}).`);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error('Вместо списка игр пришла веб-страница. Проверь ссылку на список.');
    // data/pain.json: {columns, items: [{name, ...}]}; старый CSV таблицы — первая колонка
    const raw = /^\s*\{/.test(text)
      ? (JSON.parse(text).items || []).map(g => g.name)
      : parseCSV(text).slice(1).map(r => r[0]);
    const names = new Map();
    for (const n of raw) {
      const name = (n || '').trim().replace(/\s+/g, ' ');
      if (name && !names.has(norm(name))) names.set(norm(name), name);
    }
    const games = [...names.values()];
    status.sheet = {state: games.length ? 'online' : 'error', text: games.length ? `${games.length} игр в списке` : 'Список игр пуст'};
    return games;
  } catch (error) {
    status.sheet = {state: 'error', text: error.name === 'AbortError' ? 'Сайт со списком игр не ответил вовремя.' : error.message};
    throw new Error(status.sheet.text);
  } finally { broadcast(); }
}

// ---------- крутки ----------

const GAME_SPIN_MS = 12500, TIME_SPIN_MS = 5500;
const spinBusy = () => state.spin && Date.now() < state.spin.revealAt;

async function spinGame() {
  if (spinBusy()) throw new Error('Рулетка ещё крутится.');
  if (state.painCredits < 1) throw new Error('Нет оплаченных круток игры.');
  if (timerLeft() > 0) throw new Error('Сначала доиграй: таймер прошлой игры не на нуле.');
  const games = await loadGames();
  if (!games.length) throw new Error('Список игр пуст.');
  // Перепроверяем после ожидания списка игр: за это время могли нажать ещё раз.
  if (spinBusy() || state.painCredits < 1 || timerLeft() > 0) throw new Error('Состояние изменилось, попробуй ещё раз.');
  const options = [...config.gameMinutes];
  const g = randomIndex(games.length), t = randomIndex(options.length), now = Date.now();
  state.painCredits--;
  state.game = {name: games[g], baseMinutes: options[t], extraMinutes: 0, at: now};
  setTimer(options[t] * 60000, false);
  state.spin = {id: crypto.randomUUID(), kind: 'game', games, gameIndex: g, options, timeIndex: t,
    minutes: options[t], game: games[g], at: now, revealAt: now + GAME_SPIN_MS};
  pushHistory('game', `${games[g]} — ${fmtMinutes(options[t])}`);
  log(`Крутка игры: «${games[g]}», ${fmtMinutes(options[t])}.`);
  changed();
}
function spinTime(auto = false) {
  if (spinBusy()) throw new Error('Рулетка ещё крутится.');
  if (state.timeCredits < 1) throw new Error('Нет оплаченных круток времени.');
  if (!state.game) throw new Error('Ещё не выпало ни одной игры — время не к чему добавлять.');
  const options = [...config.extraMinutes];
  const t = randomIndex(options.length), now = Date.now();
  state.timeCredits--;
  state.game.extraMinutes += options[t];
  state.timer.remainingMs += options[t] * 60000; // если таймер идёт — продолжит идти
  state.spin = {id: crypto.randomUUID(), kind: 'time', options, timeIndex: t, minutes: options[t],
    game: state.game.name, auto, at: now, revealAt: now + TIME_SPIN_MS};
  pushHistory('time', `+${fmtMinutes(options[t])} к «${state.game.name}»`);
  log(`Крутка времени${auto ? " (авто)" : ""}: +${fmtMinutes(options[t])} к «${state.game.name}».`);
  changed();
}
function fmtMinutes(n) {
  if (n % 60) return `${n} мин`;
  const h = n / 60, tail = h % 100;
  const word = tail >= 11 && tail <= 14 ? 'часов' : h % 10 === 1 ? 'час' : h % 10 >= 2 && h % 10 <= 4 ? 'часа' : 'часов';
  return `${h} ${word}`;
}

// ---------- live-обновления (SSE) ----------

const clients = new Set();
function snapshot() {
  return {
    now: Date.now(),
    config: {painPrice: config.painPrice, timePrice: config.timePrice, painTag: config.painTag,
      timeTag: config.timeTag, gameMinutes: config.gameMinutes, extraMinutes: config.extraMinutes},
    painBank: state.painBank, timeBank: state.timeBank,
    painCredits: state.painCredits, timeCredits: state.timeCredits,
    game: state.game, timer: {remainingMs: timerLeft(), running: !!state.timer.runningSince},
    spin: state.spin, history: state.history.slice(0, 30), donations: state.donations.slice(0, 50),
    status,
  };
}
let broadcastQueued = false;
function broadcast() {
  if (broadcastQueued) return;
  broadcastQueued = true;
  setImmediate(() => {
    broadcastQueued = false;
    const data = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of clients) res.write(data);
  });
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

// ---------- HTTP ----------

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 65536) { reject(new Error('Слишком большой запрос.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (_) { reject(new Error('Неверный JSON.')); } });
    req.on('error', reject);
  });
}
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav'};
// Рулетка живёт на сайте (тот же дизайн, что у рулетки заказов); старая — запасной /pain-classic
// Адрес сайта из настроек: всегда со слешем на конце; пусто — сайта нет, работает только сам мост
const siteUrl = () => { const u = String(config.siteUrl || '').trim(); return u ? u.replace(/\/*$/, '/') : ''; };
const siteOrigin = () => { try { return new URL(siteUrl()).origin; } catch (_) { return ''; } };
const painListUrl = () => config.sheetCsv || (siteUrl() ? siteUrl() + 'data/pain.json?from=bridge' : '');
const PAGES = {'/pain-classic': 'pain.html', '/overlay': 'overlay.html', '/widget': 'widget.html', '/admin': 'admin.html'};
function num(v, min, max) { const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Число вне диапазона ${min}…${max}.`); return n; }
function minutesList(v) {
  const list = (Array.isArray(v) ? v : String(v).split(/[,;\s]+/)).filter(x => x !== '').map(x => Math.round(num(x, 1, 10000)));
  if (!list.length || list.length > 24) throw new Error('Нужно от 1 до 24 вариантов времени.');
  return list;
}

const handlers = {
  'GET /api/state': () => snapshot(),
  'GET /api/games': async () => ({games: await loadGames()}),
  'POST /api/spin/game': async () => { await spinGame(); return {ok: true}; },
  'POST /api/spin/time': () => { spinTime(); return {ok: true}; },
  'POST /api/timer': body => {
    const left = timerLeft();
    if (body.action === 'start') { if (left <= 0) throw new Error('Таймер на нуле.'); setTimer(left, true); log('Таймер: старт.'); }
    else if (body.action === 'pause') { setTimer(left, false); log('Таймер: пауза.'); }
    else if (body.action === 'reset') { setTimer(0, false); log('Таймер: сброс.'); pushHistory('reset', 'Таймер сброшен вручную'); }
    else if (body.action === 'set') {
      const ms = (num(body.hours || 0, 0, 999) * 60 + num(body.minutes || 0, 0, 59999)) * 60000;
      setTimer(ms, false); log(`Таймер: задан вручную ${Math.round(ms / 60000)} мин.`);
    } else throw new Error('Неизвестное действие таймера.');
    changed(); return {ok: true};
  },
  'POST /api/admin/set': body => {
    for (const k of ['painBank', 'timeBank']) if (body[k] !== undefined) state[k] = round2(num(body[k], 0, 1e7));
    for (const k of ['painCredits', 'timeCredits']) if (body[k] !== undefined) state[k] = Math.round(num(body[k], 0, 1000));
    if (body.gameName !== undefined) {
      const name = String(body.gameName).trim().slice(0, 120);
      state.game = name ? {...(state.game || {baseMinutes: 0, extraMinutes: 0, at: Date.now()}), name} : null;
    }
    log('Ручная правка:', JSON.stringify(body)); changed(); return {ok: true};
  },
  'POST /api/admin/donate': body => {
    const tag = body.tag === 'time' ? 'time' : 'pain';
    handleDonation('manual', {id: crypto.randomUUID(), username: String(body.username || 'Вручную'), message: '',
      rub: num(body.amount, 1, 1e6), isTest: false}, {forceTag: tag});
    return {ok: true};
  },
  'GET /api/config': () => ({...config, donationAlerts: {clientId: config.donationAlerts.clientId, hasSecret: !!config.donationAlerts.clientSecret},
    donatex: {hasToken: !!config.donatex.token}, redirectUri: DA_REDIRECT}),
  'POST /api/config': body => {
    const next = structuredClone(config);
    if (body.painPrice !== undefined) next.painPrice = Math.round(num(body.painPrice, 1, 1e6));
    if (body.timePrice !== undefined) next.timePrice = Math.round(num(body.timePrice, 1, 1e6));
    for (const k of ['painTag', 'timeTag']) if (body[k] !== undefined) {
      const tag = String(body[k]).trim();
      if (tag.length < 2 || tag.length > 30) throw new Error('Метка должна быть от 2 до 30 символов.');
      next[k] = tag;
    }
    if (norm(next.painTag) === norm(next.timeTag)) throw new Error('Метки должны различаться.');
    if (body.gameMinutes !== undefined) next.gameMinutes = minutesList(body.gameMinutes);
    if (body.extraMinutes !== undefined) next.extraMinutes = minutesList(body.extraMinutes);
    if (body.countTestDonations !== undefined) next.countTestDonations = !!body.countTestDonations;
    if (body.sheetCsv !== undefined) next.sheetCsv = String(body.sheetCsv).trim();
    if (body.siteUrl !== undefined) {
      const u = String(body.siteUrl).trim();
      if (u && !/^https?:\/\/[^/\s]+/i.test(u)) throw new Error('Адрес сайта должен начинаться с https://');
      next.siteUrl = u ? u.replace(/\/*$/, '/') : '';
    }
    if (body.daClientId !== undefined) next.donationAlerts.clientId = String(body.daClientId).trim();
    if (body.daClientSecret) next.donationAlerts.clientSecret = String(body.daClientSecret).trim();
    if (body.dxToken) next.donatex.token = String(body.dxToken).trim();
    const daChanged = next.donationAlerts.clientId !== config.donationAlerts.clientId || next.donationAlerts.clientSecret !== config.donationAlerts.clientSecret;
    const dxChanged = next.donatex.token !== config.donatex.token;
    config = next; writeJSON(CONFIG_FILE, config);
    log('Настройки сохранены.');
    if (daChanged) daConnect();
    if (dxChanged) dxConnect();
    broadcast(); return {ok: true};
  },
  'POST /api/reconnect': () => { daConnect(); dxConnect(); return {ok: true}; },
};

// ---------- модификаторы с рулетки карточек (сайт cards.html → оверлей mods.html) ----------
// Сайт шлёт список активных модификаторов целиком, оверлей слушает /api/mods/events.
// Пускаем только свой сайт и localhost: CORS + нестандартный заголовок на POST.
const MODS_FILE = path.join(DATA, 'mods.json');
let mods = readJSON(MODS_FILE, {mods: [], updatedAt: 0});
const modClients = new Set();
function modsCors(req) {
  const o = String(req.headers.origin || '');
  if ((o && o === siteOrigin()) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return {'Access-Control-Allow-Origin': o, Vary: 'Origin'};
  return {};
}
function cleanMod(m) {
  const str = (v, n) => String(v ?? '').slice(0, n);
  const t = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  return {id: str(m.id, 40), cardId: str(m.cardId, 40), text: str(m.text, 300), kind: str(m.kind, 20), kindLabel: str(m.kindLabel, 40),
    group: str(m.group, 60), rarity: str(m.rarity, 40), color: /^#[0-9a-f]{3,8}$/i.test(m.color || '') ? m.color : '#FAC775',
    target: str(m.target, 30), durationSec: Math.max(0, Math.min(86400, Math.round(Number(m.durationSec) || 0))),
    startedAt: t(m.startedAt), endsAt: t(m.endsAt), hideAt: t(m.hideAt)};
}
function modsBroadcast() {
  const data = `data: ${JSON.stringify(mods)}\n\n`;
  for (const res of modClients) res.write(data);
}
setInterval(() => { for (const res of modClients) res.write(': ping\n\n'); }, 20000);
async function handleMods(req, res, route) {
  const cors = modsCors(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Pain-Bridge',
      'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600'});
    return res.end();
  }
  const json = (code, body) => { res.writeHead(code, {...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(body)); };
  if (route === 'GET /api/mods/events') {
    res.writeHead(200, {...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive'});
    res.write(`retry: 3000\ndata: ${JSON.stringify(mods)}\n\n`);
    modClients.add(res);
    req.on('close', () => modClients.delete(res));
    return;
  }
  if (route === 'GET /api/mods') return json(200, mods);
  if (route === 'POST /api/mods') {
    if (req.headers['x-pain-bridge'] !== '1') return json(403, {error: 'Forbidden'});
    const body = await readBody(req);
    if (!Array.isArray(body.mods)) return json(400, {error: 'Нужен список mods.'});
    const updatedAt = Math.round(Number(body.updatedAt) || Date.now());
    if (updatedAt > (mods.updatedAt || 0)) {
      mods = {mods: body.mods.slice(0, 12).map(cleanMod).filter(m => m.id && m.text), updatedAt};
      try { writeJSON(MODS_FILE, mods); } catch (error) { log('Ошибка сохранения модификаторов:', error.message); }
      modsBroadcast();
    }
    return json(200, mods);
  }
  return json(404, {error: 'Not found'});
}

let daOAuthState = null;
const server = http.createServer(async (req, res) => {
  // Защита от DNS-rebinding и чужих сайтов: принимаем только наш localhost.
  const host = String(req.headers.host || '');
  if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`) return send(res, 403, {error: 'Forbidden host'});
  const url = new URL(req.url, ORIGIN);
  const route = `${req.method} ${url.pathname}`;
  try {
    if (url.pathname === '/api/mods' || url.pathname === '/api/mods/events') return await handleMods(req, res, route);
    // Пульт боли в админке сайта: тот же пропуск, что у модификаторов. Ключи (/api/config) сайту не отдаём.
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/config') {
      const cors = modsCors(req);
      for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Pain-Bridge',
          'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600'});
        return res.end();
      }
    }
    if (route === 'GET /api/events') {
      res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive'});
      res.write(`retry: 2000\ndata: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (route === 'GET /da/connect') {
      if (!config.donationAlerts.clientId) return send(res, 400, 'Сначала впиши ID приложения в админке.', 'text/plain; charset=utf-8');
      daOAuthState = crypto.randomBytes(16).toString('hex');
      const auth = new URL('https://www.donationalerts.com/oauth/authorize');
      auth.search = new URLSearchParams({client_id: config.donationAlerts.clientId, redirect_uri: DA_REDIRECT,
        response_type: 'code', scope: DA_SCOPES, state: daOAuthState}).toString();
      res.writeHead(302, {Location: auth.toString()}); return res.end();
    }
    if (route === 'GET /da/callback') {
      const code = url.searchParams.get('code');
      if (!code || !daOAuthState || url.searchParams.get('state') !== daOAuthState) {
        return send(res, 400, 'Авторизация не удалась или устарела. Вернись в админку и нажми «Подключить DonationAlerts» ещё раз.', 'text/plain; charset=utf-8');
      }
      daOAuthState = null;
      await daTokenRequest({grant_type: 'authorization_code', code, redirect_uri: DA_REDIRECT});
      log('DonationAlerts: авторизация получена.');
      daConnect();
      res.writeHead(302, {Location: '/admin?da=ok'}); return res.end();
    }
    const handler = handlers[route];
    if (handler) {
      let body = {};
      if (req.method === 'POST') {
        // Нестандартный заголовок заставляет браузер делать preflight — чужие сайты не смогут дёрнуть API.
        if (req.headers['x-pain-bridge'] !== '1') return send(res, 403, {error: 'Forbidden'});
        body = await readBody(req);
      }
      return send(res, 200, await handler(body));
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/pain')) {
      const q = new URLSearchParams(url.search);
      if (PORT !== 3777) q.set('bridge', `http://127.0.0.1:${PORT}`);
      // Адреса сайта нет — открываем рулетку самого моста
      const target = siteUrl() ? siteUrl() + 'pain.html' : '/pain-classic';
      res.writeHead(302, {Location: target + (String(q) ? '?' + String(q).replace(/=(&|$)/g, '$1') : '')});
      return res.end();
    }
    if (req.method === 'GET') {
      const file = PAGES[url.pathname] || url.pathname.slice(1);
      if (/^[\w.-]+$/.test(file) && !file.startsWith('.')) {
        const full = path.join(PUBLIC, file);
        if (fs.existsSync(full)) return send(res, 200, fs.readFileSync(full), TYPES[path.extname(file)] || 'application/octet-stream');
      }
    }
    send(res, 404, {error: 'Not found'});
  } catch (error) {
    send(res, 400, {error: error.message});
  }
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') { log(`Порт ${PORT} занят — похоже, мост уже запущен. Выходим.`); process.exit(0); }
  log('Ошибка сервера:', error.message); process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {
  log(`Мост запущен: ${ORIGIN}/pain · оверлей ${ORIGIN}/overlay · админка ${ORIGIN}/admin`);
  daConnect(); dxConnect();
  loadGames().catch(() => { /* статус уже выставлен */ });
});
process.on('uncaughtException', error => log('Необработанная ошибка:', error.stack || error.message));
process.on('unhandledRejection', error => log('Необработанная ошибка:', error?.stack || error));
