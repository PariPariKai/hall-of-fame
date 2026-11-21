// Код страницы rules.html (раздел court). Подключается из rules.html.
(function () {
'use strict';
const { LEVELS, MAX_LEVEL, esc } = court;
const $ = id => document.getElementById(id);
$('repeat-days').textContent = court.REPEAT_DAYS;

// ---------- свод правил и ступени ----------
// hidden = статья только для суда (отдельная часть общего правила) — зрителям не показываем
async function loadLevels() {
  try {
    const rules = (await court.loadRules()).filter(r => r.hidden !== '1').sort((a, b) => a.level - b.level);
    const num = new Map(rules.map((r, i) => [r, i + 1]));
    $('code-list').innerHTML = rules.map(r => `<li class="lvl--${r.level}"><span class="code__num">${num.get(r)}</span>
      <span class="code__title">${esc(r.title)}</span><span class="code__text">${esc(r.text)}</span>${court.levelBadge(r.level, 'Ступень ' + r.level)}</li>`).join('');
    const blocks = [];
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const list = rules.filter(r => r.level === l);
      if (!list.length) continue;
      blocks.push(`<section class="level lvl--${l}">
        <div class="level__head">${court.levelBadge(l, 'Ступень ' + l)}<div class="level__name">${esc(LEVELS[l].name)}</div>${court.oddsHTML(l)}</div>
        <ul class="level__rules">${list.map(r => `<li><b>${num.get(r)}. ${esc(r.title)}</b></li>`).join('')}</ul></section>`);
    }
    $('levels').innerHTML = blocks.join('');
  } catch (err) {
    console.error(err);
    $('levels').innerHTML = $('code-list').innerHTML = '<p class="error-state">' + icon('alert') + 'Не удалось загрузить правила. Обнови страницу.</p>';
  }
}

// ---------- история ----------
const FILTERS = [
  { id: 'all', label: 'Все', test: () => true },
  { id: 'muted', label: 'В муте', test: s => s === 'muted' },
  { id: 'banned', label: 'В бане', test: s => s === 'banned' || s === 'perma' },
  { id: 'freed', label: 'Разбанены и помилованы', test: s => s === 'unbanned' || s === 'lifted' },
  { id: 'served', label: 'Отсидели', test: s => s === 'served' },
];
const view = { filter: 'all', q: '' };
let cases = null;
function renderHistory() {
  $('zone').innerHTML = siteTime.zoneLabel();
  $('tz-btn').innerHTML = siteTime.toggle();
  if (!cases) return;
  const all = cases.slice().sort((a, b) => (siteTime.parse(b.at) || 0) - (siteTime.parse(a.at) || 0));
  const states = new Map(all.map(it => [it, court.state(it).id]));
  $('filter').innerHTML = FILTERS.map(f => `<button type="button" class="chip${view.filter === f.id ? ' is-active' : ''}" data-v="${f.id}">${f.label} <span class="count">${all.filter(it => f.test(states.get(it))).length}</span></button>`).join('');
  const test = FILTERS.find(f => f.id === view.filter).test;
  const list = all.filter(it => test(states.get(it)) && (!view.q || it.nick.toLowerCase().includes(view.q)));
  $('cases').innerHTML = list.map(it => court.caseHTML(it)).join('') ||
    `<li class="empty-state">${all.length ? 'Никого не нашлось.' : 'Приговоров пока не было. Чат образцовый — так держать.'}</li>`;
}
$('filter').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { view.filter = b.dataset.v; renderHistory(); } });
$('q').addEventListener('input', e => { view.q = e.target.value.trim().toLowerCase(); renderHistory(); });
siteTime.onChange(renderHistory);

async function loadHistory() {
  try {
    const res = await fetch('data/punishments.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cases = (await res.json()).items || [];
  } catch (err) {
    console.error(err);
    cases = null;
    $('cases').innerHTML = '<li class="error-state">' + icon('alert') + 'Не удалось загрузить историю. Обнови страницу.</li>';
    return;
  }
  renderHistory();
}
loadLevels();
loadHistory();
// Муты истекают — раз в минуту пересчитываем, раз в 5 минут перечитываем историю
setInterval(renderHistory, 60000);
setInterval(loadHistory, 5 * 60000);
})();
