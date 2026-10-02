// Общий поиск игр для роботов pain-meta.mjs («Боль») и orders-meta.mjs (заказы игр).
// Источники: Steam (поиск + appdetails на русском), запасной — Wikidata (Steam ID по названию),
// последний — IGDB (нужны секреты репозитория TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET; без них пропускается).

const UA = {'User-Agent': 'hall-of-fame-meta/1.0 (https://pariparikai.github.io/hall-of-fame/)'};
const IGDB_ID = process.env.TWITCH_CLIENT_ID || '', IGDB_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const IGDB_ON = !!(IGDB_ID && IGDB_SECRET);

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function getJSON(url, tries = 3) {
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
// Не сама игра: саундтреки, DLC, утилиты и моды («Skyrim Script Extender»)
const JUNK = /\b(soundtrack|ost|dlc|pack|bundle|demo|набор|саундтрек|season pass|artbook|extender|sdk|server|editor|toolkit|mod tools|creation kit|wallpaper)\b/;
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

// Ищем в российском и американском магазинах: часть игр (Microsoft, EA…) из российского убрана,
// и там остаются только клоны с тем же названием. Выбор:
//   • есть точные совпадения — берём меньший appid (оригинал почти всегда старше клона);
//   • иначе среди близких по сходству (до 0.1 от лучшего) — тот, кого Steam ставит выше в выдаче
//     («Skyrim» → Special Edition, а не VR).
// strict: неполное совпадение засчитываем, только если слова запроса идут в названии подряд
// («Skyrim» → «The Elder Scrolls V: Skyrim» да, «Stone Simulator» → «Space Stone Smashing Simulator» нет).
// exclude: appid, которые уже отброшены (например, по дате выхода), — тогда вернётся следующий кандидат.
export async function steamSearch(name, {strict = false, exclude = new Set()} = {}) {
  const inRow = cand => {
    const q = tokens(name), c = tokens(cand);
    for (let i = 0; i + q.length <= c.length; i++) if (q.every((t, j) => c[i + j] === t)) return true;
    return false;
  };
  const items = new Map();
  for (const cc of ['RU', 'US']) {
    const json = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=russian&cc=${cc}`);
    for (const i of json?.items || []) if (i.type === 'app' || !i.type) items.set(i.id, i);
    if (cc === 'RU') await sleep(800);
  }
  const cands = [...items.values()]
    .map((item, rank) => ({id: item.id, name: item.name, rank, s: score(name, item.name)}))
    .filter(c => c.s >= 0.6 && !exclude.has(c.id) && !(strict && c.s < 1 && !inRow(c.name)));
  if (!cands.length) return null;
  const exact = cands.filter(c => c.s >= 1 - 1e-9);
  if (exact.length) return exact.sort((a, b) => a.id - b.id)[0];
  const top = Math.max(...cands.map(c => c.s));
  return cands.filter(c => c.s >= top - 0.1).sort((a, b) => a.rank - b.rank)[0];
}

export async function wikidataSteamId(name) {
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
export async function igdbAuth() {
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
export async function igdbSearch(name) {
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

// ---------- карточка Steam ----------

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
// Вертикальная обложка (600x900) из API магазина: у новых игр она лежит по адресу с хэшем,
// который угадать нельзя, — а IStoreBrowseService отдаёт настоящий путь. Ключ не нужен.
async function steamCapsule(appid) {
  const input = {ids: [{appid}], context: {language: 'english', country_code: 'US'}, data_request: {include_assets: true}};
  const json = await getJSON(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
  const a = json?.response?.store_items?.[0]?.assets;
  if (!a?.asset_url_format || !a.library_capsule) return null;
  return 'https://shared.steamstatic.com/store_item_assets/' + a.asset_url_format.replace('${FILENAME}', a.library_capsule);
}

// Не жанры, а пометки магазина — в фильтр по жанрам не берём.
const NOT_GENRES = new Set(['Ранний доступ', 'Бесплатные', 'Бесплатно', 'Бесплатно для игры', 'Многопользовательские игры', 'Массовые многопользовательские']);
// cover — вертикальная обложка 600x900 (если есть), header — горизонтальная шапка магазина.
export async function steamDetails(appid) {
  // Часть игр (EA, Bethesda…) убрана из российского Steam — тогда спрашиваем другие регионы.
  let d = null;
  for (const cc of ['ru', 'us', 'de']) {
    const json = await getJSON(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=russian&cc=${cc}`);
    d = json?.[appid];
    if (d?.success) break;
    await sleep(1200);
  }
  const base = `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}`;
  const cover = await steamCapsule(appid) ||
    (await imageExists(`${base}/library_600x900.jpg`) ? `${base}/library_600x900.jpg` : null);
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
