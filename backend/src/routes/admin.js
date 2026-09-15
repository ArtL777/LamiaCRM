const express = require('express');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, role, created_at
             FROM users
             ORDER BY created_at DESC`
        );
        res.json({ users: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении списка пользователей' });
    }
});

module.exports = router;
