// Собирает steam.json: статистика Steam стримера, но только по играм из заказов зрителей (data/games.json) —
// сколько часов наиграно в Steam и когда запускал в последний раз. Вся библиотека (13 тыс. игр) на сайт не попадает.
// Запускается GitHub Actions (см. .github/workflows/steam-stats.yml) или вручную:
//   STEAM_API_KEY=... node .github/scripts/steam-stats.mjs
// Ключ Steam Web API — только в секрете репозитория STEAM_API_KEY: на сайт и в репозиторий он не попадает.
// Профиль должен быть открытым, включая «Сведения об играх», иначе Steam отдаёт пустую библиотеку.

import fs from 'node:fs';

const STEAM_ID = '76561197995699569'; // steamcommunity.com/id/Pariparikai
const KEY = process.env.STEAM_API_KEY || '';
const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('steam.json', ROOT);

if (!KEY) {
  console.log('Нет секрета STEAM_API_KEY — пропускаю (добавь его в Settings → Secrets and variables → Actions).');
  process.exit(0);
}

// appid заказанных игр: ссылка на магазин Steam в заказе главнее находки робота orders-meta (как на сайте, orders.js)
const readJson = path => { try { return JSON.parse(fs.readFileSync(new URL(path, ROOT), 'utf8')); } catch { return null; } };
const metaKey = title => 'games|' + String(title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');
const found = readJson('orders-meta.json')?.items || {};
const wanted = new Set();
for (const row of readJson('data/games.json')?.items || []) {
  if (!row.title) continue;
  const link = String(row.url || '').match(/store\.steampowered\.com\/app\/(\d+)/);
  const m = found[metaKey(row.title)];
  const appid = link ? +link[1] : m && m.found && m.appid;
  if (appid) wanted.add(appid);
}

async function api(path, params) {
  const qs = new URLSearchParams({ key: KEY, steamid: STEAM_ID, format: 'json', ...params });
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`https://api.steampowered.com/${path}?${qs}`, { signal: AbortSignal.timeout(60000) });
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Steam не принял ключ (проверь STEAM_API_KEY)'), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (error.fatal || i >= 3) throw error;
      await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
}

// Без названий (include_appinfo) ответ на 13 тыс. игр короче в разы; бесплатные игры тоже нужны (AION 2 и т.п.)
const owned = (await api('IPlayerService/GetOwnedGames/v1/', { include_played_free_games: '1' })).response || {};
if (!owned.games) {
  throw new Error('Steam не отдал библиотеку: открой в настройках приватности профиля «Сведения об играх» → «Открытые».');
}

const games = {};
for (const g of owned.games) {
  if (!wanted.has(g.appid)) continue;
  games[g.appid] = {
    minutes: g.playtime_forever || 0,   // всего, минут
    minutes2w: g.playtime_2weeks || 0,  // за последние 2 недели
    last: g.rtime_last_played || 0,     // последний запуск, unix-время (0 — не запускал)
  };
}

const next = {
  note: 'Генерируется автоматически .github/scripts/steam-stats.mjs — руками не править. Только игры из заказов.',
  games,
};

// Время обновления пишем, только если что-то поменялось — иначе робот коммитил бы каждый час впустую
const prev = readJson('steam.json');
const strip = o => o && JSON.stringify({ ...o, updated: undefined });
const missing = [...wanted].filter(id => !games[id]);
console.log(`Заказанных игр со Steam: ${wanted.size}, есть в библиотеке: ${Object.keys(games).length}` +
  (missing.length ? ` (нет в библиотеке: ${missing.join(', ')})` : '') + '.');
if (strip(prev) === strip(next)) {
  console.log('Изменений нет.');
} else {
  next.updated = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify({ updated: next.updated, ...next }, null, 1) + '\n');
  console.log('steam.json обновлён.');
}
