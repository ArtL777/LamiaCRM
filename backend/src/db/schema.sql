-- Схема базы данных LamiaCRM

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Заголовок главной страницы. Всегда ровно одна строка (id = 1).
CREATE TABLE IF NOT EXISTS home_content (
    id          SMALLINT PRIMARY KEY DEFAULT 1,
    title       TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Содержимое главной страницы устроено как блог-лента: текстовые блоки
-- и медиафайлы (изображение/видео) идут в произвольном порядке,
-- заданном полем position, — как в обычном посте блога.
CREATE TABLE IF NOT EXISTS home_blocks (
    id         SERIAL PRIMARY KEY,
    type       VARCHAR(10) NOT NULL CHECK (type IN ('text', 'image', 'video')),
    content    TEXT NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Кнопки раздела «Интерактив»: у каждой есть название и описание;
-- порядок отображения задаётся полем position.
CREATE TABLE IF NOT EXISTS interactive_buttons (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Медиафайлы кнопки — их может быть несколько, на публичной странице
-- показываются каруселью (стрелки влево/вправо), а не сеткой.
CREATE TABLE IF NOT EXISTS interactive_button_media (
    id         SERIAL PRIMARY KEY,
    button_id  INTEGER NOT NULL REFERENCES interactive_buttons(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    type       VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Активные области ("хотспоты") на изображении: прямоугольник (в долях
-- от 0 до 1 от размеров картинки, чтобы масштабировался вместе с ней)
-- и текст подсказки, которая показывается при наведении.
CREATE TABLE IF NOT EXISTS media_hotspots (
    id         SERIAL PRIMARY KEY,
    media_id   INTEGER NOT NULL REFERENCES interactive_button_media(id) ON DELETE CASCADE,
    x          REAL NOT NULL,
    y          REAL NOT NULL,
    width      REAL NOT NULL,
    height     REAL NOT NULL,
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
