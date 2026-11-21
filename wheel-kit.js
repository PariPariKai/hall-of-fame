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
   WheelKit.finalSpin()  — последняя крутка (двое на колесе): без замедления,
                           резкий тормоз, а иногда проскальзывание к другому

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
    // Сколько блёсток — из админки (wheel_glitter), 0 — без блёсток
    function setCount(n) {
      if (reduceMotion) n = 0;
      while (parts.length < n) parts.push(spawn());
      parts.length = Math.max(0, n);
    }
    setCount(settings.wheel_glitter);
    glitters.push(setCount);

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

    if (!reduceMotion) {
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
    let choice = 'wood', own = false;   // own — выбрал сам в этом браузере
    try {
      // раньше выбор жил только в рулетке заказов
      const s = localStorage.getItem(KEY) || localStorage.getItem('picker.clickSound');
      if (CHOICES.includes(s)) { choice = s; own = true; }
    } catch (e) {}
    const painters = [];

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
      painters.push(paint);
      btns.forEach(btn => btn.addEventListener('click', () => {
        choice = btn.dataset.sound;
        own = true;
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
      // звук по умолчанию из админки — только тем, кто ещё не выбирал сам
      setDefault(v) { if (!own && CHOICES.includes(v)) { choice = v; painters.forEach(f => f()); } },
    };
  })();

  // Авто-выбывание: чем меньше осталось, тем дольше крутка и пауза перед ней.
  // Темп выбирается по числу вариантов перед круткой. Последняя крутка
  // (двое на колесе) — особая, см. finalSpin. Цифры — из админки, applySettings().
  const AUTO_PHASES = [];
  const autoPhase = n => AUTO_PHASES.find(p => n <= p.upTo);

  const random = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 4294967296; };

  // ============================================================
  // Финальная крутка (двое на колесе)
  //
  // Обычная крутка плавно замедляется, и задолго до конца видно, где
  // встанет. Здесь колесо крутится без замедления и в случайный момент
  // между 30 и 60 секундами резко тормозит: его чуть заносит дальше по
  // инерции, и стрелка-фиксатор отбрасывает на несколько градусов назад.
  //
  // Потом 5 секунд тишины, и в четверти случаев (FINAL.slipChance) фиксатор не держит:
  // колесо дрожит и проскальзывает к другому участнику. Итог всё равно
  // честный: кто окажется под стрелкой, решено заранее (target, случайно,
  // как в обычной крутке), а «проскальзывание» только меняет, на ком колесо
  // встанет сначала. Поэтому даже вставшее колесо ещё ничего не значит.
  //
  // segments — кусочки колеса; keyOf(seg) — чей кусочек; target — чей
  // кусочек в итоге окажется под стрелкой. Возвращает итоговый угол колеса.
  // ============================================================
  // speed, brakeFrom/To, holdBeforeSlip, slipChance — из админки, applySettings()
  const FINAL = {
    speed: 320,          // °/с — крейсерская скорость, без замедления
    spinUp: 1.5,         // с — разгон
    brakeFrom: 30,       // с — тормоз в случайный момент между…
    brakeTo: 59,         // …и этим (плюс до секунды, чтобы встать точно)
    brake: 0.7,          // с — сам тормоз
    overshoot: [4, 9],   // ° — занос за точку остановки
    holdBeforeSlip: 5,   // с — колесо стоит, прежде чем может проскользнуть
    slipChance: 0.25,    // шанс, что фиксатор не удержит
  };

  function finalSpin({ group, segments, keyOf, target, startRot, pointer = 90, onRotate, onTick, onStop }) {
    const mod = a => ((a % 360) + 360) % 360;
    const pick = arr => arr[Math.floor(random() * arr.length)];
    const others = segments.filter(s => keyOf(s) !== target);
    const slip = others.length > 0 && random() < FINAL.slipChance;
    const first = slip ? keyOf(others[0]) : target;

    // Встаём не точно посередине кусочка — так меньше похоже на подгонку
    const firstSlice = pick(segments.filter(s => keyOf(s) === first));
    const firstAngle = firstSlice.startAngle + 3 + random() * Math.max(0, firstSlice.angle - 6);

    const W = FINAL.speed, UP = FINAL.spinUp, D = FINAL.brake;
    const over = FINAL.overshoot[0] + random() * (FINAL.overshoot[1] - FINAL.overshoot[0]);
    const brakeDist = W * D / 3;                    // тормоз по кубической кривой проходит треть
    const T = FINAL.brakeFrom + random() * (FINAL.brakeTo - FINAL.brakeFrom);
    // Чтобы встать точно на firstAngle, тормоз чуть сдвигаем (до 360° = ~1 с)
    const nominalOver = startRot + W * UP / 2 + W * (T - UP) + brakeDist;
    const extra = mod(pointer - firstAngle + over - nominalOver);
    const tBrake = T + extra / W;
    const rotBrake = startRot + W * UP / 2 + W * (tBrake - UP);
    const rotOver = rotBrake + brakeDist;
    const rotStop = rotOver - over;

    // Щелчок, когда стрелка переходит границу кусочка — в любую сторону
    let lastP = pointer - startRot;
    function setRot(rot) {
      group.style.transform = `rotate(${rot}deg)`;
      onRotate(rot);
      const p = pointer - rot;
      const lo = Math.min(p, lastP), hi = Math.max(p, lastP);
      if (hi > lo && segments.some(s => Math.floor((hi - s.startAngle) / 360) !== Math.floor((lo - s.startAngle) / 360))) onTick();
      lastP = p;
    }
    // Время — по часам, а не по кадрам: в фоновой вкладке колесо догонит
    function animate(dur, fn) {
      return new Promise(resolve => {
        const t0 = performance.now();
        (function frame(now) {
          const u = Math.min(1, (now - t0) / 1000 / dur);
          setRot(fn(u));
          if (u < 1) requestAnimationFrame(frame); else resolve();
        })(t0);
      });
    }
    // Отдача: от base+amp назад к base с затухающим покачиванием
    const recoil = (base, amp) => u => base + amp * Math.exp(-4 * u) * Math.cos(2.6 * Math.PI * u) * (1 - u);
    const easeOut = u => 1 - Math.pow(1 - u, 3);
    const sleep = sec => new Promise(r => setTimeout(r, sec * 1000));

    return (async () => {
      group.style.transition = 'none';
      await animate(tBrake, u => {
        const t = u * tBrake;
        return t < UP ? startRot + W * t * t / (2 * UP) : startRot + W * UP / 2 + W * (t - UP);
      });
      await animate(D, u => rotBrake + brakeDist * easeOut(u));
      await animate(0.9, recoil(rotStop, over));
      setRot(rotStop);
      if (onStop) onStop();
      if (!slip) { await sleep(FINAL.holdBeforeSlip); return rotStop; }

      await sleep(FINAL.holdBeforeSlip);
      // Фиксатор не держит: дрожь, и колесо проскальзывает вперёд к ближайшему кусочку target
      await animate(0.45, u => rotStop + 1.6 * Math.sin(u * Math.PI * 9) * (1 - u));
      const dist = s => { const d = mod(pointer - s.midAngle - rotStop); return d < 4 ? d + 360 : d; };
      const dest = segments.filter(s => keyOf(s) === target).reduce((a, b) => dist(a) <= dist(b) ? a : b);
      const rotSlip = rotStop + dist(dest);
      const slipOver = 2.5;
      await animate(0.75, u => rotStop + (rotSlip + slipOver - rotStop) * easeOut(u));
      await animate(0.6, recoil(rotSlip, slipOver));
      setRot(rotSlip);
      if (onStop) onStop();
      return rotSlip;
    })();
  }

  // ============================================================
  // Настройки рулеток — вкладка «Настройки» в админке, data/config.json.
  // Пустое поле = значение по умолчанию отсюда (его же показывает админка).
  // Файл грузится при открытии страницы; пока не пришёл — работают умолчания.
  // ============================================================
  const DEFAULTS = {
    // авто-выбывание: пока вариантов больше mid_from — many, до mid_from — mid, до late_from — late
    wheel_auto_spin_many: 3,  wheel_auto_pause_many: 2,
    wheel_auto_mid_from: 10,  wheel_auto_spin_mid: 5,   wheel_auto_pause_mid: 2,
    wheel_auto_late_from: 5,  wheel_auto_spin_late: 10, wheel_auto_pause_late: 3,
    wheel_auto_pause_final: 3,
    // финал: surprise — без замедления и с тормозом (finalSpin), classic — обычная крутка
    wheel_final_mode: 'surprise', wheel_final_classic_spin: 60,
    wheel_final_brake_from: 30, wheel_final_brake_to: 60,
    wheel_final_speed: 0.9,           // оборотов в секунду
    wheel_final_slip_chance: 25,      // %
    wheel_final_slip_after: 5,        // с
    wheel_final_manual: 'FALSE',      // такой же финал и в ручном выбывании
    // вид и звук
    wheel_glitter: 340,
    wheel_sound_default: 'wood',
    // рулетка заказов: что включено при открытии и слово для сбора из чата
    picker_sources: 'anime,movies,series',
    picker_statuses: 'pending',
    picker_join_words: 'я',
  };
  const settings = { ...DEFAULTS };
  const glitters = [];

  function applySettings(c) {
    const num = (k, min, max) => {
      const v = parseFloat(String(c[k] ?? '').replace(',', '.'));
      return isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULTS[k];
    };
    const str = k => String(c[k] ?? '').trim() || DEFAULTS[k];
    for (const k of Object.keys(DEFAULTS)) settings[k] = typeof DEFAULTS[k] === 'number' ? num(k, 0, 100000) : str(k);

    const midFrom = Math.max(4, Math.round(num('wheel_auto_mid_from', 4, 500)));
    const lateFrom = Math.min(midFrom - 1, Math.max(3, Math.round(num('wheel_auto_late_from', 3, 500))));
    const classic = settings.wheel_final_mode === 'classic';
    AUTO_PHASES.length = 0;
    AUTO_PHASES.push(
      classic
        ? { upTo: 2, spin: num('wheel_final_classic_spin', 1, 300), pause: num('wheel_auto_pause_final', 0, 60) }
        : { upTo: 2, final: true, pause: num('wheel_auto_pause_final', 0, 60) },
      { upTo: lateFrom, spin: num('wheel_auto_spin_late', 1, 300), pause: num('wheel_auto_pause_late', 0, 60) },
      { upTo: midFrom,  spin: num('wheel_auto_spin_mid', 1, 300),  pause: num('wheel_auto_pause_mid', 0, 60) },
      { upTo: Infinity, spin: num('wheel_auto_spin_many', 1, 300), pause: num('wheel_auto_pause_many', 0, 60) },
    );

    const from = num('wheel_final_brake_from', 3, 600);
    FINAL.brakeFrom = from;
    FINAL.brakeTo = Math.max(from, num('wheel_final_brake_to', 3, 600) - 1);   // до секунды добирает точная остановка
    FINAL.speed = num('wheel_final_speed', 0.2, 3) * 360;
    FINAL.slipChance = num('wheel_final_slip_chance', 0, 100) / 100;
    FINAL.holdBeforeSlip = num('wheel_final_slip_after', 0, 60);

    settings.wheel_glitter = Math.round(num('wheel_glitter', 0, 1500));
    glitters.forEach(set => set(settings.wheel_glitter));
    sound.setDefault(settings.wheel_sound_default);
  }
  applySettings({});

  // Страница может дождаться настроек: await WheelKit.ready
  const ready = hof.config()
    .catch(() => ({}))
    .then(c => { applySettings(c); return settings; });

  const truthy = v => /^(true|1|да|yes)$/i.test(String(v).trim());
  // Особый финал и в ручном выбывании, если так настроено в админке
  const finalInManual = () => settings.wheel_final_mode !== 'classic' && truthy(settings.wheel_final_manual);
  const list = k => String(settings[k]).split(',').map(x => x.trim()).filter(Boolean);

  return { WHEEL_R, RIM_R, shade, builder, mount, flash, sound, AUTO_PHASES, autoPhase, finalSpin, FINAL, random,
    DEFAULTS, settings, ready, applySettings, finalInManual, list };
})();
