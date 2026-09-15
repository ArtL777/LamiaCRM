const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { upload, saveMediaFile, UPLOAD_DIR, MAX_FILES } = require('../utils/upload');

const router = express.Router();

async function getButtons() {
    const buttons = await pool.query(
        'SELECT id, title, description, position FROM interactive_buttons ORDER BY position ASC, id ASC'
    );
    const media = await pool.query(
        'SELECT id, button_id, url, type, position FROM interactive_button_media ORDER BY position ASC, id ASC'
    );
    const hotspots = await pool.query(
        'SELECT id, media_id, x, y, width, height, text FROM media_hotspots ORDER BY id ASC'
    );

    return buttons.rows.map((button) => ({
        ...button,
        media: media.rows
            .filter((m) => m.button_id === button.id)
            .map(({ id, url, type }) => ({
                id,
                url,
                type,
                hotspots: hotspots.rows
                    .filter((h) => h.media_id === id)
                    .map(({ id: hid, x, y, width, height, text }) => ({ id: hid, x, y, width, height, text })),
            })),
    }));
}

async function nextButtonPosition() {
    const result = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM interactive_buttons');
    return result.rows[0].next;
}

async function nextMediaPosition(buttonId) {
    const result = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM interactive_button_media WHERE button_id = $1', [buttonId]);
    return result.rows[0].next;
}

router.get('/', async (req, res) => {
    try {
        res.json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении кнопок' });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    const title = (req.body.title || '').trim();
    if (!title) {
        return res.status(400).json({ error: 'Название кнопки не может быть пустым' });
    }

    try {
        const position = await nextButtonPosition();
        await pool.query(
            'INSERT INTO interactive_buttons (title, description, position) VALUES ($1, $2, $3)',
            [title, (req.body.description || '').trim(), position]
        );
        res.status(201).json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при создании кнопки' });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
    const title = (req.body.title || '').trim();
    if (!title) {
        return res.status(400).json({ error: 'Название кнопки не может быть пустым' });
    }

    try {
        const result = await pool.query(
            'UPDATE interactive_buttons SET title = $1, description = $2 WHERE id = $3 RETURNING id',
            [title, (req.body.description || '').trim(), req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Кнопка не найдена' });
        }
        res.json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении кнопки' });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const media = await pool.query('SELECT url FROM interactive_button_media WHERE button_id = $1', [req.params.id]);
        const result = await pool.query('DELETE FROM interactive_buttons WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Кнопка не найдена' });
        }

        media.rows.forEach((row) => fs.unlink(path.join(UPLOAD_DIR, path.basename(row.url)), () => {}));

        res.json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при удалении кнопки' });
    }
});

router.post('/:id/media', requireAdmin, upload.array('media', MAX_FILES), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Файлы не были загружены' });
    }

    try {
        const button = await pool.query('SELECT id FROM interactive_buttons WHERE id = $1', [req.params.id]);
        if (button.rows.length === 0) {
            return res.status(404).json({ error: 'Кнопка не найдена' });
        }

        const existingCount = await pool.query('SELECT COUNT(*)::int AS count FROM interactive_button_media WHERE button_id = $1', [req.params.id]);
        if (existingCount.rows[0].count + req.files.length > MAX_FILES) {
            return res.status(400).json({ error: `Достигнут лимит медиафайлов на кнопку (не более ${MAX_FILES})` });
        }

        let position = await nextMediaPosition(req.params.id);
        for (const file of req.files) {
            const { url, type } = await saveMediaFile(file);
            await pool.query(
                'INSERT INTO interactive_button_media (button_id, url, type, position) VALUES ($1, $2, $3, $4)',
                [req.params.id, url, type, position++]
            );
        }

        res.status(201).json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при загрузке медиафайлов' });
    }
});

router.delete('/:id/media/:mediaId', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM interactive_button_media WHERE id = $1 AND button_id = $2 RETURNING url',
            [req.params.mediaId, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Медиафайл не найден' });
        }

        fs.unlink(path.join(UPLOAD_DIR, path.basename(result.rows[0].url)), () => {});

        res.json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при удалении медиафайла' });
    }
});

router.post('/media/:mediaId/hotspots', requireAdmin, async (req, res) => {
    const { x, y, width, height } = req.body;
    const text = (req.body.text || '').trim();

    const nums = [x, y, width, height].map(Number);
    if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 1)) {
        return res.status(400).json({ error: 'Некорректные координаты области' });
    }
    if (nums[2] <= 0 || nums[3] <= 0) {
        return res.status(400).json({ error: 'Область должна иметь ненулевой размер' });
    }
    if (!text) {
        return res.status(400).json({ error: 'Текст подсказки не может быть пустым' });
    }

    try {
        const media = await pool.query("SELECT id FROM interactive_button_media WHERE id = $1", [req.params.mediaId]);
        if (media.rows.length === 0) {
            return res.status(404).json({ error: 'Медиафайл не найден' });
        }

        await pool.query(
            'INSERT INTO media_hotspots (media_id, x, y, width, height, text) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.params.mediaId, nums[0], nums[1], nums[2], nums[3], text]
        );

        res.status(201).json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при добавлении области' });
    }
});

router.delete('/media/:mediaId/hotspots/:hotspotId', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM media_hotspots WHERE id = $1 AND media_id = $2 RETURNING id',
            [req.params.hotspotId, req.params.mediaId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Область не найдена' });
        }
        res.json({ buttons: await getButtons() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при удалении области' });
    }
});

router.put('/:id/move', requireAdmin, async (req, res) => {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({ error: 'Некорректное направление перемещения' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const current = await client.query('SELECT id, position FROM interactive_buttons WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (current.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Кнопка не найдена' });
        }

        const neighborQuery = direction === 'up'
            ? 'SELECT id, position FROM interactive_buttons WHERE position < $1 ORDER BY position DESC LIMIT 1'
            : 'SELECT id, position FROM interactive_buttons WHERE position > $1 ORDER BY position ASC LIMIT 1';
        const neighbor = await client.query(neighborQuery, [current.rows[0].position]);

        if (neighbor.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ buttons: await getButtons() });
        }

        await client.query('UPDATE interactive_buttons SET position = $1 WHERE id = $2', [neighbor.rows[0].position, current.rows[0].id]);
        await client.query('UPDATE interactive_buttons SET position = $1 WHERE id = $2', [current.rows[0].position, neighbor.rows[0].id]);

        await client.query('COMMIT');
        res.json({ buttons: await getButtons() });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при перемещении кнопки' });
    } finally {
        client.release();
    }
});

module.exports = router;
