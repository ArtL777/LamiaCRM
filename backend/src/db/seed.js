require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const ADMIN_USERNAME = 'Ламия';
const ADMIN_EMAIL = 'lamia@gmail.com';
const ADMIN_PASSWORD = 'Password';

async function seed() {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO NOTHING`,
        [ADMIN_USERNAME, ADMIN_EMAIL, passwordHash]
    );

    await pool.query(
        `INSERT INTO home_content (id, title)
         VALUES (1, '')
         ON CONFLICT (id) DO NOTHING`
    );

    console.log('Посев данных завершён: аккаунт администратора и пустая главная страница готовы.');
    await pool.end();
}

seed().catch((err) => {
    console.error('Ошибка посева данных:', err);
    process.exit(1);
});
