// «Преступление и наказание»: тяжесть статей, рулетка наказаний и состояние приговоров.
// Общее для rules.html (правила и история — для зрителей) и court.html (суд — рулетка стримера).
// Статьи — data/rules.json, приговоры — data/punishments.json (пишет court.html через github.js).
// Подключается после site.js (нужен siteTime).
(function () {
  'use strict';
  // Исходы рулетки. fill — цвет деления на колесе, ink — цвет в тексте и легенде
  const OUTCOMES = {
    m10:   { kind: 'mute',  sec: 600,    short: '10 мин', label: 'мут на 10 минут',  fill: '#2c5a37', ink: '#97C459' },
    m30:   { kind: 'mute',  sec: 1800,   short: '30 мин', label: 'мут на 30 минут',  fill: '#21545c', ink: '#7fd0c8' },
    h1:    { kind: 'mute',  sec: 3600,   short: '1 час',  label: 'мут на час',       fill: '#2b4677', ink: '#88B4F5' },
    d1:    { kind: 'mute',  sec: 86400,  short: 'сутки',  label: 'мут на сутки',     fill: '#76561c', ink: '#FAC775' },
    w1:    { kind: 'mute',  sec: 604800, short: 'неделя', label: 'мут на неделю',    fill: '#87401f', ink: '#ff9f6a' },
    ban:   { kind: 'ban',   sec: 0,      short: 'бан',    label: 'бан с апелляцией', fill: '#8c2424', ink: '#F38787' },
    perma: { kind: 'perma', sec: 0,      short: 'вечный', label: 'вечный бан',       fill: '#1b0b10', ink: '#ff5a5a' },
  };
  const ORDER = Object.keys(OUTCOMES);
  // Тяжесть статьи (1–5) → сколько делений каждого исхода на колесе. Всего делений — 20.
  const LEVELS = [null,
    { name: 'Мелкое хулиганство',  wheel: { m10: 12, m30: 6, h1: 2 } },
    { name: 'Проступок',           wheel: { m10: 5, m30: 7, h1: 6, d1: 2 } },
    { name: 'Преступление',        wheel: { m30: 3, h1: 6, d1: 7, w1: 3, ban: 1 } },
    { name: 'Тяжкое преступление', wheel: { d1: 4, w1: 8, ban: 6, perma: 2 } },
    { name: 'Особо тяжкое',        wheel: { ban: 1, perma: 19 } },
  ];
  const SECTORS = 20;
  const MAX_LEVEL = LEVELS.length - 1;
  const REPEAT_DAYS = 30; // попался снова в течение месяца — статья на ступень тяжелее

  // Деления колеса по кругу: одинаковые исходы разбросаны равномерно, а не стоят кучкой
  function sectors(level) {
    const out = [];
    ORDER.forEach((id, k) => {
      const c = LEVELS[level].wheel[id] || 0;
      for (let i = 0; i < c; i++) out.push({ id, pos: (i + 0.5 + k * 0.071) / c });
    });
    return out.sort((a, b) => a.pos - b.pos).map(s => s.id);
  }
  // Исходы уровня по порядку тяжести: [{ id, count }]
  const odds = level => ORDER.filter(id => LEVELS[level].wheel[id]).map(id => ({ id, count: LEVELS[level].wheel[id] }));

  // ---------- время: всё в данных — по часам стримера, «DD.MM.YYYY HH:MM» ----------
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  function stamp(date) {
    const p = siteTime.parts(date);
    return `${pad(p.d)}.${pad(p.mo + 1)}.${p.y} ${pad(p.h)}:${pad(p.mi)}`;
  }
  // «24 окт, 21:40» по часам того, кто смотрит (siteTime.show), год — если не текущий
  function when(str) {
    const d = siteTime.parse(str);
    if (!d) return str || '';
    const tz = siteTime.show(), p = siteTime.parts(d, tz);
    const y = siteTime.parts(new Date(), tz).y;
    return `${p.d} ${MONTHS[p.mo]}${p.y !== y ? ' ' + p.y : ''}, ${pad(p.h)}:${pad(p.mi)}`;
  }
  // Сколько осталось: «47 мин», «5 ч», «3 дн»
  function left(str, now) {
    const d = siteTime.parse(str);
    if (!d) return '';
    const min = Math.max(1, Math.ceil((d.getTime() - (now || Date.now())) / 60000));
    return min < 60 ? min + ' мин' : min < 48 * 60 ? Math.round(min / 60) + ' ч' : Math.round(min / 1440) + ' дн';
  }

  // ---------- приговоры ----------
  const outcomeOf = it => OUTCOMES[it.outcome] || OUTCOMES.m10;
  // Состояние приговора сейчас: tone — цвет метки .tag--*
  function state(it, now) {
    const o = outcomeOf(it);
    if (it.status === 'lifted') return o.kind === 'mute'
      ? { id: 'lifted', label: 'Помилован', tone: 'paused' }
      : { id: 'unbanned', label: 'Разбанен', tone: 'done' };
    if (o.kind === 'perma') return { id: 'perma', label: 'Вечный бан', tone: 'dropped' };
    if (o.kind === 'ban') return { id: 'banned', label: 'В бане', tone: 'dropped' };
    const until = siteTime.parse(it.until);
    if (until && until.getTime() > (now || Date.now())) return { id: 'muted', label: 'В муте', tone: 'active' };
    return { id: 'served', label: 'Отсидел', tone: 'queue' };
  }
  const sameNick = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  // Прошлые приговоры зрителя, свежие первыми
  const record = (items, nick) => items.filter(it => sameNick(it.nick, nick))
    .sort((a, b) => (siteTime.parse(b.at) || 0) - (siteTime.parse(a.at) || 0));
  function isRepeat(items, nick, now) {
    const last = record(items, nick)[0];
    const d = last && siteTime.parse(last.at);
    return !!d && (now || Date.now()) - d.getTime() < REPEAT_DAYS * 864e5;
  }
  // Команда для чата Twitch
  function command(it) {
    const o = outcomeOf(it);
    const reason = 'Статья: ' + (it.rule_title || it.rule || 'нарушение правил');
    return o.kind === 'mute' ? `/timeout ${it.nick} ${o.sec} ${reason}` : `/ban ${it.nick} ${reason}`;
  }
  const undoCommand = it => (outcomeOf(it).kind === 'mute' ? '/untimeout ' : '/unban ') + it.nick;

  async function loadRules() {
    const res = await fetch('data/rules.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json()).items.map(r => Object.assign({}, r, { level: Math.min(MAX_LEVEL, Math.max(1, +r.level || 1)) }));
  }

  // ---------- разметка, общая для обеих страниц (стили — court.css) ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const levelBadge = (lvl, label) => `<span class="lvl-badge lvl--${lvl}"><span class="lvl-dots">${
    Array.from({ length: MAX_LEVEL }, (_, i) => `<i${i < lvl ? ' class="on"' : ''}></i>`).join('')}</span>${esc(label || LEVELS[lvl].name)}</span>`;
  const sentence = it => `<span class="sentence" style="--ink:${outcomeOf(it).ink}">${esc(outcomeOf(it).label)}</span>`;
  function oddsHTML(level) {
    const list = odds(level);
    return `<div class="odds"><div class="odds__bar">${list.map(o => `<span style="--n:${o.count};--ink:${OUTCOMES[o.id].ink}"></span>`).join('')}</div>
      <div class="odds__list">${list.map(o => `<span style="--ink:${OUTCOMES[o.id].ink}"><i></i>${esc(OUTCOMES[o.id].short)} <b>${o.count * 100 / SECTORS}%</b></span>`).join('')}</div></div>`;
  }
  // Строка истории; extra — что дописать под состоянием (кнопки суда)
  function caseHTML(it, extra) {
    const st = state(it);
    const lvl = Math.min(MAX_LEVEL, Math.max(1, +it.level || 1));
    const note = st.id === 'muted' ? `до <span class="tz">${esc(when(it.until))}</span> · ещё ${esc(left(it.until))}`
      : st.id === 'banned' ? 'можно обжаловать'
      : (st.id === 'unbanned' || st.id === 'lifted') && it.lifted_at ? `<span class="tz">${esc(when(it.lifted_at))}</span>` : '';
    return `<li class="case${['served', 'lifted', 'unbanned'].includes(st.id) ? ' is-old' : ''}" data-id="${esc(it.id)}">
      <div class="case__date tz">${esc(when(it.at))}</div>
      <div class="case__nick">${esc(it.nick)}</div>
      <div class="case__rule">${levelBadge(lvl)}<span class="case__rule-title">${esc(it.rule_title || it.rule)}${it.repeat ? '<small>повторно</small>' : ''}</span>${
        it.note ? `<span class="case__note">${esc(it.note)}</span>` : ''}</div>
      <div class="case__sentence">${sentence(it)}</div>
      <div class="case__state"><span class="tag tag--${st.tone}">${st.label}</span>${note ? `<span>${note}</span>` : ''}${extra || ''}</div></li>`;
  }

  window.court = {
    OUTCOMES, ORDER, LEVELS, SECTORS, MAX_LEVEL, REPEAT_DAYS,
    sectors, odds, stamp, when, left, outcomeOf, state, sameNick, record, isRepeat, command, undoCommand, loadRules,
    esc, levelBadge, sentence, oddsHTML, caseHTML,
  };
})();
