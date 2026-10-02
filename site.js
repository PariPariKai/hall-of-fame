// Общее для страниц сайта: верхнее меню и набор иконок.
// Подключается синхронно первой строкой <body>: <script src="site.js?v=2"></script> — меню появляется сразу, без мигания.
// Иконки — SVG вместо эмодзи: эмодзи на каждом устройстве рисуются по-своему и ломают дизайн.
// В разметке: <svg class="ic"><use href="#i-film"></use></svg>, в скриптах: icon('film').
(function () {
  'use strict';
  // Контуры в стиле Lucide (24×24, обводка currentColor). Цвет иконки = цвет текста вокруг.
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    film: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9M12.4 3.4l3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    tv: '<rect x="2" y="7" width="20" height="15" rx="2.5"/><path d="m17 2-5 5-5-5"/>',
    torii: '<path d="M2 4.5c3.2 1.3 6.4 1.9 10 1.9s6.8-.6 10-1.9"/><path d="M4 10.5h16M6.5 6.6V21M17.5 6.6V21M12 6.9v3.6"/>',
    gamepad: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.26A4 4 0 0 0 17.32 5z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    crown: '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.29L21.18 5.5a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.66a1 1 0 0 0 1.52-.29z"/><path d="M5 21h14"/>',
    target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
    hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    'volume-off': '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="3"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    flip: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    bot: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2.5"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>',
    play: '<path d="M6.5 4.2v15.6a1 1 0 0 0 1.53.85l12.48-7.8a1 1 0 0 0 0-1.7L8.03 3.35A1 1 0 0 0 6.5 4.2z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    star: '<path d="M11.52 2.3a.53.53 0 0 1 .96 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.78.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.02a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.9l5.17-.76a2.12 2.12 0 0 0 1.6-1.16z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    video: '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.94a.5.5 0 0 0-.76-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2.5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6M2 9h20"/>',
    wheel: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5V10M12 14v7.5M2.5 12H10M14 12h7.5M5.3 5.3l5.3 5.3M13.4 13.4l5.3 5.3M18.7 5.3l-5.3 5.3M10.6 13.4l-5.3 5.3"/>',
    external: '<path d="M7 17 17 7M8 7h9v9"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
    pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
  };

  const NAV_LINKS = `
    <li><a href="hall.html">Зал Славы</a></li>
    <li><a href="tickets.html">Билеты</a></li>
    <li class="site-nav__dd">
      <button type="button" class="site-nav__dd-btn" aria-haspopup="true" aria-expanded="false">Заказы зрителя <span class="site-nav__caret">▾</span></button>
      <ul class="site-nav__menu">
        <li><a href="anime.html">Аниме</a></li>
        <li><a href="movies.html">Фильмы</a></li>
        <li><a href="series.html">Сериалы</a></li>
        <li><a href="games.html">Игры</a></li>
        <li><a href="pain-games.html">Боль</a></li>
        <li><a href="picker.html">Рулетка заказов</a></li>
      </ul>
    </li>
    <li class="site-nav__dd">
      <button type="button" class="site-nav__dd-btn" aria-haspopup="true" aria-expanded="false">Для стримера <span class="site-nav__caret">▾</span></button>
      <ul class="site-nav__menu">
        <li><a href="chat-wheel.html">Чат-рулетка</a></li>
        <li><a href="pain.html">Боль стримера за шекели</a></li>
        <li><a href="cards.html">Админка-рулетка</a></li>
        <li><a href="cards.html?stream">Хаос-рулетка</a></li>
      </ul>
    </li>`;

  // Базовый вид иконок — и для страниц без site.css (рулетки со своими стилями).
  const ICON_CSS = '<style>.ic{width:1em;height:1em;flex:0 0 auto;display:inline-block;vertical-align:-0.14em;fill:none;stroke:currentColor;' +
    'stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ic--fill{fill:currentColor}' +
    // Ссылки и кнопки-разделы меню — на одной линии (иначе кнопки сидят на пару пикселей ниже ссылок)
    '.site-nav__links{align-items:center}.site-nav__links>li>a,.site-nav__links>li>.site-nav__dd-btn{display:inline-flex;align-items:center;line-height:1.2;padding:5px 0 3px}' +
    // Последний раздел меню у правого края: выпадающий список прижимаем вправо, иначе он вылезает за экран
    // Заглавные буквы визуально сидят ниже центра строки — на компьютере поднимаем содержимое панели на 2px
    '@media (min-width:721px){.site-nav__inner{padding-top:10px;padding-bottom:14px}.site-nav__links>li:last-child>.site-nav__menu{left:auto;right:0;transform:translateY(-6px)}' +
    '.site-nav__links>li:last-child:hover>.site-nav__menu,.site-nav__links>li:last-child.is-open>.site-nav__menu,' +
    '.site-nav__links>li:last-child:focus-within>.site-nav__menu{transform:translateY(0)}}</style>';
  const sprite = ICON_CSS + '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' +
    Object.entries(ICONS).map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`).join('') +
    '</svg>';

  window.icon = (name, cls) =>
    `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  const me = document.currentScript;
  // data-nav="off" — страница без меню (оверлеи для OBS), но с иконками.
  const withNav = !me || me.dataset.nav !== 'off';
  const html = sprite + (withNav
    ? `<nav class="site-nav"><div class="site-nav__inner"><a class="site-nav__brand" href="index.html">ParipariKai</a><ul class="site-nav__links">${NAV_LINKS}</ul></div></nav>`
    : '');
  if (me && me.parentNode) me.insertAdjacentHTML('afterend', html);
  else document.body.insertAdjacentHTML('afterbegin', html);
  if (!withNav) return;

  // Меню: подсветка текущей страницы и открытие разделов по клику (для тач-экранов)
  const nav = document.querySelector('.site-nav');
  const here = (location.pathname.split('/').pop() || 'index.html') + location.search;
  nav.querySelectorAll('.site-nav__links a').forEach(a => {
    if (a.getAttribute('href') === here) {
      a.classList.add('is-active');
      const dd = a.closest('.site-nav__dd');
      if (dd) dd.classList.add('is-active');
    }
  });
  const closeAll = () => nav.querySelectorAll('.site-nav__dd.is-open').forEach(dd => {
    dd.classList.remove('is-open');
    dd.querySelector('.site-nav__dd-btn').setAttribute('aria-expanded', 'false');
  });
  nav.querySelectorAll('.site-nav__dd-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dd = btn.parentElement;
      const open = !dd.classList.contains('is-open');
      closeAll();
      if (open) {
        dd.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
})();
