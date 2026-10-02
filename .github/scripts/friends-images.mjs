// Копирует картинки баннеров «Рекомендую» (лист Friends) на сам сайт: friends/<ник>-<хэш>.jpg + friends-meta.json.
// Зачем: сторонние хостинги картинок открываются не у всех зрителей, а исходники весят мегабайты.
// Картинка вписывается в 2500×500 (баннер 5:1, больше не нужно) и сохраняется в JPEG.
// Перекачивается, только если в таблице сменили ссылку. Сайт берёт копию, а без неё — исходную ссылку.
// Запускается GitHub Actions (см. .github/workflows/friends-images.yml) или вручную:
//   npm install --no-save sharp && node .github/scripts/friends-images.mjs
// SITE_ROOT — папка сайта (по умолчанию корень репозитория; нужно только для запуска не из репозитория).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThU3PDQlG4EPkPHygpf1q54KuNuuc4WYWnGqZde3-8iD8buBBFLEkr3MIDdnvv-oekgEN0CXj7Bq6C/pub?gid=1322308154&single=true&output=csv';
const ROOT = process.env.SITE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const DIR = path.join(ROOT, 'friends');
const META = path.join(ROOT, 'friends-meta.json');
const UA = {'User-Agent': 'Mozilla/5.0 (compatible; hall-of-fame-friends/1.0; +https://pariparikai.github.io/hall-of-fame/)'};
const MAX_W = 2500, MAX_H = 500, QUALITY = 82;
const BG = '#0a0e1a'; // фон сайта — на него ляжет прозрачность PNG

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

const isUrl = s => /^https?:\/\//i.test(s || '');
const slug = nick => nick.toLowerCase().replace(/[^a-z0-9_-]+/g, '') || 'friend';
const kb = n => `${Math.round(n / 1024)} КБ`;

const res = await fetch(CSV + '&cache=' + Date.now(), {headers: UA});
if (!res.ok) throw new Error(`Лист Friends недоступен: HTTP ${res.status}`);
const rows = parseCSV(await res.text());
const header = rows[0].map(h => h.trim().toLowerCase());
const cNick = header.indexOf('nick'), cImg = header.indexOf('image_url');
if (cNick < 0 || cImg < 0) throw new Error('В листе Friends нужны колонки nick и image_url');

const prev = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {images: {}};
const images = {};
fs.mkdirSync(DIR, {recursive: true});

for (const r of rows.slice(1)) {
  const nick = (r[cNick] || '').trim(), url = (r[cImg] || '').trim();
  if (!nick || !isUrl(url) || images[url]) continue;
  const old = prev.images[url];
  if (old && fs.existsSync(path.join(ROOT, old.file))) { images[url] = old; continue; }

  console.log(`→ ${nick}: ${url}`);
  try {
    const img = await fetch(url, {headers: UA, signal: AbortSignal.timeout(60000)});
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    if (!(img.headers.get('content-type') || '').startsWith('image/')) throw new Error(`не картинка: ${img.headers.get('content-type')}`);
    const src = Buffer.from(await img.arrayBuffer());
    const jpg = await sharp(src).rotate()
      .resize({width: MAX_W, height: MAX_H, fit: 'inside', withoutEnlargement: true})
      .flatten({background: BG})
      .jpeg({quality: QUALITY, mozjpeg: true})
      .toBuffer();
    // Хэш ссылки в имени файла: сменили картинку — новое имя, браузеры не покажут старую из кэша
    const file = `friends/${slug(nick)}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 8)}.jpg`;
    fs.writeFileSync(path.join(ROOT, file), jpg);
    const {width, height} = await sharp(jpg).metadata();
    images[url] = {nick, file, width, height, bytes: jpg.length, sourceBytes: src.length};
    console.log(`  ${file}: ${width}×${height}, ${kb(src.length)} → ${kb(jpg.length)}`);
  } catch (error) {
    console.warn(`  ! не удалось: ${error.message} — сайт покажет исходную ссылку`);
  }
}

// Удаляем копии картинок, которых больше нет в таблице
const keep = new Set(Object.values(images).map(i => path.basename(i.file)));
for (const f of fs.readdirSync(DIR)) {
  if (!keep.has(f)) { fs.unlinkSync(path.join(DIR, f)); console.log(`  удалено: friends/${f}`); }
}

const next = {note: 'Генерируется автоматически .github/scripts/friends-images.mjs — руками не править.', images};
if (JSON.stringify(prev.images) !== JSON.stringify(images)) {
  fs.writeFileSync(META, JSON.stringify(next, null, 2) + '\n');
  console.log(`friends-meta.json обновлён: картинок ${Object.keys(images).length}.`);
} else {
  console.log('Изменений нет.');
}
