# Инструкции для Claude Code — деплой Hall of Fame v8

## Контекст

v8 — это **большое обновление**:
- **Перенос** Hall of Fame с `index.html` в отдельный `hall.html`
- **Новый `index.html`** — landing-page "о стримере"
- **Новая страница** `games.html` — заказы игр с прогрессом прохождения
- **Доработки** существующих страниц `anime.html`, `movies.html`, `series.html`:
  - Обложки тайтлов справа на карточках
  - Оценка стримера (бейдж "★ 8.5")
  - Поиск по нику заказчика (отдельное второе поле)
  - Кликабельные ники зрителей-стримеров (через `twitch_url` из Viewers)
  - При фильтре "Все" больше не показываются `watched` — только активные
  - Просмотренные доступны только через фильтр "Просмотрено"
  - Хронологическая сортировка просмотренных по `date_completed`
  - Фикс опечатки "Просмотрена" → "Просмотрено"
- **Обновление nav** на всех страницах: добавление пунктов "Игры" + клик на brand ведёт на landing

**Зависимость:** Codex v8 должен был отработать. Пользователь должен передать новый `GAMES_CSV_URL`. Остальные URL'ы (Anime/Movies/Series/Viewers/Config) **не меняются** — добавление колонок в Google Sheets не ломает существующие публикации.

---

## Что нужно от пользователя (проверь перед началом)

1. `GAMES_CSV_URL` — новая ссылка из v8
2. Подтверждение, что Codex v8 отработан (добавлены `rating`/`cover_url` в Anime/Movies/Series, `twitch_url` в Viewers, ключи `streamer_*` в Config, создан лист Games)

Все остальные URL'ы берутся из существующих файлов v7 (`anime.html`, `movies.html`, `series.html` уже их содержат).

---

## Архитектурные решения (согласовано с пользователем)

- **Routing:** `index.html` теперь landing. Старая Hall of Fame переезжает в `hall.html`. Brand "ParipariKai" в nav на всех страницах ведёт на `index.html` (landing).
- **Поиск:** два независимых поля — "по названию" и "по заказчику". Работают AND.
- **Фильтр "Все":** показывает только **активные** (pending + watching/playing). Чтобы увидеть watched/completed — клик по соответствующей кнопке.
- **Сортировка:**
  - Активные: `pending` сначала по `date_added` desc (новые заказы наверху)
  - Активные: `watching` группой перед `pending`
  - Просмотренные: по `date_completed` desc (недавно посмотренные сверху)
  - Сортировка без UI-контролов — просто всегда так
- **Обложки:** справа от текста карточки, фикс. ширина (например 80px), `aspect-ratio: 2/3` для аниме/фильмов/сериалов, `aspect-ratio: 16/9` для игр. На мобильном — обложка слева сверху или вообще скрывается под определённой шириной.
- **Rating:** бейдж "★ 8.5" золотым цветом, рядом со статусом. Если `rating` пуст — бейдж не показывается.
- **Twitch link:** если у зрителя в `Viewers.twitch_url` есть значение — ник на карточке оборачивается в `<a target="_blank" rel="noopener">`. Подсветка: золотой цвет + подчёркивание при ховере. Если значения нет — обычный текст.

---

## Шаг 0. Подготовка — переименование

```bash
git mv index.html hall.html
```

Старый `index.html` с Hall of Fame теперь живёт под именем `hall.html`. Внутри файла **ничего пока не меняй** (кроме nav-меню в Шаге 7).

---

## Шаг 1. Создать новый `index.html` (landing-page)

### Структура

1. **Top nav** (общий компонент)
2. **Hero блок:**
   - По центру/слева — большой аватар (~140px круглый) — берётся из `streamer_avatar_url` (Config)
   - Заголовок: `streamer_name` (Config) большими буквами с золотой подсветкой
   - Подзаголовок: `streamer_intro` (Config) обычным текстом, max-width ~600px, центрирован
   - Кнопка: "Смотреть на Twitch" — ведёт на `streamer_twitch_url` (Config), `target="_blank"`. Стиль — золотая кнопка с лёгким glow, hover увеличивает glow.
   - Если какое-то из значений Config пустое — fallback: имя "Stream", интро "Добро пожаловать", без кнопки/аватара (показать заглушку).
3. **Сетка карточек-переходов** (6 штук): Hall of Fame · Билеты · Аниме · Фильмы · Сериалы · Игры
   - Каждая карточка — кликабельный `<a>`, ведёт на соответствующую страницу
   - На карточке: emoji-иконка крупно (🏆 🎟 🌸 🎬 📺 🎮), название страницы, и **счётчик** (см. ниже)
   - Layout: на десктопе 3 в ряд × 2 ряда; на мобиле — 2 в ряд × 3 ряда или одна колонка (на твоё усмотрение).
   - Hover effect: лёгкое поднятие `translateY(-3px)`, border меняется на золотой
   - Размер карточек: примерно 200-260px ширина, 140-160px высота

### Счётчики на карточках

Загружай 6 CSV параллельно (`Promise.all`) и считай:

| Карточка | Что показать |
|----------|-------------|
| Hall of Fame | "X побед" (всего строк в Winners) |
| Билеты | "X участников · Y билетов" (строк в Tickets и сумма silver+gold) |
| Аниме | "X в очереди · Y просмотрено" (`pending+watching` / `watched`) |
| Фильмы | "X в очереди · Y просмотрено" |
| Сериалы | "X в очереди · Y просмотрено" |
| Игры | "X в очереди · Y играем" (`pending` / `playing`) |

Если какой-то CSV не загрузился — соответствующий счётчик показать как "—" и продолжить рендер остальных. Не блокируй всю страницу одним сетевым сбоем.

### Config

В шапке файла создай переменные:
```javascript
const CONFIG_CSV_URL = "..."; // тот же что в tickets.html
const WINNERS_CSV_URL = "..."; // из hall.html
const TICKETS_CSV_URL = "..."; // из tickets.html
const ANIME_CSV_URL = "..."; // из anime.html
const MOVIES_CSV_URL = "..."; // из movies.html
const SERIES_CSV_URL = "..."; // из series.html
const GAMES_CSV_URL = "..."; // новый из v8
```

### Стилизация

Те же CSS-переменные что в `hall.html`: фон `#0a0e1a`, акцент `#FAC775`, фиолетовый `#7F77DD`. Hero блок может иметь лёгкий радиальный градиент на фоне.

---

## Шаг 2. Создать `games.html`

Скопируй `anime.html` (после применения всех правок Шага 4) как стартовую точку — затем модифицируй под игры.

### Отличия games.html от anime.html

| Элемент | anime.html | games.html |
|---------|-----------|------------|
| Заголовок | "Заказы аниме" | "Заказы игр" |
| Статусы | pending / watching / watched | **pending / playing / completed / dropped** |
| Фильтр-кнопки | Все · В очереди · Смотрим · Просмотрено | **Все · В очереди · Играем · Пройдено · Дропнуто** |
| Бейдж формата | DUB/SUB | (нет) |
| Прогресс | episodes_watched / episodes_total | **progress_percent (0-100)** + текст "Х часов" |
| Обложка | aspect-ratio 2/3 | **aspect-ratio 16/9** (или 2/3 если так лучше выглядит; пусть будет 16/9) |
| CSV | ANIME_CSV_URL | **GAMES_CSV_URL** |
| Колонки CSV | nick, title, format, episodes_total, episodes_watched, status, rating, cover_url, date_added, date_completed, url, notes | **nick, title, progress_percent, hours_played, status, rating, cover_url, date_added, date_completed, url, notes** |

### Прогресс-бар для игр

- Подпись над баром: `{progress_percent}%`
- Сама полоска: ширина заполнения = `progress_percent`
- Цвет: dropped — красный, completed — зелёный, playing — золотой, pending — пустой/тонкий
- Под баром мелким текстом: `{hours_played}ч сыграно`

### Дефолтная сортировка для games

- `playing` сверху по `date_added` desc
- Потом `pending` по `date_added` desc
- Под фильтром "Пройдено" — `completed` по `date_completed` desc (свежие сверху)
- Под фильтром "Дропнуто" — `dropped` по `date_completed` desc

### Бейджи статусов на карточке

| Статус | Текст | Цвет |
|--------|-------|------|
| pending | "В очереди" | серый |
| playing | "Играем" | золотой |
| completed | "Пройдено" | зелёный |
| dropped | "Дропнуто" | красный |

---

## Шаг 3. Обновить `hall.html`

Это бывший `index.html`. Что в нём поменять:

1. **Nav-меню** — обновить, см. Шаг 7
2. **Активная nav-ссылка** — теперь `is-active` на пункте "Hall of Fame" (а не на brand)
3. **Никакого другого функционала не трогать** — Hall of Fame работает как работал

---

## Шаг 4. Обновить `anime.html`, `movies.html`, `series.html`

Эти три страницы получают одинаковый набор доработок. Применяй ко всем трём.

### 4.1. Чтение новых колонок

В функции парсинга/маппинга строк CSV — добавь чтение полей `rating` и `cover_url`. Они опциональны: если пусто — undefined/null.

### 4.2. Виусуализация обложки

В шаблон карточки добавь `<img>` справа (или согласно responsive-логике):

```html
<div class="card">
  <div class="card__avatar"><!-- аватар заказчика --></div>
  <div class="card__body">
    <!-- title, бейджи, прогресс, notes -->
  </div>
  <div class="card__cover">
    <img src="{cover_url}" alt="{title}" loading="lazy" />
  </div>
</div>
```

- Если `cover_url` пуст — блок `card__cover` не рендерится вообще (контент перетекает на освободившееся место).
- На мобильном (`< 640px`) можно: либо обложку скрыть (если места мало), либо переместить вверх (см. на твоё усмотрение). Главное — без overflow и без сломанного layout.
- `loading="lazy"` обязательно — иначе на большом списке будет лагать.
- Размер обложки: 80×120px (aspect-ratio 2/3) для anime/movies/series.

### 4.3. Бейдж rating

Если `rating` присутствует и не пуст — рядом с бейджем status показать бейдж:

```html
<span class="badge badge--rating">★ {rating}</span>
```

Стиль: золотой фон `rgba(250,199,117,0.15)`, золотой текст `#FAC775`, золотая граница `1px solid rgba(250,199,117,0.4)`. Звёздочка `★` юникод.

Формат числа: если целое — показать как есть (`8`), если дробное — округлить до 1 знака (`8.5`).

### 4.4. Поле поиска по заказчику

Добавь **второе поле поиска** рядом с существующим:

```html
<div class="controls">
  <input id="search-title" placeholder="Поиск по названию..." />
  <input id="search-nick" placeholder="Поиск по заказчику..." />
  <div class="filters"><!-- кнопки статуса --></div>
</div>
```

Поиск работает AND: показать только те карточки, где **и** title матчит (substring, case-insensitive), **и** nick матчит. Пустое поле = не фильтровать по нему.

### 4.5. Кликабельный ник через `twitch_url`

В функции построения `viewersMap` (где сейчас уже лежат `nick → {nick, avatar}`) — добавь поле `twitchUrl`:

```javascript
viewersMap[normalizedNick] = {
  nick: row.nick,
  avatar: row.avatar_url,
  twitchUrl: row.twitch_url || null
};
```

В шаблоне карточки — если `twitchUrl` есть:
```html
<a href="{twitchUrl}" target="_blank" rel="noopener" class="nick nick--streamer">{nick}</a>
```

Если нет:
```html
<span class="nick">{nick}</span>
```

CSS: `.nick--streamer` золотой цвет + hover подчёркивание + tiny icon ↗ после ника (опционально).

### 4.6. Логика фильтра "Все"

**Раньше (v7):** "Все" показывает все статусы.

**Теперь (v8):** "Все" показывает только **активные** — `pending` + `watching` (+ `playing` для games, без `dropped`/`completed`).

Чтобы увидеть просмотренные — пользователь кликает на отдельную кнопку "Просмотрено" / "Пройдено".

**Важно для UX:** счётчик в header ("X из Y просмотрено") должен **остаться глобальным** — он показывает общую статистику по всем строкам, независимо от фильтра. Это полезная инфа на стриме.

### 4.7. Сортировка по дате

Логика дефолтной сортировки (всегда применяется, без UI-выбора):

```javascript
function sortRows(rows, currentFilter) {
  return rows.sort((a, b) => {
    // Если фильтр "watched" — сортируем по date_completed desc
    if (currentFilter === 'watched' || currentFilter === 'completed') {
      return parseDate(b.date_completed) - parseDate(a.date_completed);
    }
    // Иначе — группируем по приоритету статуса + по date_added desc
    const statusPriority = { watching: 0, playing: 0, pending: 1, watched: 2, completed: 2, dropped: 3 };
    const pa = statusPriority[a.status] ?? 9;
    const pb = statusPriority[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return parseDate(b.date_added) - parseDate(a.date_added);
  });
}
```

Где `parseDate` — простая утилита: возвращает `0` для пустых/невалидных, иначе `Date.parse(d)`.

### 4.8. Фикс опечатки

В коде/тексте, где для статуса `watched` подставляется лейбл — заменить "Просмотрена" на **"Просмотрено"**. Это касается:
- Бейджа на карточке (`<span class="badge badge--watched">Просмотрено</span>`)
- Текста фильтр-кнопки (тоже "Просмотрено")
- Возможно текста в подсчёте header

Поиск в коде по `Просмотрена` должен дать 0 результатов после правки. Аналогично для женского рода у других статусов если есть.

---

## Шаг 5. Обновить `tickets.html` и `wheel.html`

Только **обновление nav-меню** (см. Шаг 7). Никаких функциональных изменений.

---

## Шаг 6. Обновить `CurrentPrizes` ссылки (если используется на сайте)

Если в листе `CurrentPrizes` есть строки со ссылкой на `https://pariparikai.github.io/hall-of-fame/index.html` или `/` — этот URL теперь ведёт на landing-page, а не на Hall of Fame. Скажи пользователю проверить и, если надо, заменить на `/hall.html`.

**Это не задача Claude Code напрямую** — просто **упомяни в финальном отчёте пользователю**, что нужно проверить таблицу `CurrentPrizes`.

---

## Шаг 7. Обновлённое nav-меню (на ВСЕХ страницах)

Структура HTML обновлённого nav:

```html
<nav class="site-nav">
  <div class="site-nav__inner">
    <a class="site-nav__brand" href="index.html">ParipariKai</a>
    <ul class="site-nav__links">
      <li><a href="hall.html" data-page="hall">Hall of Fame</a></li>
      <li><a href="tickets.html" data-page="tickets">Билеты</a></li>
      <li><a href="anime.html" data-page="anime">Аниме</a></li>
      <li><a href="movies.html" data-page="movies">Фильмы</a></li>
      <li><a href="series.html" data-page="series">Сериалы</a></li>
      <li><a href="games.html" data-page="games">Игры</a></li>
    </ul>
  </div>
</nav>
```

**На каждой странице** — `is-active` на соответствующем `<a>`:
- `index.html` — на brand (или ни на чём; visual cue не нужен — пользователь уже на главной)
- `hall.html` — на ссылке "Hall of Fame"
- `tickets.html` — на "Билеты"
- ... и так далее
- `games.html` — на "Игры"
- `wheel.html` — без `is-active` ни на чём (рулетка не в основном меню; это спец-страница)

**Brand `ParipariKai`** теперь всегда ведёт на `index.html` (landing). Это сохраняется на всех страницах.

**Мобильный режим:** с 6 пунктами + brand стало тесновато. Решения по убыванию приоритета:
1. На < 640px — wrap ссылок в две строки (как было в v7)
2. На < 480px — горизонтальный скролл для `site-nav__links` (`overflow-x: auto`)
3. На < 380px — сжать brand до сокращения "PK" или иконки

Гамбургер-меню по-прежнему не делаем (отложено на v9+).

---

## Шаг 8. Локальная проверка

```bash
python3 -m http.server 8000
```

Открой по очереди:
- `http://localhost:8000/` (`index.html`) — landing-page
  - ✅ Hero блок с аватаром, ником, интро, кнопкой Twitch
  - ✅ 6 карточек-переходов с правильными счётчиками
  - ✅ Кнопка Twitch ведёт на правильный URL
  - ✅ Каждая карточка кликабельна и ведёт куда надо
  - ✅ Если значения Config пустые — graceful fallback
- `http://localhost:8000/hall.html` — старый Hall of Fame
  - ✅ Всё работает как в v7
  - ✅ Nav обновлён, активная ссылка "Hall of Fame"
- `http://localhost:8000/anime.html` (и movies, series)
  - ✅ Обложка справа на карточке (если cover_url есть)
  - ✅ Бейдж рейтинга "★ 8.5" если rating есть
  - ✅ Два поля поиска работают независимо
  - ✅ Ники с twitch_url кликабельны и подсвечены
  - ✅ Фильтр "Все" не показывает watched
  - ✅ Фильтр "Просмотрено" показывает в хронологическом порядке (свежие сверху)
  - ✅ "Просмотрено" пишется правильно (мужской род)
- `http://localhost:8000/games.html` — новая страница
  - ✅ Прогресс-бар с процентами + часы
  - ✅ 4 статус-кнопки работают
  - ✅ Обложки 16:9 (или 2:3 если так лучше)
- `http://localhost:8000/tickets.html`, `wheel.html` — без функциональных изменений, только nav

### Тестовые данные

Чтобы проверить новые фичи, попроси пользователя временно положить в каждый лист (через Google Sheets):
- 1-2 строки с заполненным `rating` и `cover_url` (например на `cover_url` можно использовать любую публичную картинку — https://i.ibb.co/... или плакат с MyAnimeList/Kinopoisk)
- 1-2 строки в `Viewers` с заполненным `twitch_url` для проверки кликабельных ников
- 2-3 строки в `Games` для проверки новой страницы

---

## Шаг 9. Деплой

```bash
git add -A
git commit -m "v8: landing page, games page, covers, ratings, nick search, streamer twitch links, fixed sorting"
git push origin main
```

---

## Финальный отчёт пользователю

После пуша передай пользователю:

1. ✅ Перенесено: Hall of Fame теперь на `/hall.html`, `/` стало landing-page
2. ✅ Создано: `games.html` со статусами pending/playing/completed/dropped, прогрессом 0-100%, часами
3. ✅ Доработано: обложки + рейтинг + поиск по нику + кликабельные стримеры + правильная сортировка/фильтрация на anime/movies/series
4. ✅ Опечатка "Просмотрена" → "Просмотрено" исправлена
5. ✅ Nav обновлён на всех страницах, brand ведёт на landing

**⚠️ Пользователю нужно сделать вручную:**
- Проверить `CurrentPrizes` в Google Sheets — если там есть ссылки на старую главную (`/index.html`), заменить на `/hall.html`
- Заполнить значения `streamer_*` в Config (имя, интро, аватар, Twitch URL) — без них landing будет с заглушками

---

## Технические напоминания

- **Используй один и тот же `parseCSV`** на всех страницах — тот, что в `hall.html` (с фиксом пустых финальных строк из v6).
- **Используй один и тот же CSS-fundament** — переменные цвета, шрифты, скругления — везде одинаковые.
- **Не оверфетчить** — `index.html` грузит 6 CSV параллельно, всё через `Promise.allSettled` (не `all`!), чтобы один упавший не положил всю страницу.
- **Кэширование GSheets** до 5 минут — не баг, просто упомянуть это в комментарии если будет confusion.
- **Lazy-loading** на всех `<img>` для обложек (`loading="lazy"`) — критично с учётом возможного роста списка.
- **Не пиши свою магию для дат** — `Date.parse(d) || 0` достаточно для всех YYYY-MM-DD строк.

---

## Краткое summary файловых изменений

**Новые файлы:**
- `index.html` — landing (новое содержимое; старый `index.html` переименован в `hall.html`)
- `games.html` — заказы игр

**Переименованные файлы:**
- `index.html` (v7) → `hall.html` (v8) — содержимое не меняется кроме nav

**Изменённые файлы:**
- `anime.html` — обложки, рейтинг, поиск по нику, twitch-ссылки, новая логика фильтра "Все", сортировка, фикс опечатки, nav
- `movies.html` — то же что в anime
- `series.html` — то же что в anime
- `tickets.html` — только обновление nav
- `wheel.html` — только обновление nav

**Возможно (если выносил отдельно):**
- `nav.css` — добавлены пункты "Игры" и обновлены стили
