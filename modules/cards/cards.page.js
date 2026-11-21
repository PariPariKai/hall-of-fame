// Код страницы cards.html (раздел cards). Подключается из cards.html.
// ============================================================
// СТАРТОВЫЙ НАБОР
// ============================================================
const RARITY_SEED = [
  { id: 'common',    name: 'Обычная',     chance: 50,  color: '#9FB3C8' },
  { id: 'uncommon',  name: 'Необычная',   chance: 25,  color: '#5FD68A' },
  { id: 'rare',      name: 'Редкая',      chance: 16,  color: '#56A8F5' },
  { id: 'epic',      name: 'Эпическая',   chance: 7,   color: '#B57CE8' },
  { id: 'legendary', name: 'Легендарная', chance: 1.5, color: '#FAC775' },
  { id: 'artifact',  name: 'Артефакт',    chance: 0.5, color: '#FF7A59' }
];

const GROUP_SEED = [
  { id: 'g-mod',   rarity: 'uncommon', name: 'Модификатор', target: null },
  { id: 'g-sport', rarity: 'uncommon', name: 'Спорт',       target: null },
  { id: 'g-games', rarity: 'rare',     name: 'Игры',        target: null }
];

// [текст, редкость, категория, тип, на кого]
const ITEM_SEED = [
  ['Говорить на английском 3 минуты', 'common', null, 'chaos', 'streamer'],
  ['Говорить на иврите 3 минуты', 'common', null, 'chaos', 'streamer'],
  ['1 минуту говорить максимально театрально', 'common', null, 'chaos', 'streamer'],
  ['1 минуту хвалить любую фигню', 'common', null, 'chaos', 'streamer'],
  ['1 минуту покер-фейс', 'common', null, 'chaos', 'streamer'],
  ['Крупный план 30 сек, мут на 60 секунд', 'common', null, 'chaos', 'streamer'],
  ['1 минуту все слова начинаются на одну букву', 'common', null, 'chaos', 'streamer'],
  ['Сменить название стрима', 'common', null, 'chaos', 'streamer'],
  ['Мут на 60 секунд', 'common', null, 'punish', 'streamer'],
  ['3 минуты житель Майнкрафта', 'common', null, 'chaos', 'streamer'],
  ['Мут на выбор кому-то на 60 секунд', 'common', null, 'punish', 'viewer'],
  ['Мут на 600 секунд', 'common', null, 'punish', 'streamer'],
  ['1 минуту зло смеяться после каждой фразы', 'common', null, 'chaos', 'streamer'],
  ['1 минуту объяснять всё как ребёнку', 'common', null, 'chaos', 'streamer'],

  ['Титул, не пить, не материться', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Надеть / снять шапку', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Добавлять «сенпай» к нику победителя', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Без эффекта (отмена модификатора)', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Шёпот (пародия на ASMR-стрим)', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['−80% скорости: говорю и двигаюсь как можно медленнее', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Говорить о себе в третьем лице', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['«Вот и думайте» после каждой фразы', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['«Если вы понимаете, о чём я» после каждой фразы', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Умиляюще говорить с чатом как с детьми', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Слово-паразит', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['«Моё почтение» с приподниманием цилиндра после каждой фразы', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['«Можно, а зачем?» после каждой фразы', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Молчанка: мне нельзя говорить', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Рифмоплёт: стараюсь говорить в рифму', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Смена голоса через фильтр микрофона', 'uncommon', 'g-mod', 'mod', 'streamer'],
  ['Стримить, обнимая плюшевую игрушку', 'uncommon', 'g-mod', 'mod', 'streamer'],

  ['50 прыжков', 'uncommon', 'g-sport', 'punish', 'streamer'],
  ['10 отжиманий', 'uncommon', 'g-sport', 'punish', 'streamer'],
  ['Планка 60 секунд', 'uncommon', 'g-sport', 'punish', 'streamer'],
  ['10 приседаний', 'uncommon', 'g-sport', 'punish', 'streamer'],

  ['PNG MODE: выключаю вебку, включаю PNG-tuber', 'rare', null, 'chaos', 'streamer'],

  ['Пауза в игре на 10 минут', 'rare', 'g-games', 'chaos', 'streamer'],
  ['10 минут нестандартного правила в игре', 'rare', 'g-games', 'chaos', 'streamer'],
  ['Меняем цель в игре', 'rare', 'g-games', 'chaos', 'streamer'],
  ['5 минут играть одной рукой', 'rare', 'g-games', 'punish', 'streamer'],
  ['10 минут играть иначе', 'rare', 'g-games', 'chaos', 'streamer'],
  ['Хардкор: 1 смерть — 5 приседаний', 'rare', 'g-games', 'punish', 'streamer'],
  ['Запрещённая кнопка на 5 минут', 'rare', 'g-games', 'punish', 'streamer'],
  ['3 минуты не использовать способности', 'rare', 'g-games', 'punish', 'streamer'],
  ['3 минуты не прыгать в игре', 'rare', 'g-games', 'punish', 'streamer'],

  ['Билет на розыгрыш в конце месяца', 'epic', null, 'reward', 'viewer'],

  ['100 наханок', 'legendary', null, 'reward', 'viewer'],
  ['Добавить награду за баллы канала', 'legendary', null, 'reward', 'viewer'],
  ['Закончить стрим раньше + рейд', 'legendary', null, 'reward', 'viewer'],
  ['Випка', 'legendary', null, 'reward', 'viewer'],
  ['Распечатать аватар чатерса и повесить на стену', 'legendary', null, 'reward', 'viewer'],
  ['Дать / отнять випку', 'legendary', null, 'reward', 'viewer'],
  ['Присесть 50 раз', 'legendary', null, 'punish', 'streamer'],
  ['Мут на 600 секунд', 'legendary', null, 'punish', 'streamer'],
  ['Редкий скам', 'legendary', null, 'chaos', 'viewer'],
  ['Мут до конца стрима', 'legendary', null, 'punish', 'streamer'],
  ['Играть в игру на выбор (минимум 4 часа)', 'legendary', null, 'reward', 'viewer'],
  ['Играть в игру 18+ на Kick или Boosty', 'legendary', null, 'reward', 'viewer'],
  ['Хардкорный челлендж', 'legendary', null, 'punish', 'streamer'],
  ['Добавить постоянный элемент на стрим до конца месяца', 'legendary', null, 'reward', 'viewer'],
  ['Личное сообщение аудио/видео в личку', 'legendary', null, 'reward', 'viewer'],
  ['Мут на час', 'legendary', null, 'punish', 'streamer'],

  ['Спец-стрим по теме от победителя', 'artifact', null, 'reward', 'viewer']
];

const STORAGE_KEY = 'ppk_cards_v1';
const KIND_LABEL   = { chaos: 'Хаос', punish: 'Наказание', reward: 'Награда', mod: 'Модификатор' };
const TARGET_LABEL = { streamer: 'Стример', viewer: 'Зритель', both: 'Оба' };

let uidCounter = 0;
function uid() {
  uidCounter++;
  return 'c' + Date.now().toString(36) + uidCounter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

function seedState() {
  const now = Date.now();
  return {
    version: 1,
    rarities: RARITY_SEED.map(r => ({ ...r })),
    groups: GROUP_SEED.map(g => ({ ...g })),
    items: ITEM_SEED.map(([text, rarity, group, kind, target]) => ({
      id: uid(), text, rarity, group, kind, target,
      weight: 1, active: true, pinned: false, tags: [], note: '', durationSec: 0,
      createdAt: now, activatedAt: now, benchedAt: null, rolls: 0, lastRoll: null
    })),
    history: [],
    settings: { cooldown: 5, modHideMin: 60 },
    lastBackup: null,
    savedAt: 0              // 0 — стартовый набор, на сайт не уходит, пока его не поправят
  };
}

// ============================================================
// СОСТОЯНИЕ
// ============================================================
let state = seedState();
let undoStack = [];
let ui = {
  tab: 'board',
  rarityFilter: null,       // null = все колонки
  search: '',
  kind: '',
  target: '',
  sort: 'manual',
  benchOpen: {},            // rarityId -> bool
  chanceSort: { key: 'chance', dir: -1 }
};

let storageWarned = false;
// keepStamp — записать как есть (база пришла с сайта или стартовый набор), иначе это правка: время обновляется
function save(keepStamp) {
  if (!keepStamp) state.savedAt = Date.now();
  cloudSchedule();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    if (!storageWarned) {
      storageWarned = true;
      toast('Браузер не даёт сохранять данные на этой странице — правки живут только до перезагрузки. Открой страницу по обычной ссылке сайта, а не как локальный файл.');
    }
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return false;
    state = normalize(parsed);
    return true;
  } catch (e) {
    console.warn('Битые данные в localStorage', e);
    return false;
  }
}

// Приводит любой загруженный объект к актуальной форме
function normalize(obj) {
  const now = Date.now();
  const s = {
    version: 1,
    rarities: Array.isArray(obj.rarities) && obj.rarities.length ? obj.rarities : RARITY_SEED.map(r => ({ ...r })),
    groups: Array.isArray(obj.groups) ? obj.groups : [],
    items: [],
    history: Array.isArray(obj.history) ? obj.history.slice(0, 200) : [],
    settings: {
      cooldown: Math.max(0, Math.min(50, Number(obj.settings && obj.settings.cooldown) || 0)),
      // через сколько минут модификатор без таймера сам уходит с оверлея (0 — никогда)
      modHideMin: obj.settings && obj.settings.modHideMin != null
        ? Math.max(0, Math.min(1440, Math.round(Number(obj.settings.modHideMin)) || 0)) : 60
    },
    lastBackup: obj.lastBackup || null,
    savedAt: Number(obj.savedAt) || legacyStamp(obj)
  };
  if (!obj.settings) s.settings.cooldown = 5;
  s.rarities = s.rarities.map(r => ({
    id: String(r.id), name: String(r.name || r.id),
    chance: Number(r.chance) || 0, color: r.color || '#9FB3C8'
  }));
  const rarityIds = new Set(s.rarities.map(r => r.id));
  s.groups = s.groups
    .filter(g => g && g.id && rarityIds.has(g.rarity))
    .map(g => ({ id: String(g.id), rarity: g.rarity, name: String(g.name || 'Без названия'), target: g.target ?? null, paused: !!g.paused }));
  const groupIds = new Set(s.groups.map(g => g.id));
  s.items = (obj.items || []).filter(it => it && it.text).map(it => ({
    id: it.id || uid(),
    text: String(it.text).trim(),
    rarity: rarityIds.has(it.rarity) ? it.rarity : s.rarities[0].id,
    group: groupIds.has(it.group) ? it.group : null,
    kind: KIND_LABEL[it.kind] ? it.kind : 'chaos',
    target: TARGET_LABEL[it.target] ? it.target : 'streamer',
    weight: Number(it.weight) > 0 ? Number(it.weight) : 1,
    active: it.active !== false,
    pinned: !!it.pinned,
    pausedByGroup: !!it.pausedByGroup,
    durationSec: Math.max(0, Math.min(86400, Math.round(Number(it.durationSec) || 0))),
    tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
    note: String(it.note || ''),
    createdAt: Number(it.createdAt) || now,
    activatedAt: Number(it.activatedAt) || now,
    benchedAt: it.benchedAt ? Number(it.benchedAt) : null,
    rolls: Number(it.rolls) || 0,
    lastRoll: it.lastRoll ? Number(it.lastRoll) : null
  }));
  // группа не должна торчать в чужую редкость
  s.items.forEach(it => {
    if (it.group) {
      const g = s.groups.find(x => x.id === it.group);
      if (!g || g.rarity !== it.rarity) it.group = null;
    }
  });
  return s;
}

// База до появления savedAt: свежесть — по последнему действию в ней (крутка, правка, скамейка)
function legacyStamp(obj) {
  let t = 0;
  (obj.history || []).forEach(h => { t = Math.max(t, Number(h && h.at) || 0); });
  (obj.items || []).forEach(it => {
    if (it) t = Math.max(t, Number(it.lastRoll) || 0, Number(it.activatedAt) || 0, Number(it.benchedAt) || 0);
  });
  return t;
}

// ============================================================
// КОПИЯ НА САЙТЕ — data/cards.json в репозитории
// Пишет только полная страница (не ?stream) и только при входе токеном GitHub.
// Правка карточек уходит через 30 секунд тишины, одни крутки/история — не чаще раза в 30 минут.
// Перед записью читаем свежую копию: если она новее нашей (правили в другом браузере) — берём её.
// ============================================================
const CLOUD_PATH = 'data/cards.json';
const CLOUD_EDIT_DELAY = 30e3;
const CLOUD_STATS_EVERY = 30 * 60e3;
var cloud = { ready: false, sha: null, savedAt: 0, sig: '', pushedAt: 0, timer: null, busy: false, status: '', seededHere: false };

// «Содержимое» базы без счётчиков круток: по нему понятно, правка это или просто крутили
function cardsSig(s) {
  return JSON.stringify([s.rarities, s.groups, s.settings,
    s.items.map(({ rolls, lastRoll, ...rest }) => rest)]);
}
function cloudOn() { return cloud.ready && !IS_STREAM && !!siteGit.token; }

function cloudSchedule() {
  if (!cloudOn()) return;
  clearTimeout(cloud.timer);
  if (!state.savedAt || state.savedAt <= cloud.savedAt) return;
  const edit = cardsSig(state) !== cloud.sig;
  const wait = edit ? CLOUD_EDIT_DELAY : Math.max(CLOUD_EDIT_DELAY, cloud.pushedAt + CLOUD_STATS_EVERY - Date.now());
  cloud.timer = setTimeout(cloudPush, wait);
  cloudStatus('ждёт сохранения');
}

function cloudAdopt(data, why) {
  snapshot('копия с сайта');
  state = normalize(data);
  save(true);
  if (typeof renderAll === 'function' && $('#app').style.display === 'block') renderAll();
  toast(why, 'откатить', undo);
}

async function cloudPush() {
  if (!cloudOn() || cloud.busy) return;
  clearTimeout(cloud.timer);
  cloud.busy = true;
  cloudStatus('сохраняю…');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await siteGit.readJson(CLOUD_PATH);
      const remoteAt = remote ? Number(remote.data.savedAt) || 0 : 0;
      if (remote && remoteAt > state.savedAt) {
        cloudAdopt(remote.data, 'В другом браузере база новее — взял её с сайта');
        cloudRemember(remote.sha, state);
        return;
      }
      if (!state.savedAt || (remote && remoteAt === state.savedAt)) { cloudRemember(remote && remote.sha, state); return; }
      try {
        const snap = JSON.parse(JSON.stringify(state));
        const sha = await siteGit.writeJson(CLOUD_PATH, snap, remote && remote.sha, 'Карточки: копия базы рулетки');
        cloudRemember(sha, snap);
        return;
      } catch (err) {
        if (err.status !== 409 && err.status !== 422) throw err;
      }
    }
    throw new Error('файл одновременно меняют с другого устройства');
  } catch (err) {
    cloudStatus('не сохранилась: ' + err.message);
  } finally {
    cloud.busy = false;
    cloudSchedule();
  }
}
function cloudRemember(sha, s) {
  cloud.sha = sha || null;
  cloud.savedAt = s.savedAt || 0;
  cloud.sig = cardsSig(s);
  cloud.pushedAt = Date.now();
  cloudStatus(cloud.savedAt ? 'сохранена ' + new Date(cloud.savedAt).toLocaleString('ru-RU') : 'пока не сохранялась');
}
function cloudStatus(text) {
  cloud.status = text;
  const el = document.getElementById('cloud-status');
  if (el) el.textContent = text;
  const btn = document.getElementById('btn-cloud-push');
  if (btn) btn.hidden = !cloudOn();
}

// Пустой браузер: берём базу с сайта (без токена — опубликованную копию, она может отставать на пару минут)
async function cloudFetch() {
  try {
    if (siteGit.token) { const r = await siteGit.readJson(CLOUD_PATH); return r && r.data; }
    const res = await fetch(CLOUD_PATH + '?t=' + Date.now(), { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch (e) { return null; }
}

// Полная страница при входе токеном: сверяемся с сайтом и включаем автосохранение
async function cloudInit() {
  if (IS_STREAM) return;
  if (!siteGit.token) { cloudStatus('сохраняется, только если войти токеном GitHub, а не кодом'); return; }
  cloudStatus('проверяю…');
  try {
    const remote = await siteGit.readJson(CLOUD_PATH);
    if (remote) {
      const remoteAt = Number(remote.data.savedAt) || 0;
      if (remoteAt > state.savedAt || (cloud.seededHere && remote.data.items && remote.data.items.length)) {
        cloudAdopt(remote.data, 'Взял базу карточек с сайта — она новее, чем в этом браузере');
      }
      cloud.ready = true;
      cloudRemember(remote.sha, normalize(remote.data));
    } else {
      cloud.ready = true;
      cloudStatus('пока не сохранялась');
    }
    cloudSchedule();
    if (!remote && state.savedAt) cloudPush();   // первый раз: переносим базу из браузера на сайт
  } catch (err) {
    cloudStatus('не проверить: ' + err.message);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && cloud.timer && cloudOn()) cloudPush();
});

// ---------- undo ----------
function snapshot(label) {
  undoStack.push({ label, data: JSON.stringify(state) });
  if (undoStack.length > 40) undoStack.shift();
}
function undo() {
  const prev = undoStack.pop();
  if (!prev) { toast('Отменять нечего'); return; }
  state = normalize(JSON.parse(prev.data));
  save();
  renderAll();
  toast('Отменено: ' + prev.label);
}

// ---------- мелкие помощники ----------
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function rarity(id) { return state.rarities.find(r => r.id === id) || state.rarities[0]; }
function group(id)  { return state.groups.find(g => g.id === id) || null; }
function itemsOf(rarityId, active) {
  return state.items.filter(it => it.rarity === rarityId && it.active === active);
}
function fmtPct(x) {
  if (x === 0) return '0%';
  if (x < 0.01) return x.toFixed(4).replace(/0+$/, '') + '%';
  if (x < 1) return x.toFixed(2) + '%';
  return x.toFixed(x < 10 ? 2 : 1).replace(/\.0+$/, '') + '%';
}
function days(ts) { return Math.floor((Date.now() - ts) / 86400000); }
function ageLabel(ts) {
  const d = days(ts);
  if (d < 1) return 'сегодня';
  if (d === 1) return '1 день';
  if (d < 5) return d + ' дня';
  return d + ' дней';
}

let toastTimer = null;
function toast(msg, actionLabel, action) {
  const old = $('.toast'); if (old) old.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span>' + esc(msg) + '</span>';
  if (actionLabel) {
    const b = document.createElement('button');
    b.textContent = actionLabel;
    b.onclick = () => { el.remove(); action(); };
    el.appendChild(b);
  }
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), actionLabel ? 8000 : 3200);
}

// ============================================================
// МАТЕМАТИКА ШАНСОВ
// ============================================================
// Шанс редкости с учётом того, что суммарно может быть не 100%,
// и что редкость без активных карточек выпасть не может.
function rarityChances() {
  const live = state.rarities.filter(r => itemsOf(r.id, true).length > 0);
  const total = live.reduce((s, r) => s + r.chance, 0);
  const map = {};
  state.rarities.forEach(r => { map[r.id] = 0; });
  if (total <= 0) return map;
  live.forEach(r => { map[r.id] = r.chance / total * 100; });
  return map;
}

function itemChance(item) {
  if (!item.active) return 0;
  const rc = rarityChances()[item.rarity] || 0;
  const pool = itemsOf(item.rarity, true);
  const sum = pool.reduce((s, i) => s + i.weight, 0);
  if (sum <= 0) return 0;
  return rc * (item.weight / sum);
}

function pickWeighted(list, weightOf) {
  const total = list.reduce((s, x) => s + weightOf(x), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of list) {
    r -= weightOf(x);
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

// Карточки из последних N круток (settings.cooldown) временно не участвуют,
// чтобы одно и то же не выпадало дважды за вечер. Редкость выбирается как обычно;
// если в ней после исключения никого не остаётся — исключение снимается.
function rollOnce() {
  const chances = rarityChances();
  const live = state.rarities.filter(r => chances[r.id] > 0);
  if (!live.length) return null;
  const r = pickWeighted(live, x => chances[x.id]);
  const recent = new Set(state.history.slice(0, state.settings.cooldown).map(h => h.id));
  let pool = itemsOf(r.id, true);
  const fresh = pool.filter(i => !recent.has(i.id));
  if (fresh.length) pool = fresh;
  const item = pickWeighted(pool, x => x.weight);
  return item ? { item, rarityId: r.id } : null;
}

// ============================================================
// РЕНДЕР: полоса редкостей
// ============================================================
function renderStrip() {
  const chances = rarityChances();
  const strip = $('#rarity-strip');
  strip.innerHTML = state.rarities.map(r => {
    const act = itemsOf(r.id, true).length;
    const bench = itemsOf(r.id, false).length;
    const per = act ? chances[r.id] / act : 0;
    const dim = ui.rarityFilter && ui.rarityFilter !== r.id;
    let warn = '';
    if (act === 0) warn = '<div class="rcard__meta rcard__warn">пусто — не выпадет</div>';
    else if (act < 5) warn = '<div class="rcard__meta rcard__warn">мало вариантов, предсказуемо</div>';
    return `
      <div class="rcard${dim ? ' is-dim' : ''}" style="--rc:${r.color}" data-rarity="${r.id}">
        <div class="rcard__name">${esc(r.name)}</div>
        <div class="rcard__pct">${fmtPct(r.chance)}</div>
        <div class="rcard__meta">${act} в рулетке · ${bench} на скамейке</div>
        <div class="rcard__meta">одна карточка ≈ ${fmtPct(per)}</div>
        ${warn}
      </div>`;
  }).join('');
  strip.querySelectorAll('.rcard').forEach(el => {
    el.onclick = () => {
      ui.rarityFilter = ui.rarityFilter === el.dataset.rarity ? null : el.dataset.rarity;
      renderStrip(); renderBoard();
    };
  });
}

// ============================================================
// РЕНДЕР: доска
// ============================================================
function matchesFilters(it) {
  if (ui.kind && it.kind !== ui.kind) return false;
  if (ui.target && it.target !== ui.target) return false;
  if (ui.search) {
    const g = group(it.group);
    const hay = (it.text + ' ' + it.tags.join(' ') + ' ' + (g ? g.name : '') + ' ' + it.note).toLowerCase();
    if (!hay.includes(ui.search)) return false;
  }
  return true;
}

function sortItems(list) {
  const arr = list.slice();
  switch (ui.sort) {
    case 'text':   arr.sort((a, b) => a.text.localeCompare(b.text, 'ru')); break;
    case 'weight': arr.sort((a, b) => b.weight - a.weight); break;
    case 'rolls':  arr.sort((a, b) => b.rolls - a.rolls); break;
    case 'age':    arr.sort((a, b) => a.createdAt - b.createdAt); break;
  }
  return arr;
}

function cardHTML(it) {
  const r = rarity(it.rarity);
  const g = group(it.group);
  const chips = [];
  if (it.pinned) chips.push('<span class="chip chip--pin" title="закреплена: ротация её не трогает">★</span>');
  if (g) chips.push(`<span class="chip chip--group">${esc(g.name)}</span>`);
  if (it.weight !== 1) chips.push(`<span class="chip chip--w" title="вес">×${it.weight}</span>`);
  // если категория называется так же, как тип, второй раз не повторяем
  if (!g || normText(g.name) !== normText(KIND_LABEL[it.kind])) {
    chips.push(`<span class="chip">${KIND_LABEL[it.kind]}</span>`);
  }
  if (it.durationSec) chips.push(`<span class="chip chip--timer" title="таймер на оверлее"><svg class="ic" aria-hidden="true"><use href="#i-timer"></use></svg>${fmtDur(it.durationSec)}</span>`);
  if (it.rolls) chips.push(`<span class="chip" title="сколько раз выпадало">⟳ ${it.rolls}</span>`);
  if (ui.sort === 'age') chips.push(`<span class="chip" title="в базе">${ageLabel(it.createdAt)}</span>`);
  it.tags.forEach(t => chips.push(`<span class="chip">#${esc(t)}</span>`));

  return `
    <div class="card${it.active ? '' : ' is-benched'}" draggable="true" data-id="${it.id}" style="--rc:${r.color}">
      <div class="card__text">${esc(it.text)}</div>
      <div class="card__foot">
        ${chips.join('')}
        <span class="card__acts">
          <button class="iconbtn" data-act="edit"   title="Редактировать">✎</button>
          <button class="iconbtn" data-act="pin"    title="Закрепить / открепить">★</button>
          <button class="iconbtn" data-act="toggle" title="${it.active ? 'На скамейку' : 'В рулетку'}">${it.active ? '↓' : '↑'}</button>
          <button class="iconbtn" data-act="copy"   title="Дублировать">⧉</button>
          <button class="iconbtn" data-act="del"    title="Удалить">✕</button>
        </span>
      </div>
    </div>`;
}

function renderBoard() {
  const board = $('#board');
  const rars = ui.rarityFilter ? state.rarities.filter(r => r.id === ui.rarityFilter) : state.rarities;
  board.classList.toggle('is-single', rars.length === 1);
  const chances = rarityChances();

  board.innerHTML = rars.map(r => {
    const act = sortItems(itemsOf(r.id, true).filter(matchesFilters));
    const bench = sortItems(itemsOf(r.id, false).filter(matchesFilters));
    const actAll = itemsOf(r.id, true).length;
    const benchAll = itemsOf(r.id, false).length;
    const open = ui.benchOpen[r.id];
    return `
      <div class="col" style="--rc:${r.color}" data-rarity="${r.id}">
        <div class="col__head">
          <span class="col__name">${esc(r.name)}</span>
          <span class="col__count">${fmtPct(r.chance)}</span>
        </div>
        <div class="col__sub">${actAll} в рулетке${actAll ? ' · одна ≈ ' + fmtPct(chances[r.id] / actAll) : ''}</div>
        <div class="zone" data-rarity="${r.id}" data-zone="active">
          ${act.map(cardHTML).join('') || '<div class="empty">пусто — перетащи сюда карточку</div>'}
        </div>
        <div class="zone-label" data-toggle-bench="${r.id}">
          <span style="order:1">${open ? '▾' : '▸'} Скамейка (${benchAll})</span>
        </div>
        <div class="zone" data-rarity="${r.id}" data-zone="bench" style="${open ? '' : 'display:none'}">
          ${bench.map(cardHTML).join('') || '<div class="empty">никто не отдыхает</div>'}
        </div>
      </div>`;
  }).join('');

  wireBoard();
}

function wireBoard() {
  // сворачивание скамейки
  $$('[data-toggle-bench]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.toggleBench;
      ui.benchOpen[id] = !ui.benchOpen[id];
      renderBoard();
    };
  });

  // кнопки на карточке
  $$('.card .iconbtn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.closest('.card').dataset.id;
      const it = state.items.find(x => x.id === id);
      if (!it) return;
      const act = btn.dataset.act;
      if (act === 'edit') return openEditor(it);
      if (act === 'pin') {
        snapshot('закрепление');
        it.pinned = !it.pinned; save(); renderBoard(); return;
      }
      if (act === 'toggle') {
        snapshot(it.active ? 'на скамейку' : 'в рулетку');
        setActive(it, !it.active); save(); renderAll(); return;
      }
      if (act === 'copy') {
        snapshot('дублирование');
        const clone = { ...it, id: uid(), text: it.text + ' (копия)', rolls: 0, lastRoll: null, createdAt: Date.now() };
        state.items.splice(state.items.indexOf(it) + 1, 0, clone);
        save(); renderAll(); openEditor(clone); return;
      }
      if (act === 'del') {
        const backup = JSON.stringify(state);
        snapshot('удаление');
        state.items = state.items.filter(x => x.id !== id);
        save(); renderAll();
        toast('Удалено: ' + it.text.slice(0, 40), 'вернуть', () => {
          state = normalize(JSON.parse(backup)); save(); renderAll();
        });
      }
    };
  });

  // двойной клик — редактор
  $$('.card').forEach(el => {
    el.ondblclick = () => {
      const it = state.items.find(x => x.id === el.dataset.id);
      if (it) openEditor(it);
    };
  });

  wireDnd();
}

function setActive(it, on) {
  if (it.active === on) return;
  it.active = on;
  if (on) { it.activatedAt = Date.now(); it.benchedAt = null; }
  else    { it.benchedAt = Date.now(); }
}

// ---------- drag & drop ----------
let dragId = null;
function moveItem(it, toRarity, toActive) {
  if (it.rarity === toRarity && it.active === toActive) return;
  snapshot('перенос карточки');
  if (it.rarity !== toRarity) {
    it.rarity = toRarity;
    const g = group(it.group);
    if (g && g.rarity !== toRarity) it.group = null;
  }
  setActive(it, toActive);
  save(); renderAll();
}

function droppedItem(e) {
  const id = dragId || e.dataTransfer.getData('text/plain');
  return state.items.find(x => x.id === id) || null;
}

function renderDock() {
  const dock = $('#drag-dock');
  dock.innerHTML = state.rarities.map(r =>
    `<div class="drag-dock__t" style="--rc:${r.color}" data-rarity="${r.id}" data-zone="active">${esc(r.name)}<small>в рулетку</small></div>`
  ).join('') + `<div class="drag-dock__t drag-dock__t--bench" data-zone="bench">Скамейка<small>той же редкости</small></div>`;

  dock.querySelectorAll('.drag-dock__t').forEach(t => {
    t.addEventListener('dragover', e => { e.preventDefault(); t.classList.add('is-over'); });
    t.addEventListener('dragleave', () => t.classList.remove('is-over'));
    t.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      t.classList.remove('is-over');
      const it = droppedItem(e);
      if (!it) return;
      const toActive = t.dataset.zone === 'active';
      moveItem(it, t.dataset.rarity || it.rarity, toActive);
    });
  });
}

function wireDnd() {
  $$('.card').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragId = el.dataset.id;
      el.classList.add('is-dragging');
      document.body.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    el.addEventListener('dragend', () => {
      dragId = null;
      el.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging');
      $$('.zone, .col, .drag-dock__t').forEach(z => z.classList.remove('is-over'));
    });
  });

  // зоны «в рулетке» / «скамейка» внутри колонки
  $$('.zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove('is-over');
      const it = droppedItem(e);
      if (it) moveItem(it, zone.dataset.rarity, zone.dataset.zone === 'active');
    });
  });

  // вся колонка целиком: бросил куда угодно внутри — попадает в рулетку этой редкости
  $$('.col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('is-over'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('is-over');
      const it = droppedItem(e);
      if (it) moveItem(it, col.dataset.rarity, true);
    });
  });

  renderDock();
}

// ============================================================
// РЕДАКТОР КАРТОЧКИ
// ============================================================
function modal(html, wide) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal${wide ? ' modal--wide' : ''}">${html}</div>`;
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  function close() {
    back.remove(); document.removeEventListener('keydown', onKey);
    if (reloadPending) applyExternalState();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  return { el: back, close };
}

function groupOptions(rarityId, selected) {
  const gs = state.groups.filter(g => g.rarity === rarityId);
  return '<option value="">— без категории —</option>' +
    gs.map(g => `<option value="${g.id}"${g.id === selected ? ' selected' : ''}>${esc(g.name)}</option>`).join('') +
    '<option value="__new">+ новая категория…</option>';
}

function openEditor(it) {
  const isNew = !state.items.includes(it);
  const m = modal(`
    <div class="modal__title">${isNew ? 'Новая карточка' : 'Карточка'}</div>
    <label class="field"><span>Текст</span>
      <textarea id="f-text" rows="3">${esc(it.text)}</textarea></label>
    <div class="row">
      <label class="field"><span>Редкость</span>
        <select id="f-rarity">${state.rarities.map(r =>
          `<option value="${r.id}"${r.id === it.rarity ? ' selected' : ''}>${esc(r.name)} — ${fmtPct(r.chance)}</option>`).join('')}</select></label>
      <label class="field"><span>Категория</span>
        <select id="f-group">${groupOptions(it.rarity, it.group)}</select></label>
    </div>
    <div class="row">
      <label class="field"><span>Тип</span>
        <select id="f-kind">${Object.entries(KIND_LABEL).map(([k, v]) =>
          `<option value="${k}"${k === it.kind ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Кто попадает</span>
        <select id="f-target">${Object.entries(TARGET_LABEL).map(([k, v]) =>
          `<option value="${k}"${k === it.target ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Вес внутри редкости</span>
        <input type="number" id="f-weight" min="0.1" step="0.1" value="${it.weight}"></label>
    </div>
    <div class="row row--timer">
      <label class="field"><span>Таймер: минуты</span>
        <input type="number" id="f-dmin" min="0" max="1440" step="1" value="${Math.floor((it.durationSec || 0) / 60) || ''}" placeholder="0"></label>
      <label class="field"><span>секунды</span>
        <input type="number" id="f-dsec" min="0" max="59" step="1" value="${(it.durationSec || 0) % 60 || ''}" placeholder="0"></label>
      <button class="btn btn--sm" id="f-dguess" type="button" hidden></button>
    </div>
    <div class="field-hint" id="f-dhint"></div>
    <label class="field"><span>Теги через запятую</span>
      <input type="text" id="f-tags" value="${esc(it.tags.join(', '))}" placeholder="например: голос, физуха, долгое"></label>
    <label class="field"><span>Заметка для себя</span>
      <input type="text" id="f-note" value="${esc(it.note)}" placeholder="условия, лимиты, что не сработало"></label>
    <div class="row">
      <label class="check"><input type="checkbox" id="f-active"${it.active ? ' checked' : ''}> в рулетке</label>
      <label class="check"><input type="checkbox" id="f-pinned"${it.pinned ? ' checked' : ''}> закрепить (ротация не трогает)</label>
    </div>
    <div id="f-stats" style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:14px;line-height:1.6"></div>
    <div class="modal__foot">
      ${isNew ? '' : '<button class="btn btn--danger left" id="f-del">Удалить</button>'}
      <button class="btn" id="f-cancel">Отмена</button>
      <button class="btn btn--gold" id="f-save">Сохранить</button>
    </div>
  `);

  const rarSel = m.el.querySelector('#f-rarity');
  const grpSel = m.el.querySelector('#f-group');

  rarSel.onchange = () => { grpSel.innerHTML = groupOptions(rarSel.value, null); refreshStats(); };

  // Таймер: подсказка из текста («3 минуты», «60 секунд», «на час») и пояснение про оверлей
  const dMin = m.el.querySelector('#f-dmin'), dSec = m.el.querySelector('#f-dsec');
  const dGuess = m.el.querySelector('#f-dguess'), dHint = m.el.querySelector('#f-dhint');
  const kindSel = m.el.querySelector('#f-kind'), textEl = m.el.querySelector('#f-text');
  const readDur = () => Math.max(0, Math.round((Number(dMin.value) || 0) * 60 + (Number(dSec.value) || 0)));
  function refreshTimer() {
    const cur = readDur(), guess = guessDuration(textEl.value);
    dGuess.hidden = !guess || guess === cur;
    dGuess.textContent = 'Из текста: ' + fmtDur(guess);
    const onOverlay = kindSel.value === 'mod' || cur > 0;
    dHint.textContent = onOverlay
      ? (cur ? `На оверлее модификаторов с таймером ${fmtDur(cur)}, потом сама исчезнет.` : 'На оверлее модификаторов без таймера — висит, пока не снимешь.')
      : 'Без таймера и не модификатор — на оверлей не попадает.';
  }
  dGuess.onclick = () => { const g = guessDuration(textEl.value); dMin.value = Math.floor(g / 60) || ''; dSec.value = g % 60 || ''; refreshTimer(); };
  [dMin, dSec, textEl].forEach(el => el.addEventListener('input', refreshTimer));
  kindSel.addEventListener('change', refreshTimer);
  refreshTimer();
  grpSel.onchange = () => {
    if (grpSel.value !== '__new') return;
    const name = prompt('Название новой категории внутри редкости «' + rarity(rarSel.value).name + '»:');
    if (!name || !name.trim()) { grpSel.value = it.group || ''; return; }
    const g = { id: 'g' + uid(), rarity: rarSel.value, name: name.trim(), target: null };
    state.groups.push(g); save();
    grpSel.innerHTML = groupOptions(rarSel.value, g.id);
  };

  function refreshStats() {
    const box = m.el.querySelector('#f-stats');
    if (isNew) { box.textContent = ''; return; }
    const ch = itemChance(it);
    box.innerHTML =
      `Текущий шанс: <b>${fmtPct(ch)}</b>${ch > 0 ? ' — примерно раз в ' + Math.round(100 / ch) + ' круток' : ''}<br>` +
      `Выпадало ${it.rolls} раз${it.lastRoll ? ', последний раз ' + new Date(it.lastRoll).toLocaleDateString('ru-RU') : ''}<br>` +
      `В базе ${ageLabel(it.createdAt)}${it.active ? ', в рулетке с ' + new Date(it.activatedAt).toLocaleDateString('ru-RU')
        : (it.benchedAt ? ', на скамейке с ' + new Date(it.benchedAt).toLocaleDateString('ru-RU') : '')}`;
  }
  refreshStats();

  m.el.querySelector('#f-cancel').onclick = m.close;
  if (!isNew) m.el.querySelector('#f-del').onclick = () => {
    snapshot('удаление');
    state.items = state.items.filter(x => x.id !== it.id);
    save(); renderAll(); m.close();
  };

  m.el.querySelector('#f-save').onclick = () => {
    const text = m.el.querySelector('#f-text').value.trim();
    if (!text) { toast('Текст не может быть пустым'); return; }
    snapshot(isNew ? 'новая карточка' : 'правка карточки');
    it.text = text;
    it.rarity = rarSel.value;
    it.group = grpSel.value && grpSel.value !== '__new' ? grpSel.value : null;
    it.kind = m.el.querySelector('#f-kind').value;
    it.target = m.el.querySelector('#f-target').value;
    it.weight = Math.max(0.1, Number(m.el.querySelector('#f-weight').value) || 1);
    it.tags = m.el.querySelector('#f-tags').value.split(',').map(s => s.trim()).filter(Boolean);
    it.note = m.el.querySelector('#f-note').value.trim();
    it.durationSec = Math.min(86400, readDur());
    it.pinned = m.el.querySelector('#f-pinned').checked;
    setActive(it, m.el.querySelector('#f-active').checked);
    if (isNew) state.items.push(it);
    save(); renderAll(); m.close();
  };

  setTimeout(() => m.el.querySelector('#f-text').focus(), 30);
}

function newCard() {
  const now = Date.now();
  openEditor({
    id: uid(), text: '', rarity: ui.rarityFilter || 'common', group: null,
    kind: 'chaos', target: 'streamer', weight: 1, active: true, pinned: false,
    tags: [], note: '', durationSec: 0, createdAt: now, activatedAt: now, benchedAt: null, rolls: 0, lastRoll: null
  });
}

// ============================================================
// МАССОВОЕ ДОБАВЛЕНИЕ
// ============================================================
function openBulk() {
  const m = modal(`
    <div class="modal__title">Массовое добавление</div>
    <p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:14px">
      По одному варианту на строку. Пустые строки и повторы с уже существующими карточками пропускаются.
    </p>
    <label class="field"><span>Список</span>
      <textarea id="b-text" rows="12" placeholder="говорить только вопросами 2 минуты&#10;поменять шрифт чата на комик санс&#10;…"></textarea></label>
    <div class="row">
      <label class="field"><span>Редкость</span>
        <select id="b-rarity">${state.rarities.map(r =>
          `<option value="${r.id}"${r.id === (ui.rarityFilter || 'common') ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Категория</span>
        <select id="b-group">${groupOptions(ui.rarityFilter || 'common', null)}</select></label>
      <label class="field"><span>Тип</span>
        <select id="b-kind">${Object.entries(KIND_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="field"><span>Кто попадает</span>
        <select id="b-target">${Object.entries(TARGET_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    </div>
    <label class="check"><input type="checkbox" id="b-bench"> положить сразу на скамейку (копим про запас)</label>
    <div class="modal__foot">
      <button class="btn" id="b-cancel">Отмена</button>
      <button class="btn btn--gold" id="b-save">Добавить</button>
    </div>
  `);

  const rs = m.el.querySelector('#b-rarity');
  const gs = m.el.querySelector('#b-group');
  rs.onchange = () => { gs.innerHTML = groupOptions(rs.value, null); };
  gs.onchange = () => {
    if (gs.value !== '__new') return;
    const name = prompt('Название новой категории:');
    if (!name || !name.trim()) { gs.value = ''; return; }
    const g = { id: 'g' + uid(), rarity: rs.value, name: name.trim(), target: null };
    state.groups.push(g); save();
    gs.innerHTML = groupOptions(rs.value, g.id);
  };

  m.el.querySelector('#b-cancel').onclick = m.close;
  m.el.querySelector('#b-save').onclick = () => {
    const lines = m.el.querySelector('#b-text').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { toast('Список пустой'); return; }
    const known = new Set(state.items.map(i => normText(i.text)));
    const bench = m.el.querySelector('#b-bench').checked;
    const now = Date.now();
    let added = 0, skipped = 0;
    snapshot('массовое добавление');
    lines.forEach(text => {
      if (known.has(normText(text))) { skipped++; return; }
      known.add(normText(text));
      state.items.push({
        id: uid(), text,
        rarity: rs.value,
        group: gs.value && gs.value !== '__new' ? gs.value : null,
        kind: m.el.querySelector('#b-kind').value,
        target: m.el.querySelector('#b-target').value,
        weight: 1, active: !bench, pinned: false, tags: [], note: '',
        createdAt: now, activatedAt: now, benchedAt: bench ? now : null, rolls: 0, lastRoll: null
      });
      added++;
    });
    save(); renderAll(); m.close();
    toast(`Добавлено ${added}${skipped ? ', пропущено повторов: ' + skipped : ''}`);
  };
  setTimeout(() => m.el.querySelector('#b-text').focus(), 30);
}

function normText(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

// ============================================================
// РОТАЦИЯ
// ============================================================
function openRotate() {
  const rarOpts = '<option value="">Все редкости</option>' + state.rarities.map(r =>
    `<option value="${r.id}"${r.id === ui.rarityFilter ? ' selected' : ''}>${esc(r.name)}</option>`).join('');

  const m = modal(`
    <div class="modal__title">Ротация состава</div>
    <p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:16px">
      Убирает случайные карточки на скамейку и возвращает в рулетку тех, кто отдыхал дольше всех.
      Закреплённые (★) карточки не трогаются. Всё можно откатить через <span class="kbd">Ctrl</span>+<span class="kbd">Z</span>.
    </p>
    <div class="row">
      <label class="field"><span>Редкость</span><select id="r-rarity">${rarOpts}</select></label>
      <label class="field"><span>Убрать на скамейку</span><input type="number" id="r-out" min="0" value="3"></label>
      <label class="field"><span>Вернуть в рулетку</span><input type="number" id="r-in" min="0" value="3"></label>
    </div>
    <label class="check" style="margin-bottom:8px"><input type="checkbox" id="r-fresh" checked> сначала убирать те, что чаще выпадали</label>
    <label class="check"><input type="checkbox" id="r-oldest" checked> возвращать тех, кто дольше на скамейке</label>
    <div id="r-preview" style="margin-top:18px"></div>
    <div class="modal__foot">
      <button class="btn" id="r-cancel">Отмена</button>
      <button class="btn" id="r-preview-btn">Показать, что будет</button>
      <button class="btn btn--gold" id="r-go">Перемешать</button>
    </div>
  `);

  function plan() {
    const rid = m.el.querySelector('#r-rarity').value;
    const nOut = Math.max(0, Number(m.el.querySelector('#r-out').value) || 0);
    const nIn = Math.max(0, Number(m.el.querySelector('#r-in').value) || 0);
    const byRolls = m.el.querySelector('#r-fresh').checked;
    const byOldest = m.el.querySelector('#r-oldest').checked;
    const rars = rid ? [rid] : state.rarities.map(r => r.id);
    const out = [], back = [];

    rars.forEach(id => {
      let act = itemsOf(id, true).filter(i => !i.pinned);
      let ben = itemsOf(id, false).filter(i => !i.pinned && !(group(i.group) || {}).paused);
      // не осушаем редкость полностью: минимум 1 карточка должна остаться
      const keepMin = 1;
      const canRemove = Math.max(0, itemsOf(id, true).length - keepMin);
      act = byRolls ? act.slice().sort((a, b) => b.rolls - a.rolls || a.activatedAt - b.activatedAt) : shuffle(act);
      ben = byOldest ? ben.slice().sort((a, b) => (a.benchedAt || 0) - (b.benchedAt || 0)) : shuffle(ben);
      out.push(...act.slice(0, Math.min(nOut, canRemove)));
      back.push(...ben.slice(0, nIn));
    });
    return { out, back };
  }

  function showPreview() {
    const { out, back } = plan();
    const list = (arr, title, cls) => arr.length
      ? `<div style="margin-bottom:12px"><div class="panel__title" style="margin-bottom:6px">${title}</div>` +
        arr.map(i => `<div style="font-size:13px;padding:3px 0;color:${cls}">${esc(rarity(i.rarity).name)} · ${esc(i.text)}</div>`).join('') + '</div>'
      : `<div style="margin-bottom:12px" class="empty">${title}: никого</div>`;
    m.el.querySelector('#r-preview').innerHTML =
      list(out, 'Уйдут на скамейку', '#F0B95F') + list(back, 'Вернутся в рулетку', '#7FD69B');
  }

  m.el.querySelector('#r-preview-btn').onclick = showPreview;
  m.el.querySelector('#r-cancel').onclick = m.close;
  m.el.querySelector('#r-go').onclick = () => {
    const { out, back } = plan();
    if (!out.length && !back.length) { toast('Нечего менять'); return; }
    snapshot('ротация');
    out.forEach(i => setActive(i, false));
    back.forEach(i => setActive(i, true));
    save(); renderAll(); m.close();
    toast(`Ротация: −${out.length} на скамейку, +${back.length} в рулетку`, 'откатить', undo);
  };
  showPreview();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// ПОИСК ДУБЛЕЙ
// ============================================================
// ============================================================
// ПАУЗА КАТЕГОРИИ — вся категория на скамейку одной кнопкой и обратно.
// Категории с одинаковым названием в разных редкостях считаются одной.
// ============================================================
function pauseGroups(groups, on) {
  snapshot(on ? 'пауза категории' : 'возврат категории');
  groups.forEach(g => {
    g.paused = on;
    state.items.filter(i => i.group === g.id).forEach(i => {
      if (on && i.active) { setActive(i, false); i.pausedByGroup = true; }
      if (!on && i.pausedByGroup) { setActive(i, true); i.pausedByGroup = false; }
    });
  });
  save(); renderAll(); updatePauseButton();
}

function updatePauseButton() {
  const n = new Set(state.groups.filter(g => g.paused).map(g => normText(g.name))).size;
  const btn = $('#btn-pause');
  btn.innerHTML = icon('pause') + (n ? ` Категории (${n} на паузе)` : ' Категории');
  btn.classList.toggle('btn--gold', n > 0);
}

function openPause() {
  const byName = new Map();
  state.groups.forEach(g => {
    const k = normText(g.name);
    if (!byName.has(k)) byName.set(k, { name: g.name, groups: [] });
    byName.get(k).groups.push(g);
  });
  const rows = Array.from(byName.values()).map(({ name, groups }) => {
    const ids = new Set(groups.map(g => g.id));
    const items = state.items.filter(i => ids.has(i.group));
    const act = items.filter(i => i.active).length;
    const paused = groups.some(g => g.paused);
    const rars = groups.map(g => `<span style="color:${rarity(g.rarity).color}">${esc(rarity(g.rarity).name)}</span>`).join(', ');
    return `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07)">
      <div style="flex:1 1 auto">
        <div style="font-size:15px">${esc(name)} ${paused ? '<span class="chip" style="background:rgba(240,185,95,0.18);color:#F0B95F">на паузе</span>' : ''}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:3px">${rars} · ${act} в рулетке, ${items.length - act} на скамейке</div>
      </div>
      <button class="btn ${paused ? 'btn--gold' : ''}" data-pause="${esc(normText(name))}">${paused ? icon('play') + ' Вернуть' : icon('pause') + ' На скамейку'}</button>
    </div>`;
  }).join('');

  const m = modal(`
    <div class="modal__title">Пауза категорий</div>
    <p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:12px">
      «На скамейку» убирает из рулетки все карточки категории разом. «Вернуть» поднимает обратно только те,
      что были убраны паузой — кто лежал на скамейке до неё, там и останется. Пока категория на паузе,
      ротация её карточки не возвращает. Всё откатывается через <span class="kbd">Ctrl</span>+<span class="kbd">Z</span>.
    </p>
    ${rows || '<div class="empty">Категорий пока нет — назначь их карточкам в редакторе.</div>'}
    <div class="modal__foot"><button class="btn" id="pz-close">Закрыть</button></div>
  `);
  m.el.querySelector('#pz-close').onclick = m.close;
  m.el.querySelectorAll('[data-pause]').forEach(b => {
    b.onclick = () => {
      const groups = state.groups.filter(g => normText(g.name) === b.dataset.pause);
      const on = !groups.some(g => g.paused);
      pauseGroups(groups, on);
      m.close(); openPause();
      toast(on ? `«${groups[0].name}» — на скамейке` : `«${groups[0].name}» — снова в рулетке`);
    };
  });
}

function openDupes() {
  const map = new Map();
  state.items.forEach(it => {
    const k = normText(it.text);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  });
  const dupes = Array.from(map.values()).filter(g => g.length > 1);
  const body = dupes.length
    ? dupes.map(g => `
        <div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.07)">
          <div style="font-size:14px;margin-bottom:6px">${esc(g[0].text)}</div>
          ${g.map(i => `<div style="font-size:12px;color:rgba(255,255,255,0.5)">
              ${esc(rarity(i.rarity).name)} · ${i.active ? 'в рулетке' : 'на скамейке'}
              <button class="btn btn--sm" style="margin-left:8px" data-del="${i.id}">удалить эту</button>
            </div>`).join('')}
        </div>`).join('')
    : '<div class="empty">Повторов нет.</div>';

  const m = modal(`
    <div class="modal__title">Повторяющиеся карточки</div>
    <p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:16px">
      Сравнение по смыслу текста без учёта регистра и знаков. Одинаковый текст в разных
      редкостях — не всегда ошибка, но обычно стоит оставить одну версию.
    </p>
    ${body}
    <div class="modal__foot"><button class="btn" id="d-close">Закрыть</button></div>
  `, true);

  m.el.querySelector('#d-close').onclick = m.close;
  m.el.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => {
      snapshot('удаление дубля');
      state.items = state.items.filter(x => x.id !== b.dataset.del);
      save(); renderAll(); m.close(); openDupes();
    };
  });
}

// ============================================================
// ВКЛАДКА «БАЛАНС»
// ============================================================
function renderBalance() {
  renderHealth();
  renderRarityTable();
  renderGroups();
  renderChanceTable();
}

function renderHealth() {
  const sum = state.rarities.reduce((s, r) => s + r.chance, 0);
  const msgs = [];
  if (Math.abs(sum - 100) > 0.001) {
    msgs.push(`<div class="warn">Сумма шансов редкостей — ${fmtPct(sum)}, а не 100%. Шансы всё равно работают, но нормализуются.</div>`);
  } else {
    msgs.push('<div class="good">Сумма шансов ровно 100%.</div>');
  }
  state.rarities.forEach(r => {
    const n = itemsOf(r.id, true).length;
    if (n === 0) msgs.push(`<div class="bad">«${esc(r.name)}» — ни одной карточки в рулетке, ${fmtPct(r.chance)} шанса перетекает в другие редкости.</div>`);
    else if (n < 5) msgs.push(`<div class="warn">«${esc(r.name)}» — всего ${n} вариант(а) в рулетке, зрители запомнят их за пару стримов.</div>`);
  });
  const bench = state.items.filter(i => !i.active).length;
  if (bench < 10) msgs.push(`<div class="warn">На скамейке только ${bench} карточек — ротацию скоро будет нечем кормить.</div>`);

  const total = state.items.length;
  const active = state.items.filter(i => i.active).length;
  $('#health').innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat"><div class="stat__v">${total}</div><div class="stat__l">всего вариантов</div></div>
      <div class="stat"><div class="stat__v">${active}</div><div class="stat__l">в рулетке</div></div>
      <div class="stat"><div class="stat__v">${bench}</div><div class="stat__l">на скамейке</div></div>
      <div class="stat"><div class="stat__v">${state.items.filter(i => i.pinned).length}</div><div class="stat__l">закреплено</div></div>
    </div>
    <div style="font-size:13px;line-height:1.9">${msgs.join('')}</div>`;
}

function renderRarityTable() {
  const chances = rarityChances();
  const rows = state.rarities.map(r => {
    const act = itemsOf(r.id, true).length;
    const bench = itemsOf(r.id, false).length;
    const eff = chances[r.id];
    const per = act ? eff / act : 0;
    return `<tr style="--rc:${r.color}">
      <td><span style="color:${r.color}">${esc(r.name)}</span></td>
      <td class="num"><input type="number" step="0.1" min="0" value="${r.chance}" data-rchance="${r.id}" style="width:90px;text-align:right"></td>
      <td class="num">${fmtPct(eff)}</td>
      <td class="num">${act}</td>
      <td class="num">${bench}</td>
      <td class="num">${fmtPct(per)}</td>
      <td class="num">${per > 0 ? 'раз в ' + Math.round(100 / per) : '—'}</td>
      <td style="width:120px"><div class="bar"><i style="width:${Math.min(100, eff)}%"></i></div></td>
    </tr>`;
  }).join('');

  $('#rarity-table').innerHTML = `
    <thead><tr>
      <th>Редкость</th><th class="num">Шанс</th><th class="num">Фактический</th>
      <th class="num">В рулетке</th><th class="num">Скамейка</th>
      <th class="num">Одна карточка</th><th class="num">Повтор карточки</th><th></th>
    </tr></thead><tbody>${rows}</tbody>`;

  $$('[data-rchance]').forEach(inp => {
    inp.onchange = () => {
      snapshot('шанс редкости');
      rarity(inp.dataset.rchance).chance = Math.max(0, Number(inp.value) || 0);
      save(); renderAll();
    };
  });
}

function renderGroups() {
  const blocks = state.rarities.map(r => {
    const gs = state.groups.filter(g => g.rarity === r.id);
    const pool = itemsOf(r.id, true);
    const sum = pool.reduce((s, i) => s + i.weight, 0);
    const ungrouped = pool.filter(i => !i.group);
    if (!gs.length && !ungrouped.length) return '';
    const line = (name, items, gid) => {
      const w = items.reduce((s, i) => s + i.weight, 0);
      const share = sum ? w / sum * 100 : 0;
      return `<tr>
        <td>${esc(name)}</td>
        <td class="num">${items.length}</td>
        <td class="num">${fmtPct(share)}</td>
        <td style="width:110px"><div class="bar" style="--rc:${r.color}"><i style="width:${share}%"></i></div></td>
        <td class="num">${gid ? `<input type="number" min="1" max="99" step="1" placeholder="цель %" data-gtarget="${gid}" style="width:80px;text-align:right">
             <button class="btn btn--sm" data-gapply="${gid}">Выровнять</button>` : ''}</td>
      </tr>`;
    };
    return `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${r.color};margin-bottom:8px">${esc(r.name)}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Категория</th><th class="num">Карточек</th><th class="num">Доля</th><th></th><th></th></tr></thead>
          <tbody>
            ${gs.map(g => line(g.name, pool.filter(i => i.group === g.id), g.id)).join('')}
            ${ungrouped.length ? line('— без категории —', ungrouped, null) : ''}
          </tbody>
        </table></div>
      </div>`;
  }).join('');

  $('#groups-block').innerHTML = blocks || '<div class="empty">Категорий пока нет.</div>';

  $$('[data-gapply]').forEach(btn => {
    btn.onclick = () => {
      const gid = btn.dataset.gapply;
      const inp = $(`[data-gtarget="${gid}"]`);
      const targetPct = Number(inp.value);
      if (!(targetPct > 0 && targetPct < 100)) { toast('Введи целевую долю от 1 до 99'); return; }
      const g = group(gid);
      const pool = itemsOf(g.rarity, true);
      const inG = pool.filter(i => i.group === gid);
      const outG = pool.filter(i => i.group !== gid);
      if (!inG.length || !outG.length) { toast('Нужны карточки и внутри категории, и вне её'); return; }
      snapshot('выравнивание категории');
      // веса вне категории оставляем как есть, вес каждой внутри категории подгоняем
      const outSum = outG.reduce((s, i) => s + i.weight, 0);
      const needSum = outSum * targetPct / (100 - targetPct);
      const each = Math.round(needSum / inG.length * 100) / 100;
      inG.forEach(i => { i.weight = Math.max(0.1, each); });
      save(); renderAll();
      toast(`«${g.name}» ≈ ${targetPct}% внутри редкости`);
    };
  });
}

function renderChanceTable() {
  const rows = state.items.filter(i => i.active).map(i => ({ i, ch: itemChance(i) }));
  const key = ui.chanceSort.key, dir = ui.chanceSort.dir;
  rows.sort((a, b) => {
    let v;
    if (key === 'text') v = a.i.text.localeCompare(b.i.text, 'ru');
    else if (key === 'rarity') v = state.rarities.findIndex(r => r.id === a.i.rarity) - state.rarities.findIndex(r => r.id === b.i.rarity);
    else if (key === 'weight') v = a.i.weight - b.i.weight;
    else if (key === 'rolls') v = a.i.rolls - b.i.rolls;
    else v = a.ch - b.ch;
    return v * dir;
  });

  const maxCh = rows.length ? Math.max(...rows.map(r => r.ch)) : 1;
  const th = (k, label, cls) =>
    `<th class="sortable ${cls || ''}" data-sort="${k}">${label}${key === k ? (dir === 1 ? ' ↑' : ' ↓') : ''}</th>`;

  $('#chance-table').innerHTML = `
    <thead><tr>
      ${th('text', 'Карточка')}${th('rarity', 'Редкость')}${th('weight', 'Вес', 'num')}
      ${th('chance', 'Шанс', 'num')}<th class="num">Раз в</th>${th('rolls', 'Выпадало', 'num')}<th></th>
    </tr></thead>
    <tbody>${rows.map(({ i, ch }) => {
      const r = rarity(i.rarity);
      const g = group(i.group);
      return `<tr>
        <td>${esc(i.text)}${g ? ` <span class="chip chip--group">${esc(g.name)}</span>` : ''}</td>
        <td style="color:${r.color};white-space:nowrap">${esc(r.name)}</td>
        <td class="num">×${i.weight}</td>
        <td class="num">${fmtPct(ch)}</td>
        <td class="num">${ch > 0 ? Math.round(100 / ch) : '—'}</td>
        <td class="num">${i.rolls}</td>
        <td style="width:110px"><div class="bar" style="--rc:${r.color}"><i style="width:${maxCh ? ch / maxCh * 100 : 0}%"></i></div></td>
      </tr>`;
    }).join('')}</tbody>`;

  $$('#chance-table [data-sort]').forEach(el => {
    el.onclick = () => {
      const k = el.dataset.sort;
      if (ui.chanceSort.key === k) ui.chanceSort.dir *= -1;
      else ui.chanceSort = { key: k, dir: k === 'text' ? 1 : -1 };
      renderChanceTable();
    };
  });
}

// ============================================================
// ВКЛАДКА «КРУТКА»
// ============================================================
let spinning = false;

// Общий движок крутки: перебор с замедлением, затем фиксация результата.
// targets: { stage, text, rarity, meta, button }, duration в мс.
function runSpin(targets, duration, onDone) {
  if (spinning) return;
  const result = rollOnce();
  if (!result) { toast('В рулетке нет ни одной активной карточки'); return; }
  spinning = true;
  targets.button.disabled = true;

  const stage = targets.stage;
  const textEl = targets.text;
  const rarEl = targets.rarity;
  const metaEl = targets.meta;
  stage.classList.remove('is-done');
  textEl.classList.add('is-rolling');
  metaEl.textContent = '';

  const pool = state.items.filter(i => i.active);
  const start = performance.now();
  const DURATION = duration;

  function frame(now) {
    const t = Math.min(1, (now - start) / DURATION);
    if (t < 1) {
      // замедляющийся перебор
      const step = 40 + t * t * 260;
      if (!frame.last || now - frame.last > step) {
        frame.last = now;
        const rnd = pool[Math.floor(Math.random() * pool.length)];
        textEl.textContent = rnd.text;
        const rr = rarity(rnd.rarity);
        stage.style.setProperty('--rc', rr.color);
        rarEl.textContent = rr.name;
      }
      requestAnimationFrame(frame);
    } else {
      finish();
    }
  }

  function finish() {
    frame.last = 0;
    const r = rarity(result.rarityId);
    stage.style.setProperty('--rc', r.color);
    rarEl.textContent = r.name;
    textEl.textContent = result.item.text;
    textEl.classList.remove('is-rolling');
    const ch = itemChance(result.item);
    const g = group(result.item.group);
    const parts = [];
    if (g) parts.push(g.name);
    if (!g || normText(g.name) !== normText(KIND_LABEL[result.item.kind])) parts.push(KIND_LABEL[result.item.kind]);
    parts.push(TARGET_LABEL[result.item.target], 'шанс был ' + fmtPct(ch));
    if (result.item.durationSec) parts.push('таймер ' + fmtDur(result.item.durationSec));
    metaEl.textContent = parts.join(' · ');

    stage.classList.add('is-done');

    result.item.rolls++;
    result.item.lastRoll = Date.now();
    state.history.unshift({ id: result.item.id, text: result.item.text, rarity: result.rarityId, at: Date.now(), chance: itemChance(result.item) });
    state.history = state.history.slice(0, 100);
    save();
    announceMod(result.item);
    spinning = false;
    targets.button.disabled = false;
    if (onDone) onDone(result);
  }

  requestAnimationFrame(frame);
}

function doSpin() {
  runSpin({
    stage: $('#spin-stage'), text: $('#spin-text'), rarity: $('#spin-rarity'),
    meta: $('#spin-meta'), button: $('#btn-spin')
  }, 1800, renderHistory);
}

// ============================================================
// ОВЕРЛЕЙ МОДИФИКАТОРОВ (mods.html — browser source в OBS)
// Выпавший модификатор (тип «Модификатор» или любая карточка с таймером) кладём в список
// активных и рассылаем тремя путями: localStorage + BroadcastChannel — если оверлей в том же
// браузере (OBS: рулетка как источник/док), и мост localhost:3777 — если рулетка в обычном браузере.
// Шлём список целиком, побеждает более свежий updatedAt.
// ============================================================
const MODS_KEY = 'ppk_mods_v1';
// ?bridge=http://127.0.0.1:3799 — другой порт моста (для проверки)
const MODS_BRIDGE = (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(new URLSearchParams(location.search).get('bridge') || '')
  ? new URLSearchParams(location.search).get('bridge') : 'http://127.0.0.1:3777') + '/api/mods';
let modsChan = null;
try { modsChan = new BroadcastChannel('ppk-mods'); } catch (e) {}
let modsBox = { mods: [], updatedAt: 0 };
let bridgeOk = null; // null — ещё не знаем

function fmtDur(sec) {
  sec = Math.round(sec);
  if (sec >= 3600 && sec % 60 === 0) {
    const h = Math.floor(sec / 3600), m = (sec % 3600) / 60;
    return h + ' ч' + (m ? ' ' + m + ' мин' : '');
  }
  if (sec >= 60) { const m = Math.floor(sec / 60), s = sec % 60; return s ? `${m}:${String(s).padStart(2, '0')}` : m + ' мин'; }
  return sec + ' сек';
}
function fmtClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

// «3 минуты», «60 секунд», «30 сек», «на час», «10 мин» → секунды (0 — не нашли)
function guessDuration(text) {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (/до конца стрима/.test(t)) return 0;
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:секунд|сек(?![а-я])|с(?![а-я]))/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')));
  m = t.match(/(\d+(?:[.,]\d+)?)\s*мин/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  m = t.match(/(\d+(?:[.,]\d+)?)\s*час/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 3600);
  if (/(?:^|[^а-я])час(?![а-я])/.test(t)) return 3600;
  if (/(?:^|[^а-я])минуту(?![а-я])/.test(t)) return 60;
  return 0;
}

function showsOnOverlay(it) { return it.kind === 'mod' || it.durationSec > 0; }

// Модификатор без таймера сам уходит через settings.modHideMin минут после выпадения.
// Считаем от startedAt, а не от сохранённого hideAt — так настройка действует и на уже висящие.
function modHideAt(m) {
  const min = state.settings.modHideMin;
  return !m.endsAt && min > 0 && m.startedAt ? m.startedAt + min * 60000 : null;
}
// закончившиеся по таймеру больше минуты назад (оверлей их уже убрал) и скрытые по настройке
function modGone(m, now) {
  if (m.endsAt) return m.endsAt <= now - 60000;
  const h = modHideAt(m);
  return h != null && h <= now;
}

function modsReadLocal() {
  try {
    const o = JSON.parse(localStorage.getItem(MODS_KEY));
    if (o && Array.isArray(o.mods)) return o;
  } catch (e) {}
  return { mods: [], updatedAt: 0 };
}
function modsAdopt(box) {
  if (box && Array.isArray(box.mods) && (box.updatedAt || 0) > (modsBox.updatedAt || 0)) {
    modsBox = { mods: box.mods, updatedAt: box.updatedAt };
    renderMods();
  }
}
// подтягиваем свежий список из моста — вдруг его меняли из другого браузера
// а если у нас список свежее (мост перезапускали или он был выключен) — отдаём ему свой
async function modsPull() {
  modsAdopt(modsReadLocal());
  try {
    const r = await fetch(MODS_BRIDGE, { cache: 'no-store' });
    if (!r.ok) throw new Error('мост без /api/mods — старая версия');
    const remote = await r.json();
    modsAdopt(remote);
    bridgeOk = true;
    if ((modsBox.updatedAt || 0) > (remote.updatedAt || 0)) {
      fetch(MODS_BRIDGE, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pain-Bridge': '1' }, body: JSON.stringify(modsBox)
      }).catch(() => {});
    }
  } catch (e) { bridgeOk = false; }
  renderMods();
}
setInterval(modsPull, 30000);
function modsPublish(mods) {
  const now = Date.now();
  // hideAt — подсказка оверлею, когда убрать плашку самому (если рулетку к тому времени закроют)
  const box = {
    mods: mods.filter(m => !modGone(m, now)).slice(0, 12).map(m => ({ ...m, hideAt: modHideAt(m) })),
    updatedAt: Math.max(now, (modsBox.updatedAt || 0) + 1)
  };
  modsBox = box;
  try { localStorage.setItem(MODS_KEY, JSON.stringify(box)); } catch (e) {}
  try { modsChan && modsChan.postMessage(box); } catch (e) {}
  fetch(MODS_BRIDGE, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pain-Bridge': '1' }, body: JSON.stringify(box)
  }).then(r => { bridgeOk = r.ok; renderMods(); }).catch(() => { bridgeOk = false; renderMods(); });
  renderMods();
}

function announceMod(it) {
  if (!showsOnOverlay(it)) return;
  const r = rarity(it.rarity), g = group(it.group), now = Date.now();
  const mod = {
    id: uid(), cardId: it.id, text: it.text, kind: it.kind, kindLabel: KIND_LABEL[it.kind],
    group: g ? g.name : '', rarity: r.name, color: r.color, target: TARGET_LABEL[it.target],
    durationSec: it.durationSec || 0, startedAt: now, endsAt: it.durationSec ? now + it.durationSec * 1000 : null
  };
  modsAdopt(modsReadLocal());
  // новый модификатор сменяет прошлый (на оверлее всегда одна плашка модификатора);
  // карточки с таймером других типов висят рядом. Та же карточка ещё раз — таймер заново.
  modsPublish([mod, ...modsBox.mods.filter(m => m.cardId !== it.id && !(it.kind === 'mod' && m.kind === 'mod'))]);
}
function modsRemove(id) { modsPublish(modsBox.mods.filter(m => m.id !== id)); }
function modsAddTime(id, sec) {
  const now = Date.now();
  modsPublish(modsBox.mods.map(m => {
    if (m.id !== id || !m.endsAt) return m;
    // если время уже вышло — считаем от «сейчас», полоска на оверлее начнётся заново
    if (m.endsAt <= now) return { ...m, startedAt: now, endsAt: now + sec * 1000, durationSec: sec };
    return { ...m, endsAt: m.endsAt + sec * 1000, durationSec: m.durationSec + sec };
  }));
}

function modsListHTML() {
  const now = Date.now();
  const live = modsBox.mods.filter(m => !modGone(m, now) && (!m.endsAt || m.endsAt > now - 6000));
  const rows = live.map(m => {
    const left = m.endsAt ? m.endsAt - now : null, hide = modHideAt(m);
    const time = left != null ? (left > 0 ? fmtClock(left) : 'вышло')
      : hide ? 'уйдёт в ' + new Date(hide).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'без таймера';
    return `<div class="mods-row" style="--rc:${esc(m.color)}">
      <div class="mods-row__text">${esc(m.text)}</div>
      <span class="mods-row__time${left != null && left <= 0 ? ' is-over' : ''}" data-mod-time="${esc(m.id)}">${time}</span>
      ${m.endsAt ? `<button class="btn btn--sm" data-mod-plus="${esc(m.id)}" title="Добавить минуту">+1 мин</button>` : ''}
      <button class="btn btn--sm btn--danger" data-mod-del="${esc(m.id)}" title="Снять с оверлея">✕</button>
    </div>`;
  }).join('');
  const bridge = bridgeOk === true ? 'мост на связи'
    : bridgeOk === false ? 'мост не отвечает или старой версии (перезапусти его) — оверлей в OBS награду не увидит' : '';
  return `<div class="mods-list">${rows || '<div class="mods-empty">Сейчас на оверлее пусто.</div>'}</div>
    <div class="mods-foot"><span>${bridge}</span>${live.length ? '<button class="btn btn--sm" data-mod-clear="1">Снять все</button>' : ''}</div>`;
}
function modsLiveCount() {
  const now = Date.now();
  return modsBox.mods.filter(m => !modGone(m, now) && (!m.endsAt || m.endsAt > now)).length;
}
function renderMods() {
  const badge = document.getElementById('s-mods-n');
  if (badge) badge.textContent = modsLiveCount() || '';
  for (const box of [document.getElementById('mods-panel'), document.getElementById('s-mods-pop')]) {
    if (box && !box.hidden) box.innerHTML = modsListHTML();
  }
}
// раз в секунду обновляем только цифры, без перерисовки кнопок
setInterval(() => {
  const now = Date.now();
  let gone = false;
  document.querySelectorAll('[data-mod-time]').forEach(el => {
    const m = modsBox.mods.find(x => x.id === el.dataset.modTime);
    if (!m || !m.endsAt) return;
    const left = m.endsAt - now;
    if (left < -6000) gone = true;
    el.textContent = left > 0 ? fmtClock(left) : 'вышло';
    el.classList.toggle('is-over', left <= 0);
  });
  const badge = document.getElementById('s-mods-n');
  if (badge) badge.textContent = modsLiveCount() || '';
  // модификатор без таймера отвисел своё — снимаем его везде (и с оверлея через мост)
  if (modsBox.mods.some(m => !m.endsAt && modGone(m, now))) modsPublish(modsBox.mods);
  else if (gone) renderMods();
}, 1000);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-mod-del],[data-mod-plus],[data-mod-clear]');
  if (!t) return;
  e.stopImmediatePropagation(); // список сейчас перерисуется — не даём закрыть всплывашку
  if (t.dataset.modDel) modsRemove(t.dataset.modDel);
  else if (t.dataset.modPlus) modsAddTime(t.dataset.modPlus, 60);
  else modsPublish([]);
});
window.addEventListener('storage', e => {
  if (e.key === MODS_KEY && e.newValue) { try { modsAdopt(JSON.parse(e.newValue)); } catch (_) {} }
});
if (modsChan) modsChan.onmessage = e => modsAdopt(e.data);

// ============================================================
// СТРИМ-РЕЖИМ: ЛОТОТРОН (cards.html?stream, для OBS — ?stream&bg=transparent)
// В стеклянной сфере перемешиваются шарики цветов редкости, один вылетает
// в лоток, подъезжает к камере, раскрывается — внутри бумажка с текстом.
// ============================================================
const IS_STREAM = new URLSearchParams(location.search).has('stream');

const lotto = {
  canvas: null, ctx: null, balls: [], phase: 'idle', chosen: null,
  w: 0, h: 0, cx: 0, cy: 0, R: 0, ballR: 0, trayY: 0, neckW: 0,
  t0: 0, mixDur: 3000, dropT0: 0, dropDur: 1100, last: 0, raf: 0
};

function shade(hex, k) {
  // k < 0 — темнее, k > 0 — светлее
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? 0 : 255, a = Math.abs(k);
  r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
  return `rgb(${r},${g},${b})`;
}

// ---------- ёлочные игрушки (зимой: SEASON = 'winter' в site.js) ----------
// Цвет игрушки — по-прежнему цвет редкости. Колпачок и узор поворачиваются вместе с игрушкой,
// а свет (блик и тень) всегда сверху слева — так шар выглядит объёмным при любом наклоне.
const XMAS = window.siteSeason === 'winter';
const ORN_DECOS = 5; // 0 — пояс с точками (как у большой игрушки), 1 — горошек, 2 — зигзаг, 3 — снежинка, 4 — дольки
const ORN_GOLD = 'rgba(255,224,140,0.92)', ORN_WHITE = 'rgba(255,255,255,0.85)';

function ornDots(ctx, r, rows, size) {
  for (const k of rows) {
    const y = k * r, rx = Math.sqrt(1 - k * k) * r;
    for (let i = -3; i <= 3; i++) {
      const t = i / 3.6 * Math.PI / 2, f = Math.cos(t);
      ctx.beginPath();
      ctx.ellipse(Math.sin(t) * rx, y + f * r * 0.06, size * r * f, size * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function ornPattern(ctx, b) {
  const r = b.r;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (b.deco) {
    case 0: // пояс по экватору + ряды точек
      ctx.strokeStyle = ORN_GOLD; ctx.lineWidth = r * 0.22;
      ctx.beginPath(); ctx.ellipse(0, r * 0.02, r * 1.05, r * 0.24, 0, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = ORN_WHITE; ctx.lineWidth = r * 0.05;
      for (const dy of [-0.13, 0.17]) { ctx.beginPath(); ctx.ellipse(0, r * dy, r * 1.05, r * 0.24, 0, 0, Math.PI); ctx.stroke(); }
      ctx.fillStyle = ORN_WHITE; ornDots(ctx, r, [-0.5, 0.62], 0.055);
      break;
    case 1: // горошек
      ctx.fillStyle = ORN_WHITE; ornDots(ctx, r, [-0.62, -0.2, 0.22, 0.62], 0.07);
      break;
    case 2: { // зигзаг между двумя тонкими поясами
      ctx.strokeStyle = ORN_GOLD; ctx.lineWidth = r * 0.06;
      for (const dy of [-0.22, 0.26]) { ctx.beginPath(); ctx.ellipse(0, r * dy, r * 1.05, r * 0.2, 0, 0, Math.PI); ctx.stroke(); }
      ctx.strokeStyle = ORN_WHITE; ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const x = -r + i * r / 5, y = r * (0.02 + Math.sqrt(Math.max(0, 1 - (x / r) ** 2)) * 0.2) + (i % 2 ? -1 : 1) * r * 0.13;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 3: { // снежинка спереди
      ctx.strokeStyle = ORN_WHITE; ctx.lineWidth = r * 0.07;
      const s = r * 0.5;
      ctx.save(); ctx.translate(-r * 0.04, r * 0.08);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s);
        ctx.moveTo(0, -s * 0.55); ctx.lineTo(-s * 0.2, -s * 0.75);
        ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.2, -s * 0.75);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    default: // дольки-меридианы
      ctx.strokeStyle = ORN_GOLD; ctx.lineWidth = r * 0.05;
      for (const k of [0.2, 0.55, 0.85]) { ctx.beginPath(); ctx.ellipse(0, 0, r * k, r, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
}

function lottoDrawOrnament(ctx, b) {
  const r = b.r, c = b.color;
  ctx.save();
  ctx.translate(b.x, b.y);
  // петелька и колпачок — позади верха шара
  ctx.save();
  ctx.rotate(b.rot);
  ctx.strokeStyle = 'rgba(225,228,238,0.9)'; ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath(); ctx.ellipse(0, -r * 1.3, r * 0.12, r * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
  const cw = r * 0.46, chh = r * 0.28, top = -r * 1.16;
  const metal = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  metal.addColorStop(0, '#7d6532'); metal.addColorStop(0.35, '#fff3c8');
  metal.addColorStop(0.6, '#d8b35c'); metal.addColorStop(1, '#5f4a1f');
  ctx.fillStyle = metal;
  ctx.fillRect(-cw / 2, top, cw, chh);
  ctx.fillStyle = 'rgba(50,35,10,0.35)';
  for (let i = 1; i < 4; i++) ctx.fillRect(-cw / 2 + i * cw / 4 - r * 0.02, top, r * 0.04, chh);
  ctx.fillStyle = metal;
  ctx.beginPath(); ctx.ellipse(0, top + chh, cw * 0.6, chh * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // стеклянный шар цвета редкости
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
  body.addColorStop(0, shade(c, 0.55));
  body.addColorStop(0.25, shade(c, 0.12));
  body.addColorStop(0.65, c);
  body.addColorStop(1, shade(c, -0.55));
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  // узор поверх, внутри контура шара
  ctx.save();
  ctx.clip();
  ctx.save(); ctx.rotate(b.rot); ornPattern(ctx, b); ctx.restore();
  // тень по краю ложится и на узор — объём
  const sh = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.02);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = sh; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  // блики: яркий сверху слева и отражение снизу справа
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.2, r * 0.11, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, Math.PI * 0.1, Math.PI * 0.38); ctx.stroke();
  ctx.restore();
}

function lottoInit() {
  lotto.canvas = $('#s-canvas');
  lotto.ctx = lotto.canvas.getContext('2d');
  lottoResize();
  window.addEventListener('resize', lottoResize);
  lottoBuildBalls();
  lotto.last = performance.now();
  lotto.raf = requestAnimationFrame(lottoFrame);
}

function lottoResize() {
  const c = lotto.canvas, dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  lotto.w = rect.width; lotto.h = rect.height;
  c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr);
  lotto.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // сфера + горлышко + лоток должны поместиться по высоте
  lotto.R = Math.min(lotto.w * 0.34, lotto.h / 2.95);
  lotto.cx = lotto.w / 2;
  lotto.cy = lotto.R + (lotto.h - lotto.R * 2.95) / 2 + lotto.R * 0.04;
  lotto.ballR = lotto.R * 0.088;
  lotto.neckW = lotto.ballR * 2.7;
  lotto.neckEndY = lotto.cy + lotto.R + lotto.R * 0.22;   // конец трубки
  lotto.saucerY = lotto.cy + lotto.R + lotto.R * 0.72;    // центр эллипса блюдца
  lotto.trayY = lotto.saucerY - lotto.ballR * 0.8;        // центр шара, лежащего на блюдце
  lotto.balls.forEach(b => { b.r = lotto.ballR; });
  lottoWake(); // сфера поменяла размер — шарам надо заново улечься
}

function lottoBuildBalls() {
  const chances = rarityChances();
  const TOTAL = 44;
  const balls = [];
  state.rarities.forEach(r => {
    const n = chances[r.id] > 0 ? Math.max(1, Math.round(chances[r.id] / 100 * TOTAL)) : 0;
    for (let i = 0; i < n; i++) balls.push(lottoNewBall(r));
  });
  lotto.balls = balls;
}

// Куча шаров «засыпает»: через SETTLE_SEC просчитанной физики после перемешивания (или появления новых шаров)
// шары замирают. Иначе гравитация и расталкивание каждый кадр чуть двигают лежащие шары — они вечно дрожат и крутятся.
// Считаем время симуляции, а не часы: во вкладке в фоне кадры не идут, и шары не должны замереть в воздухе.
const SETTLE_SEC = 3;
function lottoWake() { lotto.settleLeft = SETTLE_SEC; }

function lottoNewBall(r) {
  lottoWake();
  const a = Math.random() * Math.PI * 2, d = Math.random() * (lotto.R - lotto.ballR * 1.2);
  return {
    rarity: r.id, color: r.color, r: lotto.ballR,
    x: lotto.cx + Math.cos(a) * d, y: lotto.cy + Math.sin(a) * d,
    vx: 0, vy: 0, free: false, hidden: false, from: null,
    // для ёлочных игрушек: узор и наклон (шар катится — игрушка поворачивается)
    deco: Math.floor(Math.random() * ORN_DECOS), rot: (Math.random() - 0.5) * 1.6
  };
}

function lottoStep(dt) {
  const { balls, cx, cy, R } = lotto;
  const g = R * 3.4;
  const mixing = lotto.phase === 'mix';
  const mixT = mixing ? (performance.now() - lotto.t0) / lotto.mixDur : 0;
  const power = mixing ? (mixT < 0.82 ? 1 : Math.max(0, (1 - mixT) / 0.18)) : 0;
  if (mixing) lottoWake(); else lotto.settleLeft -= dt;
  const asleep = !(lotto.settleLeft > 0);

  for (const b of balls) {
    if (b.free || b.hidden || asleep) continue;
    b.vy += g * dt;
    if (!mixing) b.vx *= Math.exp(-dt * 1.5); // без потоков воздуха шары быстрее успокаиваются
    if (power > 0) {
      // два потока воздуха из нижних углов сферы навстречу друг другу:
      // каждый поднимается вдоль своей стенки и закручивается в вихрь,
      // наверху они встречаются и валятся вниз по середине
      const depth = Math.max(0, Math.min(1, (b.y - (cy - R)) / (2 * R)));
      const rel = (b.x - cx) / R;
      let fx = 0, fy = 0;
      for (const sgn of [-1, 1]) {
        const vcx = cx + sgn * R * 0.45, vcy = cy - R * 0.05;
        const dx = b.x - vcx, dy = b.y - vcy, d = Math.hypot(dx, dy) || 1;
        const w = Math.exp(-((d / (R * 0.75)) ** 2));
        fx += sgn * (dy / d) * w;  fy += -sgn * (dx / d) * w;       // закрутка
        fx += -dx / d * w * 0.2;   fy += -dy / d * w * 0.2;         // подсос к центру вихря
      }
      if (depth > 0.55) {                                            // струи у дна
        const jet = (depth - 0.55) / 0.45;
        fx += -Math.sign(rel || 1) * 0.9 * jet; fy += -2.4 * jet;
      }
      const F = R * 9 * power;
      b.vx += fx * F * dt; b.vy += fy * F * dt;
      b.vy -= g * dt * 0.5 * power;                                  // общий подъём
      b.vx += (Math.random() - 0.5) * R * 6 * dt * power;
      b.vy += (Math.random() - 0.5) * R * 6 * dt * power;
      const sp = Math.hypot(b.vx, b.vy), max = R * 6;
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.abs(b.vx) > b.r * 0.8) b.rot += b.vx * dt / b.r * 0.35; // крутится, только когда правда катится
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 0.001, lim = R - b.r;
    if (d > lim) {
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * lim; b.y = cy + ny * lim;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny;
        if (mixing && vn > R * 1.2) sfxTick(vn / (R * 6));
      }
      b.vx *= 0.98;
    }
  }
  if (!asleep) for (let i = 0; i < balls.length; i++) {
    const a = balls[i]; if (a.free || a.hidden) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const c = balls[j]; if (c.free || c.hidden) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.001, min = a.r + c.r;
      if (d < min) {
        const nx = dx / d, ny = dy / d, ov = (min - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (rv < 0) {
          const imp = -rv * 0.75; a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny;
          if (mixing && -rv > R * 1.5) sfxTick(-rv / (R * 6));
        }
      }
    }
  }

  // выбранный шар едет по рельсам: к горлышку, потом вниз в лоток
  const ch = lotto.chosen;
  if (ch && ch.free && lotto.phase === 'drop') {
    const t = Math.min(1, (performance.now() - lotto.dropT0) / lotto.dropDur);
    const neckY = cy + R + lotto.ballR * 0.3;
    if (t < 0.5) {
      const k = t / 0.5, e = k * k;
      ch.x = ch.from.x + (cx - ch.from.x) * e;
      ch.y = ch.from.y + (neckY - ch.from.y) * e;
    } else {
      const k = (t - 0.5) / 0.5;
      const e = k < 0.7 ? (k / 0.7) * (k / 0.7) : 1 - Math.sin((k - 0.7) / 0.3 * Math.PI) * 0.06;
      ch.x = cx; ch.y = neckY + (lotto.trayY - neckY) * e;
    }
    // к блюдцу игрушка выравнивается колпачком вверх — как большая игрушка, которая её сменит
    ch.rot *= Math.max(0, 1 - dt * 5);
  }
}

function lottoDrawBall(ctx, b) {
  if (XMAS) return lottoDrawOrnament(ctx, b);
  const r = b.r;
  const grad = ctx.createRadialGradient(b.x - r * 0.38, b.y - r * 0.42, r * 0.08, b.x, b.y, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.22, shade(b.color, 0.15));
  grad.addColorStop(0.7, b.color);
  grad.addColorStop(1, shade(b.color, -0.5));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
}

function lottoDraw() {
  const { ctx, w, h, cx, cy, R, balls, neckW, trayY, ballR } = lotto;
  ctx.clearRect(0, 0, w, h);

  // горлышко: трубка вырастает из разрыва в стенке сферы, без верхней кромки
  const gapA = Math.asin(neckW / 2 / R);
  const topY = cy + R * Math.cos(gapA);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.moveTo(cx - neckW / 2, topY);
  ctx.lineTo(cx - neckW / 2, lotto.neckEndY);
  ctx.lineTo(cx + neckW / 2, lotto.neckEndY);
  ctx.lineTo(cx + neckW / 2, topY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - neckW / 2, topY); ctx.lineTo(cx - neckW / 2, lotto.neckEndY);
  ctx.moveTo(cx + neckW / 2, topY); ctx.lineTo(cx + neckW / 2, lotto.neckEndY);
  ctx.stroke();
  // кольцо на конце трубки
  ctx.beginPath();
  ctx.ellipse(cx, lotto.neckEndY, neckW / 2 + 2, ballR * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.5; ctx.stroke();
  // блюдце
  const sy = lotto.saucerY, sw = neckW * 2.4, sh = ballR * 0.75;
  const saucer = ctx.createRadialGradient(cx, sy - sh * 0.4, sw * 0.1, cx, sy, sw);
  saucer.addColorStop(0, 'rgba(255,255,255,0.16)');
  saucer.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.beginPath(); ctx.ellipse(cx, sy, sw, sh, 0, 0, Math.PI * 2);
  ctx.fillStyle = saucer; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, sy + sh * 0.15, sw * 0.62, sh * 0.5, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();

  // сфера: стекло
  const glass = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  glass.addColorStop(0, 'rgba(255,255,255,0.10)');
  glass.addColorStop(0.6, 'rgba(255,255,255,0.03)');
  glass.addColorStop(1, 'rgba(255,255,255,0.07)');
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // шары внутри сферы
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, Math.PI * 2); ctx.clip();
  for (const b of balls) if (!b.hidden && !b.free) lottoDrawBall(ctx, b);
  ctx.restore();

  // обводка сферы с разрывом внизу под горлышко
  const gap = Math.asin(neckW / 2 / R);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI / 2 + gap, Math.PI / 2 - gap + Math.PI * 2); ctx.stroke();
  // блик
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = R * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, Math.PI * 1.15, Math.PI * 1.42); ctx.stroke();

  // выбранный шар поверх всего
  const ch = lotto.chosen;
  if (ch && ch.free && !ch.hidden) lottoDrawBall(ctx, ch);
}

function lottoFrame(now) {
  const dt = Math.min(1 / 30, (now - lotto.last) / 1000);
  lotto.last = now;
  lottoStep(dt);
  lottoDraw();
  lotto.raf = requestAnimationFrame(lottoFrame);
}

let streamTimers = [];
function later(ms, fn) { streamTimers.push(setTimeout(fn, ms)); }

function streamSpin() {
  if (spinning) return;
  const result = rollOnce();
  if (!result) { toast('В рулетке нет ни одной активной карточки'); return; }
  const r = rarity(result.rarityId);

  let ball = lotto.balls.find(b => b.rarity === r.id && !b.hidden);
  if (!ball) { ball = lottoNewBall(r); lotto.balls.push(ball); }
  // прошлый выбранный шар возвращаем в сферу
  lotto.balls.forEach(b => { if (b.hidden || b.free) { const nb = lottoNewBall(rarity(b.rarity)); Object.assign(b, nb, { rarity: b.rarity, color: b.color }); } });

  spinning = true;
  $('#s-spin').disabled = true;
  streamTimers.forEach(clearTimeout); streamTimers = [];

  const capsule = $('#capsule'), paper = $('#paper'), lottoEl = $('#lotto');
  paper.classList.remove('is-shown');
  capsule.classList.remove('is-open', 'is-visible', 'is-tappable', 'is-shake');
  capsule.dataset.taps = '0';
  lottoEl.classList.remove('is-dim');
  pendingOpen = null;

  lotto.chosen = ball;
  ball.deco = 0; // узор как у большой игрушки, которая её сменит на блюдце
  lotto.phase = 'mix';
  lotto.t0 = performance.now();
  sfxInit();
  sfxMixStart();

  const T_MIX = lotto.mixDur, T_DROP = lotto.dropDur;

  later(T_MIX, () => {
    sfxMixStop();
    lotto.phase = 'drop';
    lottoWake(); // перемешивание кончилось — даём куче осесть
    lotto.dropT0 = performance.now();
    ball.free = true; ball.from = { x: ball.x, y: ball.y };
  });

  later(T_MIX + T_DROP + 150, () => {
    // шар на блюдце → подменяем DOM-капсулой ровно на его месте и ждём кликов
    ball.hidden = true; ball.free = false;
    lotto.phase = 'wait';
    tapsLeft = TAPS_TO_OPEN;
    capsule.dataset.taps = '0';
    capsule.style.setProperty('--rc', r.color);
    capsule.style.transition = 'none';
    capsule.style.setProperty('--x', lotto.cx + 'px');
    capsule.style.setProperty('--y', lotto.trayY + 'px');
    capsule.style.setProperty('--sz', lotto.ballR * 2 + 'px');
    capsule.classList.add('is-visible');
    void capsule.offsetWidth;
    capsule.style.transition = '';
    capsule.style.setProperty('--sz', lotto.ballR * 3.6 + 'px');
    capsule.style.setProperty('--y', (lotto.saucerY - lotto.ballR * 1.55) + 'px');
    capsule.classList.add('is-tappable');
    sfxLand();
  });

  // дальше цепочку продолжает capsuleTap() после пятого клика
  pendingOpen = () => {
    const rect = lottoEl.getBoundingClientRect();
    const sz = Math.min(300, rect.height * 0.5, rect.width * 0.5);
    capsule.classList.remove('is-tappable');
    capsule.style.setProperty('--x', rect.width / 2 + 'px');
    capsule.style.setProperty('--y', rect.height / 2 + 'px');
    capsule.style.setProperty('--sz', sz + 'px');
    lottoEl.classList.add('is-dim');
    later(850, () => capsule.classList.add('is-open'));
    later(850 + 280, showPaper);
    later(850 + 280 + 700, finish);
  };

  function showPaper() {
    const g = group(result.item.group);
    const parts = [];
    if (g) parts.push(g.name);
    if (!g || normText(g.name) !== normText(KIND_LABEL[result.item.kind])) parts.push(KIND_LABEL[result.item.kind]);
    parts.push(TARGET_LABEL[result.item.target], 'шанс ' + fmtPct(itemChance(result.item)));
    if (result.item.durationSec) parts.push('таймер ' + fmtDur(result.item.durationSec));
    paper.style.setProperty('--rcd', shade(r.color, -0.35));
    $('#p-rarity').textContent = r.name;
    $('#p-text').textContent = result.item.text;
    $('#p-meta').textContent = parts.join(' · ');
    paper.classList.add('is-shown');
  }

  function finish() {
    result.item.rolls++;
    result.item.lastRoll = Date.now();
    state.history.unshift({ id: result.item.id, text: result.item.text, rarity: result.rarityId, at: Date.now(), chance: itemChance(result.item) });
    state.history = state.history.slice(0, 100);
    save();
    announceMod(result.item);
    renderStreamHistory();
    spinning = false;
    $('#s-spin').disabled = false;
  }
}

// ---------- звук ----------
// Клики по шарику — файлы sounds/click-1..5.wav, случайный на каждый удар.
// Перемешивание — синтез через WebAudio: шум воздуха + постукивание шаров
// о стенки и друг о друга. Положи свой файл в sounds/mix.wav — он заменит синтез.
const CLICK_SOUNDS = [1, 2, 3, 4, 5].map(n => `sounds/click-${n}.wav`);
const MIX_SOUND_URL = 'sounds/mix.wav';
let audioCtx = null, mixNoise = null, mixGain = null, mixFile = null, mixFileOk = null;
let lastTick = 0;

function sfxInit() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  CLICK_SOUNDS.forEach(src => { const a = new Audio(src); a.preload = 'auto'; });
  mixFile = new Audio(MIX_SOUND_URL);
  mixFile.loop = true; mixFile.volume = 0.7;
  mixFile.addEventListener('canplaythrough', () => { mixFileOk = true; }, { once: true });
  mixFile.addEventListener('error', () => { mixFileOk = false; }, { once: true });
}

function sfxClick() {
  const a = new Audio(CLICK_SOUNDS[Math.floor(Math.random() * CLICK_SOUNDS.length)]);
  a.volume = 0.9;
  a.play().catch(() => {});
}

// короткий стеклянный «тик» — шар ударился
function sfxTick(strength) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  if (now - lastTick < 0.035) return;
  lastTick = now;
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 1400 + Math.random() * 1800;
  const v = Math.min(0.22, 0.04 + strength * 0.2);
  g.gain.setValueAtTime(v, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + Math.random() * 0.04);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(now); osc.stop(now + 0.12);
}

function sfxLand() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
  g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(now); osc.stop(now + 0.3);
}

function sfxMixStart() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (mixFileOk) { mixFile.currentTime = 0; mixFile.play().catch(() => {}); return; }
  // шум воздуха: белый шум через полосовой фильтр, плавно нарастает и стихает
  const len = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  mixNoise = audioCtx.createBufferSource(); mixNoise.buffer = buf; mixNoise.loop = true;
  const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
  mixGain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  mixGain.gain.setValueAtTime(0.0001, now);
  mixGain.gain.exponentialRampToValueAtTime(0.16, now + 0.5);
  mixGain.gain.setValueAtTime(0.16, now + lotto.mixDur / 1000 * 0.8);
  mixGain.gain.exponentialRampToValueAtTime(0.0001, now + lotto.mixDur / 1000);
  mixNoise.connect(f).connect(mixGain).connect(audioCtx.destination);
  mixNoise.start(now); mixNoise.stop(now + lotto.mixDur / 1000 + 0.1);
}

function sfxMixStop() {
  if (mixFileOk && mixFile) { mixFile.pause(); }
}

const TAPS_TO_OPEN = 5;
let tapsLeft = 0;
let pendingOpen = null;

// Убрать бумажку и капсулу, вернуть шар в сферу — сцена снова чистая
function dismissResult() {
  if (spinning) return;
  const capsule = $('#capsule'), paper = $('#paper'), lottoEl = $('#lotto');
  if (!paper.classList.contains('is-shown') && !capsule.classList.contains('is-visible')) return;
  paper.classList.remove('is-shown');
  capsule.classList.remove('is-open', 'is-visible', 'is-tappable', 'is-shake');
  capsule.dataset.taps = '0';
  lottoEl.classList.remove('is-dim');
  lotto.balls.forEach(b => {
    if (b.hidden || b.free) { const nb = lottoNewBall(rarity(b.rarity)); Object.assign(b, nb, { rarity: b.rarity, color: b.color }); }
  });
  lotto.chosen = null;
  lotto.phase = 'idle';
}

function capsuleTap() {
  if (lotto.phase !== 'wait' || tapsLeft <= 0) return;
  tapsLeft--;
  const capsule = $('#capsule');
  capsule.dataset.taps = String(TAPS_TO_OPEN - tapsLeft);
  capsule.classList.remove('is-shake');
  void capsule.offsetWidth;
  capsule.classList.add('is-shake');
  sfxClick();
  if (tapsLeft === 0) {
    lotto.phase = 'open';
    const fn = pendingOpen; pendingOpen = null;
    later(320, fn);
  }
}

function renderStreamHistory() {
  $('#s-hist').innerHTML = state.history.slice(1, 6).map(h => {
    const r = rarity(h.rarity);
    return `<span style="--rc:${r.color}" title="${esc(h.text)}">${esc(h.text)}</span>`;
  }).join('');
}

function startStream() {
  document.body.classList.add('is-stream');
  if (new URLSearchParams(location.search).get('bg') === 'transparent') {
    document.body.classList.add('is-transparent');
  }
  $('#stream').style.display = 'flex';
  renderStreamHistory();
  lottoInit();

  $('#s-spin').onclick = streamSpin;
  $('#s-mods').onclick = e => {
    e.stopPropagation();
    const pop = $('#s-mods-pop');
    pop.hidden = !pop.hidden;
    if (!pop.hidden) modsPull();
  };
  document.addEventListener('click', e => {
    const pop = $('#s-mods-pop');
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('#s-mods')) pop.hidden = true;
  });
  $('#capsule').onclick = capsuleTap;
  $('#paper').onclick = dismissResult;
  $('#s-full').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (lotto.phase === 'wait') capsuleTap(); else streamSpin();
    }
    if (e.code === 'KeyF') $('#s-full').click();
    if (e.code === 'Escape' && !document.fullscreenElement) dismissResult();
  });
}

// Если менеджер и стрим-режим открыты в разных вкладках одного браузера —
// подхватываем правки друг друга без перезагрузки страницы.
let reloadPending = false;
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  if (document.querySelector('.modal-back')) { reloadPending = true; return; }
  applyExternalState();
});
function applyExternalState() {
  reloadPending = false;
  if (spinning) { setTimeout(applyExternalState, 500); return; }
  if (!load()) return;
  if (IS_STREAM) { renderStreamHistory(); if (lotto.phase === 'idle' && !spinning) lottoBuildBalls(); } else renderAll();
}

function renderHistory() {
  const box = $('#hist');
  if (!state.history.length) { box.innerHTML = '<div class="empty">Пока пусто.</div>'; return; }
  box.innerHTML = state.history.map(h => {
    const r = rarity(h.rarity);
    const d = new Date(h.at);
    return `<div class="hist-item" style="--rc:${r.color}">
      <span class="hist-time">${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}</span>
      <span class="hist-rar">${esc(r.name)}</span>
      <span style="flex:1 1 auto">${esc(h.text)}</span>
      ${h.chance != null ? `<span class="hist-time" style="flex:0 0 auto;text-align:right">${fmtPct(h.chance)}</span>` : ''}
    </div>`;
  }).join('');
}

function simulate(n) {
  const chances = rarityChances();
  const live = state.rarities.filter(r => chances[r.id] > 0);
  if (!live.length) { $('#sim-out').innerHTML = '<div class="empty">Нечего крутить.</div>'; return; }
  const byRarity = {}, byItem = {};
  for (let k = 0; k < n; k++) {
    const r = pickWeighted(live, x => chances[x.id]);
    const item = pickWeighted(itemsOf(r.id, true), x => x.weight);
    if (!item) continue;
    byRarity[r.id] = (byRarity[r.id] || 0) + 1;
    byItem[item.id] = (byItem[item.id] || 0) + 1;
  }
  const rows = state.rarities.map(r => {
    const c = byRarity[r.id] || 0;
    return `<div style="display:flex;gap:10px;align-items:center;font-size:12.5px;padding:3px 0">
      <span style="flex:0 0 92px;color:${r.color}">${esc(r.name)}</span>
      <span class="num" style="flex:0 0 52px">${c}</span>
      <span class="num" style="flex:0 0 56px">${fmtPct(c / n * 100)}</span>
      <span class="bar" style="--rc:${r.color};flex:1 1 auto"><i style="width:${c / n * 100}%"></i></span>
    </div>`;
  }).join('');
  const never = state.items.filter(i => i.active && !byItem[i.id]).length;
  $('#sim-out').innerHTML = rows +
    `<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:10px;line-height:1.6">
      За ${n} круток ни разу не выпало карточек: <b>${never}</b>.
    </div>`;
}

// ============================================================
// ВКЛАДКА «ДАННЫЕ»
// ============================================================
function renderData() {
  const total = state.items.length;
  const active = state.items.filter(i => i.active).length;
  const rolled = state.items.reduce((s, i) => s + i.rolls, 0);
  const kinds = {};
  state.items.filter(i => i.active).forEach(i => { kinds[i.kind] = (kinds[i.kind] || 0) + 1; });
  const targets = {};
  state.items.filter(i => i.active).forEach(i => { targets[i.target] = (targets[i.target] || 0) + 1; });

  $('#data-stats').innerHTML = `
    <div class="stat"><div class="stat__v">${total}</div><div class="stat__l">всего вариантов</div></div>
    <div class="stat"><div class="stat__v">${active}</div><div class="stat__l">в рулетке</div></div>
    <div class="stat"><div class="stat__v">${total - active}</div><div class="stat__l">на скамейке</div></div>
    <div class="stat"><div class="stat__v">${rolled}</div><div class="stat__l">круток всего</div></div>
    <div class="stat"><div class="stat__v">${Object.entries(kinds).map(([k, v]) => KIND_LABEL[k] + ': ' + v).join('<br>') || '—'}</div><div class="stat__l">по типу</div></div>
    <div class="stat"><div class="stat__v">${Object.entries(targets).map(([k, v]) => TARGET_LABEL[k] + ': ' + v).join('<br>') || '—'}</div><div class="stat__l">на кого</div></div>`;

  $('#cooldown').value = state.settings.cooldown;
  $('#last-backup').textContent = state.lastBackup
    ? new Date(state.lastBackup).toLocaleString('ru-RU')
    : 'никогда';

  renderExportBox();
}

function renderExportBox() {
  const withBench = $('#export-bench').checked;
  const lines = [];
  state.rarities.forEach(r => {
    const act = itemsOf(r.id, true);
    const ben = withBench ? itemsOf(r.id, false) : [];
    if (!act.length && !ben.length) return;
    lines.push(`${r.name.toUpperCase()} — ${fmtPct(r.chance)}`);
    act.forEach(i => lines.push('  • ' + i.text));
    if (ben.length) {
      lines.push('  [скамейка]');
      ben.forEach(i => lines.push('  · ' + i.text));
    }
    lines.push('');
  });
  $('#export-box').value = lines.join('\n').trim();
}

function download(filename, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function exportJSON() {
  state.lastBackup = Date.now();
  save();
  download(`cards-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
  renderData();
  toast('Бэкап скачан');
}

function exportCSV() {
  const head = 'rarity,group,text,kind,target,weight,active,pinned,tags,rolls\n';
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const body = state.items.map(i => [
    q(rarity(i.rarity).name), q(group(i.group)?.name || ''), q(i.text),
    q(KIND_LABEL[i.kind]), q(TARGET_LABEL[i.target]), i.weight,
    i.active ? 1 : 0, i.pinned ? 1 : 0, q(i.tags.join(' ')), i.rolls
  ].join(',')).join('\n');
  download(`cards-${stamp()}.csv`, '﻿' + head + body, 'text/csv;charset=utf-8');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || !Array.isArray(obj.items)) throw new Error('в файле нет списка карточек');
      snapshot('импорт JSON');
      state = normalize(obj);
      save(); renderAll();
      toast(`Загружено карточек: ${state.items.length}`, 'откатить', undo);
    } catch (e) {
      toast('Не получилось прочитать файл: ' + e.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================
// ВКЛАДКИ И ОБЩИЙ РЕНДЕР
// ============================================================
function switchTab(name) {
  ui.tab = name;
  $$('#tabs .tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
  ['board', 'balance', 'spin', 'data'].forEach(n => { $('#tab-' + n).hidden = n !== name; });
  renderAll();
}

function renderAll() {
  if (ui.tab === 'board') { renderStrip(); renderBoard(); updatePauseButton(); }
  else if (ui.tab === 'balance') renderBalance();
  else if (ui.tab === 'spin') { renderHistory(); $('#mod-hide').value = state.settings.modHideMin; }
  else if (ui.tab === 'data') renderData();
}

// ============================================================
// ПРИВЯЗКА СОБЫТИЙ
// ============================================================
function wireApp() {
  // Адрес оверлея модификаторов — рядом с этой страницей, на том же сайте
  document.querySelectorAll('.mods-url').forEach(el => { el.textContent = new URL('mods.html', location.href.split(/[?#]/)[0]).href; });
  $$('#tabs .tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));

  $('#search').oninput = e => { ui.search = e.target.value.trim().toLowerCase(); renderBoard(); };
  $('#filter-kind').onchange = e => { ui.kind = e.target.value; renderBoard(); };
  $('#filter-target').onchange = e => { ui.target = e.target.value; renderBoard(); };
  $('#sort').onchange = e => { ui.sort = e.target.value; renderBoard(); };

  $('#btn-add').onclick = newCard;
  $('#btn-bulk').onclick = openBulk;
  $('#btn-rotate').onclick = openRotate;
  $('#btn-dupes').onclick = openDupes;
  $('#btn-pause').onclick = openPause;

  $('#btn-spin').onclick = doSpin;
  $('#btn-stream').onclick = () => window.open('cards.html?stream', 'ppk-cards-stream');
  $('#btn-clear-hist').onclick = () => {
    snapshot('очистка истории');
    state.history = []; save(); renderHistory();
  };
  $$('[data-sim]').forEach(b => b.onclick = () => simulate(Number(b.dataset.sim)));

  $('#btn-export-json').onclick = exportJSON;
  $('#btn-cloud-push').onclick = () => { if (!state.savedAt) save(); cloudPush(); };
  $('#btn-export-csv').onclick = exportCSV;
  $('#btn-export-txt').onclick = () => download(`cards-${stamp()}.txt`, $('#export-box').value);
  $('#btn-import-json').onclick = () => $('#file-input').click();
  $('#file-input').onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; };
  $('#export-bench').onchange = renderExportBox;
  $('#btn-copy-export').onclick = () => {
    const box = $('#export-box');
    box.select();
    navigator.clipboard.writeText(box.value).then(
      () => toast('Скопировано'),
      () => { document.execCommand('copy'); toast('Скопировано'); }
    );
  };

  $('#cooldown').onchange = e => {
    snapshot('защита от повторов');
    state.settings.cooldown = Math.max(0, Math.min(50, Number(e.target.value) || 0));
    e.target.value = state.settings.cooldown;
    save();
  };
  $('#mod-hide').onchange = e => {
    state.settings.modHideMin = Math.max(0, Math.min(1440, Math.round(Number(e.target.value)) || 0));
    e.target.value = state.settings.modHideMin;
    save();
    modsPublish(modsBox.mods); // пересчитать, когда уйдут уже висящие
  };

  $('#btn-reset-rolls').onclick = () => {
    if (!confirm('Обнулить счётчики выпадений у всех карточек?')) return;
    snapshot('обнуление счётчиков');
    state.items.forEach(i => { i.rolls = 0; i.lastRoll = null; });
    save(); renderAll(); toast('Счётчики обнулены', 'откатить', undo);
  };
  $('#btn-reset-all').onclick = () => {
    if (!confirm('Вернуть стартовый набор? Все правки и добавленные карточки пропадут.\nСначала лучше скачать JSON.')) return;
    snapshot('сброс к стартовому набору');
    state = seedState();
    save(); renderAll(); toast('Стартовый набор восстановлен', 'откатить', undo);
  };

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault(); undo();
    }
  });
}


async function startApp() {
  $('#gate').style.display = 'none';
  if (!load()) {
    const remote = await cloudFetch();
    if (remote && Array.isArray(remote.items)) { state = normalize(remote); save(true); toast('База карточек загружена с сайта'); }
    else { state = seedState(); cloud.seededHere = true; save(true); }
  }
  cloudInit();
  modsPull();
  if (IS_STREAM) { startStream(); return; }
  $('#app').style.display = 'block';
  wireApp();
  switchTab('board');
}

if (IS_STREAM) document.body.classList.add('is-stream');

// Вход: код стримера или токен GitHub — общий для всех страниц стримера (github.js → siteGit.gate)
siteGit.gate(startApp);
