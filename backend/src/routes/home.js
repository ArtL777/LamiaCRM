const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { upload, saveMediaFile, UPLOAD_DIR, MAX_FILES } = require('../utils/upload');

const router = express.Router();

async function getBlocks() {
    const result = await pool.query('SELECT id, type, content, position FROM home_blocks ORDER BY position ASC, id ASC');
    return result.rows;
}

async function nextPosition() {
    const result = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM home_blocks');
    return result.rows[0].next;
}

router.get('/', async (req, res) => {
    try {
        const content = await pool.query('SELECT title, updated_at FROM home_content WHERE id = 1');
        const blocks = await getBlocks();
        res.json({ home: { title: content.rows[0]?.title || '', updatedAt: content.rows[0]?.updated_at || null, blocks } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении главной страницы' });
    }
});

router.put('/', requireAdmin, async (req, res) => {
    const { title } = req.body;
    try {
        const result = await pool.query(
            `UPDATE home_content SET title = COALESCE($1, title), updated_at = now() WHERE id = 1 RETURNING title, updated_at`,
            [title]
        );
        res.json({ home: { title: result.rows[0].title, updatedAt: result.rows[0].updated_at, blocks: await getBlocks() } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении главной страницы' });
    }
});

router.post('/blocks/text', requireAdmin, async (req, res) => {
    const content = (req.body.content || '').trim();
    if (!content) {
        return res.status(400).json({ error: 'Текст блока не может быть пустым' });
    }
    try {
        const position = await nextPosition();
        await pool.query('INSERT INTO home_blocks (type, content, position) VALUES ($1, $2, $3)', ['text', content, position]);
        res.status(201).json({ blocks: await getBlocks() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при добавлении текстового блока' });
    }
});

router.put('/blocks/:id', requireAdmin, async (req, res) => {
    const content = (req.body.content || '').trim();
    if (!content) {
        return res.status(400).json({ error: 'Текст блока не может быть пустым' });
    }
    try {
        const result = await pool.query(
            "UPDATE home_blocks SET content = $1 WHERE id = $2 AND type = 'text' RETURNING id",
            [content, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Текстовый блок не найден' });
        }
        res.json({ blocks: await getBlocks() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении блока' });
    }
});

router.post('/blocks/media', requireAdmin, upload.array('media', MAX_FILES), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Файлы не были загружены' });
    }

    try {
        const existingCount = await pool.query("SELECT COUNT(*)::int AS count FROM home_blocks WHERE type IN ('image', 'video')");
        if (existingCount.rows[0].count + req.files.length > MAX_FILES) {
            return res.status(400).json({ error: `Достигнут лимит медиафайлов (не более ${MAX_FILES})` });
        }

        let position = await nextPosition();
        for (const file of req.files) {
            const { url, type } = await saveMediaFile(file);
            await pool.query('INSERT INTO home_blocks (type, content, position) VALUES ($1, $2, $3)', [type, url, position++]);
        }

        res.status(201).json({ blocks: await getBlocks() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при загрузке медиафайлов' });
    }
});

router.delete('/blocks/:id', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM home_blocks WHERE id = $1 RETURNING type, content', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Блок не найден' });
        }

        const block = result.rows[0];
        if (block.type !== 'text') {
            const filePath = path.join(UPLOAD_DIR, path.basename(block.content));
            fs.unlink(filePath, () => {});
        }

        res.json({ blocks: await getBlocks() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при удалении блока' });
    }
});

router.put('/blocks/:id/move', requireAdmin, async (req, res) => {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({ error: 'Некорректное направление перемещения' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const current = await client.query('SELECT id, position FROM home_blocks WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (current.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Блок не найден' });
        }

        const neighborQuery = direction === 'up'
            ? 'SELECT id, position FROM home_blocks WHERE position < $1 ORDER BY position DESC LIMIT 1'
            : 'SELECT id, position FROM home_blocks WHERE position > $1 ORDER BY position ASC LIMIT 1';
        const neighbor = await client.query(neighborQuery, [current.rows[0].position]);

        if (neighbor.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ blocks: await getBlocks() });
        }

        await client.query('UPDATE home_blocks SET position = $1 WHERE id = $2', [neighbor.rows[0].position, current.rows[0].id]);
        await client.query('UPDATE home_blocks SET position = $1 WHERE id = $2', [current.rows[0].position, neighbor.rows[0].id]);

        await client.query('COMMIT');
        res.json({ blocks: await getBlocks() });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при перемещении блока' });
    } finally {
        client.release();
    }
});

module.exports = router;
