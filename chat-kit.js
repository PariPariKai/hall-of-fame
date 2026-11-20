// Общее для чат-оверлея (chat.html) и вкладки «Чат» в админке: значения по умолчанию, режимы, события, описание полей.
// Данные — data/chat.json: записи kind 'overlay' (каждая = отдельный источник OBS chat.html?o=<id>)
// и kind 'event' (как показывать события чата: стрики, сабки, рейды...). Пустое/нет поля = значение отсюда.
(function () {
  'use strict';

  const MODES = [
    ['list', 'Колонка', 'Классический чат: сообщения столбиком'],
    ['row', 'Строка', 'Сообщения в одну строку, новые выталкивают старые'],
    ['fly', 'Летающий', 'Сообщения пролетают через экран, как в азиатских стримах'],
    ['ticker', 'Новости', 'Бегущая строка, как в новостях'],
    ['alerts', 'Только алерты', 'Без чата: только анимации событий'],
  ];

  // Область на экране 1920×1080 в процентах — у каждого режима своя по умолчанию
  const AREAS = {
    list: { x: 1.5, y: 38, w: 24, h: 58 },
    row: { x: 2, y: 88, w: 96, h: 8 },
    fly: { x: 0, y: 4, w: 100, h: 55 },
    ticker: { x: 0, y: 93, w: 100, h: 7 },
    alerts: { x: 0, y: 0, w: 100, h: 100 },
  };

  const OVERLAY = {
    name: 'Чат', mode: 'list',
    x: 1.5, y: 38, w: 24, h: 58,
    font: 'system', size: 26, weight: 500, nickWeight: 700, color: '#ffffff', outline: true,
    bgMode: 'msg', bgColor: '#0b0e18', bgAlpha: 55, radius: 12, pad: 10, gap: 8, accent: '#FAC775',
    nick: true, nickColors: true, badges: true, emotes: true, layout: 'inline',
    life: 0, max: 30, alpha: 100,
    animIn: 'slide', animOut: 'fade', animMs: 350,
    dir: 'up', align: 'left', rowFrom: 'right',
    flySpeed: 260, flyRandom: true,
    tickerLabel: 'ЧАТ ТВ', tickerLabelColor: '#d8263a', tickerSpeed: 140, tickerClock: true, tickerIdle: 'В чате тихо. Пишите, вы в эфире',
    hideCmd: true, hideLinks: true, maxLen: 200,
    ignore: 'nightbot, streamelements, moobot, fossabot, wizebot, streamlabs, soundalerts, sery_bot, commanderroot',
    highlights: true, alerts: true, alertPos: 'top', alertScale: 100, volume: 60,
  };

  // Вид алерта и звук
  const ANIMS = [['burst', 'Вспышка'], ['banner', 'Плашка'], ['neon', 'Неон']];
  const SOUNDS = [['chime', 'Колокольчик'], ['pop', 'Щелчок'], ['fanfare', 'Фанфары'], ['off', 'Без звука']];

  // События. Переменные в текстах: {nick} {n} {msg} {to} {tier}
  const EVENTS = [
    { id: 'streak', short: 'Стрик', label: 'Стрик просмотров', vars: '{nick} {n} {msg}', minLabel: 'Стрик от',
      d: { on: true, hl: true, alert: true, min: 5, cap: 'Стрик {n}', text: 'Вау! Стрик из {n}!', sub: '{nick} не пропускает стримы', color: '#FF9F43', anim: 'burst', sound: 'fanfare', dur: 7 } },
    { id: 'first', short: 'Новичок', label: 'Первое сообщение', vars: '{nick} {msg}',
      d: { on: true, hl: true, alert: false, min: 0, cap: 'Впервые в чате', text: 'Новенький в чате', sub: 'Привет, {nick}!', color: '#7CE0B8', anim: 'banner', sound: 'pop', dur: 5 } },
    { id: 'sub', short: 'Подписка', label: 'Подписка', vars: '{nick} {tier} {msg}',
      d: { on: true, hl: true, alert: true, min: 0, cap: 'Подписка', text: 'Новая подписка!', sub: '{nick}', color: '#B68CFF', anim: 'burst', sound: 'fanfare', dur: 6 } },
    { id: 'resub', short: 'Продление', label: 'Продление подписки', vars: '{nick} {n} {tier} {msg}', minLabel: 'Месяцев от',
      d: { on: true, hl: true, alert: true, min: 0, cap: '{n} мес. с подпиской', text: '{n} месяцев с подпиской', sub: '{nick}', color: '#B68CFF', anim: 'banner', sound: 'chime', dur: 6 } },
    { id: 'gift', short: 'Подарки', label: 'Подарочные подписки', vars: '{nick} {n} {to}', minLabel: 'Подписок от',
      d: { on: true, hl: true, alert: true, min: 1, cap: 'Дарит подписки: {n}', text: '{nick} дарит подписки: {n}', sub: 'Щедро!', color: '#FF7EB6', anim: 'burst', sound: 'fanfare', dur: 7 } },
    { id: 'raid', short: 'Рейд', label: 'Рейд', vars: '{nick} {n}', minLabel: 'Зрителей от',
      d: { on: true, hl: true, alert: true, min: 1, cap: 'Рейд, зрителей: {n}', text: 'Рейд!', sub: '{nick} привёл зрителей: {n}', color: '#5BC0FF', anim: 'burst', sound: 'fanfare', dur: 8 } },
    { id: 'bits', short: 'Биты', label: 'Биты', vars: '{nick} {n} {msg}', minLabel: 'Битов от',
      d: { on: true, hl: true, alert: true, min: 100, cap: '{n} битов', text: '{n} битов!', sub: '{nick}', color: '#C9A6FF', anim: 'banner', sound: 'chime', dur: 6 } },
    { id: 'highlight', short: 'Выделенное', label: 'Выделенное за баллы', vars: '{nick} {msg}',
      d: { on: true, hl: true, alert: false, min: 0, cap: 'Выделено', text: '{nick}', sub: '{msg}', color: '#FAC775', anim: 'banner', sound: 'pop', dur: 6 } },
    { id: 'reward', short: 'Награда', label: 'Награда за баллы с текстом', vars: '{nick} {msg}',
      d: { on: true, hl: true, alert: false, min: 0, cap: 'Награда', text: '{nick}', sub: '{msg}', color: '#FAC775', anim: 'banner', sound: 'pop', dur: 6 } },
    { id: 'announce', short: 'Объявление', label: 'Объявление модератора', vars: '{nick} {msg}',
      d: { on: true, hl: true, alert: false, min: 0, cap: 'Объявление', text: 'Объявление', sub: '{msg}', color: '#5BC0FF', anim: 'banner', sound: 'chime', dur: 8 } },
  ];
  const EVENT = Object.fromEntries(EVENTS.map(e => [e.id, e]));

  // Шрифты с кириллицей (Google Fonts); system — без загрузки
  const FONTS = [
    ['system', 'Обычный (Segoe UI)', '"Segoe UI", Roboto, Arial, sans-serif', ''],
    ['rubik', 'Rubik', '"Rubik", sans-serif', 'Rubik:wght@400;500;700;800'],
    ['montserrat', 'Montserrat', '"Montserrat", sans-serif', 'Montserrat:wght@400;500;700;800'],
    ['nunito', 'Nunito', '"Nunito", sans-serif', 'Nunito:wght@400;600;800;900'],
    ['comfortaa', 'Comfortaa', '"Comfortaa", sans-serif', 'Comfortaa:wght@400;500;700'],
    ['unbounded', 'Unbounded', '"Unbounded", sans-serif', 'Unbounded:wght@400;500;700;800'],
    ['oswald', 'Oswald (узкий)', '"Oswald", sans-serif', 'Oswald:wght@400;500;600;700'],
    ['russo', 'Russo One', '"Russo One", sans-serif', 'Russo+One'],
    ['martian', 'Martian Mono', '"Martian Mono", monospace', 'Martian+Mono:wght@400;500;700'],
  ];

  // Поля настроек оверлея для админки. modes — в каких режимах поле имеет смысл (нет — во всех)
  const CHAT_MODES = ['list', 'row', 'fly', 'ticker'];
  const GROUPS = [
    { title: 'Где на экране', area: true, fields: [
      { k: 'x', label: 'Слева', type: 'num', min: 0, max: 100, step: 0.5, unit: '%' },
      { k: 'y', label: 'Сверху', type: 'num', min: 0, max: 100, step: 0.5, unit: '%' },
      { k: 'w', label: 'Ширина', type: 'num', min: 3, max: 100, step: 0.5, unit: '%' },
      { k: 'h', label: 'Высота', type: 'num', min: 3, max: 100, step: 0.5, unit: '%' },
    ] },
    { title: 'Текст', modes: CHAT_MODES, fields: [
      { k: 'font', label: 'Шрифт', type: 'select', opts: FONTS.map(f => [f[0], f[1]]) },
      { k: 'size', label: 'Размер', type: 'range', min: 14, max: 72, step: 1, unit: 'px' },
      { k: 'weight', label: 'Жирность текста', type: 'select', opts: [[400, 'Обычный'], [500, 'Средний'], [700, 'Жирный'], [800, 'Очень жирный']] },
      { k: 'nickWeight', label: 'Жирность ника', type: 'select', opts: [[400, 'Обычный'], [500, 'Средний'], [700, 'Жирный'], [800, 'Очень жирный']] },
      { k: 'color', label: 'Цвет текста', type: 'color' },
      { k: 'outline', label: 'Обводка', type: 'bool', on: 'Тёмная обводка букв' },
      { k: 'nick', label: 'Ник', type: 'bool', on: 'Показывать ник' },
      { k: 'nickColors', label: 'Цвет ника', type: 'bool', on: 'Как в Twitch' },
      { k: 'badges', label: 'Значки', type: 'bool', on: 'Мод, VIP, саб' },
      { k: 'emotes', label: 'Смайлы', type: 'bool', on: '7TV, BTTV, FFZ' },
      { k: 'layout', label: 'Ник и текст', type: 'select', opts: [['inline', 'В одну строку'], ['stack', 'Ник над текстом']], modes: ['list', 'row'] },
    ] },
    { title: 'Фон за сообщением', modes: CHAT_MODES, fields: [
      { k: 'bgMode', label: 'Фон', type: 'select', opts: [['msg', 'Плашка у каждого'], ['area', 'Одна подложка на всё'], ['none', 'Без фона']] },
      { k: 'bgColor', label: 'Цвет', type: 'color' },
      { k: 'bgAlpha', label: 'Затемнение', type: 'range', min: 0, max: 100, step: 1, unit: '%' },
      { k: 'radius', label: 'Скругление', type: 'range', min: 0, max: 40, step: 1, unit: 'px' },
      { k: 'pad', label: 'Отступ внутри', type: 'range', min: 0, max: 30, step: 1, unit: 'px' },
      { k: 'gap', label: 'Между сообщениями', type: 'range', min: 0, max: 40, step: 1, unit: 'px' },
      { k: 'alpha', label: 'Прозрачность всего', type: 'range', min: 20, max: 100, step: 1, unit: '%' },
    ] },
    { title: 'Поведение', modes: CHAT_MODES, fields: [
      { k: 'dir', label: 'Новые', type: 'select', opts: [['up', 'Снизу, старые уходят вверх'], ['down', 'Сверху, старые уходят вниз']], modes: ['list'] },
      { k: 'align', label: 'Прижать', type: 'select', opts: [['left', 'Влево'], ['right', 'Вправо']], modes: ['list'] },
      { k: 'rowFrom', label: 'Новые появляются', type: 'select', opts: [['right', 'Справа'], ['left', 'Слева']], modes: ['row'] },
      { k: 'flySpeed', label: 'Скорость полёта', type: 'range', min: 60, max: 900, step: 10, unit: 'px/с', modes: ['fly'] },
      { k: 'flyRandom', label: 'Дорожки', type: 'bool', on: 'Вразброс, а не сверху вниз', modes: ['fly'] },
      { k: 'tickerLabel', label: 'Плашка слева', type: 'text', modes: ['ticker'], ph: 'ЧАТ ТВ, СРОЧНО...' },
      { k: 'tickerLabelColor', label: 'Цвет плашки', type: 'color', modes: ['ticker'] },
      { k: 'tickerSpeed', label: 'Скорость ленты', type: 'range', min: 40, max: 500, step: 10, unit: 'px/с', modes: ['ticker'] },
      { k: 'tickerClock', label: 'Часы', type: 'bool', on: 'Часы справа', modes: ['ticker'] },
      { k: 'tickerIdle', label: 'Когда чат молчит', type: 'text', modes: ['ticker'] },
      { k: 'life', label: 'Сообщение живёт', type: 'range', min: 0, max: 120, step: 1, unit: 'с', zero: 'всегда', modes: ['list', 'row'] },
      { k: 'max', label: 'Не больше', type: 'range', min: 1, max: 60, step: 1, unit: 'шт', modes: ['list', 'row', 'fly'] },
    ] },
    { title: 'Анимация', modes: ['list', 'row'], fields: [
      { k: 'animIn', label: 'Появление', type: 'select', opts: [['slide', 'Выезжает'], ['fade', 'Проявляется'], ['pop', 'Выпрыгивает'], ['drop', 'Падает сверху'], ['none', 'Сразу']] },
      { k: 'animOut', label: 'Исчезание', type: 'select', opts: [['fade', 'Тает'], ['slide', 'Уезжает'], ['shrink', 'Сжимается'], ['none', 'Сразу']] },
      { k: 'animMs', label: 'Скорость', type: 'range', min: 100, max: 1500, step: 50, unit: 'мс' },
    ] },
    { title: 'Фильтры', modes: CHAT_MODES, fields: [
      { k: 'hideCmd', label: 'Команды', type: 'bool', on: 'Прятать «!команды»' },
      { k: 'hideLinks', label: 'Ссылки', type: 'bool', on: 'Прятать сообщения со ссылками' },
      { k: 'maxLen', label: 'Длиннее обрезать', type: 'range', min: 20, max: 500, step: 10, unit: 'симв.' },
      { k: 'ignore', label: 'Не показывать ники', type: 'text', wide: true, hint: 'боты, через запятую' },
    ] },
    { title: 'События', fields: [
      { k: 'highlights', label: 'В чате', type: 'bool', on: 'Выделять сообщения событий', modes: CHAT_MODES },
      { k: 'alerts', label: 'Алерты', type: 'bool', on: 'Показывать анимации событий' },
      { k: 'alertPos', label: 'Где алерт', type: 'select', opts: [['top', 'Сверху'], ['center', 'По центру'], ['bottom', 'Снизу']] },
      { k: 'alertScale', label: 'Размер алерта', type: 'range', min: 50, max: 200, step: 5, unit: '%' },
      { k: 'volume', label: 'Громкость звука', type: 'range', min: 0, max: 100, step: 5, unit: '%', zero: 'без звука' },
      { k: 'accent', label: 'Цвет выделения', type: 'color', hint: 'если у события нет своего' },
    ] },
  ];

  const isNum = v => typeof v === 'number';
  // Сохранённое поверх значений по умолчанию; числа и флажки приводятся к своему типу
  function merge(def, saved) {
    const out = Object.assign({}, def);
    Object.keys(saved || {}).forEach(k => {
      const v = saved[k];
      if (v == null || v === '') return;
      if (isNum(def[k])) { const n = parseFloat(String(v).replace(',', '.')); if (isFinite(n)) out[k] = n; }
      else if (typeof def[k] === 'boolean') out[k] = v === true || /^(true|1|yes|да)$/i.test(String(v));
      else out[k] = v;
    });
    // пустой текст — тоже настройка (стёртая подпись, нет плашки)
    Object.keys(def).forEach(k => { if (typeof def[k] === 'string' && saved && saved[k] === '') out[k] = ''; });
    return out;
  }
  const overlay = saved => merge(Object.assign({}, OVERLAY, AREAS[(saved && saved.mode) || OVERLAY.mode] || {}), saved);
  const event = (id, saved) => merge(EVENT[id] ? EVENT[id].d : {}, saved);

  // Из файла: { overlays: [...], events: {id: settings} }
  function read(data) {
    const items = (data && data.items) || [];
    const overlays = items.filter(it => it.kind === 'overlay').map(it => Object.assign(overlay(it), { id: it.id }));
    const events = Object.fromEntries(EVENTS.map(e => [e.id, event(e.id, items.find(it => it.kind === 'event' && it.event === e.id))]));
    return { overlays, events };
  }

  // Подстановка {nick} {n} ... (значения уже без HTML)
  const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : ''));

  window.ChatKit = { MODES, AREAS, OVERLAY, EVENTS, EVENT, FONTS, GROUPS, ANIMS, SOUNDS, CHAT_MODES, overlay, event, read, fill, merge };
})();
