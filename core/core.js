// ===== core.js — общие функции для всех страниц сайта и OBS-оверлеев =====
// Подключается первым скриптом страницы, раньше site.js и своего кода страницы:
//   <script src="core/core.js?v=1"></script>
// Ничего не рисует и не меняет на странице, только даёт функции.
//
// Что здесь есть (всё доступно как hof.имя, самые частые — ещё и просто по имени):
//   esc(s)                         — текст для вставки в HTML: < > & " ' не ломают разметку
//   plural(n, 'билет', 'билета', 'билетов') или plural(n, ['билет', 'билета', 'билетов'])
//   parseCSV(text)                 — CSV в массив строк (старый путь чтения разделов, см. siteData)
//   hof.json(path, {fresh})        — загрузить JSON; fresh — мимо кэша (для оверлеев OBS)
//   hof.table(name, {fresh})       — записи раздела data/<name>.json (массив объектов)
//   hof.kv(data)                   — {items: [{key, value}]} → {key: value}
//   hof.config({fresh})            — настройки сайта data/config.json как {key: value}
//   siteData.text / .fetch / .toCSV — data/*.json в виде CSV для страниц, которые ещё читают CSV
//
// Правило: функция, которая нужна больше чем одной странице, живёт здесь, а не копируется.
(function () {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

  // Русское склонение по числу: 1 билет, 2 билета, 5 билетов, 11 билетов, 21 билет
  function plural(n, one, few, many) {
    if (Array.isArray(one)) [one, few, many] = one;
    const t = Math.abs(n) % 100, d = t % 10;
    if (t >= 11 && t <= 14) return many;
    return d === 1 ? one : d >= 2 && d <= 4 ? few : many;
  }

  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { cell += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cell += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      if (row.some(c => c.length > 0)) rows.push(row);
    }
    return rows;
  }

  // fresh: true — оверлеи OBS держат страницу часами, им нужен свежий файл при каждом чтении
  async function json(path, opts) {
    const fresh = opts && opts.fresh;
    const url = fresh ? path + (path.includes('?') ? '&' : '?') + 't=' + Date.now() : path;
    const res = await fetch(url, { cache: fresh ? 'no-store' : 'no-cache' });
    if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
    return res.json();
  }
  const table = (name, opts) => json('data/' + name + '.json', opts).then(d => (d && d.items) || []);
  const kv = data => Object.fromEntries(((data && data.items) || []).map(r => [r.key, r.value]));
  let configCache = null;
  function config(opts) {
    if (opts && opts.fresh) return json('data/config.json', opts).then(kv);
    if (!configCache) configCache = json('data/config.json').then(kv).catch(e => { configCache = null; throw e; });
    return configCache;
  }

  window.hof = { esc, plural, parseCSV, json, table, kv, config };
  window.esc = esc;
  window.plural = plural;
  window.parseCSV = parseCSV;
})();

// ===== siteData: data/*.json в виде CSV =====
// Наследство Google-таблиц: многие страницы до сих пор разбирают CSV. siteData.text(src) отдаёт
// CSV-текст из data/*.json, siteData.fetch(src) — ответ с таким текстом (для кода, который проверяет res.ok).
// Новому коду CSV не нужен: hof.table('anime') сразу даёт записи.
// Формат файла: { "columns": [...], "items": [{колонка: "строка"}, ...] }.
(function () {
  'use strict';
  const cell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function toCSV(data) {
    const cols = data.columns || [...new Set((data.items || []).flatMap(Object.keys))];
    return [cols, ...(data.items || []).map(o => cols.map(c => o[c]))].map(r => r.map(cell).join(',')).join('\n') + '\n';
  }
  async function text(src, opts) {
    const isJson = /\.json(\?|$)/.test(src);
    const res = await fetch(src, Object.assign(isJson ? { cache: 'no-cache' } : {}, opts));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return isJson ? toCSV(await res.json()) : res.text();
  }
  async function fetchData(src, opts) {
    if (!/\.json(\?|$)/.test(src)) return fetch(src, opts);
    const res = await fetch(src, Object.assign({ cache: 'no-cache' }, opts));
    return res.ok ? new Response(toCSV(await res.json()), { status: 200 }) : res;
  }
  window.siteData = { text, toCSV, fetch: fetchData };
})();
