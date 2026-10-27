// Чтение и запись файлов репозитория сайта через GitHub API — для страниц стримера (admin.html, court.html).
// Каждое сохранение — коммит в main, GitHub Pages обновляет сайт примерно за минуту.
// Вход — личный токен GitHub (fine-grained, только репозиторий hall-of-fame, Contents: Read and write).
// Токен хранится только в этом браузере (localStorage), один на все страницы стримера; подключается на admin.html.
(function () {
  'use strict';
  const REPO = 'PariPariKai/hall-of-fame';
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
        : res.status === 403 || res.status === 404 ? 'У токена нет доступа к репозиторию hall-of-fame (нужно Contents: Read and write).'
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

  // Чей токен — для подписи «Вход: …» (пустой объект, если не вышло)
  const user = () => fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : {}).catch(() => ({}));

  // Вход на страницы стримера (рулетки, карточки): токен с правом записи в репозиторий открывает их сам.
  // candidate — токен, вставленный в поле кода (так его подключают в OBS и на другом компьютере); подошёл — запоминаем.
  async function hasAccess(candidate) {
    const t = candidate || token;
    if (!t) return false;
    try {
      const res = await fetch('https://api.github.com/repos/' + REPO, { cache: 'no-store',
        headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json' } });
      if (!res.ok) return false;
      const repo = await res.json();
      if (!(repo.permissions && repo.permissions.push)) return false;
      if (candidate) setToken(candidate);
      return true;
    } catch (e) { return false; }
  }
  const isToken = s => /^(github_pat_|ghp_)/.test(s);

  window.siteGit = {
    get token() { return token; },
    setToken, readFile, writeFile, user, hasAccess, isToken,
  };
})();
