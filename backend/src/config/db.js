const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Без этого обработчика неожиданный обрыв простаивающего соединения
// (например, разрыв связи с PostgreSQL) роняет весь процесс Node.js.
pool.on('error', (err) => {
    console.error('Неожиданная ошибка простаивающего клиента PostgreSQL', err);
});

module.exports = pool;
