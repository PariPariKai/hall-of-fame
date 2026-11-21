// Код страницы experiments.html (раздел experiments). Подключается из experiments.html.
'use strict';
const KINDS = {
  game:  {label: 'Игра',       many: 'Игры',        icon: 'gamepad'},
  mod:   {label: 'Мод',        many: 'Моды и патчи', icon: 'wrench'},
  tool:  {label: 'Инструмент', many: 'Инструменты', icon: 'bot'},
  site:  {label: 'Сайт',       many: 'Сайты',       icon: 'code'},
  other: {label: 'Другое',     many: 'Другое',      icon: 'flask'},
};
const STATUSES = {
  done:    {label: 'Готово',         cls: 'tag--done'},
  testing: {label: 'Нужны тестеры',  cls: 'tag--show'},
  wip:     {label: 'В работе',       cls: 'tag--paused'},
  soon:    {label: 'Скоро',          cls: 'tag--paused'},
};
const LINKS = {
  play:     {icon: 'play',     label: 'Играть'},
  download: {icon: 'download', label: 'Скачать'},
  video:    {icon: 'video',    label: 'Видео'},
  source:   {icon: 'code',     label: 'Исходники'},
  page:     {icon: 'external', label: 'Открыть'},
};
// Облака для кнопок скачивания: логотип + название. host в experiments.json: gdrive | yadisk
const HOSTS = {
  gdrive: {name: 'Google Диск', logo: '<svg viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>'},
  itch: {name: 'itch.io', logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#fa5c5c"/><path d="M5 9.5 6.5 5h11L19 9.5a1.75 1.75 0 0 1-3.5 0 1.75 1.75 0 0 1-3.5 0 1.75 1.75 0 0 1-3.5 0 1.75 1.75 0 0 1-3.5 0Z" fill="#fff"/><path d="M6.5 12.2v6.3h11v-6.3" fill="#fff"/><circle cx="10" cy="15.3" r="1.1" fill="#fa5c5c"/><circle cx="14" cy="15.3" r="1.1" fill="#fa5c5c"/></svg>'},
  github: {name: 'GitHub', logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#181717" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg>'},
  yadisk: {name: 'Яндекс Диск', logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19H8a6 6 0 1 1 1.1-11.9A6.5 6.5 0 0 1 21 10.5a4.3 4.3 0 0 1-3.5 8.5z" fill="#ffcc00" stroke="#d99a00" stroke-width="1.2"/></svg>'},
};
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const state = {items: [], kind: 'all'};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function iconEl(name) { const s = el('span'); s.innerHTML = icon(name); return s.firstChild; }
function fmtDate(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s || '');
  return m ? `${+m[3]} ${MONTHS[m[2] - 1]} ${m[1]}` : '';
}
const kindOf = x => KINDS[x.kind] ? x.kind : 'other';
const list = v => (Array.isArray(v) ? v : []).filter(s => typeof s === 'string' && s.trim());

function buildList(label, items, iconName) {
  const box = el('div');
  box.append(el('div', 'xcard__label', label));
  const ul = el('ul', 'xcard__list');
  items.forEach(t => { const li = el('li'); li.append(iconEl(iconName), el('span', '', t)); ul.append(li); });
  box.append(ul);
  return box;
}

function buildCard(x) {
  const kind = KINDS[kindOf(x)], status = STATUSES[x.status];
  const li = el('li', 'xcard' + (x.status === 'testing' ? ' is-testing' : ''));
  li.id = x.id || '';
  if (/^#[0-9a-f]{3,8}$/i.test(x.accent || '')) li.style.setProperty('--accent', x.accent);

  const cover = el('div', 'xcard__cover');
  const shots = list(x.gallery);
  if (shots.length) {
    cover.classList.add('has-img', 'has-gallery');
    cover.append(...buildGallery(shots, x.title || ''));
  } else if (x.cover) {
    const img = el('img');
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = x.cover;
    img.onerror = () => { img.remove(); cover.classList.remove('has-img'); };
    cover.classList.add('has-img');
    cover.append(img);
  }
  const big = el('div', 'xcard__kind-ic'); big.innerHTML = icon(kind.icon);
  const tags = el('div', 'xcard__tags');
  const kindTag = el('span', 'tag tag--queue'); kindTag.append(iconEl(kind.icon), kind.label);
  tags.append(kindTag);
  if (status) tags.append(el('span', 'tag ' + status.cls, status.label));
  cover.append(big, tags);
  if (x.badge && x.badge.value) {
    const badge = el('div', 'xcard__badge');
    badge.append(el('b', '', x.badge.value));
    if (x.badge.label) badge.append(el('span', '', x.badge.label));
    cover.append(badge);
  }

  const body = el('div', 'xcard__body');
  const head = el('div', 'xcard__head');
  head.append(el('h2', 'xcard__title', x.title || 'Без названия'));
  const meta = el('div', 'xcard__meta');
  const ai = list(x.ai);
  if (ai.length) { const s = el('span', '', 'Сделано с: '); s.append(el('b', '', ai.join(', '))); meta.append(s); }
  if (x.version) meta.append(el('span', '', x.version));
  if (fmtDate(x.date)) meta.append(el('span', '', fmtDate(x.date)));
  if (meta.childNodes.length) head.append(meta);
  body.append(head);
  if (x.summary) body.append(el('p', 'xcard__summary', x.summary));
  if (list(x.requirements).length) body.append(buildList('Что нужно', list(x.requirements), 'chevron'));
  // "Что внутри" и "Как это сделано" спрятаны под кнопки в один ряд, чтобы карточка не вываливала всё сразу
  const more = el('div', 'xcard__more');
  const toggle = (label, content) => {
    const d = el('details', 'xcard__story');
    const sum = el('summary'); sum.append(iconEl('chevron'), label);
    const box = el('div', 'xcard__story-text'); box.append(...content);
    d.append(sum, box); more.append(d);
  };
  if (list(x.features).length) {
    const ul = el('ul', 'xcard__list');
    list(x.features).forEach(t => { const li = el('li'); li.append(iconEl('check'), el('span', '', t)); ul.append(li); });
    toggle('Что внутри', [ul]);
  }
  if (list(x.story).length) {
    const parts = x.storyTitle ? [el('h3', 'xcard__story-title', x.storyTitle)] : [];
    list(x.story).forEach(t => parts.push(el('p', '', t)));
    toggle(x.storyLabel || 'Как это сделано', parts);
  }
  if (more.childNodes.length) body.append(more);

  if (x.warning) { const w = el('div', 'xcard__warn'); w.append(iconEl('alert'), el('span', '', x.warning)); body.append(w); }

  const links = (Array.isArray(x.links) ? x.links : []).filter(l => l && LINKS[l.type]);
  if (links.length) {
    const actions = el('div', 'xcard__actions');
    links.forEach((l, i) => {
      const def = LINKS[l.type], ready = /^(https?:\/\/|[\w.\-\/]+$)/.test(l.url || '');
      const a = el('a', 'btn' + (i === 0 ? ' btn--main' : '') + (ready ? '' : ' is-off'));
      const host = HOSTS[l.host];
      if (host) { const logo = el('span', 'btn__logo'); logo.innerHTML = host.logo; a.append(logo); }
      else a.append(iconEl(def.icon));
      a.append(l.label || (host ? `${def.label} · ${host.name}` : def.label));
      if (l.size) a.append(el('span', 'btn__size', '· ' + l.size));
      if (!ready) a.append(el('span', 'btn__size', '· скоро'));
      if (ready) {
        a.href = l.url;
        if (/^https?:/.test(l.url)) { a.target = '_blank'; a.rel = 'noopener'; }
        if (l.type === 'download' && !/^https?:/.test(l.url)) a.download = '';
      } else a.setAttribute('aria-disabled', 'true');
      actions.append(a);
    });
    body.append(actions);
  }

  li.append(cover, body);
  return li;
}

// Обложка-галерея. Картинки грузятся по мере листания (текущая и следующая), а не все сразу.
function buildGallery(shots, title) {
  const n = shots.length, box = el('div', 'xgal');
  const imgs = shots.map((src, i) => {
    const img = el('img');
    img.alt = `${title}: скриншот ${i + 1} из ${n}`; img.decoding = 'async'; img.draggable = false; img.dataset.src = src;
    box.append(img);
    return img;
  });
  imgs[0].loading = 'lazy';
  const load = i => { if (!imgs[i].src) imgs[i].src = imgs[i].dataset.src; };
  const parts = [box], dots = [];
  let cur = 0;
  const show = i => {
    cur = (i + n) % n;
    load(cur);
    if (n > 1) load((cur + 1) % n);
    imgs.forEach((im, k) => im.classList.toggle('is-on', k === cur));
    dots.forEach((d, k) => { d.classList.toggle('is-on', k === cur); d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
  };
  // Сама листается раз в 6 секунд, пока зритель её не трогал; при наведении — пауза
  let auto = n > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches, hover = false;
  const go = i => { auto = false; show(i); };
  if (n > 1) {
    const nav = (cls, label, step) => {
      const b = el('button', 'xgal__nav ' + cls);
      b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = icon('chevron');
      b.addEventListener('click', e => { e.stopPropagation(); go(cur + step); });
      return b;
    };
    const dotsBox = el('div', 'xgal__dots');
    shots.forEach((_, i) => {
      const d = el('button', 'xgal__dot');
      d.type = 'button'; d.setAttribute('aria-label', `Скриншот ${i + 1}`);
      d.addEventListener('click', e => { e.stopPropagation(); go(i); });
      dots.push(d); dotsBox.append(d);
    });
    parts.push(nav('xgal__nav--prev', 'Предыдущий скриншот', -1), nav('xgal__nav--next', 'Следующий скриншот', 1), dotsBox);
    // Свайп пальцем или мышью
    let x0 = null, swiped = false;
    box.addEventListener('pointerdown', e => { x0 = e.clientX; swiped = false; });
    box.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; go(cur + (dx < 0 ? 1 : -1)); }
    });
    box.addEventListener('click', () => { if (!swiped) { auto = false; openLightbox(shots, cur, title, show); } });
    box.addEventListener('pointerenter', () => { hover = true; });
    box.addEventListener('pointerleave', () => { hover = false; });
    setInterval(() => { if (auto && !hover && !document.hidden && box.isConnected) show(cur + 1); }, 6000);
  } else box.addEventListener('click', () => openLightbox(shots, 0, title, show));
  show(0);
  return parts;
}

// Просмотр на весь экран. onChange — чтобы обложка карточки догнала листание в просмотрщике.
function openLightbox(shots, start, title, onChange) {
  const n = shots.length, back = document.activeElement;
  let cur = start, swiped = false;
  const lb = el('div', 'lightbox');
  lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', title);
  const img = el('img'), count = el('div', 'lightbox__count');
  const btn = (cls, label, ic) => { const b = el('button', 'lightbox__btn ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = icon(ic); return b; };
  const close = btn('lightbox__close', 'Закрыть', 'x');
  const show = i => {
    cur = (i + n) % n;
    img.src = shots[cur]; img.alt = `${title}: скриншот ${cur + 1} из ${n}`;
    count.textContent = `${cur + 1} / ${n}`;
    if (n > 1) new Image().src = shots[(cur + 1) % n];
    if (onChange) onChange(cur);
  };
  const onKey = e => {
    if (e.key === 'Escape') shut();
    else if (e.key === 'ArrowRight' && n > 1) show(cur + 1);
    else if (e.key === 'ArrowLeft' && n > 1) show(cur - 1);
  };
  const shut = () => {
    lb.remove(); document.removeEventListener('keydown', onKey);
    document.documentElement.style.overflow = '';
    if (back && back.focus) back.focus({preventScroll: true});
  };
  lb.append(img, close);
  if (n > 1) {
    const prev = btn('lightbox__prev', 'Предыдущий скриншот', 'chevron'), next = btn('lightbox__next', 'Следующий скриншот', 'chevron');
    prev.addEventListener('click', e => { e.stopPropagation(); show(cur - 1); });
    next.addEventListener('click', e => { e.stopPropagation(); show(cur + 1); });
    lb.append(prev, next, count);
    let x0 = null;
    lb.addEventListener('pointerdown', e => { x0 = e.clientX; swiped = false; });
    lb.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; show(cur + (dx < 0 ? 1 : -1)); }
    });
  }
  close.addEventListener('click', shut);
  // Клик по картинке — следующая, мимо картинки — закрыть
  lb.addEventListener('click', e => {
    if (swiped) return;
    if (e.target === img && n > 1) show(cur + 1);
    else if (e.target === lb) shut();
  });
  document.addEventListener('keydown', onKey);
  document.documentElement.style.overflow = 'hidden';
  document.body.append(lb);
  show(start);
  close.focus();
}

function renderFilters() {
  const counts = new Map();
  state.items.forEach(x => counts.set(kindOf(x), (counts.get(kindOf(x)) || 0) + 1));
  const box = document.getElementById('kind-filters');
  const chips = [['all', 'Все', state.items.length], ...Object.keys(KINDS).filter(k => counts.has(k)).map(k => [k, KINDS[k].many, counts.get(k)])];
  box.replaceChildren(...chips.map(([value, label, count]) => {
    const b = el('button', 'chip' + (state.kind === value ? ' is-active' : ''), label + ' ');
    b.type = 'button';
    b.append(el('span', 'count', count));
    b.addEventListener('click', () => { state.kind = value; renderFilters(); render(); });
    return b;
  }));
  // Фильтр нужен, только когда есть из чего выбирать
  box.parentElement.hidden = counts.size < 2;
}

function render() {
  const shown = state.items.filter(x => state.kind === 'all' || kindOf(x) === state.kind);
  const grid = document.getElementById('grid');
  grid.replaceChildren(...shown.map(x => x.card));
  grid.hidden = !shown.length;
}

async function load() {
  const status = document.getElementById('status');
  try {
    const r = await fetch('experiments.json?v=' + Math.floor(Date.now() / 60000), {cache: 'no-cache'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    state.items = (data.experiments || []).filter(x => x && x.title);
    state.items.forEach(x => { x.card = buildCard(x); });
    status.hidden = !!state.items.length;
    status.textContent = 'Пока пусто. Первый эксперимент уже в работе.';
    const n = state.items.length, testing = state.items.filter(x => x.status === 'testing').length;
    const sub = document.getElementById('subtitle');
    sub.replaceChildren('Что я собрал вместе с нейросетями · ', el('span', 'accent', `${n} ${plural(n, 'эксперимент', 'эксперимента', 'экспериментов')}`));
    if (testing) sub.append(' · ждут тестеров: ', el('span', 'accent', testing));
    renderFilters(); render();
    // Ссылка вида experiments.html#tiny-game — сразу к нужной карточке
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({block: 'start'});
  } catch (err) {
    console.warn('Experiments load failed:', err.message);
    status.className = 'error-state';
    status.textContent = 'Не удалось загрузить эксперименты. Обнови страницу чуть позже.';
  }
}
load();
