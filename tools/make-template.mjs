// Собирает чистый шаблон сайта для другого стримера: тот же код, но без личных данных.
//   node tools/make-template.mjs [папка]        (по умолчанию ../hall-of-fame-template рядом с репозиторием)
// Что делает:
//   - копирует файлы репозитория (всё, что не закрыто .gitignore), кроме личных картинок и этого скрипта;
//   - обнуляет данные: заказы, зал славы, зрители, билеты, правила, шаблоны, эксперименты и т.д.;
//   - ставит в профиль заглушки (имя, канал, пояс), выключает зиму, убирает код доступа;
//   - заменяет в коде упоминания этого стримера на нейтральные;
//   - в конце ищет личные слова (ник, SteamID, хэш кода) и падает, если что-то осталось.
// Результат — папка, которую можно залить в новый репозиторий; дальше по docs/INSTALL.md.
// Если скрипт упал на «не найдено»: в коде поменялась строка из списка REPLACE — поправь список.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'hall-of-fame-template'));
if (OUT === ROOT || OUT.startsWith(ROOT + path.sep)) throw new Error('Папка шаблона должна быть вне репозитория');

// ---------- что не берём ----------
const SKIP = [
  /^friends\//, /^experiments\//, /^sounds\/chat\//,   // картинки друзей, экспериментов, свои звуки чата
  /^data\/cards\.json$/,                                // база рулетки хаоса — сама создастся из стартового набора
  /^tools\/make-template\.mjs$/,
];

// ---------- данные ----------
const EMPTY_TABLES = ['anime', 'movies', 'series', 'games', 'pain', 'prizes', 'winners', 'viewers', 'tickets', 'friends',
  'rules', 'punishments', 'templates', 'screens'];
const CONFIG = {   // личное → заглушки; настройки рулеток, заставок и т.п. остаются как есть
  streamer_name: 'Имя стримера',
  streamer_intro: 'Привет! Здесь хроника моих стримов, рулетки и заказы зрителей.',
  streamer_avatar_url: '', streamer_twitch_url: '', streamer_timezone: 'Europe/Moscow',
  streamer_donate_url: '', streamer_steam_id: '', streamer_code_hash: '', site_season: '',
  raffle_active: 'FALSE', raffle_title: '', raffle_date: '', tickets_banner_url: '',
  schedule_sun: '', schedule_mon: '19:00-23:00', schedule_tue: '19:00-23:00', schedule_wed: '19:00-23:00',
  schedule_thu: '19:00-23:00', schedule_fri: '19:00-23:00', schedule_sat: '',
};
const ROOT_JSON = {
  'experiments.json': d => ({ note: d.note, experiments: [] }),
  'orders-meta.json': d => ({ note: d.note, items: {} }),
  'orders-quips.json': d => ({ note: d.note, items: {} }),
  'pain-meta.json': d => ({ note: d.note, games: {} }),
  'steam.json': d => ({ updated: '', note: d.note, games: {} }),
  'friends-meta.json': d => ({ note: d.note, images: {} }),
};

// ---------- замены в коде: [файл, было, стало] ----------
const REPLACE = [
  ['core/site.js', /const DEFAULT_PROFILE = \{[^}]*\};/, "const DEFAULT_PROFILE = { name: 'Стример', channel: '', tz: 'Europe/Moscow', season: '', donateUrl: '' };"],
  ['core/site.js', "'Боль стримера за шекели'", "'Боль стримера'"],
  ['core/github.js', /const CODE_HASH_FALLBACK = '[0-9a-f]+';/, "const CODE_HASH_FALLBACK = '';"],
  ['core/github.js', "'PariPariKai/hall-of-fame'", "'owner/hall-of-fame'"],
  ['modules/chat/chat.page.js', "  if (!channel) channel = 'pariparikai';\n", ''],
  ['modules/chat/chat.page.js', "['pariparikai', '#FAC775'", "['streamer', '#FAC775'"],
  ['modules/screen/screen.page.js', "  if (!channel) channel = 'pariparikai';\n", ''],
  ['index.html', '<title>ParipariKai</title>', '<title>Hall of Fame</title>'],
  ['pain.html', '<title>Боль стримера за шекели — ParipariKai</title>', '<title>Боль стримера — Hall of Fame</title>'],
  ['rules.html', 'Правила чата ParipariKai,', 'Правила чата,'],
  ['templates.html', 'шаблоны титров стрима ParipariKai:', 'шаблоны титров стрима:'],
  ['pain-games.html', '«Боль стримера за шекели»', '«Боль стримера»'],
  ['bridge/server.js', "siteUrl: 'https://pariparikai.github.io/hall-of-fame/',", "siteUrl: '',"],
  ['bridge/public/pain.html', '<h1>Боль стримера <span>за шекели</span></h1>', '<h1>Боль стримера</h1>'],
  ['bridge/public/pain.html', 'ШЕКЕЛИ ПРИНЯТЫ', 'ДОНАТ ПРИНЯТ'],
  ['bridge/public/pain.js', 'ШЕКЕЛИ ПРИНЯТЫ', 'ДОНАТ ПРИНЯТ'],
  ['docs/RESTORE.md', /PariPariKai\/hall-of-fame/g, '<ник>/<репозиторий>'],
  ['docs/RESTORE.md', /https:\/\/pariparikai\.github\.io\/hall-of-fame\//g, 'https://<ник>.github.io/<репозиторий>/'],
];
const FORBIDDEN = /paripari|шекел|76561197995699569|fc8ee83f/i;

// ---------- сборка ----------
const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => !SKIP.some(re => re.test(f)));
fs.rmSync(OUT, { recursive: true, force: true });
for (const f of files) {
  const to = path.join(OUT, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), to);
}
for (const dir of ['friends', 'experiments']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });

const rd = f => fs.readFileSync(path.join(OUT, f), 'utf8').replace(/\r\n/g, '\n');
const wr = (f, s) => fs.writeFileSync(path.join(OUT, f), s);
const table = d => '{\n  "columns": ' + JSON.stringify(d.columns) + ',\n  "items": [\n' +
  d.items.map(o => '    ' + JSON.stringify(o)).join(',\n') + (d.items.length ? '\n' : '') + '  ]\n}\n';

for (const name of EMPTY_TABLES) {
  const f = `data/${name}.json`;
  const d = JSON.parse(rd(f));
  wr(f, table({ columns: d.columns, items: [] }));
}
{
  const d = JSON.parse(rd('data/config.json'));
  for (const [key, value] of Object.entries(CONFIG)) {
    const row = d.items.find(r => r.key === key);
    if (row) row.value = value; else d.items.push({ key, value });
  }
  wr('data/config.json', table(d));
}
{
  const d = JSON.parse(rd('data/modules.json'));
  d.items.forEach(m => { m.on = 'TRUE'; if (m.id === 'pain') m.title = 'Боль стримера'; });
  wr('data/modules.json', table(d));
}
for (const [f, make] of Object.entries(ROOT_JSON)) wr(f, JSON.stringify(make(JSON.parse(rd(f))), null, 2) + '\n');

for (const [f, from, to] of REPLACE) {
  const s = rd(f);
  const hit = typeof from === 'string' ? s.includes(from) : from.test(s);
  if (!hit) throw new Error(`Не найдено в ${f}: ${from}`);
  wr(f, typeof from === 'string' ? s.split(from).join(to) : s.replace(from, to));
}

wr('README.md', `# Hall of Fame — сайт стримера

Зал славы, заказы зрителей, рулетки, правила чата, оверлеи для OBS и админка.
Статический сайт на GitHub Pages: без сервера, без сборки, бесплатно.

**Начать:** [docs/INSTALL.md](docs/INSTALL.md) — установка за 15 минут.

- [Как устроен сайт](docs/ARCHITECTURE.md)
- [Переустановка Windows или новый компьютер](docs/RESTORE.md)
- [Мост донатов и модификаторов](bridge/README.md)
`);

// ---------- проверка: личного не осталось ----------
const bad = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return walk(p);
  if (!/\.(html|js|mjs|css|json|md|yml|cmd|vbs|ps1|svg|txt)$/i.test(e.name)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => { if (FORBIDDEN.test(line)) bad.push(`${path.relative(OUT, p)}:${i + 1}: ${line.trim().slice(0, 120)}`); });
});
walk(OUT);
if (bad.length) { console.error('Остались личные данные:\n' + bad.join('\n')); process.exit(1); }
console.log(`Готово: ${OUT} (${files.length} файлов). Дальше — docs/INSTALL.md в этой папке.`);
