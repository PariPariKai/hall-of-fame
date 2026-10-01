// Собирает pain-meta.json: обложка, жанры, год и описание для игр из пула «Боль».
// Запускается GitHub Actions по расписанию (см. .github/workflows/pain-meta.yml) или вручную:
//   node .github/scripts/pain-meta.mjs
// Ищет только новые игры: уже найденные берутся из прошлого pain-meta.json.
// Источники: Steam (поиск + appdetails на русском), запасной — Wikidata (Steam ID по названию),
// последний — IGDB (нужны секреты репозитория TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET; без них пропускается).
// Колонка «Steam ID или картинка» в таблице перекрывает автопоиск.

import fs from 'node:fs';

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThU3PDQlG4EPkPHygpf1q54KuNuuc4WYWnGqZde3-8iD8buBBFLEkr3MIDdnvv-oekgEN0CXj7Bq6C/pub?gid=827100001&single=true&output=csv';
const OUT = new URL('../../pain-meta.json', import.meta.url);
const UA = {'User-Agent': 'hall-of-fame-pain-meta/1.0 (https://pariparikai.github.io/hall-of-fame/)'};
const RETRY_MISSING_DAYS = 7; // ненайденные игры перепроверяем раз в неделю
const IGDB_ID = process.env.TWITCH_CLIENT_ID || '', IGDB_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const IGDB_ON = !!(IGDB_ID && IGDB_SECRET);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = s => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

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
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function getJSON(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, {headers: UA, signal: AbortSignal.timeout(20000)});
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      if (i >= tries) { console.warn(`  ! ${url.slice(0, 90)}… — ${error.message}`); return null; }
      await sleep(3000 * i);
    }
  }
}

// ---------- сопоставление названий ----------

const ROMAN = {1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi', 7: 'vii', 8: 'viii', 9: 'ix', 10: 'x'};
const JUNK = /\b(soundtrack|ost|dlc|pack|bundle|demo|набор|саундтрек|season pass|artbook)\b/;
function tokens(s) {
  return s.toLowerCase().replace(/[™®©]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')
    .filter(Boolean).map(t => ROMAN[t] || t);
}
// Доля слов запроса, найденных в названии кандидата; лишние слова кандидата слегка штрафуются.
function score(query, candidate) {
  const q = tokens(query), c = tokens(candidate);
  if (!q.length || !c.length) return 0;
  const set = new Set(c);
  const hit = q.filter(t => set.has(t)).length / q.length;
  const extra = c.filter(t => !q.includes(t)).length;
  return hit - extra * 0.02 - (JUNK.test(candidate.toLowerCase()) ? 0.5 : 0);
}

async function steamSearch(name) {
  const json = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=russian&cc=RU`);
  const items = (json?.items || []).filter(i => i.type === 'app' || !i.type);
  let best = null;
  for (const item of items) {
    const s = score(name, item.name);
    if (!best || s > best.s) best = {id: item.id, s, name: item.name};
  }
  return best && best.s >= 0.6 ? best : null;
}

async function wikidataSteamId(name) {
  const search = await getJSON(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&uselang=ru&type=item&limit=5&format=json`);
  const ids = (search?.search || []).map(s => s.id);
  if (!ids.length) return null;
  await sleep(1500);
  const ents = await getJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json`);
  for (const id of ids) {
    const steam = ents?.entities?.[id]?.claims?.P1733?.[0]?.mainsnak?.datavalue?.value;
    if (steam && /^\d+$/.test(steam)) return Number(steam);
  }
  return null;
}

// ---------- IGDB (запасной источник, если Steam и Wikidata не нашли) ----------

// Жанры IGDB по-английски — приводим к названиям Steam, чтобы фильтр на сайте был общим.
const IGDB_GENRES = {
  'Adventure': 'Приключенческие игры', 'Role-playing (RPG)': 'Ролевые игры', 'Shooter': 'Экшены',
  'Fighting': 'Экшены', "Hack and slash/Beat 'em up": 'Экшены', 'Platform': 'Экшены', 'Arcade': 'Экшены',
  'Indie': 'Инди', 'Simulator': 'Симуляторы', 'Strategy': 'Стратегии', 'Real Time Strategy (RTS)': 'Стратегии',
  'Turn-based strategy (TBS)': 'Стратегии', 'Tactical': 'Стратегии', 'MOBA': 'Стратегии', 'Racing': 'Гонки',
  'Sport': 'Спортивные игры', 'Puzzle': 'Головоломки', 'Point-and-click': 'Приключенческие игры',
  'Visual Novel': 'Визуальные новеллы', 'Music': 'Ритм-игры', 'Card & Board Game': 'Настольные игры',
  'Quiz/Trivia': 'Казуальные игры', 'Pinball': 'Казуальные игры',
};
let igdbToken = null;
async function igdbAuth() {
  if (igdbToken !== null) return igdbToken;
  igdbToken = false;
  if (!IGDB_ON) return false;
  try {
    const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(IGDB_ID)}&client_secret=${encodeURIComponent(IGDB_SECRET)}&grant_type=client_credentials`,
      {method: 'POST', signal: AbortSignal.timeout(20000)});
    const json = await res.json();
    igdbToken = json.access_token || false;
    if (!igdbToken) console.warn(`  ! IGDB: Twitch не выдал токен (HTTP ${res.status}). Проверь секреты TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET.`);
  } catch (error) { console.warn('  ! IGDB: ' + error.message); }
  return igdbToken;
}
async function igdbSearch(name) {
  const token = await igdbAuth();
  if (!token) return null;
  const query = `search "${name.replace(/["\\]/g, ' ')}"; fields name,cover.image_id,genres.name,first_release_date,summary,url; where version_parent = null; limit 10;`;
  let list;
  try {
    const res = await fetch('https://api.igdb.com/v4/games', {method: 'POST', body: query, signal: AbortSignal.timeout(20000),
      headers: {'Client-ID': IGDB_ID, Authorization: 'Bearer ' + token, 'Content-Type': 'text/plain'}});
    if (!res.ok) { console.warn(`  ! IGDB: HTTP ${res.status}`); return null; }
    list = await res.json();
  } catch (error) { console.warn('  ! IGDB: ' + error.message); return null; }
  let best = null;
  for (const g of list) {
    const s = score(name, g.name);
    if (!best || s > best.s) best = {g, s};
  }
  if (!best || best.s < 0.6) return null;
  const g = best.g;
  console.log(`  IGDB: ${g.name} (${best.s.toFixed(2)})`);
  return {
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    genres: [...new Set((g.genres || []).map(x => IGDB_GENRES[x.name] || x.name))].slice(0, 4),
    description: (g.summary || '').slice(0, 400),
    cover: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${g.cover.image_id}.jpg` : null,
    igdbUrl: g.url, found: true, source: 'igdb',
  };
}

function decodeEntities(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}
async function imageExists(url) {
  try {
    const res = await fetch(url, {method: 'HEAD', headers: UA, signal: AbortSignal.timeout(15000)});
    return res.ok && (res.headers.get('content-type') || '').startsWith('image/');
  } catch (_) { return false; }
}
// Не жанры, а пометки магазина — в фильтр по жанрам не берём.
const NOT_GENRES = new Set(['Ранний доступ', 'Бесплатные', 'Бесплатно', 'Бесплатно для игры', 'Многопользовательские игры', 'Массовые многопользовательские']);
async function steamDetails(appid) {
  // Часть игр (EA, Bethesda…) убрана из российского Steam — тогда спрашиваем другие регионы.
  let d = null;
  for (const cc of ['ru', 'us', 'de']) {
    const json = await getJSON(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=russian&cc=${cc}`);
    d = json?.[appid];
    if (d?.success) break;
    await sleep(1200);
  }
  const base = `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}`;
  const cover = await imageExists(`${base}/library_600x900.jpg`) ? `${base}/library_600x900.jpg` : null;
  if (!d?.success) return {appid, cover, header: `${base}/header.jpg`};
  return {
    appid,
    title: d.data.name,
    year: Number((d.data.release_date?.date || '').match(/\d{4}/)?.[0]) || null,
    genres: (d.data.genres || []).map(g => g.description).filter(g => !NOT_GENRES.has(g)).slice(0, 4),
    description: decodeEntities(d.data.short_description || '').slice(0, 400),
    cover,
    header: d.data.header_image || `${base}/header.jpg`,
  };
}

// ---------- описания «от себя» (Claude API, нужен секрет ANTHROPIC_API_KEY) ----------

const QUIPS_ON = !!process.env.ANTHROPIC_API_KEY;
const QUIP_SYSTEM = `Ты пишешь подписи к карточкам игр на сайте стримера. Это пул «Боль»: игры, которые зрители заказывают, чтобы стример страдал. Он годами отказывался от соулслайков, гринда ради гринда, бесконечных повторяющихся каток и детских песочниц.

Напиши одну короткую подпись на русском (до 120 символов) — ироничную, в духе стрим-юмора: чем эта игра будет мучить стримера. Без спойлеров сюжета, без оскорблений, без кавычек вокруг ответа и без эмодзи. Ответь только текстом подписи.

Примеры подписей для других игр:`;
let anthropic = null;
async function makeQuip(entry, examples) {
  if (!anthropic) {
    const {default: Anthropic} = await import('@anthropic-ai/sdk');
    anthropic = new Anthropic();
  }
  const facts = [`Игра: ${entry.title || entry.name}`, entry.year && `Год: ${entry.year}`,
    entry.genres?.length && `Жанры: ${entry.genres.join(', ')}`, entry.description && `Описание из магазина: ${entry.description}`]
    .filter(Boolean).join('\n');
  try {
    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: {effort: 'low'},
      // При отказе фильтров запрос сам перезапускается на рекомендованной модели.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: `${QUIP_SYSTEM}\n${examples.map(q => '— ' + q).join('\n')}`,
      messages: [{role: 'user', content: facts}],
    });
    if (response.stop_reason === 'refusal') { console.warn(`  ! Claude отказался описывать «${entry.name}»`); return null; }
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
      .replace(/^["«„]|["»“]$/g, '').trim();
    return text && text.length <= 200 ? text : null;
  } catch (error) {
    console.warn(`  ! Claude API: ${error.status || ''} ${error.message}`);
    return null;
  }
}

// ---------- главный проход ----------

const res = await fetch(SHEET_CSV + '&cache=' + Date.now(), {headers: UA});
if (!res.ok) throw new Error(`Таблица недоступна: HTTP ${res.status}`);
const rows = parseCSV(await res.text());
const header = rows[0].map(h => h.trim().toLowerCase());
if (header[0] !== 'название игры') throw new Error('Первая колонка таблицы должна называться «Название игры».');
const overrideCol = header.findIndex(h => /steam|картин/.test(h));

const games = new Map();
for (const r of rows.slice(1)) {
  const name = (r[0] || '').trim().replace(/\s+/g, ' ');
  if (name && !games.has(key(name))) games.set(key(name), {name, override: overrideCol >= 0 ? (r[overrideCol] || '').trim() : ''});
}

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {games: {}};
const out = {};
let looked = 0;
for (const [k, {name, override}] of games) {
  const old = prev.games[k];
  // Ненайденную игру перепроверяем раз в неделю — или сразу, если появились рабочие ключи IGDB.
  const fresh = old && old.override === override &&
    (old.found || (Date.now() - Date.parse(old.checked) < RETRY_MISSING_DAYS * 864e5 && (old.igdbTried || !(await igdbAuth()))));
  if (fresh) { out[k] = old; continue; }

  looked++;
  console.log(`→ ${name}${override ? ` [${override}]` : ''}`);
  const entry = {name, override, checked: new Date().toISOString(), found: false};
  let appid = null;
  if (/^https?:\/\//i.test(override)) {
    entry.cover = override; entry.found = true; entry.source = 'таблица';
  } else if (/^\d+$/.test(override)) {
    appid = Number(override);
  } else {
    const hit = await steamSearch(name);
    if (hit) { appid = hit.id; console.log(`  Steam: ${hit.name} (${hit.id}, ${hit.s.toFixed(2)})`); }
    else {
      await sleep(1500);
      appid = await wikidataSteamId(name);
      if (appid) console.log(`  Wikidata → Steam ${appid}`);
    }
  }
  if (appid) {
    await sleep(1200);
    Object.assign(entry, await steamDetails(appid), {found: true, source: 'steam', steamUrl: `https://store.steampowered.com/app/${appid}/`});
  }
  // Помечаем «IGDB проверен» только при рабочих ключах — иначе после их добавления игра не перепроверится.
  if (!entry.found && await igdbAuth()) {
    entry.igdbTried = true;
    const hit = await igdbSearch(name);
    if (hit) Object.assign(entry, hit);
  }
  if (!entry.found) console.log('  не найдено');
  out[k] = entry;
  await sleep(1200);
}

// Описание «от себя» — только для найденных игр (иначе модели не на что опереться) и только один раз.
if (QUIPS_ON) {
  const examples = Object.values(out).map(e => e.quip).filter(Boolean).slice(0, 8);
  for (const entry of Object.values(out)) {
    if (entry.quip || !entry.found || !(entry.title || entry.description)) continue;
    const quip = await makeQuip(entry, examples);
    if (quip) { entry.quip = quip; console.log(`  ✎ ${entry.name}: ${quip}`); }
  }
}

const next = {note: 'Генерируется автоматически .github/scripts/pain-meta.mjs — руками не править.', games: out};
const before = JSON.stringify(prev.games), after = JSON.stringify(out);
if (before !== after) {
  fs.writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`pain-meta.json обновлён: игр ${games.size}, проверено заново ${looked}.`);
} else {
  console.log('Изменений нет.');
}
