require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function init() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('База данных инициализирована: таблицы users и home_content готовы.');
    await pool.end();
}

init().catch((err) => {
    console.error('Ошибка инициализации базы данных:', err);
    process.exit(1);
});
