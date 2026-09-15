const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Заполните логин, почту и пароль' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Некорректный формат почты' });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Пользователь с такой почтой уже зарегистрирован' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, role)
             VALUES ($1, $2, $3, 'user')
             RETURNING id, username, email, role`,
            [username.trim(), email.toLowerCase(), passwordHash]
        );

        req.session.user = result.rows[0];
        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ error: 'Введите логин/почту и пароль' });
    }

    try {
        const result = await pool.query(
            'SELECT id, username, email, password_hash, role FROM users WHERE email = $1 OR LOWER(username) = $1',
            [identifier.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный логин/почта или пароль' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Неверный логин/почта или пароль' });
        }

        const safeUser = { id: user.id, username: user.username, email: user.email, role: user.role };
        req.session.user = safeUser;
        res.json({ user: safeUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

router.get('/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

module.exports = router;
