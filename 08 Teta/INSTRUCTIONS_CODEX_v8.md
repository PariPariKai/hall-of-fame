# Инструкции для Codex — расширение Google Sheets для Hall of Fame v8

## Контекст

v8 — это **большое функциональное расширение**. К сайту добавляются:
- Новая страница **Games** (заказы игр с прогрессом прохождения)
- Новый landing-page с инфо о стримере и быстрыми переходами
- На существующих страницах (Anime/Movies/Series): обложки тайтлов, оценка стримера, кликабельные ники зрителей-стримеров

Со стороны Google Sheets нужно:
1. Добавить колонки в **существующие** листы `Anime`, `Movies`, `Series`, `Viewers`, `Config`
2. Создать **новый** лист `Games`
3. Опубликовать `Games` как CSV

**Что НЕ меняется:** существующие листы `Winners`, `CurrentPrizes`, `Tickets` остаются как есть. Существующие данные в `Anime`, `Movies`, `Series`, `Viewers`, `Config` сохраняются, добавляются только новые колонки/ключи справа.

**Важно про публикации:** при добавлении колонок в уже опубликованный лист публикация автоматически их подхватывает. Перепубликовывать `Anime`, `Movies`, `Series`, `Viewers`, `Config` **не нужно** — существующие ссылки CSV продолжают работать. Только новый `Games` нужно опубликовать.

---

## Архитектурные решения (для контекста)

Согласовано с пользователем:

- **Rating:** целое или дробное число от 1 до 10 (формат `8` или `8.5`)
- **Cover URL:** прямая ссылка на изображение обложки (jpg/png/webp). Универсальный размер не требуется — сайт сам приведёт к нужному виду через `object-fit: cover`.
- **Twitch URL:** только для зрителей-стримеров, опциональное поле. Если заполнено — на сайте ник становится кликабельной ссылкой на их Twitch. Если пусто — ник остаётся обычным текстом.
- **Games / progress:** два числовых поля — `progress_percent` (0-100) и `hours_played` (часы)
- **Config:** добавляются ключи для landing-page (имя стримера, интро текст, аватар, ссылка на Twitch)

---

## Шаг 1. Расширить лист `Anime`

В существующий лист `Anime` **добавить две колонки между `status` и `date_added`**:

**Было (v7):**
```
nick | title | format | episodes_total | episodes_watched | status | date_added | date_completed | url | notes
```

**Стало (v8):**
```
nick | title | format | episodes_total | episodes_watched | status | rating | cover_url | date_added | date_completed | url | notes
```

| Новая колонка | Тип | Описание |
|---------------|-----|----------|
| `rating` | number | Оценка стримера 1-10 (целая или с десятичной: `8`, `7.5`). Пусто = нет оценки. |
| `cover_url` | text | Прямая ссылка на изображение обложки. Пусто = без обложки. |

**Не трогай существующие данные** — просто вставь две пустые колонки в нужное место (правый клик по колонке `date_added` → Insert 2 columns to the left). Все существующие строки получат пустые значения в `rating` и `cover_url`, это нормально.

---

## Шаг 2. Расширить лист `Movies`

Аналогично — **добавить две колонки между `status` и `date_added`**:

**Было (v7):**
```
nick | title | type | url | status | date_added | date_completed | notes
```

**Стало (v8):**
```
nick | title | type | url | status | rating | cover_url | date_added | date_completed | notes
```

Те же `rating` и `cover_url` (см. описание в шаге 1).

---

## Шаг 3. Расширить лист `Series`

Аналогично — **добавить две колонки между `status` и `date_added`**:

**Было (v7):**
```
nick | title | episodes_total | episodes_watched | status | date_added | date_completed | url | notes
```

**Стало (v8):**
```
nick | title | episodes_total | episodes_watched | status | rating | cover_url | date_added | date_completed | url | notes
```

---

## Шаг 4. Расширить лист `Viewers`

Добавить **одну колонку `twitch_url`** между `steam_nick` и `avatar_url`:

**Было:**
```
nick | steam_nick | avatar_url
```

**Стало:**
```
nick | steam_nick | twitch_url | avatar_url
```

| Новая колонка | Тип | Описание |
|---------------|-----|----------|
| `twitch_url` | text | Полная ссылка на Twitch-канал (например, `https://www.twitch.tv/somenick`). Заполняется **только для зрителей-стримеров**. Большинство строк останутся пустыми — это нормально. |

**Важно:** колонка `avatar_url` должна остаться в конце таблицы. Если её сдвинуть — сломается логика чтения на сайте? Нет, сайт читает по имени колонки, не по индексу — так что порядок не критичен. Но для удобства редактирования всё равно лучше: `nick`, `steam_nick`, `twitch_url`, `avatar_url`.

---

## Шаг 5. Расширить лист `Config`

В существующий `Config` (структура `key | value`) **добавить 4 новые строки** для landing-page:

| key | value (пример) |
|-----|----------------|
| `streamer_name` | ParipariKai |
| `streamer_intro` | Привет! Я стримлю игры, фильмы и аниме. Здесь хроника моих стримов, рулетки и заказы зрителей. |
| `streamer_avatar_url` | https://static-cdn.jtvnw.net/jtv_user_pictures/... |
| `streamer_twitch_url` | https://www.twitch.tv/pariparikai |

**Не трогай существующие ключи:** `raffle_date`, `raffle_title`, `raffle_active`, `tickets_banner_url` остаются как есть.

**Значения подставь как примеры** — пользователь сам отредактирует под себя. Главное, чтобы ключи (левая колонка) назывались **ровно так** как указано выше (lowercase, underscore).

---

## Шаг 6. Создать новый лист `Games`

В мега-таблице создай новый лист с именем `Games`. Структура:

| Колонка | Тип | Обязательно | Описание |
|---------|-----|-------------|----------|
| `nick` | text | ✅ | Twitch-ник заказчика. Совпадает с `nick` в `Viewers`. |
| `title` | text | ✅ | Название игры |
| `progress_percent` | number | ✅ | Прогресс прохождения 0-100. По умолчанию 0. |
| `hours_played` | number | ✅ | Сколько часов уже наиграно. По умолчанию 0. Поддерживает десятичные (`4.5`). |
| `status` | text | ✅ | `pending` / `playing` / `completed` / `dropped` (см. ниже) |
| `rating` | number | ⛔ опционально | Оценка стримера 1-10 |
| `cover_url` | text | ⛔ опционально | Ссылка на обложку игры |
| `date_added` | date | ⛔ опционально | Когда заказали. Формат `YYYY-MM-DD`. |
| `date_completed` | date | ⛔ опционально | Когда закончили (или дропнули). |
| `url` | text | ⛔ опционально | Ссылка на Steam/Metacritic/IGDB/HowLongToBeat |
| `notes` | text | ⛔ опционально | Заметки (жанр, мотивация заказа, что угодно) |

**Точная строка заголовков (первая строка листа):**
```
nick	title	progress_percent	hours_played	status	rating	cover_url	date_added	date_completed	url	notes
```

### Про статусы игр

Здесь набор статусов отличается от аниме/фильмов:
- `pending` — заказана, ещё не начинали
- `playing` — играем сейчас
- `completed` — прошли
- `dropped` — забросили (не понравилось, слишком сложно, что угодно)

Это сознательное расхождение с аниме/сериалами (`watched`/`watching`/`pending`) — игры реально чаще "дропаются", и есть смысл показывать это отдельным статусом, а не сваливать в `watched`.

### Data validation для `Games`

- **Колонка `status`** (E): выпадающий список из `pending`, `playing`, `completed`, `dropped`
- **Колонка `progress_percent`** (C): валидация Number between 0 and 100 (не блокирующая, just warning)
- **Колонка `rating`** (F): валидация Number between 0 and 10 (не блокирующая)

### Conditional formatting для `Games`

- `status = completed` — серый фон + зачёркнутый текст
- `status = playing` — золотой фон
- `status = dropped` — красноватый фон (`#5a2a2a` или похожий)
- `status = pending` — без подсветки

---

## Шаг 7. Опубликовать `Games` как CSV

1. `File` → `Share` → `Publish to web`
2. Выбрать лист `Games`
3. Формат: `Comma-separated values (.csv)`
4. Галочка `Automatically republish when changes are made`
5. `Publish` → подтвердить
6. Скопировать ссылку

Полученный URL — это `GAMES_CSV_URL`.

---

## Шаг 8. Отчитаться пользователю

Передай пользователю:

```
GAMES_CSV_URL=https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv
```

Также подтверди:
1. ✅ В `Anime` добавлены `rating` и `cover_url` (между `status` и `date_added`)
2. ✅ В `Movies` добавлены `rating` и `cover_url`
3. ✅ В `Series` добавлены `rating` и `cover_url`
4. ✅ В `Viewers` добавлена `twitch_url`
5. ✅ В `Config` добавлены 4 ключа: `streamer_name`, `streamer_intro`, `streamer_avatar_url`, `streamer_twitch_url`
6. ✅ Создан лист `Games` со всеми колонками + dropdown'ами для `status`
7. ✅ `Games` опубликован как CSV, ссылка передана пользователю
8. ✅ Существующие данные не повреждены

---

## Итоговая структура таблицы после v8

9 листов:

| Лист | Колонки | Что изменилось |
|------|---------|----------------|
| Winners | nick, prize, rank, quote, date, unique, prize_image_url | без изменений |
| CurrentPrizes | image_url, title, link, active | без изменений |
| Tickets | nick, silver, gold | без изменений |
| Config | key, value | **+4 ключа** (streamer_*) |
| Viewers | nick, steam_nick, **twitch_url**, avatar_url | **+1 колонка** |
| Anime | nick, title, format, episodes_total, episodes_watched, status, **rating**, **cover_url**, date_added, date_completed, url, notes | **+2 колонки** |
| Movies | nick, title, type, url, status, **rating**, **cover_url**, date_added, date_completed, notes | **+2 колонки** |
| Series | nick, title, episodes_total, episodes_watched, status, **rating**, **cover_url**, date_added, date_completed, url, notes | **+2 колонки** |
| **Games** | **nick, title, progress_percent, hours_played, status, rating, cover_url, date_added, date_completed, url, notes** | **новый лист** |

---

## Замечания

- **Не трогай существующие CSV-публикации** для Anime/Movies/Series/Viewers/Config — они автоматически подхватят новые колонки. Только Games нужно опубликовать впервые.
- **Не вставляй тестовые данные в Games** — лист остаётся пустым, пользователь сам перенесёт реальные данные.
- **Не меняй регистр** новых колонок. Всё lowercase + underscore: `rating`, `cover_url`, `twitch_url`, `progress_percent`, `hours_played`. Сайт читает по этим точным именам.
- **`progress_percent` и `hours_played` независимы.** Можно поставить `progress_percent=80, hours_played=20` или `progress_percent=0, hours_played=2` (только посмотрели но решили не играть). Сайт не пытается их связать.
- **Если значения `streamer_*` в Config окажутся пустыми** — сайт покажет дефолтные значения (имя "Stream", без интро, без аватара). Это не критическая ошибка, просто landing будет менее красивым.
