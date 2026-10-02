// Собирает pain-meta.json: обложка, жанры, год и описание для игр из пула «Боль».
// Запускается GitHub Actions по расписанию (см. .github/workflows/pain-meta.yml) или вручную:
//   node .github/scripts/pain-meta.mjs
// Ищет только новые игры: уже найденные берутся из прошлого pain-meta.json.
// Поиск игр (Steam → Wikidata → IGDB) — в общем модуле lib/games.mjs, им же пользуется orders-meta.mjs.
// Колонка «Steam ID или картинка» в таблице перекрывает автопоиск.

import fs from 'node:fs';
import {sleep, steamSearch, wikidataSteamId, steamDetails, igdbAuth, igdbSearch} from './lib/games.mjs';

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThU3PDQlG4EPkPHygpf1q54KuNuuc4WYWnGqZde3-8iD8buBBFLEkr3MIDdnvv-oekgEN0CXj7Bq6C/pub?gid=827100001&single=true&output=csv';
const OUT = new URL('../../pain-meta.json', import.meta.url);
const UA = {'User-Agent': 'hall-of-fame-pain-meta/1.0 (https://pariparikai.github.io/hall-of-fame/)'};
const RETRY_MISSING_DAYS = 7; // ненайденные игры перепроверяем раз в неделю

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

// ---------- описания «от себя» (Claude API, нужен секрет ANTHROPIC_API_KEY) ----------

const QUIPS_ON = !!process.env.ANTHROPIC_API_KEY;
const QUIP_SYSTEM = `Ты пишешь подписи к карточкам игр на сайте стримера. Это пул «Боль»: игры, которые зрители заказывают, чтобы стример страдал. Он годами отказывался от соулслайков, гринда ради гринда, бесконечных повторяющихся каток и детских песочниц.

Напиши одну короткую подпись на русском (до 130 символов) — злую, жёсткую подколку в адрес стримера в духе стрим-юмора: чем именно эта игра будет его мучить и унижать. Обращайся к стримеру на «ты». Чёрный юмор и грубоватость можно, жалеть стримера нельзя. Без мата, без спойлеров сюжета, без оскорблений по внешности, национальности и тому подобному, без кавычек вокруг ответа и без эмодзи. Ответь только текстом подписи.

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
