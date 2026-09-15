require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');

const pool = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const adminRoutes = require('./src/routes/admin');
const homeRoutes = require('./src/routes/home');
const interactiveRoutes = require('./src/routes/interactive');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(express.json());
app.use(
    session({
        // Сессии хранятся в PostgreSQL, а не в памяти процесса — иначе
        // при каждом перезапуске сервера (или перезагрузке nodemon)
        // все вошедшие пользователи разлогинивались бы.
        store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
        secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней
        },
    })
);

app.use('/uploads', express.static(path.join(FRONTEND_DIR, 'uploads')));
app.use(express.static(FRONTEND_DIR));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/interactive', interactiveRoutes);

// Обработка ошибок загрузки файлов (multer) и прочих ошибок API
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.message) {
        return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
    console.log(`LamiaCRM запущен: http://localhost:${PORT}`);
});
