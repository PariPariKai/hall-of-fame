// Код страницы templates.html (раздел templates). Подключается из templates.html.
(function () {
'use strict';
const $ = id => document.getElementById(id);

// Известные вкладки — в этом порядке, даже пустые. Остальные появятся после них по данным.
// limit — лимит символов чата (Twitch режет сообщения длиннее 500)
const TABS = {
  'Паста': {
    icon: 'message', one: 'пасту', limit: 500,
    intro: 'Заходим рейдом — и весь чат дружно жмёт <b>Ctrl+V</b>. Скопируй пасту заранее, а когда рейд залетит, вставляй. ' +
      'В одно сообщение Twitch влезает <b>500 символов</b>.',
  },
  'Титры': {
    icon: 'star', one: 'стиль',
    intro: 'Стили резюме для титров в конце стрима — каким тоном подводим итог по истории чата. ' +
      'Выбери настроение на сегодня и скопируй.',
  },
};
const DEFAULT_TAB = { icon: 'pin', one: 'шаблон', intro: '' };
const meta = tab => TABS[tab] || DEFAULT_TAB;

let items = null;
let tab = '';
let q = '';
let picked = null;

const tabsList = () => [...new Set(Object.keys(TABS).concat((items || []).map(it => it.tab).filter(Boolean)))];
const inTab = () => (items || []).filter(it => it.tab === tab);

let toastTimer = 0;
function toast(text, err) {
  const t = $('toast');
  t.className = 'toast is-on' + (err ? ' toast--err' : '');
  t.innerHTML = icon(err ? 'alert' : 'check') + '<span>' + esc(text) + '</span>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2500);
}

// Копирование: Clipboard API, а без него (старый браузер, не https) — через выделение
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* пробуем по-старому */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* не вышло */ }
  ta.remove();
  return ok;
}

const lenHTML = it => {
  const lim = meta(it.tab).limit;
  const n = [...it.text].length;
  return lim ? `<span class="len${n > lim ? ' is-over' : ''}" title="${n > lim ? 'Длиннее лимита чата — Twitch обрежет' : 'Символов в сообщении'}">${n} / ${lim}</span>`
    : `<span class="len">${n} симв.</span>`;
};
const copyBtn = (it, solid) => `<button type="button" class="btn${solid ? ' btn--solid' : ' btn--sm'}" data-copy="${esc(it.id)}">${icon('copy')}Копировать</button>`;

function renderTabs() {
  $('tabs').innerHTML = tabsList().map(t => `<button type="button" class="chip${t === tab ? ' is-active' : ''}" data-tab="${esc(t)}">${icon(meta(t).icon)}${esc(t)}
    <span class="count">${(items || []).filter(it => it.tab === t).length}</span></button>`).join('');
}

function renderPick() {
  const box = $('pick');
  const it = picked && inTab().find(x => x.id === picked);
  box.hidden = !it;
  if (!it) return;
  box.innerHTML = `<div class="pick__label">${icon('dice')}Выпало</div>
    ${it.title ? `<div class="pick__title">${esc(it.title)}</div>` : ''}
    <div class="pick__text">${esc(it.text)}</div>
    <div class="pick__foot">${copyBtn(it, true)}<button type="button" class="btn btn--ghost" id="reroll">${icon('refresh')}Другую</button>${lenHTML(it)}</div>`;
  box.classList.remove('is-new');
  void box.offsetWidth; // перезапуск анимации
  box.classList.add('is-new');
}

function renderList() {
  const m = meta(tab);
  $('intro').innerHTML = m.intro || `Шаблоны вкладки «${esc(tab)}».`;
  if (!items) return;
  const all = inTab();
  $('random').disabled = all.length < 2;
  const ql = q.toLowerCase();
  const list = all.filter(it => !ql || (it.title + '\n' + it.text).toLowerCase().includes(ql));
  $('list').innerHTML = list.map(it => `<li class="tpl${it.id === picked ? ' is-picked' : ''}" data-id="${esc(it.id)}">
      ${it.title ? `<div class="tpl__title">${esc(it.title)}</div>` : ''}
      <div class="tpl__text">${esc(it.text)}</div>
      <button type="button" class="tpl__more" hidden>Развернуть</button>
      <div class="tpl__foot">${lenHTML(it)}${copyBtn(it)}</div></li>`).join('') ||
    (all.length ? '<li class="empty-state">Ничего не нашлось.</li>'
      : `<li class="empty-state tpl-empty">Здесь пока пусто.<br><a class="btn" href="admin.html#templates">${icon('plus')}Добавить ${esc(m.one)}</a></li>`);
  // Длинные тексты свёрнуты до 10 строк
  $('list').querySelectorAll('.tpl__text').forEach(el => {
    if (el.scrollHeight > el.clientHeight + 2) {
      el.classList.add('is-clamped');
      el.nextElementSibling.hidden = false;
    }
  });
}

function render() {
  renderTabs();
  renderPick();
  renderList();
}

function setTab(t) {
  tab = tabsList().includes(t) ? t : tabsList()[0];
  picked = null;
  render();
}

function pickRandom() {
  const all = inTab();
  if (!all.length) return;
  const pool = all.length > 1 ? all.filter(it => it.id !== picked) : all; // не тот же, что в прошлый раз
  picked = pool[Math.floor(Math.random() * pool.length)].id;
  renderPick();
  renderList();
  $('pick').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  history.replaceState(null, '', '#' + encodeURIComponent(b.dataset.tab));
  setTab(b.dataset.tab);
});
window.addEventListener('hashchange', () => setTab(decodeURIComponent(location.hash.slice(1))));
$('random').addEventListener('click', pickRandom);
$('q').addEventListener('input', e => { q = e.target.value.trim(); renderList(); });
document.addEventListener('click', async e => {
  if (e.target.closest('#reroll')) return pickRandom();
  const more = e.target.closest('.tpl__more');
  if (more) {
    const open = more.previousElementSibling.classList.toggle('is-open');
    more.textContent = open ? 'Свернуть' : 'Развернуть';
    return;
  }
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const it = items.find(x => x.id === btn.dataset.copy);
  if (!it) return;
  if (!(await copyText(it.text))) return toast('Не получилось скопировать — выдели текст вручную', true);
  toast('Скопировано — теперь Ctrl+V');
  btn.classList.add('is-done');
  btn.innerHTML = icon('check') + 'Скопировано';
  setTimeout(() => { btn.classList.remove('is-done'); btn.innerHTML = icon('copy') + 'Копировать'; }, 1800);
});

async function load() {
  try {
    const res = await fetch('data/templates.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    items = ((await res.json()).items || []).filter(it => String(it.text || '').trim())
      .map(it => ({ id: it.id, tab: String(it.tab || '').trim() || 'Паста', title: String(it.title || '').trim(), text: String(it.text).replace(/\s+$/, '') }));
  } catch (err) {
    console.error(err);
    $('list').innerHTML = '<li class="error-state">' + icon('alert') + 'Не удалось загрузить шаблоны. Обнови страницу.</li>';
    return;
  }
  setTab(decodeURIComponent(location.hash.slice(1)));
}
setTab(decodeURIComponent(location.hash.slice(1)));
load();
})();
