/* =====================================================================
   Общий набор для рулеток-колёс (picker.html, chat-wheel.html).
   Подключать после site.js и до основного скрипта страницы,
   вместе с wheel-kit.css. При изменении — поднять ?v=N во всех подключениях.

   WheelKit.builder()    — разметка колеса: объёмные сектора, обод с бликом,
                           штырьки, стеклянный блик, ступица с иконкой
   WheelKit.mount()      — стрелка и блёстки «в масле» вокруг колеса
   WheelKit.flash()      — вспышка вылетающего варианта
   WheelKit.sound        — щелчки стрелки на выбор: Дерево / Мягкий / Шарик / Выкл
   WheelKit.autoPhase(n) — темп авто-выбывания по числу оставшихся вариантов

   Геометрия — в координатах viewBox 0..100: сектора до WHEEL_R, дальше
   неподвижный обод (свет на нём не крутится), штырьки крутятся с колесом.
   ===================================================================== */
window.WheelKit = (() => {
  const WHEEL_R = 44;
  const RIM_R = 48.5;
  const PEG_R = 46.25;
  const MAX_PEGS = 72;   // больше — штырьки сливаются, ставим декоративные через равный шаг

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = v => Math.max(0, Math.min(255, v));
    const r = clamp(((n >> 16) & 255) + amount);
    const g = clamp(((n >> 8) & 255) + amount);
    const b = clamp((n & 255) + amount);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Сектор темнеет к центру и светлеет у обода — колесо выглядит объёмным
  function sectorGradient(id, color) {
    return `<radialGradient id="${id}" cx="50" cy="50" r="${WHEEL_R}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${shade(color, -95)}"/>
      <stop offset="0.38" stop-color="${shade(color, -38)}"/>
      <stop offset="0.8" stop-color="${color}"/>
      <stop offset="0.95" stop-color="${shade(color, 28)}"/>
      <stop offset="1" stop-color="${shade(color, -20)}"/>
    </radialGradient>`;
  }

  // Собирает колесо целиком. fill(color) отдаёт заливку сектора,
  // frame(...) — готовое содержимое <svg viewBox="0 0 100 100">.
  // Вращается только <g id="wheel-group"> — его и крутит страница.
  function builder() {
    const grads = {};
    return {
      fill(color) {
        const id = 'sg-' + color.slice(1);
        if (!grads[id]) grads[id] = sectorGradient(id, color);
        return `url(#${id})`;
      },
      // boundaries — углы границ секторов (по ним щёлкает стрелка, там и штырьки)
      frame({ content, boundaries, rotation, hubIcon = 'dice' }) {
        const angles = boundaries.length <= MAX_PEGS
          ? boundaries
          : Array.from({ length: 48 }, (_, i) => i * 7.5);
        let pegs = '';
        angles.forEach(a => {
          const rad = (a - 90) * Math.PI / 180;
          pegs += `<circle cx="${(50 + Math.cos(rad) * PEG_R).toFixed(3)}" cy="${(50 + Math.sin(rad) * PEG_R).toFixed(3)}" r="0.95" fill="url(#peg)" stroke="rgba(0,0,0,0.45)" stroke-width="0.2"/>`;
        });
        const gx = WHEEL_R * 0.86;
        return `
          <defs>
            ${Object.values(grads).join('')}
            <linearGradient id="rim" x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0" style="stop-color: var(--rim-1)"/>
              <stop offset="0.3" style="stop-color: var(--rim-2)"/>
              <stop offset="0.62" style="stop-color: var(--rim-3)"/>
              <stop offset="1" style="stop-color: var(--rim-4)"/>
            </linearGradient>
            <radialGradient id="peg" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stop-color="#ffffff"/>
              <stop offset="0.5" style="stop-color: var(--rim-2)"/>
              <stop offset="1" style="stop-color: var(--rim-3)"/>
            </radialGradient>
            <radialGradient id="edge-shade" cx="50" cy="50" r="${WHEEL_R}" gradientUnits="userSpaceOnUse">
              <stop offset="0.82" stop-color="#000" stop-opacity="0"/>
              <stop offset="1" stop-color="#000" stop-opacity="0.38"/>
            </radialGradient>
            <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity="0.24"/>
              <stop offset="1" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
            <radialGradient id="hub" cx="0.4" cy="0.35" r="0.75">
              <stop offset="0" stop-color="#1d2b4a"/>
              <stop offset="1" stop-color="#05080f"/>
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="${RIM_R}" fill="url(#rim)"/>
          <circle cx="50" cy="50" r="${RIM_R - 0.35}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.3"/>
          <circle cx="50" cy="50" r="${WHEEL_R + 0.35}" fill="#05080f"/>
          <g id="wheel-group" style="transform-origin: 50% 50%; transform: rotate(${rotation}deg); transition: none;">
            ${content}
            ${pegs}
          </g>
          <circle cx="50" cy="50" r="${WHEEL_R}" fill="url(#edge-shade)" pointer-events="none"/>
          <path d="M ${50 - gx} 44 A ${WHEEL_R} ${WHEEL_R} 0 0 1 ${50 + gx} 44 Q 50 34 ${50 - gx} 44 Z" fill="url(#gloss)" pointer-events="none"/>
          <circle cx="50" cy="50" r="8.6" fill="url(#rim)" stroke="rgba(0,0,0,0.5)" stroke-width="0.3"/>
          <circle cx="50" cy="50" r="6.7" fill="url(#hub)" stroke="rgba(255,255,255,0.25)" stroke-width="0.25"/>
          <use href="#i-${hubIcon}" x="46.3" y="46.3" width="7.4" height="7.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--gold, #FAC775)"/>`;
      },
    };
  }

  const POINTER_SVG = `
    <svg viewBox="0 0 60 52">
      <defs>
        <linearGradient id="ptr-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color: var(--ptr-1)"/>
          <stop offset="0.5" style="stop-color: var(--ptr-2)"/>
          <stop offset="1" style="stop-color: var(--ptr-3)"/>
        </linearGradient>
        <radialGradient id="ptr-gem" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" style="stop-color: var(--gem-1)"/>
          <stop offset="0.45" style="stop-color: var(--gem-2)"/>
          <stop offset="1" style="stop-color: var(--gem-3)"/>
        </radialGradient>
      </defs>
      <path d="M3 26 L48 5.5 Q56 2.5 56 10.5 L56 41.5 Q56 49.5 48 46.5 Z" fill="url(#ptr-body)" stroke="rgba(4,8,18,0.75)" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M9 24.6 L47.5 8.6" stroke="rgba(255,255,255,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 27.4 L47.5 43.4" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="47.5" cy="26" r="6.4" fill="url(#ptr-gem)" stroke="rgba(4,8,18,0.7)" stroke-width="1.3"/>
      <circle cx="45.7" cy="24.1" r="1.9" fill="#fff" opacity="0.9"/>
    </svg>`;

  // Вылетающий вариант вспыхивает на всех своих кусочках (selector — его секторы)
  function flash(selector) {
    const group = document.getElementById('wheel-group');
    if (!group) return Promise.resolve();
    group.querySelectorAll(selector).forEach(p => {
      const f = p.cloneNode();
      for (const a of [...f.attributes]) if (a.name.startsWith('data-')) f.removeAttribute(a.name);
      f.setAttribute('fill', '#fff');
      f.setAttribute('class', 'seg-flash');
      group.appendChild(f);
    });
    return new Promise(r => setTimeout(r, 650));
  }

  // ============================================================
  // Блёстки в масле
  //
  // Колесо будто лежит в густом масле с блёстками. Раскрутили колесо —
  // масло у обода тянется за ним, дальние слои отстают и разгоняются
  // медленнее; после остановки блёстки ещё долго плывут по инерции.
  // На большой скорости их отбрасывает наружу, потом они оседают обратно.
  //
  // Расстояния — в радиусах колеса (1 = край обода). Угол растёт по
  // часовой, как и поворот колеса в CSS.
  // ============================================================
  function glitter(cv, getRotation, isSpinning) {
    const ctx = cv.getContext('2d');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CANVAS_SCALE = 1.6;          // холст больше колеса (см. .wheel-fx)
    const R_OUTER = RIM_R / 50;        // край обода в долях половины колеса
    const COUNT = reduceMotion ? 0 : 340;
    const PALETTE = document.documentElement.classList.contains('season-winter')
      ? ['#ffffff', '#e3f4ff', '#bfe6ff', '#a9deff', '#8ec5ff', '#d9ccff']
      : ['#ffffff', '#fff1c9', '#ffd98a', '#fac775', '#ffc2e0', '#cfe8ff'];

    let W = 0, H = 0, R = 0, dpr = 1;
    const parts = [];
    let sparks = [];

    function resize() {
      const rect = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.width = Math.round(rect.width * dpr);
      H = cv.height = Math.round(rect.height * dpr);
      R = W / CANVAS_SCALE / 2 * R_OUTER;
    }

    function spawn() {
      const r0 = 1.04 + 0.5 * Math.pow(Math.random(), 1.5);   // гуще у обода
      return {
        r: r0, r0, th: Math.random() * Math.PI * 2,
        w: 0, vr: 0,
        size: 0.9 + Math.random() * Math.random() * 3,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        ph: Math.random() * Math.PI * 2,
        tw: 0.6 + Math.random() * 2.4,                    // скорость мерцания
        star: Math.random() < 0.3,                        // часть — четырёхлучевые искры
      };
    }
    for (let i = 0; i < COUNT; i++) parts.push(spawn());

    // Искры из-под стрелки, когда колесо встало
    function burst() {
      if (reduceMotion || !R) return;
      const x = W / 2 + R * 0.97, y = H / 2;
      for (let i = 0; i < 46; i++) {
        const a = (Math.random() - 0.5) * Math.PI * 1.3;
        const v = (0.4 + Math.random() * 1.4) * R;
        sparks.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 1, decay: 0.55 + Math.random() * 0.7,
          size: (0.8 + Math.random() * 1.8) * dpr,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        });
      }
    }

    function drawStar(x, y, len, width) {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
      ctx.stroke();
    }

    let last = performance.now(), lastRot = getRotation(), t = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now; t += dt;
      if (!W || !dt) return;

      // Скорость колеса берём из его настоящего угла; вне крутки угол
      // может прыгнуть при пересборке — это не вращение
      const rot = getRotation();
      const wheelW = isSpinning() ? (rot - lastRot) * Math.PI / 180 / dt : 0;
      lastRot = rot;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const cx = W / 2, cy = H / 2;
      const rMax = (W / 2) / R;                            // край холста в радиусах колеса

      for (const p of parts) {
        const inv = 1 / p.r;
        // Масло тянется за ободом и быстро слабеет с расстоянием;
        // без вращения — еле заметное течение, чтобы блёстки жили
        const target = wheelW * inv * inv * inv + 0.05 * inv;
        const grip = 2.4 * inv * inv;                      // дальние слои откликаются медленнее
        p.w += (target - p.w) * (1 - Math.exp(-grip * dt));
        p.vr += 0.0026 * p.w * p.w * p.r * dt;             // центробежная сила
        p.vr += (p.r0 - p.r) * 1.8 * dt;                   // оседают обратно
        p.vr *= Math.exp(-2.6 * dt);                       // вязкость
        p.r += p.vr * dt;
        if (p.r < 1.02) { p.r = 1.02; p.vr = Math.abs(p.vr) * 0.3; }
        p.th += p.w * dt;

        const fade = p.r > rMax * 0.82 ? Math.max(0, (rMax - p.r) / (rMax * 0.18)) : 1;
        if (fade <= 0) continue;
        const glint = Math.pow(Math.max(0, Math.sin(t * p.tw + p.ph)), 8);
        const alpha = (0.45 + 0.55 * glint) * fade;
        const x = cx + Math.cos(p.th) * p.r * R;
        const y = cy + Math.sin(p.th) * p.r * R;
        const size = p.size * dpr;

        // На скорости блёстка вытягивается в штрих вдоль своего пути
        const trail = Math.min(0.4, Math.abs(p.w) * 0.035);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ctx.fillStyle = p.color;
        if (trail * p.r * R > size * 1.5) {
          const back = p.th - Math.sign(p.w) * trail;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.arc(cx, cy, p.r * R, Math.min(back, p.th), Math.max(back, p.th));
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        if (glint > 0.4) {                                 // мягкий ореол на вспышке
          ctx.globalAlpha = 0.16 * glint * fade;
          ctx.beginPath();
          ctx.arc(x, y, size * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p.star && glint > 0.35) {
          ctx.globalAlpha = glint * fade;
          drawStar(x, y, size * (3 + glint * 4), Math.max(0.7, size * 0.35));
        }
      }

      if (sparks.length) {
        sparks = sparks.filter(s => (s.life -= s.decay * dt) > 0);
        for (const s of sparks) {
          s.vx *= Math.exp(-2.2 * dt); s.vy *= Math.exp(-2.2 * dt);
          s.vy += 0.25 * R * dt;                           // чуть оседают вниз
          s.x += s.vx * dt; s.y += s.vy * dt;
          ctx.globalAlpha = Math.min(1, s.life * 1.4);
          ctx.strokeStyle = ctx.fillStyle = s.color;
          drawStar(s.x, s.y, s.size * (1.5 + s.life * 2.5), Math.max(0.6 * dpr, s.size * 0.4));
        }
      }
      ctx.globalAlpha = 1;
    }

    if (COUNT) {
      new ResizeObserver(resize).observe(cv);
      resize();
      requestAnimationFrame(frame);
    }
    return { burst };
  }

  // Ставит стрелку и холст с блёстками в .wheel-area страницы.
  // getRotation — угол колеса прямо сейчас (по кадрам анимации), isSpinning — идёт ли крутка.
  function mount({ area, getRotation, isSpinning }) {
    const pointer = area.querySelector('.wheel-pointer');
    if (pointer) pointer.innerHTML = POINTER_SVG;
    const cv = document.createElement('canvas');
    cv.className = 'wheel-fx';
    cv.setAttribute('aria-hidden', 'true');
    area.prepend(cv);
    return glitter(cv, getRotation, isSpinning);
  }

  // ============================================================
  // Звук щелчка стрелки
  //
  // «Дерево» и «Мягкий» синтезируются, «Шарик» — файлы sounds/click-2..5.wav
  // (те же, что в Хаос-рулетке). Выбор общий для всех рулеток и запоминается
  // в браузере. «Выкл» глушит и фанфары — страница проверяет sound.enabled().
  // Кнопки выбора: <div class="sound-group"> с <button data-sound="wood|soft|ball|off">.
  // ============================================================
  const sound = (() => {
    const KEY = 'wheel.clickSound';
    const CHOICES = ['wood', 'soft', 'ball', 'off'];
    const BALL_SOUNDS = [2, 3, 4, 5].map(n => `sounds/click-${n}.wav`);
    let choice = 'wood';
    try {
      // раньше выбор жил только в рулетке заказов
      const s = localStorage.getItem(KEY) || localStorage.getItem('picker.clickSound');
      if (CHOICES.includes(s)) choice = s;
    } catch (e) {}

    let ctx = null, noiseBuf = null, ballBufs = null, lastClickAt = 0;
    function ensure() {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
        // Полсекунды белого шума — из него «деревянная» атака щелчка
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (choice === 'ball') loadBall();
      return ctx;
    }
    function loadBall() {
      if (ballBufs || !ctx) return;
      ballBufs = [];
      BALL_SOUNDS.forEach(src => fetch(src)
        .then(r => r.arrayBuffer())
        .then(b => ctx.decodeAudioData(b))
        .then(buf => ballBufs.push(buf))
        .catch(() => {}));
    }

    // Короткий глухой «ток»: щелчок шума через полосовой фильтр + затухающий тон корпуса
    function wood(now, vol) {
      const pitch = 1 + (Math.random() - 0.5) * 0.08;
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      n.playbackRate.value = pitch;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2200 * pitch; bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(0.35 * vol, now + 0.001);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
      n.connect(bp).connect(ng).connect(ctx.destination);
      n.start(now, Math.random() * 0.4); n.stop(now + 0.03);

      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(950 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.03);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.16 * vol, now + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      o.connect(og).connect(ctx.destination);
      o.start(now); o.stop(now + 0.06);
    }

    // Тихий округлый «пум» без высоких частот
    function soft(now, vol) {
      const pitch = 1 + (Math.random() - 0.5) * 0.06;
      const o = ctx.createOscillator(), g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      o.type = 'triangle';
      o.frequency.setValueAtTime(560 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(330 * pitch, now + 0.05);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.22 * vol, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      o.connect(lp).connect(g).connect(ctx.destination);
      o.start(now); o.stop(now + 0.09);
    }

    function ball(now, vol) {
      if (!ballBufs || !ballBufs.length) { wood(now, vol); return; }
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = ballBufs[Math.floor(Math.random() * ballBufs.length)];
      g.gain.value = 0.6 * vol;
      s.connect(g).connect(ctx.destination);
      s.start(now);
    }

    function click() {
      if (choice === 'off' || !ensure()) return;
      const now = ctx.currentTime;
      // На разгоне сектора мелькают десятками в секунду: реже 25 мс не щёлкаем,
      // а частые щелчки делаем тише — вместо трещотки получается мягкий шелест
      const dt = now - lastClickAt;
      if (dt < 0.025) return;
      lastClickAt = now;
      const vol = Math.min(1, 0.35 + dt * 5);
      if (choice === 'soft') soft(now, vol);
      else if (choice === 'ball') ball(now, vol);
      else wood(now, vol);
    }

    function bind(root) {
      const btns = root.querySelectorAll('[data-sound]');
      const paint = () => btns.forEach(b => b.classList.toggle('active', b.dataset.sound === choice));
      btns.forEach(btn => btn.addEventListener('click', () => {
        choice = btn.dataset.sound;
        try { localStorage.setItem(KEY, choice); } catch (e) {}
        paint();
        if (choice === 'off') return;
        // Сразу даём послушать: три щелчка с замедлением
        ensure();
        [0, 140, 320].forEach(ms => setTimeout(() => { lastClickAt = 0; click(); }, ms));
      }));
      paint();
    }

    // Браузер даёт включить звук только после действия пользователя
    document.addEventListener('click', () => { if (choice !== 'off') ensure(); }, { once: true });

    return {
      click, bind, ensure,
      enabled: () => choice !== 'off',
      get choice() { return choice; },
      set choice(v) { if (CHOICES.includes(v)) choice = v; },
    };
  })();

  // Авто-выбывание: чем меньше осталось, тем дольше крутка и пауза перед ней —
  // финал тянется. Темп выбирается по числу вариантов перед круткой.
  const AUTO_PHASES = [
    { upTo: 2,        spin: 60, pause: 3 },   // финальная крутка
    { upTo: 5,        spin: 10, pause: 3 },
    { upTo: 10,       spin: 5,  pause: 2 },
    { upTo: Infinity, spin: 3,  pause: 2 },
  ];
  const autoPhase = n => AUTO_PHASES.find(p => n <= p.upTo);

  return { WHEEL_R, RIM_R, shade, builder, mount, flash, sound, AUTO_PHASES, autoPhase };
})();
