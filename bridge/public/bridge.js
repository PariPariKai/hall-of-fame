'use strict';
// Общее для страниц моста: запросы к API, live-состояние, форматирование времени.
const Bridge = (() => {
  async function api(path, body) {
    const post = body !== undefined;
    const res = await fetch(path, post ? {method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Pain-Bridge': '1'}, body: JSON.stringify(body)} : {});
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }
  // onState(state) получает снимок; state.receivedAt — performance.now() в момент получения.
  function listen(onState, onConnection = () => {}) {
    const es = new EventSource('/api/events');
    es.onopen = () => onConnection(true);
    es.onerror = () => onConnection(false);
    es.onmessage = event => {
      const state = JSON.parse(event.data);
      state.receivedAt = performance.now();
      state.clockSkew = Date.now() - state.now;
      onState(state);
    };
  }
  function timerLeft(state) {
    if (!state) return 0;
    const t = state.timer;
    return Math.max(0, t.remainingMs - (t.running ? performance.now() - state.receivedAt : 0));
  }
  // Пока рулетка крутится, итог (игра, таймер) ещё не раскрыт зрителям.
  function revealing(state) {
    return !!state?.spin && Date.now() - state.clockSkew < state.spin.revealAt;
  }
  function clock(ms) {
    const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function minutes(n) {
    if (n % 60) return `${n} мин`;
    const h = n / 60, tail = h % 100;
    const word = tail >= 11 && tail <= 14 ? 'часов' : h % 10 === 1 ? 'час' : h % 10 >= 2 && h % 10 <= 4 ? 'часа' : 'часов';
    return `${h} ${word}`;
  }
  const rub = n => `${Number(n).toLocaleString('ru-RU', {maximumFractionDigits: 2})} ₽`;
  return {api, listen, timerLeft, revealing, clock, minutes, rub};
})();
