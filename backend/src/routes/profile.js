const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', requireAuth, (req, res) => {
    res.json({ user: req.session.user });
});

router.put('/', requireAuth, async (req, res) => {
    const { username, email, password, currentPassword } = req.body;
    const userId = req.session.user.id;

    if (!username && !email && !password) {
        return res.status(400).json({ error: 'Нечего обновлять' });
    }
    if (!currentPassword) {
        return res.status(400).json({ error: 'Введите текущий пароль для подтверждения изменений' });
    }
    if (email && !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Некорректный формат почты' });
    }
    if (password && String(password).length < 6) {
        return res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
    }

    try {
        const current = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const match = await bcrypt.compare(currentPassword, current.rows[0].password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Текущий пароль указан неверно' });
        }

        if (email) {
            const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), userId]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Эта почта уже используется другим аккаунтом' });
            }
        }

        const fields = [];
        const values = [];
        let idx = 1;

        if (username) {
            fields.push(`username = $${idx++}`);
            values.push(username.trim());
        }
        if (email) {
            fields.push(`email = $${idx++}`);
            values.push(email.toLowerCase());
        }
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            fields.push(`password_hash = $${idx++}`);
            values.push(passwordHash);
        }
        values.push(userId);

        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, email, role`,
            values
        );

        req.session.user = result.rows[0];
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' });
    }
});

module.exports = router;
