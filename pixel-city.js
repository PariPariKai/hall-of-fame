// Пиксельный ночной город — живой фон заставки (screen.html, фон «pixel»).
// Рисуется на холсте 384×216 и растягивается на весь экран без сглаживания (1 пиксель = 5 точек на 1920×1080).
// Город каждый раз новый: дома, окна, машины, футбол, самолёты и падающие звёзды — случайные.
// PixelCity.start(canvas) → { stop() }
(function () {
'use strict';
const W = 384, H = 216;
const FAR_BASE = 162, MID_BASE = 178, ROAD_Y = 180, LEDGE_Y = 199;
const FIELD = { x0: 238, x1: 318, top: 166, bottom: 176, inset: 6 }; // футбольное поле — трапеция между домами

const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;

const SKY = ['#060918', '#080c20', '#0b1028', '#0f1431', '#15183a', '#1d1c44', '#28204d', '#352656', '#44295c'];
const WARM = ['#ffd27a', '#ffc35e', '#ffe09a', '#f7b85a'];
const WARM_DIM = ['#b8924e', '#a88544', '#c49c58'];
const COOL = ['#9fd8ff', '#b8e4ff'];
const COOL_DIM = ['#6a8cb4', '#5f7fa8'];
// жёлтые — только такси
const CAR_COLORS = ['#d94f5c', '#4a8fd9', '#d9d9e0', '#454a66', '#7a5ad9', '#4ac0a0', '#c0c4d8', '#e07a3c', '#2f6fb0', '#8a2f3c',
  '#2d5e3e', '#c9b48a', '#5b2a3c', '#2a7f86', '#9aa0b0', '#eeeef2', '#3a3d4a', '#b0563a', '#6d8f3a', '#c86a9a', '#1f3a5f'];
// какой транспорт выезжает: [вид, вес]
const KINDS = [['sedan', 3], ['hatch', 2], ['suv', 2], ['coupe', 1.2], ['pickup', 1], ['van', 1], ['retro', 0.8], ['moto', 1.6], ['bus', 0.6]];
function pickKind() {
  let r = Math.random() * KINDS.reduce((a, k) => a + k[1], 0);
  for (const [k, w] of KINDS) if ((r -= w) < 0) return k;
  return 'sedan';
}

function layer() { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
const px = (ctx, x, y, col, w, h) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); };

// ===================== неподвижное: небо, дома, дорога, крыша =====================
function buildSky() {
  const [c, x] = layer();
  const band = 150 / SKY.length;
  for (let y = 0; y < H; y++) {
    const i = Math.min(SKY.length - 1, Math.floor(y / band));
    x.fillStyle = SKY[i];
    x.fillRect(0, y, W, 1);
    // стык полос — шахматкой, как в старых играх
    const into = y - i * band;
    if (i < SKY.length - 1 && into > band - 3) for (let xx = (y % 2); xx < W; xx += 2) px(x, xx, y, SKY[i + 1]);
  }
  // луна с ореолом
  const mx = RI(250, 340), my = RI(26, 44);
  for (let yy = -13; yy <= 13; yy++) for (let xx = -13; xx <= 13; xx++) {
    const d = Math.hypot(xx, yy);
    if (d > 8.5 && d < 13 && (xx + yy) % 2 === 0) px(x, mx + xx, my + yy, `rgba(244,236,208,${(0.1 * (13 - d) / 4.5).toFixed(3)})`);
    else if (d <= 8.5) px(x, mx + xx, my + yy, d > 7.5 ? '#e6dbb8' : '#f4ecd0');
  }
  [[-3, -2, 2], [2, 1, 3], [-1, 4, 1], [4, -4, 1]].forEach(([dx, dy, s]) => px(x, mx + dx, my + dy, '#d9cda6', s, s));
  return { c, moon: { x: mx, y: my } };
}

function buildFar() {
  const [c, x] = layer();
  const windows = [], antennas = [];
  let bx = RI(-6, 0);
  while (bx < W) {
    const w = RI(8, 20), h = chance(0.14) ? RI(78, 104) : RI(26, 70), top = FAR_BASE - h;
    const col = pick(['#111630', '#131934', '#161b39']);
    px(x, bx, top, col, w, h);
    if (chance(0.25) && w > 9) { const sw = w - RI(4, 6), sh = RI(3, 8); px(x, bx + Math.floor((w - sw) / 2), top - sh, col, sw, sh); }
    if (h > 55 && chance(0.55)) {
      const ax = bx + RI(2, w - 3), ah = RI(5, 12);
      px(x, ax, top - ah, '#1c2244', 1, ah);
      antennas.push({ x: ax, y: top - ah - 1, ph: R(0, 2) });
    }
    const pattern = RI(0, 2); // обычные окна, ленты, редкие
    for (let wy = top + 3; wy < FAR_BASE - 3; wy += 3) for (let wx = bx + 2; wx < bx + w - 2; wx += 2) {
      if (pattern === 2 && chance(0.6)) continue;
      const cool = chance(0.22);
      windows.push({ x: wx, y: wy, w: pattern === 1 ? 2 : 1, on: chance(0.3), col: pick(cool ? COOL_DIM : WARM_DIM) });
    }
    bx += w + RI(0, 2);
  }
  return { c, windows, antennas };
}

function buildMid() {
  const [c, x] = layer();
  const windows = [];
  let neon = null, bx = RI(-10, 0);
  while (bx < W) {
    if (bx + 16 > FIELD.x0 - 4 && bx < FIELD.x1 + 4) { bx = FIELD.x1 + 5; continue; } // место под поле
    const w = Math.min(RI(16, 38), bx < FIELD.x0 ? Math.max(12, FIELD.x0 - 4 - bx) : 99), h = RI(16, 50), top = MID_BASE - h;
    const col = pick(['#191f42', '#1d244e', '#212956']);
    px(x, bx, top, col, w, h);
    px(x, bx, top, '#2a3363', w, 1); // край крыши
    if (chance(0.3) && w > 14) { // бак с водой
      const tx = bx + RI(2, w - 8);
      px(x, tx, top - 6, '#2a3160', 6, 4); px(x, tx + 1, top - 2, '#2a3160', 1, 2); px(x, tx + 4, top - 2, '#2a3160', 1, 2);
    } else if (chance(0.35)) px(x, bx + RI(1, w - 6), top - 2, '#262d5a', 4, 2); // кондиционер
    const sign = !neon && w >= 24 && h >= 30 && chance(0.6);
    if (sign) neon = { x: bx + 3, y: top + 4, w: w - 6, h: 6, on: true, next: R(2, 6) };
    for (let wy = top + (sign ? 13 : 4); wy < MID_BASE - 4; wy += 5) for (let wx = bx + 2; wx < bx + w - 3; wx += 4) {
      const cool = chance(0.18);
      windows.push({ x: wx, y: wy, w: 2, h: 2, on: chance(0.42), col: pick(cool ? COOL : WARM), tv: cool && chance(0.35) });
    }
    bx += w + RI(1, 4);
  }
  return { c, windows, neon };
}

const fieldEdge = v => ({ l: FIELD.x0 + FIELD.inset * (1 - v), r: FIELD.x1 - FIELD.inset * (1 - v) }); // v: 0 — дальний край, 1 — ближний
const toScreen = (u, v) => { const e = fieldEdge(v); return { x: e.l + (e.r - e.l) * u, y: FIELD.top + (FIELD.bottom - FIELD.top) * v }; };

function buildGround() {
  const [c, x] = layer();
  // поле: подсветка прожекторов, газон полосами, разметка, ворота
  for (let y = FIELD.top - 18; y < FIELD.top; y++) {
    const a = 0.07 * (1 - (FIELD.top - y) / 18);
    px(x, FIELD.x0 - 4, y, `rgba(255,250,215,${a.toFixed(3)})`, FIELD.x1 - FIELD.x0 + 8, 1);
  }
  for (let y = FIELD.top; y <= FIELD.bottom; y++) {
    const v = (y - FIELD.top) / (FIELD.bottom - FIELD.top), e = fieldEdge(v);
    for (let xx = Math.round(e.l); xx <= Math.round(e.r); xx++) px(x, xx, y, Math.floor((xx - FIELD.x0) / 6) % 2 ? '#2f8a46' : '#29793d');
    px(x, Math.round(e.l), y, '#cfe8cf'); px(x, Math.round(e.r), y, '#cfe8cf');
    px(x, Math.round((e.l + e.r) / 2), y, 'rgba(207,232,207,.7)');
  }
  const e0 = fieldEdge(0), e1 = fieldEdge(1);
  px(x, Math.round(e0.l), FIELD.top, '#cfe8cf', Math.round(e0.r - e0.l) + 1, 1);
  px(x, Math.round(e1.l), FIELD.bottom, '#cfe8cf', Math.round(e1.r - e1.l) + 1, 1);
  [0, 1].forEach(u => { const a = toScreen(u, 0.38), b = toScreen(u, 0.62); px(x, a.x + (u ? 1 : -1), a.y - 2, '#ffffff', 1, Math.round(b.y - a.y) + 2); });
  px(x, FIELD.x0 - 2, FIELD.bottom + 1, '#141830', FIELD.x1 - FIELD.x0 + 4, MID_BASE - FIELD.bottom - 1);
  // прожекторы
  [[FIELD.x0 - 2, 146], [FIELD.x1 + 2, 146], [FIELD.x0 + 26, 150], [FIELD.x1 - 26, 150]].forEach(([lx, ly], i) => {
    if (i > 1) return; // дальние — только свет
    px(x, lx, ly, '#3a3f66', 1, FIELD.bottom - ly + 1);
    px(x, lx - 1, ly - 1, '#fffbe0', 3, 2);
    for (let k = 0; k < 18; k++) px(x, lx - 1 - k * (i ? 1.6 : -1.6) - (i ? 0 : 0), ly + 2 + k, 'rgba(255,250,210,.05)', 4 + k, 1);
  });

  // тротуар, дорога, разметка
  px(x, 0, MID_BASE, '#2c3052', W, 2);
  px(x, 0, ROAD_Y, '#121528', W, 17);
  for (let xx = 2; xx < W; xx += 12) px(x, xx, 188, '#3d3c55', 5, 1);
  px(x, 0, 197, '#2c3052', W, 2);
  // фонари и пятна света под ними
  for (let lx = RI(8, 24); lx < W; lx += RI(40, 56)) {
    px(x, lx, 165, '#3a3f66', 1, 13); px(x, lx, 165, '#3a3f66', 3, 1); px(x, lx + 2, 166, '#ffe7a8', 2, 1);
    for (let k = 0; k < 11; k++) { const ww = 3 + k; px(x, lx + 3 - ww / 2, 167 + k, 'rgba(255,215,140,.06)', ww, 1); } // конус до тротуара
    for (let k = 0; k < 3; k++) { const ww = 14 - k * 4; px(x, lx + 3 - ww / 2, MID_BASE + k, `rgba(255,190,90,${(0.13 - k * 0.04).toFixed(3)})`, ww, 1); } // пятно у столба
  }
  return { c };
}

function buildLedge() {
  const [c, x] = layer();
  px(x, 0, LEDGE_Y, '#2f3558', W, 1);
  px(x, 0, LEDGE_Y + 1, '#1d2140', W, 2);
  px(x, 0, LEDGE_Y + 3, '#0b0e1c', W, H - LEDGE_Y - 3);
  for (let y = LEDGE_Y + 5; y < H; y += 4) for (let xx = (y / 4) % 2 ? 0 : 6; xx < W; xx += 12) px(x, xx, y, '#0f1326', 11, 1);
  // кружка чая
  const mx = 52, my = LEDGE_Y - 7;
  px(x, mx, my, '#fff4dc', 7, 1); px(x, mx + 1, my, '#6b3d1f', 5, 1);
  px(x, mx, my + 1, '#e9dcc4', 7, 6); px(x, mx + 5, my + 1, '#c4b394', 2, 6);
  px(x, mx + 7, my + 2, '#e9dcc4', 2, 1); px(x, mx + 8, my + 3, '#e9dcc4', 1, 2); px(x, mx + 7, my + 5, '#e9dcc4', 2, 1);
  px(x, mx + 2, my + 3, '#d0605a', 2, 2); // сердечко на кружке
  return { c, mug: { x: mx + 3, y: my - 1 } };
}

// Кот со спины смотрит на город. Город светит ему в спину-контур: O — подсвеченный край, X — шерсть.
// Силуэт «грушей»: острые уши, круглая голова шире шеи, плечи, широкие задние лапы.
const CAT = [
  '...O.....O...',
  '..OXO...OXO..',
  '..OXXOOOXXO..',
  '..OXXXXXXXO..',
  '..OXXXXXXXO..',
  '...OXXXXXO...',
  '....XXXXX....',
  '...OXXXXXO...',
  '..OXXXXXXXO..',
  '..OXXXXXXXO..',
  '.OXXXXXXXXXO.',
  '.OXXXXXXXXXO.',
  'OXXXXXXXXXXXO',
  'OXXXXXXXXXXXO',
  '.XXXXXXXXXXX.',
];
// хвост лежит на парапете и кончиком загибается вверх; кадры — покачивание кончика
const TAILS = [
  [[13, 14], [14, 14], [15, 14], [16, 13], [16, 12], [17, 11]],
  [[13, 14], [14, 14], [15, 14], [16, 14], [17, 13], [17, 12]],
  [[13, 14], [14, 14], [15, 13], [15, 12], [16, 11], [16, 10]],
];
// Машины сбоку, мордой вправо (влево — зеркально). Читаются по крыше, окнам, аркам и двум круглым колёсам.
// R — светлый верх кузова, B — кузов, D — низ кузова в тени, G — стекло, W — окно автобуса со светом,
// H — фара, T — стоп-сигнал, K — шина, h — диск. Нижняя строка — земля.
const SPRITES = {
  sedan: [
    '......RRRRRR......',
    '.....BGGGBGGGB....',
    '.RRRRBGGGBGGGGRRR.',
    'TBBBBBBBBBBBBBBBBH',
    'DDDKKKDDDDDDDKKKDD',
    '...KhK.......KhK..',
    '....K.........K...',
  ],
  hatch: [
    '.....RRRRR.....',
    '....BGGBGGGB...',
    '..RRBGGBGGGGRR.',
    'TBBBBBBBBBBBBBH',
    'DDKKKDDDDDKKKDD',
    '..KhK.....KhK..',
    '...K.......K...',
  ],
  suv: [
    '...RRRRRRRRRR.....',
    '..BGGGBGGGBGGGB...',
    '..BGGGBGGGBGGGGB..',
    '.RBBBBBBBBBBBBBRRR',
    'TBBBBBBBBBBBBBBBBH',
    'DDDKKKDDDDDDDKKKDD',
    '...KhK.......KhK..',
    '....K.........K...',
  ],
  coupe: [
    '......RRRR.......',
    '.....BGGGGGB.....',
    '.RRRBBBBBBBBRRRR.',
    'TBBBBBBBBBBBBBBBH',
    'DDKKKDDDDDDDKKKDD',
    '..KhK.......KhK..',
    '...K.........K...',
  ],
  pickup: [
    '..........RRRR.....',
    '.........BGGGGB....',
    'RRRRRRRRRBGGGGBRRR.',
    'TBBBBBBBBBBBBBBBBBH',
    'DDKKKDDDDDDDDDKKKDD',
    '..KhK.........KhK..',
    '...K...........K...',
  ],
  van: [
    '.RRRRRRRRRRRRR....',
    'BBGGGBGGGBGGGBGB..',
    'BBGGGBGGGBGGGBGGB.',
    'BBBBBBBBBBBBBBBBRR',
    'TBBBBBBBBBBBBBBBBH',
    'DDDKKKDDDDDDDKKKDD',
    '...KhK.......KhK..',
    '....K.........K...',
  ],
  retro: [
    '....RRRRR.....',
    '...RGGBGGGR...',
    '.RRBBBBBBBBRR.',
    'TBBBBBBBBBBBBH',
    'DKKKDDDDDDKKKD',
    '.KhK......KhK.',
    '..K........K..',
  ],
  // мотоцикл: E — шлем, P — куртка мотоциклиста
  moto: [
    '....EE...',
    '...PPP...',
    '..BPPBBB.',
    'TBBBBBBBH',
    '.KhK.KhK.',
    '..K...K..',
  ],
  // чёрная «бэха»: низкая, длинный капот, раз в пару минут, торопится и моргает дальним
  bmw: [
    '.......RRRRR.......',
    '......BGGGBGGGB....',
    '.RRRRBGGGGBGGGGRRR.',
    'TBBBBBBBBBBBBBBBBBH',
    'DDDKKKDDDDDDDDKKKDD',
    '...KhK........KhK..',
    '....K..........K...',
  ],
  bus: [
    '.RRRRRRRRRRRRRRRRRRRRRRRR.',
    'BBBBBBBBBBBBBBBBBBBBBBBBBB',
    'BWWBWWBWWBWWBWWBWWBWWBGGGB',
    'BWWBWWBWWBWWBWWBWWBWWBGGGB',
    'RRRRRRRRRRRRRRRRRRRRRRRRRR',
    'TBBBBBBBBBBBBBBBBBBBBBBBBH',
    'DDDKKKDDDDDDDDDDDDDKKKDDDD',
    '...KhK.............KhK....',
    '....K...............K.....',
  ],
};
const LANE_GROUND = [186, 195]; // строка земли: дальняя полоса (едут вправо), ближняя (влево)
const GAP = 4;                  // меньше этого машины друг к другу не подъезжают
function shade(hex, k) { // k > 0 — светлее, k < 0 — темнее
  const n = parseInt(hex.slice(1), 16), ch = s => { const v = (n >> s) & 255; return Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)); };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ===================== сцена =====================
function build() {
  const s = { t: 0, sky: buildSky(), far: buildFar(), mid: buildMid(), ground: buildGround(), ledge: buildLedge() };
  const moon = s.sky.moon;
  s.stars = Array.from({ length: 130 }, () => ({ x: RI(0, W - 1), y: RI(0, 118), ph: R(0, 6.3), sp: R(0.6, 2.2), big: chance(0.08) }))
    .filter(st => Math.hypot(st.x - moon.x, st.y - moon.y) > 15);
  s.clouds = Array.from({ length: 4 }, () => {
    const w = RI(30, 64);
    return { x: R(-w, W), y: RI(14, 92), w, sp: R(0.8, 2.4), rows: [[RI(4, 10), w - RI(14, 22)], [0, w], [RI(2, 6), w - RI(6, 12)]] };
  });
  s.cars = [[], []];
  s.nextCar = [R(0, 2), R(0, 2)];
  s.steam = [];
  s.nextSteam = 0;
  s.plane = null; s.nextPlane = R(15, 40);
  s.shoot = null; s.nextShoot = R(6, 20);
  s.nextToggle = 0;
  s.nextBmw = R(40, 90); s.bmwDue = false;
  s.cat = { x: 70, tail: 0, nextTail: 1, ear: false, nextEar: R(4, 10), look: 0, nextLook: R(3, 8) };
  // футбол: четверо на четверо
  s.players = Array.from({ length: 8 }, (_, i) => {
    const team = i < 4 ? 0 : 1, home = { u: team ? R(0.55, 0.9) : R(0.1, 0.45), v: R(0.15, 0.85) };
    return { team, u: home.u, v: home.v, home, sp: R(0.09, 0.14) };
  });
  s.ball = { u: 0.5, v: 0.5, du: 0, dv: 0, hold: 0 };
  return s;
}

function update(s, dt) {
  s.t += dt;
  // окна: кто-то включает и выключает свет
  s.nextToggle -= dt;
  if (s.nextToggle <= 0) {
    s.nextToggle = R(0.15, 0.6);
    const w = chance(0.5) ? pick(s.far.windows) : pick(s.mid.windows);
    if (w) w.on = !w.on;
  }
  // неон моргает
  const n = s.mid.neon;
  if (n) { n.next -= dt; if (n.next <= 0) { n.on = !n.on; n.next = n.on ? R(2, 9) : R(0.05, 0.35); } }
  // облака
  s.clouds.forEach(c => { c.x += c.sp * dt; if (c.x > W) c.x = -c.w; });
  // самолёт
  s.nextPlane -= dt;
  if (!s.plane && s.nextPlane <= 0) { const dir = chance(0.5) ? 1 : -1; s.plane = { x: dir > 0 ? -6 : W + 6, y: RI(18, 70), dir, sp: R(7, 11) }; }
  if (s.plane) { s.plane.x += s.plane.dir * s.plane.sp * dt; if (s.plane.x < -10 || s.plane.x > W + 10) { s.plane = null; s.nextPlane = R(40, 90); } }
  // падающая звезда
  s.nextShoot -= dt;
  if (!s.shoot && s.nextShoot <= 0) s.shoot = { x: R(40, W - 40), y: R(5, 50), dx: chance(0.5) ? -1 : 1, life: 0 };
  if (s.shoot) { s.shoot.life += dt; if (s.shoot.life > 0.7) { s.shoot = null; s.nextShoot = R(15, 45); } }
  // машины: верхняя полоса — вправо, нижняя — влево
  if (!s.bmwDue) { s.nextBmw -= dt; if (s.nextBmw <= 0) s.bmwDue = true; }
  // Список полосы отсортирован: первые едут впереди. Догнал медленного — тормозит и держит дистанцию.
  // Мотоцикл вместо этого смещается к разделительной полосе (off), обгоняет и возвращается, когда есть место.
  [0, 1].forEach(lane => {
    const dir = lane ? -1 : 1, list = s.cars[lane].sort((a, b) => dir > 0 ? b.x - a.x : a.x - b.x);
    const gapTo = (car, ahead) => dir > 0 ? ahead.x - (car.x + car.len) : car.x - (ahead.x + ahead.len);
    const isOut = c => c.kind === 'moto' && Math.abs(c.off) >= 2; // мотоцикл сбоку — ни на кого не наезжает и никому не мешает
    s.nextCar[lane] -= dt;
    // бэха выезжает в полосу, где сейчас больше машин, — чтобы было кого догнать
    const bmwHere = s.bmwDue && list.length >= s.cars[1 - lane].length;
    if (s.nextCar[lane] <= 0 || bmwHere) {
      const kind = bmwHere ? 'bmw' : pickKind();
      const taxi = kind === 'sedan' && chance(0.18), spr = SPRITES[kind], len = spr[0].length;
      const car = { kind, spr, len, taxi, off: 0, x: dir > 0 ? -len - 2 : W + 2,
        col: kind === 'bmw' ? '#16171d' : kind === 'bus' ? pick(['#3f9a66', '#c8505a', '#3a78c0']) : taxi ? '#f2c230' : pick(CAR_COLORS),
        helmet: pick(['#f2f2f2', '#d94f5c', '#f2c230', '#4a8fd9', '#16171d']),
        sp: kind === 'bmw' ? R(44, 52) : kind === 'moto' ? R(32, 42) : kind === 'bus' ? R(10, 13) : kind === 'coupe' ? R(22, 32) : R(14, 24) };
      const last = list[list.length - 1];
      if (!last || gapTo(car, last) > 12) {
        car.v = last && !isOut(last) ? Math.min(car.sp, last.v) : car.sp;
        list.push(car);
        if (kind === 'bmw') { s.bmwDue = false; s.nextBmw = R(100, 160); }
      }
      if (!bmwHere) s.nextCar[lane] = R(5, 17); // ночь: машин немного
    }
    list.forEach((car, i) => {
      let ahead = null; // ближайший впереди, кто реально мешает (обгоняющие мотоциклы — сбоку)
      if (!isOut(car)) for (let j = i - 1; j >= 0; j--) if (!isOut(list[j])) { ahead = list[j]; break; }
      if (car.kind === 'moto') {
        if (!car.passing && ahead && gapTo(car, ahead) < 16 && ahead.v < car.sp * 0.85) car.passing = true;
        if (car.passing && isOut(car)) {
          car.outT = (car.outT || 0) + dt;
          // вернуться можно, когда рядом в полосе никого: все машины целиком позади или далеко впереди
          const clear = list.every(o => o === car || isOut(o) || (dir > 0
            ? o.x + o.len < car.x - 4 || o.x > car.x + car.len + 10
            : o.x > car.x + car.len + 4 || o.x + o.len < car.x - 10));
          if (clear && car.outT > 0.8) { car.passing = false; car.outT = 0; }
        }
        const target = car.passing ? (lane ? -3 : 3) : 0; // к разделительной: дальней полосе — вниз, ближней — вверх
        car.off += Math.sign(target - car.off) * Math.min(Math.abs(target - car.off), 7 * dt);
      }
      let want = car.sp;
      if (ahead) {
        const gap = gapTo(car, ahead);
        if (gap < 22) want = Math.min(want, Math.max(0, ahead.v + (gap - GAP - 4) * 1.2));
      }
      // бэха упёрлась в медленного — моргает дальним: два коротких, пауза
      const stuck = car.kind === 'bmw' && ahead && gapTo(car, ahead) < 30 && ahead.v < car.sp * 0.8;
      car.flashT = stuck ? (car.flashT || 0) + dt : 0;
      const ph = car.flashT % 1.1;
      car.flash = stuck && (ph < 0.12 || (ph > 0.24 && ph < 0.36));
      car.v += Math.max(-40 * dt, Math.min(10 * dt, want - car.v)); // разгон плавный, тормоз резче
      car.x += dir * car.v * dt;
      if (ahead && gapTo(car, ahead) < GAP) { // страховка: вплотную, но не насквозь
        car.x = dir > 0 ? ahead.x - GAP - car.len : ahead.x + ahead.len + GAP;
        car.v = Math.min(car.v, ahead.v);
      }
    });
    s.cars[lane] = list.filter(car => car.x > -40 && car.x < W + 40);
  });
  // пар от чая
  s.nextSteam -= dt;
  if (s.nextSteam <= 0) { s.nextSteam = R(0.18, 0.4); s.steam.push({ x: s.ledge.mug.x + R(-1.5, 1.5), y: s.ledge.mug.y, ph: R(0, 6), life: 0, max: R(2.2, 3.4) }); }
  s.steam.forEach(p => { p.life += dt; p.y -= R(4, 6) * dt; });
  s.steam = s.steam.filter(p => p.life < p.max);
  // кот: хвост и ухо
  const cat = s.cat;
  cat.nextTail -= dt;
  if (cat.nextTail <= 0) { cat.tail = (cat.tail + 1) % TAILS.length; cat.nextTail = chance(0.2) ? R(2, 5) : R(0.4, 0.9); }
  cat.nextEar -= dt;
  if (cat.nextEar <= 0) { cat.ear = !cat.ear; cat.nextEar = cat.ear ? 0.25 : R(4, 12); }
  cat.nextLook -= dt; // иногда оглядывается на кружку или на машины
  if (cat.nextLook <= 0) { cat.look = cat.look ? 0 : (chance(0.5) ? 1 : -1); cat.nextLook = cat.look ? R(1.5, 3.5) : R(7, 16); }
  // футбол
  const b = s.ball;
  if (b.hold > 0) { b.hold -= dt; if (b.hold <= 0) { b.u = 0.5; b.v = 0.5; b.du = b.dv = 0; } }
  else {
    b.u += b.du * dt; b.v += b.dv * dt;
    b.du *= Math.pow(0.35, dt); b.dv *= Math.pow(0.35, dt);
    if (b.v < 0 || b.v > 1) { b.v = Math.max(0, Math.min(1, b.v)); b.dv = -b.dv; }
    if (b.u < 0 || b.u > 1) {
      if (b.v > 0.38 && b.v < 0.62) { b.hold = 1.2; b.du = b.dv = 0; b.u = Math.max(0, Math.min(1, b.u)); s.goal = 1.2; } // гол
      else { b.u = Math.max(0, Math.min(1, b.u)); b.du = -b.du; }
    }
  }
  if (s.goal) s.goal = Math.max(0, s.goal - dt);
  [0, 1].forEach(team => {
    const mine = s.players.filter(p => p.team === team);
    const near = mine.slice().sort((p, q) => Math.hypot(p.u - b.u, p.v - b.v) - Math.hypot(q.u - b.u, q.v - b.v)).slice(0, 2);
    mine.forEach(p => {
      const chase = near.includes(p) && b.hold <= 0;
      const tu = chase ? b.u : p.home.u + Math.sin(s.t * 0.7 + p.home.v * 9) * 0.04 + (b.u - 0.5) * 0.25;
      const tv = chase ? b.v : p.home.v + Math.cos(s.t * 0.6 + p.home.u * 7) * 0.05;
      const d = Math.hypot(tu - p.u, tv - p.v);
      if (d > 0.005) { const st = Math.min(d, p.sp * dt); p.u += (tu - p.u) / d * st; p.v += (tv - p.v) / d * st * 1.6; }
      if (chase && d < 0.025 && Math.hypot(b.du, b.dv) < 0.08) { // удар: к чужим воротам, с разбросом
        const aim = { u: team ? R(-0.05, 0.3) : R(0.7, 1.05), v: R(0.2, 0.8) };
        const k = R(0.35, 0.7), dd = Math.hypot(aim.u - b.u, aim.v - b.v) || 1;
        b.du = (aim.u - b.u) / dd * k; b.dv = (aim.v - b.v) / dd * k * 0.8;
      }
    });
  });
}

function draw(ctx, s) {
  const t = s.t;
  ctx.drawImage(s.sky.c, 0, 0);
  // звёзды мерцают
  s.stars.forEach(st => {
    const v = Math.sin(t * st.sp + st.ph);
    if (v < -0.5) return;
    const col = v > 0.55 ? '#ffffff' : v > 0 ? '#b9bce6' : '#5c6098';
    px(ctx, st.x, st.y, col);
    if (st.big && v > 0.75) { px(ctx, st.x - 1, st.y, '#7f84c0'); px(ctx, st.x + 1, st.y, '#7f84c0'); px(ctx, st.x, st.y - 1, '#7f84c0'); px(ctx, st.x, st.y + 1, '#7f84c0'); }
  });
  // падающая звезда
  if (s.shoot) {
    const sh = s.shoot, k = sh.life / 0.7;
    for (let i = 0; i < 8; i++) px(ctx, sh.x + sh.dx * (k * 60 - i), sh.y + k * 30 - i * 0.5, `rgba(255,255,255,${((1 - i / 8) * (1 - k)).toFixed(2)})`);
  }
  // облака
  s.clouds.forEach(c => c.rows.forEach(([a, b], i) => px(ctx, c.x + a, c.y + i, i === 0 ? 'rgba(120,100,170,.22)' : 'rgba(55,48,100,.35)', b - a, 1)));
  // самолёт с мигалками
  if (s.plane) {
    const p = s.plane;
    px(ctx, p.x - 2, p.y, '#4a5078', 5, 1);
    if (Math.floor(t * 1.5) % 2) px(ctx, p.x + (p.dir > 0 ? 3 : -3), p.y, '#ff4d4d');
    if (Math.floor(t * 2.2 + 0.5) % 3 === 0) px(ctx, p.x, p.y - 1, '#ffffff');
  }
  // дальние дома
  ctx.drawImage(s.far.c, 0, 0);
  s.far.windows.forEach(w => { if (w.on) px(ctx, w.x, w.y, w.col, w.w, 1); });
  s.far.antennas.forEach(a => { if ((t + a.ph) % 2 < 0.45) { px(ctx, a.x, a.y, '#ff4d4d'); px(ctx, a.x - 1, a.y, 'rgba(255,77,77,.35)'); px(ctx, a.x + 1, a.y, 'rgba(255,77,77,.35)'); } });
  // поле, дорога, фонари
  ctx.drawImage(s.ground.c, 0, 0);
  if (s.goal) px(ctx, FIELD.x0 - 4, FIELD.top - 18, `rgba(255,250,215,${(0.12 * s.goal / 1.2).toFixed(3)})`, FIELD.x1 - FIELD.x0 + 8, 30);
  s.players.slice().sort((p, q) => p.v - q.v).forEach(p => {
    const q = toScreen(p.u, p.v);
    px(ctx, q.x, q.y - 2, '#f1d3b5'); px(ctx, q.x, q.y - 1, p.team ? '#8fd3ff' : '#ff7a7a');
  });
  if (s.ball.hold <= 0 || Math.floor(t * 6) % 2) { const q = toScreen(s.ball.u, s.ball.v); px(ctx, q.x, q.y, '#ffffff'); }
  // ближние дома
  ctx.drawImage(s.mid.c, 0, 0);
  s.mid.windows.forEach(w => {
    if (!w.on) return;
    const col = w.tv ? (Math.sin(t * 13 + w.x) > 0.2 ? '#9fd8ff' : '#5f86c8') : w.col;
    px(ctx, w.x, w.y, col, w.w, w.h);
  });
  const n = s.mid.neon;
  if (n) {
    const pink = n.on ? '#ff6fb5' : '#4a2a48', cyan = n.on ? '#5ff0e0' : '#244a52';
    px(ctx, n.x, n.y, pink, n.w, 1); px(ctx, n.x, n.y + n.h - 1, pink, n.w, 1); px(ctx, n.x, n.y, pink, 1, n.h); px(ctx, n.x + n.w - 1, n.y, pink, 1, n.h);
    for (let xx = n.x + 2; xx < n.x + n.w - 2; xx += 3) px(ctx, xx, n.y + 2, cyan, 2, 2);
    if (n.on) px(ctx, n.x - 1, n.y + n.h, 'rgba(255,111,181,.12)', n.w + 2, 3);
  }
  // машины
  // дальние рисуем раньше ближних: обгоняющий мотоцикл правильно перекрывает и перекрывается
  s.cars.flatMap((list, lane) => list.map(car => ({ car, lane, y: LANE_GROUND[lane] + Math.round(car.off || 0) })))
    .sort((a, b) => a.y - b.y)
    .forEach(({ car, lane, y }) => drawCar(ctx, car, y, lane ? -1 : 1, t));
  // крыша, кружка, пар, кот
  ctx.drawImage(s.ledge.c, 0, 0);
  s.steam.forEach(p => { const a = 0.5 * (1 - p.life / p.max); px(ctx, p.x + Math.sin(p.life * 2.4 + p.ph) * 1.6, p.y, `rgba(225,225,245,${a.toFixed(2)})`); });
  const cat = s.cat, cy = LEDGE_Y - CAT.length;
  CAT.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch === '.') return;
    if (cat.ear && ry < 2 && rx < 5 && (ry === 0 || rx === 2)) return; // левое ухо дёрнулось
    px(ctx, cat.x + rx, cy + ry, ch === 'X' ? '#10121f' : ry < 3 ? '#4a5290' : ry < 6 ? '#353c6c' : '#262b50'); // ярче всего — уши и макушка
  }));
  if (cat.look) { // повернул голову: видно щёку с носом и глаз блестит
    const side = cat.look > 0 ? 11 : 1, eye = cat.look > 0 ? 9 : 3;
    px(ctx, cat.x + side, cy + 4, '#4a5290'); px(ctx, cat.x + side, cy + 3, '#2a3058');
    px(ctx, cat.x + eye, cy + 3, '#d8f070');
  }
  const tail = TAILS[cat.tail];
  tail.forEach(([tx, ty], i) => px(ctx, cat.x + tx, cy + ty, i === tail.length - 1 ? '#4a5290' : '#10121f'));
  tail.forEach(([tx, ty]) => { if (!tail.some(([ax, ay]) => ax === tx && ay === ty - 1)) px(ctx, cat.x + tx, cy + ty - 1, 'rgba(74,82,144,.55)'); }); // свет по верху хвоста
}

function drawCar(ctx, car, ground, dir, t) {
  const spr = car.spr, len = car.len, x0 = Math.round(car.x), top = ground - spr.length + 1;
  const pal = car.pal || (car.pal = { R: shade(car.col, 0.3), B: car.col, D: shade(car.col, -0.4) });
  const lightRow = spr.findIndex(r => r.includes('H'));
  const at = rx => dir > 0 ? x0 + rx : x0 + len - 1 - rx; // зеркалим, если едет влево
  // свет фар: конус вперёд и пятно на асфальте; у бэхи — холодный ксенон, а дальний — длинный и яркий
  const flash = car.flash, beam = flash ? 30 : car.kind === 'moto' ? 8 : 12, y0 = top + lightRow;
  const rgb = car.kind === 'bmw' ? '220,236,255' : '255,214,120';
  for (let k = 1; k <= beam; k++) {
    const a = (flash ? 0.6 : 0.3) * (1 - k / (beam + 1));
    const up = flash ? Math.floor(k / 6) : 0, h = Math.min(ground - y0 + 1 + up, 1 + Math.floor(k / 3) + up);
    px(ctx, at(len - 1 + k), y0 - up, `rgba(${rgb},${a.toFixed(3)})`, 1, h);
  }
  if (flash) { // ореол вокруг фары
    for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 3; dx++) {
      const d = Math.abs(dy) + Math.abs(dx - 1);
      if (d && d < 4) px(ctx, at(len - 1 + dx), y0 + dy, `rgba(240,248,255,${(0.55 - d * 0.15).toFixed(2)})`);
    }
  }
  spr.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch === '.') return;
    let col = pal[ch];
    if (ch === 'G') col = row[rx - 1] !== 'G' ? '#5d80b0' : '#2b4268'; // блик на краю стекла
    else if (ch === 'W') col = '#ffd27a';
    else if (ch === 'H') col = flash ? '#ffffff' : car.kind === 'bmw' ? '#dff0ff' : '#fff6d6';
    else if (ch === 'T') col = '#ff3b3b';
    else if (ch === 'K') col = '#0b0c14';
    else if (ch === 'h') col = '#7a8098';
    else if (ch === 'E') col = car.helmet;
    else if (ch === 'P') col = '#4a4e6e';
    px(ctx, at(rx), top + ry, col);
  }));
  px(ctx, at(-1), top + lightRow, 'rgba(255,59,59,.4)'); // стоп-сигнал светится назад
  if (car.taxi) { // шашечка на крыше
    const rx = spr[0].indexOf('R') + 2;
    px(ctx, at(rx), top - 1, Math.floor(t * 2) % 2 ? '#fff3a0' : '#e8c200'); px(ctx, at(rx + 1), top - 1, '#e8c200');
  }
}

function start(canvas) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const s = build();
  let raf = 0, last = performance.now(), acc = 0;
  const STEP = 1 / 30;
  const frame = now => {
    acc += Math.min((now - last) / 1000, 0.25); last = now;
    if (acc >= STEP) { while (acc >= STEP) { update(s, STEP); acc -= STEP; } draw(ctx, s); }
    raf = requestAnimationFrame(frame);
  };
  draw(ctx, s);
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); }, scene: s, update: dt => update(s, dt), draw: () => draw(ctx, s) }; // scene/update/draw — для проверок
}

window.PixelCity = { start, W, H };
})();
