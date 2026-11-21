// Чтение и запись файлов репозитория сайта через GitHub API — для страниц стримера (admin.html, court.html).
// Каждое сохранение — коммит в main, GitHub Pages обновляет сайт примерно за минуту.
// Вход — личный токен GitHub (fine-grained, только репозиторий hall-of-fame, Contents: Read and write).
// Токен хранится только в этом браузере (localStorage), один на все страницы стримера; подключается на admin.html.
(function () {
  'use strict';
  // Репозиторий — по адресу сайта: <владелец>.github.io/<репозиторий>/. Копия сайта у другого стримера найдёт свой сама.
  // На локальном сервере (проверка правок) — запасной вариант ниже.
  const REPO = (() => {
    const owner = /^([\w-]+)\.github\.io$/i.exec(location.hostname);
    const repo = location.pathname.split('/').filter(Boolean)[0];
    return owner && repo && !/\.html$/i.test(repo) ? owner[1] + '/' + repo : 'PariPariKai/hall-of-fame';
  })();
  const BRANCH = 'main';
  const TOKEN_KEY = 'hof-gh-token';
  let token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* без хранилища — спросим токен заново */ }

  function setToken(value) {
    token = value || '';
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* только на эту вкладку */ }
  }

  async function gh(path, opts) {
    const res = await fetch('https://api.github.com/repos/' + REPO + path, Object.assign({ cache: 'no-store' }, opts, {
      headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        opts && opts.headers),
    }));
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).message || ''; } catch (e) { /* пустой ответ */ }
      const err = new Error(res.status === 401 ? 'GitHub не принял токен — возможно, он истёк. Подключи новый.'
        : res.status === 403 || res.status === 404 ? 'У токена нет доступа к репозиторию ' + REPO + ' (нужно Contents: Read and write).'
        : `GitHub: ${res.status} ${msg}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  const b64encode = str => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
  // Одна запись — одна строка: в истории git видно, что именно поменялось
  const stringify = data => '{\n  "columns": ' + JSON.stringify(data.columns) + ',\n  "items": [\n' +
    data.items.map(o => '    ' + JSON.stringify(o)).join(',\n') + (data.items.length ? '\n' : '') + '  ]\n}\n';

  async function readFile(path) {
    const f = await gh('/contents/' + path + '?ref=' + BRANCH);
    return { sha: f.sha, data: JSON.parse(b64decode(f.content)) };
  }
  // Правка = функция над свежими данными. Если файл успели поменять с другого устройства (sha устарел),
  // перечитываем и применяем правку заново — ничего чужого не затираем.
  async function writeFile(path, file, mutate, message) {
    let cur = file;
    for (let attempt = 0; attempt < 3; attempt++) {
      const data = structuredClone(cur.data);
      mutate(data);
      try {
        const res = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify({
          message, branch: BRANCH, sha: cur.sha, content: b64encode(stringify(data)),
        }) });
        return { sha: res.content.sha, data };
      } catch (err) {
        if (err.status !== 409 && err.status !== 422) throw err;
        cur = await readFile(path);
      }
    }
    throw new Error('Файл одновременно меняют с другого устройства. Обнови страницу и повтори.');
  }

  // Произвольный JSON (не таблица columns/items) — например, база карточек рулетки.
  // readJson: {sha, data} или null, если файла ещё нет. writeJson: новый sha; чужая правка поверх — ошибка 409/422.
  async function readJson(path) {
    try { return await readFile(path); } catch (err) { if (err.status === 404) return null; throw err; }
  }
  async function writeJson(path, data, sha, message) {
    const res = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify({
      message, branch: BRANCH, sha: sha || undefined, content: b64encode(JSON.stringify(data, null, 1) + '\n'),
    }) });
    return res.content.sha;
  }

  // Папка репозитория: [{name, path, sha, size}], пустая или нет папки — []
  const enc = path => path.split('/').map(encodeURIComponent).join('/');
  async function listDir(path) {
    try {
      const r = await gh('/contents/' + enc(path) + '?ref=' + BRANCH);
      return Array.isArray(r) ? r : [];
    } catch (err) { if (err.status === 404) return []; throw err; }
  }
  // Файл как есть (звук, картинка): bytes — ArrayBuffer. Такой уже есть — заменяем.
  async function putFile(path, bytes, message) {
    let sha;
    try { sha = (await gh('/contents/' + enc(path) + '?ref=' + BRANCH)).sha; } catch (err) { if (err.status !== 404) throw err; }
    const u8 = new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    const res = await gh('/contents/' + enc(path), { method: 'PUT', body: JSON.stringify({ message, branch: BRANCH, sha, content: btoa(bin) }) });
    return res.content;
  }

  // Чей токен — для подписи «Вход: …» (пустой объект, если не вышло)
  const user = () => fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : {}).catch(() => ({}));

  // Пока проверяется сохранённый токен, экран кода спрятан — иначе он мелькает при каждом открытии.
  // Не подошёл (или GitHub молчит дольше 8 секунд) — показываем.
  const showGate = () => document.documentElement.classList.remove('gh-wait');
  if (token) {
    const st = document.createElement('style');
    st.textContent = '.gh-wait .gate{visibility:hidden!important}';
    document.head.appendChild(st);
    document.documentElement.classList.add('gh-wait');
    setTimeout(showGate, 8000);
  }

  // Вход на страницы стримера (рулетки, карточки): токен с правом записи в репозиторий открывает их сам.
  // candidate — токен, вставленный в поле кода (так его подключают в OBS и на другом компьютере); подошёл — запоминаем.
  async function hasAccess(candidate) {
    const t = candidate || token;
    const ok = await canPush(t);
    if (ok && candidate) setToken(candidate);
    if (!candidate && !ok) showGate();
    return ok;
  }
  async function canPush(t) {
    if (!t) return false;
    try {
      const res = await fetch('https://api.github.com/repos/' + REPO, { cache: 'no-store',
        headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json' } });
      if (!res.ok) return false;
      const repo = await res.json();
      return !!(repo.permissions && repo.permissions.push);
    } catch (e) { return false; }
  }
  const isToken = s => /^(github_pat_|ghp_)/.test(s);

  // ===== Вход на страницы стримера (рулетки, карточки, «Боль») — один на все страницы =====
  // Пускает по токену GitHub с правом записи или по коду стримера. Код задаётся в админке («Настройки» → «Доступ»),
  // на сайте хранится только его SHA-256 хэш (ключ streamer_code_hash в data/config.json).
  // Верный код запоминается в этом браузере (OBS не спрашивает при каждом запуске); сменили код — спросит заново.
  // Кода в настройках нет — входят только по токену.
  const CODE_HASH_FALLBACK = 'fc8ee83f14149d6acca42377fc006a9ed55198c380953f09067532fd5ee7fe09'; // до настройки в админке
  const CODE_KEY = 'hof-code';
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function codeHash() {
    let c = null;
    try { c = window.hof ? await hof.config({ fresh: true }) : null; } catch (e) { /* настройки не загрузились — запасной */ }
    if (c && 'streamer_code_hash' in c) return String(c.streamer_code_hash || '').trim().toLowerCase();
    return CODE_HASH_FALLBACK;
  }
  function codeRemembered(hash) {
    if (!hash) return false;
    try {
      if (localStorage.getItem(CODE_KEY) === hash) return true;
      // старые отметки: «Боль» помнила код в pain.code, карточки — до закрытия вкладки
      if (localStorage.getItem('pain.code') === hash || sessionStorage.getItem('ppk_cards_gate') === '1') {
        localStorage.setItem(CODE_KEY, hash);
        return true;
      }
    } catch (e) { /* без хранилища — спросим код */ }
    return false;
  }
  // Разметка: #gate > form#gate-form > input#gate-input, #gate-error, кнопка type=submit.
  // onEnter() открывает страницу; если вернёт false (например, не загрузились данные) — экран входа остаётся.
  function gate(onEnter) {
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const error = document.getElementById('gate-error');
    const button = form && form.querySelector('[type=submit]');
    let entered = false;
    async function enter() {
      if (entered) return true;
      entered = true;
      const ok = (await onEnter()) !== false;
      if (!ok) { entered = false; showGate(); }
      return ok;
    }
    const hashReady = codeHash();
    hashReady.then(hash => {
      if (codeRemembered(hash)) enter();
      else hasAccess().then(ok => { if (ok) enter(); });
    });
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const value = input.value.trim();
      error.textContent = '';
      if (!value) { error.textContent = 'Введите код'; input.focus(); return; }
      if (button) button.disabled = true;
      let ok;
      if (isToken(value)) ok = await hasAccess(value);
      else if (!crypto.subtle) { error.textContent = 'Проверка кода работает только по https: открой страницу по адресу сайта.'; ok = null; }
      else {
        const hash = await hashReady;
        if (!hash) { error.textContent = 'Код ещё не задан в админке. Вставь токен GitHub.'; ok = null; }
        else if ((ok = await sha256Hex(value) === hash)) { try { localStorage.setItem(CODE_KEY, hash); } catch (e) { /* только до перезагрузки */ } }
      }
      if (ok) ok = await enter();
      else if (ok === false) { error.textContent = isToken(value) ? 'GitHub не принял токен' : 'Неверный код'; input.value = ''; }
      if (button) button.disabled = false;
      if (!ok) input.focus();
    });
    input.focus();
  }

  window.siteGit = {
    get token() { return token; },
    repo: REPO,
    setToken, readFile, writeFile, readJson, writeJson, listDir, putFile, user, hasAccess, isToken, showGate, gate,
  };
})();
