// Собирает steam.json: библиотека Steam стримера — игры, часы, недавние, «сейчас играет».
// Запускается GitHub Actions (см. .github/workflows/steam-stats.yml) или вручную:
//   STEAM_API_KEY=... node .github/scripts/steam-stats.mjs
// Ключ Steam Web API — только в секрете репозитория STEAM_API_KEY: на сайт и в репозиторий он не попадает.
// Профиль должен быть открытым, включая «Сведения об играх», иначе Steam отдаёт пустую библиотеку.

import fs from 'node:fs';

const STEAM_ID = '76561197995699569'; // steamcommunity.com/id/Pariparikai
const KEY = process.env.STEAM_API_KEY || '';
const OUT = new URL('../../steam.json', import.meta.url);

if (!KEY) {
  console.log('Нет секрета STEAM_API_KEY — пропускаю (добавь его в Settings → Secrets and variables → Actions).');
  process.exit(0);
}

async function api(path, params) {
  const qs = new URLSearchParams({ key: KEY, steamid: STEAM_ID, format: 'json', ...params });
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`https://api.steampowered.com/${path}?${qs}`, { signal: AbortSignal.timeout(30000) });
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Steam не принял ключ (проверь STEAM_API_KEY)'), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (error.fatal || i >= 3) throw error;
      await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
}

const owned = (await api('IPlayerService/GetOwnedGames/v1/', { include_appinfo: '1', include_played_free_games: '1' })).response || {};
if (!owned.games) {
  throw new Error('Steam не отдал библиотеку: открой в настройках приватности профиля «Сведения об играх» → «Открытые».');
}
const summary = ((await api('ISteamUser/GetPlayerSummaries/v2/', { steamids: STEAM_ID })).response?.players || [])[0] || {};

const games = owned.games
  .map(g => ({
    appid: g.appid,
    name: g.name || `App ${g.appid}`,
    minutes: g.playtime_forever || 0,          // всего, минут
    minutes2w: g.playtime_2weeks || 0,         // за последние 2 недели
    last: g.rtime_last_played || 0,            // последний запуск, unix-время (0 — не запускал)
  }))
  .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

// Вертикальные обложки: у новых игр путь с хэшем, угадать нельзя — берём из API магазина (ключ не нужен), пачками.
// Нет вертикальной — шапка магазина (сайт впишет её без обрезки).
for (let i = 0; i < games.length; i += 50) {
  const chunk = games.slice(i, i + 50);
  const input = { ids: chunk.map(g => ({ appid: g.appid })), context: { language: 'english', country_code: 'US' }, data_request: { include_assets: true } };
  try {
    const res = await fetch('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' + encodeURIComponent(JSON.stringify(input)),
      { signal: AbortSignal.timeout(30000) });
    for (const it of (await res.json())?.response?.store_items || []) {
      const a = it.assets, g = chunk.find(x => x.appid === it.appid);
      const file = a && (a.library_capsule || a.header);
      if (g && a?.asset_url_format && file) {
        g.cover = 'https://shared.steamstatic.com/store_item_assets/' + a.asset_url_format.replace('${FILENAME}', file);
      }
    }
  } catch (error) {
    console.warn('  ! обложки: ' + error.message);
  }
}

const next = {
  note: 'Генерируется автоматически .github/scripts/steam-stats.mjs — руками не править.',
  profile: {
    name: summary.personaname || '',
    url: summary.profileurl || `https://steamcommunity.com/profiles/${STEAM_ID}/`,
    avatar: summary.avatarfull || '',
    // Во что играет прямо сейчас (на момент запуска робота; пусто — не в игре)
    playing: summary.gameid ? { appid: +summary.gameid, name: summary.gameextrainfo || '' } : null,
  },
  totals: {
    games: games.length,
    played: games.filter(g => g.minutes > 0).length,
    hours: Math.round(games.reduce((s, g) => s + g.minutes, 0) / 60),
  },
  games,
};

// Время обновления пишем, только если что-то поменялось — иначе робот коммитил бы каждый час впустую
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const strip = o => o && JSON.stringify({ ...o, updated: undefined });
if (strip(prev) === strip(next)) {
  console.log('Изменений нет.');
} else {
  next.updated = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify({ updated: next.updated, ...next }, null, 1) + '\n');
  console.log(`steam.json обновлён: игр ${next.totals.games}, запускал ${next.totals.played}, часов ${next.totals.hours}` +
    (next.profile.playing ? `, сейчас играет: ${next.profile.playing.name}` : '') + '.');
}
