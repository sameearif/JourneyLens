DROP TABLE IF EXISTS journals CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS visions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visions (
    vision_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    character_description TEXT,
    story_running_summary TEXT,
    journal_running_summary TEXT,
    chat_history JSONB,
    image_url TEXT,
    short_term_todos JSONB DEFAULT '[]'::jsonb,
    long_term_todos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stories (
    story_id SERIAL PRIMARY KEY,
    vision_id INT REFERENCES visions(vision_id) ON DELETE CASCADE,
    story_text JSONB NOT NULL,
    story_images JSONB NOT NULL,
    chapter_image_description JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journals (
    journal_id SERIAL PRIMARY KEY,
    vision_id INT REFERENCES visions(vision_id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    journal_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
