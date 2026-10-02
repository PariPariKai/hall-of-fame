// Собирает orders-meta.json: ссылка и обложка для заказов (аниме, фильмы, сериалы, игры), когда их нет в таблице.
// Запускается GitHub Actions по расписанию (см. .github/workflows/orders-meta.yml) или вручную:
//   node .github/scripts/orders-meta.mjs
// Ищет только новые тайтлы: уже найденные берутся из прошлого orders-meta.json.
//
// Источники:
//   1. Ссылка на Кинопоиск в колонке url — обложка берётся по её ID (так можно поправить неверную находку).
//   2. Wikidata: ID Кинопоиска по названию → ссылка kinopoisk.ru и постер с CDN Кинопоиска.
//   3. Только для аниме, если Кинопоиск не нашёлся: обложка с Shikimori, ссылка на World Art (иначе на Shikimori).
//      Картинки World Art не берём: у сайта нет https, браузер не покажет их на GitHub Pages.
//   4. Игры: ссылка на Steam в url или поиск Steam → Wikidata → IGDB (общий с «Болью» lib/games.mjs).
// Сайт берёт отсюда только то, чего нет в таблице: заполненные руками url / cover_url главнее.
//
// Ещё робот дописывает в orders-quips.json короткие смешные подписи для оборота карточек
// (аниме, фильмы, сериалы) — только новым тайтлам и только если есть секрет ANTHROPIC_API_KEY.

import fs from 'node:fs';
import {steamSearch, wikidataSteamId, steamDetails, igdbSearch} from './lib/games.mjs';

const CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThU3PDQlG4EPkPHygpf1q54KuNuuc4WYWnGqZde3-8iD8buBBFLEkr3MIDdnvv-oekgEN0CXj7Bq6C/pub?single=true&output=csv&gid=';
const OUT = new URL('../../orders-meta.json', import.meta.url);
const UA = {'User-Agent': 'hall-of-fame-orders-meta/1.0 (https://pariparikai.github.io/hall-of-fame/)'};
const RETRY_MISSING_DAYS = 7; // ненайденное перепроверяем раз в неделю

// want/avoid — подсказки по описанию в Wikidata, чтобы «Врата»-аниме не путались с «Вратами»-фильмом.
// avoid смотрит только на начало описания («японская манга», «2009 video game»): «фильм по мотивам романа» — не роман.
const NOT_SCREEN = String.raw`роман|novel|манга|manga|ранобэ|light novel|видеоигр|video game|компьютерн\S* игр|игра|game|album|альбом|song|песня|комикс|comic`;
const lead = words => new RegExp(String.raw`^(?:[\p{L}\p{N}-]+\s+){0,3}(?:${words})`, 'iu');
// kind: 'screen' — Кинопоиск/Shikimori, 'game' — Steam (общий поиск с «Болью», lib/games.mjs)
const LISTS = {
  anime:  {gid: '627100001', kind: 'screen', want: /аниме|anime|мульт|animat/i, avoid: lead(NOT_SCREEN), requireWant: true, kpPath: 'film'},
  movies: {gid: '627100002', kind: 'screen', want: /фильм|film|мульт|movie/i, avoid: lead(NOT_SCREEN + '|телесериал|сериал|television series|tv series|web series'), kpPath: 'film'},
  series: {gid: '627100003', kind: 'screen', want: /сериал|series|дорам|drama/i, avoid: lead(NOT_SCREEN + '|фильм|film'), kpPath: 'series'},
  games:  {gid: '727100001', kind: 'game'},
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (list, title) => list + '|' + title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');

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

function tokens(s) {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/&[#\w]+;/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}
// Расстояние Левенштейна — чтобы опечатки вроде «дьяволського» не мешали найти тайтл
function lev(a, b) {
  const d = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b) <= (a.length >= 8 ? 2 : 1));
// Доля слов запроса, найденных в названии кандидата; лишние слова кандидата слегка штрафуются.
function score(query, candidate) {
  const q = tokens(query), c = tokens(candidate || '');
  if (!q.length || !c.length) return 0;
  const hit = q.filter(t => c.some(x => sameWord(t, x))).length / q.length;
  return hit - c.filter(x => !q.some(t => sameWord(t, x))).length * 0.05;
}
// «Мгла / Туман / The mist», «Отмель 2016», «маг целитель (на бусти)», «Неукротимый (сериал 2019)» →
// варианты названия без пометок + год как подсказка
function parseTitle(title) {
  let t = title.replace(/[«»"“”„]/g, ' ');
  let year = null;
  t = t.replace(/\(([^)]*)\)/g, (_, inner) => {
    const y = inner.match(/\b(?:19|20)\d{2}\b/);
    if (y) year = Number(y[0]);
    return ' ';
  });
  const tail = t.match(/\s((?:19|20)\d{2})\s*$/);
  if (tail) { year = year || Number(tail[1]); t = t.slice(0, tail.index); }
  const names = t.split(/\s+\/\s+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => /\p{L}{2}/u.test(s));
  return {names, year};
}

// ---------- Кинопоиск через Wikidata ----------

// Кандидаты из двух поисков: по началу названия (точный) и полнотекстовый среди записей с ID Кинопоиска
// (находит «V значит Вендетта» по ««V» значит Вендетта»). Выбор — по сходству названия, описанию, году;
// при равенстве — тот, у кого больше статей в Википедиях (то есть более известный).
async function wikidataKp(names, year, cfg) {
  const ids = new Set();
  for (const name of names) {
    const a = await getJSON(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=ru&uselang=ru&type=item&limit=8&format=json`);
    (a?.search || []).forEach(h => ids.add(h.id));
    await sleep(500);
    const b = await getJSON(`https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' haswbstatement:P2603')}&srlimit=8&format=json`);
    (b?.query?.search || []).forEach(h => ids.add(h.title));
    await sleep(500);
  }
  if (!ids.size) return null;
  const list = [...ids].slice(0, 50);
  const ents = await getJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${list.join('|')}&props=labels|aliases|descriptions|claims|sitelinks&languages=ru|en&format=json`);
  let best = null;
  for (const id of list) {
    const e = ents?.entities?.[id];
    const kp = e?.claims?.P2603?.[0]?.mainsnak?.datavalue?.value;
    if (!kp || !/^\d+$/.test(kp)) continue;
    const titles = [e.labels?.ru?.value, e.labels?.en?.value,
      ...(e.aliases?.ru || []).map(x => x.value), ...(e.aliases?.en || []).map(x => x.value)].filter(Boolean);
    let s = Math.max(...names.flatMap(n => titles.map(t => score(n, t))));
    const descs = [e.descriptions?.ru?.value, e.descriptions?.en?.value].filter(Boolean);
    const desc = descs.join(' · ');
    const wanted = cfg.want.test(desc);
    if (cfg.requireWant && !wanted) continue;
    if (wanted) s += 0.3;
    if (descs.some(d => cfg.avoid.test(d))) s -= 0.4;
    const y = Number(String(e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time || '').match(/\d{4}/)?.[0]) || null;
    if (year && y) s += Math.abs(y - year) <= 1 ? 0.3 : -0.6; // год — сильный признак: другой год отбрасываем
    const pop = Object.keys(e.sitelinks || {}).length;
    if (!best || s > best.s + 1e-9 || (Math.abs(s - best.s) <= 1e-9 && pop > best.pop)) {
      best = {kp, s, pop, label: e.labels?.ru?.value || e.labels?.en?.value || id, desc};
    }
  }
  return best && best.s >= 0.75 ? best : null;
}

// Постер по ID: CDN Кинопоиска редиректит на картинку; без постера отдаёт заглушку без редиректа.
async function kpPoster(id) {
  try {
    const res = await fetch(`https://st.kp.yandex.net/images/film_big/${id}.jpg`, {method: 'HEAD', headers: UA, signal: AbortSignal.timeout(20000)});
    if (res.ok && /avatars\.mds\.yandex\.net\/get-kinopoisk-image\//.test(res.url)) return res.url.replace(/\/[^/]+$/, '/600x900');
  } catch (_) { /* нет постера — не страшно */ }
  return null;
}

// ---------- запасной путь для аниме: Shikimori + World Art ----------

async function shikimori(name, year) {
  const list = await getJSON(`https://shikimori.one/api/animes?search=${encodeURIComponent(name)}&limit=8`);
  let best = null;
  for (const a of list || []) {
    let s = Math.max(score(name, a.russian), score(name, a.name));
    const y = Number((a.aired_on || '').slice(0, 4)) || null;
    if (year && y) s += Math.abs(y - year) <= 1 ? 0.3 : -0.6; // год — сильный признак: другой год отбрасываем
    if (!best || s > best.s) best = {a, s};
  }
  if (!best || best.s < 0.97) return null;
  const a = best.a;
  return {
    title: a.russian || a.name,
    cover: a.image?.original && !/missing/.test(a.image.original) ? 'https://shikimori.one' + a.image.original.replace(/\?.*$/, '') : null,
    shikiUrl: 'https://shikimori.one' + a.url,
  };
}

// World Art ищет в windows-1251
function cp1251(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    const b = c < 128 ? c : c >= 0x410 && c <= 0x44F ? c - 0x350 : c === 0x401 ? 0xA8 : c === 0x451 ? 0xB8 : null;
    if (b === null) continue;
    out += /[A-Za-z0-9]/.test(ch) ? ch : '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}
async function worldArt(name, year) {
  let html;
  try {
    const res = await fetch(`http://www.world-art.ru/search.php?public_search=${cp1251(name)}&global_sector=animation`, {headers: UA, signal: AbortSignal.timeout(20000)});
    if (!res.ok) return null;
    html = new TextDecoder('windows-1251').decode(await res.arrayBuffer());
  } catch (error) { console.warn('  ! World Art: ' + error.message); return null; }
  // Единственное совпадение — World Art сразу перенаправляет на страницу тайтла
  const direct = html.match(/url=\/animation\/animation\.php\?id=(\d+)/i);
  if (direct) return `http://www.world-art.ru/animation/animation.php?id=${direct[1]}`;
  let best = null;
  for (const m of html.matchAll(/animation\.php\?id=(\d+)["'][^>]*class=.review.>([^<]+)</g)) {
    const text = m[2].replace(/&nbsp;/g, ' ');
    const title = text.replace(/\s*\(.*$/, '');
    let s = score(name, title);
    const y = Number(text.match(/\((\d{4})/)?.[1]) || null;
    if (year && y) s += Math.abs(y - year) <= 1 ? 0.2 : -0.3;
    if (!best || s > best.s) best = {id: m[1], s};
  }
  return best && best.s >= 0.9 ? `http://www.world-art.ru/animation/animation.php?id=${best.id}` : null;
}

// ---------- игры: Steam → Wikidata → IGDB (как у «Боли») ----------

// Обложка — вертикальная 600x900, а если у игры её нет — шапка магазина (сайт впишет её без обрезки)
// addedYear — год из date_added: неточно совпавшая игра не может выйти позже, чем её добавили в таблицу
// (так «Stone Simulator» 2025 года не путается с «SSO: Stone Simulator Online» 2026-го).
// Точные совпадения не проверяем: у вышедших из раннего доступа (Valheim) Steam пишет дату релиза 1.0.
const saveSteam = (entry, appid, d) => Object.assign(entry, {appid, url: `https://store.steampowered.com/app/${appid}/`,
  cover: d.cover || d.header, found: true, source: 'steam'});

async function findGame(entry, names, steamFromUrl, addedYear) {
  if (steamFromUrl) { saveSteam(entry, Number(steamFromUrl), await steamDetails(Number(steamFromUrl))); return; }
  for (const n of names) {
    const exclude = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
      const hit = await steamSearch(n, {strict: true, exclude});
      await sleep(1000);
      if (!hit) break;
      console.log(`  Steam: ${hit.name} (${hit.id}, ${hit.s.toFixed(2)})`);
      const d = await steamDetails(hit.id);
      if (hit.s < 1 && addedYear && d.year && d.year > addedYear) {
        console.log(`  отброшено: вышла в ${d.year}, а добавлена в ${addedYear}`);
        exclude.add(hit.id);
        continue;
      }
      saveSteam(entry, hit.id, d);
      return;
    }
  }
  const wd = await wikidataSteamId(names[0]);
  if (wd) {
    console.log(`  Wikidata → Steam ${wd}`);
    await sleep(1000);
    saveSteam(entry, wd, await steamDetails(wd));
    return;
  }
  const hit = await igdbSearch(names[0]); // только если в репозитории есть ключи Twitch
  if (hit) Object.assign(entry, {url: hit.igdbUrl, cover: hit.cover, found: true, source: 'igdb'});
}

// ---------- главный проход ----------

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {items: {}};
const out = {};
const seen = []; // все тайтлы аниме/фильмов/сериалов — для подписей
let looked = 0;

for (const [list, cfg] of Object.entries(LISTS)) {
  const res = await fetch(CSV + cfg.gid + '&cache=' + Date.now(), {headers: UA});
  if (!res.ok) throw new Error(`Лист ${list} недоступен: HTTP ${res.status}`);
  const rows = parseCSV(await res.text());
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = n => header.indexOf(n);
  const [cTitle, cUrl, cCover, cType, cYear, cAdded] = [col('title'), col('url'), col('cover_url'), col('type'), col('year'), col('date_added')];
  if (cTitle < 0) throw new Error(`В листе ${list} нет колонки title`);

  for (const r of rows.slice(1)) {
    const title = (r[cTitle] || '').trim().replace(/\s+/g, ' ');
    if (!title || !/\p{L}{2}/u.test(title)) continue;
    if (cfg.kind === 'screen') seen.push({list, title, url: cUrl >= 0 ? (r[cUrl] || '').trim() : '', type: cType >= 0 ? (r[cType] || '').trim() : ''});
    if (cType >= 0 && /^youtube$/i.test((r[cType] || '').trim())) continue; // у YouTube обложку даёт сам сайт
    const url = cUrl >= 0 ? (r[cUrl] || '').trim() : '';
    const cover = cCover >= 0 ? (r[cCover] || '').trim() : '';
    if (url && cover) continue; // всё уже есть в таблице
    const k = key(list, title);
    if (out[k]) continue;

    // ID из ссылки в url (Кинопоиск или Steam) — по нему ищем обложку вместо поиска по названию
    const fromUrl = (cfg.kind === 'game'
      ? url.match(/store\.steampowered\.com\/app\/(\d+)/)
      : url.match(/kinopoisk\.ru\/(?:film|series)\/(\d+)/))?.[1] || '';
    // Год из колонки year главнее года в названии; поменяли год или ссылку — ищем заново
    const parsed = parseTitle(title);
    if (!parsed.names.length) continue;
    const year = Number(((cYear >= 0 ? r[cYear] : '') || '').match(/(?:19|20)\d{2}/)?.[0]) || parsed.year;
    const old = prev.items[k];
    const fresh = old && (old.fromUrl || '') === fromUrl && (old.year || null) === year &&
      (old.found || Date.now() - Date.parse(old.checked) < RETRY_MISSING_DAYS * 864e5);
    if (fresh) { out[k] = old; continue; }

    looked++;
    console.log(`→ [${list}] ${title}`);
    const entry = {list, title, checked: new Date().toISOString(), found: false};
    if (fromUrl) entry.fromUrl = fromUrl;
    if (year) entry.year = year;
    const {names} = parsed;
    const name = names[0];

    if (cfg.kind === 'game') {
      const addedYear = Number(((cAdded >= 0 ? r[cAdded] : '') || '').match(/(?:19|20)\d{2}/)?.[0]) || null;
      await findGame(entry, names, fromUrl, addedYear);
      if (!entry.found) console.log('  не найдено');
      else console.log(`  ${entry.url}${entry.cover ? '' : ' (без обложки)'}`);
      out[k] = entry;
      await sleep(1000);
      continue;
    }

    let kp = fromUrl;
    if (!kp) {
      const hit = await wikidataKp(names, year, cfg);
      if (hit) { kp = hit.kp; console.log(`  Wikidata: ${hit.label} — ${hit.desc} (${hit.s.toFixed(2)})`); }
      await sleep(800);
    }
    if (kp) {
      entry.kp = kp;
      entry.url = `https://www.kinopoisk.ru/${cfg.kpPath}/${kp}/`;
      entry.cover = await kpPoster(kp);
      entry.found = true;
      entry.source = 'kinopoisk';
      if (!entry.cover) console.log('  постера на Кинопоиске нет');
    }
    if (list === 'anime' && (!entry.found || !entry.cover)) {
      const sh = await shikimori(name, year);
      await sleep(800);
      if (sh) {
        console.log(`  Shikimori: ${sh.title}`);
        entry.cover = entry.cover || sh.cover;
        if (!entry.url) {
          entry.url = await worldArt(name, year) || sh.shikiUrl;
          entry.source = /world-art/.test(entry.url) ? 'world-art' : 'shikimori';
        }
        entry.found = true;
      }
    }
    if (!entry.found) console.log('  не найдено');
    else console.log(`  ${entry.url}${entry.cover ? '' : ' (без обложки)'}`);
    out[k] = entry;
    await sleep(800);
  }
}

// ---------- подписи для оборота карточек (Claude API) ----------

const QUIPS = new URL('../../orders-quips.json', import.meta.url);
const QUIP_SYSTEM = `Ты пишешь подписи к карточкам на сайте стримера: зрители заказывают ему аниме, фильмы, сериалы и видео, он смотрит их на стриме.

Напиши одну короткую смешную подпись на русском (до 130 символов): о чём это, без спойлеров, и подколка в адрес стримера на «ты» в духе стрим-юмора. Без мата, без оскорблений по внешности, национальности и тому подобному, без кавычек вокруг ответа и без эмодзи. Если не знаешь, что это за тайтл, шути от названия и не выдумывай сюжет. Ответь только текстом подписи.

Примеры подписей для других заказов:`;
// Заглушки вроде «пока не решила» подписывать не нужно
const PLACEHOLDER = /не\s*реш|не\s*придум|пу-пу-пу|^\W*$/i;

async function makeQuips() {
  const file = fs.existsSync(QUIPS) ? JSON.parse(fs.readFileSync(QUIPS, 'utf8')) : {items: {}};
  const todo = [];
  for (const s of seen) {
    const k = key(s.list, s.title);
    if (!file.items[k] && !PLACEHOLDER.test(s.title) && !todo.some(x => x.k === k)) todo.push({...s, k});
  }
  if (!todo.length) return;
  const {default: Anthropic} = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic();
  const examples = Object.values(file.items).sort(() => Math.random() - 0.5).slice(0, 10);
  const kinds = {anime: 'аниме', movies: 'фильм или видео', series: 'сериал или дорама'};
  let added = 0;
  for (const s of todo.slice(0, 30)) { // за один запуск не больше 30, остальное — в следующий раз
    const meta = out[s.k] || {};
    const facts = [`Список: ${kinds[s.list]}${/youtube/i.test(s.type) ? ' (YouTube)' : ''}`, `Название: ${s.title}`,
      (s.url || meta.url) && `Ссылка: ${s.url || meta.url}`, meta.year && `Год: ${meta.year}`].filter(Boolean).join('\n');
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
      if (response.stop_reason === 'refusal') { console.warn(`  ! Claude отказался подписывать «${s.title}»`); continue; }
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
        .replace(/^["«„]|["»“]$/g, '').trim();
      if (text && text.length <= 200) { file.items[s.k] = text; added++; console.log(`  ✎ ${s.title}: ${text}`); }
    } catch (error) {
      console.warn(`  ! Claude API: ${error.status || ''} ${error.message}`);
    }
  }
  if (added) {
    file.items = Object.fromEntries(Object.entries(file.items).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(QUIPS, JSON.stringify(file, null, 2) + '\n');
    console.log(`orders-quips.json: добавлено подписей ${added}.`);
  }
}
if (process.env.ANTHROPIC_API_KEY) await makeQuips();

const next = {note: 'Генерируется автоматически .github/scripts/orders-meta.mjs — руками не править.', items: out};
if (JSON.stringify(prev.items) !== JSON.stringify(out)) {
  fs.writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`orders-meta.json обновлён: тайтлов ${Object.keys(out).length}, проверено заново ${looked}.`);
} else {
  console.log('Изменений нет.');
}
