(async function () {
    const errorBox = document.getElementById('error-box');
    const successBox = document.getElementById('success-box');

    const user = await window.currentUserPromise;
    if (!user || user.role !== 'admin') {
        window.location.href = '/';
        return;
    }

    function showError(message) {
        successBox.classList.remove('visible');
        errorBox.textContent = message;
        errorBox.classList.add('visible');
    }

    function showSuccess(message) {
        errorBox.classList.remove('visible');
        successBox.textContent = message;
        successBox.classList.add('visible');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Вкладки ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            tabButtons.forEach((b) => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // --- Главная страница: заголовок ---
    const titleForm = document.getElementById('home-title-form');
    const blocksList = document.getElementById('blocks-list');

    titleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        try {
            await apiFetch('/api/home', { method: 'PUT', body: JSON.stringify({ title }) });
            showSuccess('Заголовок сохранён');
        } catch (err) {
            showError(err.message);
        }
    });

    // --- Главная страница: блоки контента ---
    function renderBlocks(blocks) {
        if (!blocks || blocks.length === 0) {
            blocksList.innerHTML = '<p class="muted">Контент пока не добавлен — добавьте текстовый блок или медиа ниже.</p>';
            return;
        }

        blocksList.innerHTML = blocks.map((block, index) => {
            const moveButtons = `
                <button type="button" class="block-move-btn" data-action="up" data-id="${block.id}" ${index === 0 ? 'disabled' : ''} aria-label="Переместить выше">&uarr;</button>
                <button type="button" class="block-move-btn" data-action="down" data-id="${block.id}" ${index === blocks.length - 1 ? 'disabled' : ''} aria-label="Переместить ниже">&darr;</button>
            `;

            if (block.type === 'text') {
                return `
                    <div class="block-item" data-id="${block.id}">
                        <div class="block-item-header">
                            <span class="block-type-badge">Текст</span>
                            <div class="block-item-actions">
                                ${moveButtons}
                                <button type="button" class="block-remove-btn" data-id="${block.id}" aria-label="Удалить блок">&times;</button>
                            </div>
                        </div>
                        <textarea class="block-text-input" data-id="${block.id}">${escapeHtml(block.content)}</textarea>
                        <button type="button" class="btn btn-outline btn-sm block-save-text-btn" data-id="${block.id}">Сохранить текст</button>
                    </div>
                `;
            }

            if (block.type === 'columns') {
                const columnsHtml = block.columns.map((col, i) => {
                    const media = col.mediaUrl
                        ? `
                            <div class="block-media-preview" data-url="${col.mediaUrl}" data-type="${col.mediaType}">
                                ${col.mediaType === 'video' ? `<video src="${col.mediaUrl}" controls></video>` : `<img src="${col.mediaUrl}" alt="">`}
                            </div>
                            <button type="button" class="btn btn-outline btn-sm column-media-remove-btn" data-id="${block.id}" data-col="${i}">Убрать медиа</button>`
                        : '<p class="muted">Медиа не добавлено</p>';
                    return `
                        <div class="block-column">
                            <div class="block-column-label">${i === 0 ? 'Левый столбец' : 'Правый столбец'}</div>
                            ${media}
                            <label class="btn btn-outline btn-sm file-btn">
                                ${col.mediaUrl ? 'Заменить медиа' : '+ Добавить медиа'}
                                <input type="file" class="column-media-input" data-id="${block.id}" data-col="${i}" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" hidden>
                            </label>
                            <textarea class="block-text-input column-text-input" data-id="${block.id}" data-col="${i}" placeholder="Текст под медиа (необязательно)">${escapeHtml(col.text)}</textarea>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="block-item" data-id="${block.id}">
                        <div class="block-item-header">
                            <span class="block-type-badge">Два столбца</span>
                            <div class="block-item-actions">
                                ${moveButtons}
                                <button type="button" class="block-remove-btn" data-id="${block.id}" aria-label="Удалить блок">&times;</button>
                            </div>
                        </div>
                        <div class="block-columns-editor">${columnsHtml}</div>
                        <button type="button" class="btn btn-outline btn-sm column-save-btn" data-id="${block.id}">Сохранить тексты</button>
                    </div>
                `;
            }

            const media = block.type === 'video'
                ? `<video src="${block.content}" controls></video>`
                : `<img src="${block.content}" alt="" data-lightbox="1">`;

            return `
                <div class="block-item" data-id="${block.id}">
                    <div class="block-item-header">
                        <span class="block-type-badge">${block.type === 'video' ? 'Видео' : 'Изображение'}</span>
                        <div class="block-item-actions">
                            ${moveButtons}
                            <button type="button" class="block-remove-btn" data-id="${block.id}" aria-label="Удалить блок">&times;</button>
                        </div>
                    </div>
                    <div class="block-media-preview" data-url="${block.content}" data-type="${block.type}">${media}</div>
                </div>
            `;
        }).join('');

        blocksList.querySelectorAll('.block-move-btn').forEach((btn) => {
            btn.addEventListener('click', () => moveBlock(btn.dataset.id, btn.dataset.action));
        });
        blocksList.querySelectorAll('.block-remove-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeBlock(btn.dataset.id));
        });
        blocksList.querySelectorAll('.block-save-text-btn').forEach((btn) => {
            btn.addEventListener('click', () => saveTextBlock(btn.dataset.id));
        });
        blocksList.querySelectorAll('.column-save-btn').forEach((btn) => {
            btn.addEventListener('click', () => saveColumnTexts(btn.dataset.id));
        });
        blocksList.querySelectorAll('.column-media-input').forEach((input) => {
            input.addEventListener('change', () => uploadColumnMedia(input.dataset.id, input.dataset.col, input));
        });
        blocksList.querySelectorAll('.column-media-remove-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeColumnMedia(btn.dataset.id, btn.dataset.col));
        });
        blocksList.querySelectorAll('.block-media-preview img').forEach((img) => {
            img.addEventListener('click', () => {
                const tile = img.closest('.block-media-preview');
                window.openLightbox(tile.dataset.url, tile.dataset.type);
            });
        });
    }

    function readColumnTexts(id) {
        return Array.from(blocksList.querySelectorAll(`.column-text-input[data-id="${id}"]`))
            .sort((a, b) => a.dataset.col - b.dataset.col)
            .map((textarea) => textarea.value);
    }

    function putColumnTexts(id) {
        return apiFetch(`/api/home/blocks/${id}/columns`, {
            method: 'PUT',
            body: JSON.stringify({ texts: readColumnTexts(id) }),
        });
    }

    async function saveColumnTexts(id) {
        try {
            const { blocks } = await putColumnTexts(id);
            renderBlocks(blocks);
            showSuccess('Тексты столбцов сохранены');
        } catch (err) {
            showError(err.message);
        }
    }

    // Перед работой с медиа сохраняем набранный текст: после загрузки
    // список блоков перерисовывается, и несохранённое пропало бы.
    async function uploadColumnMedia(id, col, input) {
        if (!input.files || input.files.length === 0) return;

        const formData = new FormData();
        formData.append('media', input.files[0]);
        try {
            await putColumnTexts(id);
            const { blocks } = await apiFetch(`/api/home/blocks/${id}/columns/${col}/media`, { method: 'POST', body: formData });
            renderBlocks(blocks);
            showSuccess('Медиафайл добавлен');
        } catch (err) {
            showError(err.message);
        } finally {
            input.value = '';
        }
    }

    async function removeColumnMedia(id, col) {
        try {
            await putColumnTexts(id);
            const { blocks } = await apiFetch(`/api/home/blocks/${id}/columns/${col}/media`, { method: 'DELETE' });
            renderBlocks(blocks);
            showSuccess('Медиафайл убран');
        } catch (err) {
            showError(err.message);
        }
    }

    async function loadHome() {
        try {
            const { home } = await apiFetch('/api/home');
            document.getElementById('title').value = home.title || '';
            renderBlocks(home.blocks);
        } catch (err) {
            showError(err.message);
        }
    }

    async function moveBlock(id, direction) {
        try {
            const { blocks } = await apiFetch(`/api/home/blocks/${id}/move`, {
                method: 'PUT',
                body: JSON.stringify({ direction }),
            });
            renderBlocks(blocks);
        } catch (err) {
            showError(err.message);
        }
    }

    async function removeBlock(id) {
        try {
            const { blocks } = await apiFetch(`/api/home/blocks/${id}`, { method: 'DELETE' });
            renderBlocks(blocks);
            showSuccess('Блок удалён');
        } catch (err) {
            showError(err.message);
        }
    }

    async function saveTextBlock(id) {
        const textarea = blocksList.querySelector(`.block-text-input[data-id="${id}"]`);
        try {
            const { blocks } = await apiFetch(`/api/home/blocks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ content: textarea.value }),
            });
            renderBlocks(blocks);
            showSuccess('Текстовый блок сохранён');
        } catch (err) {
            showError(err.message);
        }
    }

    document.getElementById('add-text-block-btn').addEventListener('click', async () => {
        try {
            const { blocks } = await apiFetch('/api/home/blocks/text', {
                method: 'POST',
                body: JSON.stringify({ content: 'Новый текстовый блок' }),
            });
            renderBlocks(blocks);
        } catch (err) {
            showError(err.message);
        }
    });

    document.getElementById('add-columns-block-btn').addEventListener('click', async () => {
        try {
            const { blocks } = await apiFetch('/api/home/blocks/columns', { method: 'POST' });
            renderBlocks(blocks);
        } catch (err) {
            showError(err.message);
        }
    });

    document.getElementById('media-input').addEventListener('change', async (e) => {
        const input = e.target;
        if (!input.files || input.files.length === 0) return;

        const formData = new FormData();
        Array.from(input.files).forEach((file) => formData.append('media', file));
        try {
            const { blocks } = await apiFetch('/api/home/blocks/media', { method: 'POST', body: formData });
            renderBlocks(blocks);
            showSuccess('Медиафайлы добавлены');
        } catch (err) {
            showError(err.message);
        } finally {
            input.value = '';
        }
    });

    // --- Интерактив: кнопки ---
    const buttonsList = document.getElementById('interactive-buttons-list');
    const newButtonForm = document.getElementById('new-button-form');

    function renderInteractiveButtons(buttons) {
        if (!buttons || buttons.length === 0) {
            buttonsList.innerHTML = '<p class="muted">Кнопок пока нет — добавьте первую выше.</p>';
            return;
        }

        buttonsList.innerHTML = buttons.map((btn, index) => {
            const moveButtons = `
                <button type="button" class="block-move-btn" data-action="up" data-id="${btn.id}" ${index === 0 ? 'disabled' : ''} aria-label="Переместить выше">&uarr;</button>
                <button type="button" class="block-move-btn" data-action="down" data-id="${btn.id}" ${index === buttons.length - 1 ? 'disabled' : ''} aria-label="Переместить ниже">&darr;</button>
            `;

            const mediaTiles = (btn.media || []).map((m) => `
                <div class="media-tile" data-id="${m.id}">
                    ${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`}
                    ${m.type === 'image' ? `<button type="button" class="media-tile-annotate interactive-annotate-btn" data-media-id="${m.id}" aria-label="Разметить область">⛶</button>` : ''}
                    <button type="button" class="media-tile-remove interactive-remove-media-btn" data-button-id="${btn.id}" data-media-id="${m.id}" aria-label="Удалить медиафайл">&times;</button>
                </div>
            `).join('');

            return `
                <div class="block-item" data-id="${btn.id}">
                    <div class="block-item-header">
                        <span class="block-type-badge">Кнопка</span>
                        <div class="block-item-actions">
                            ${moveButtons}
                            <button type="button" class="block-remove-btn" data-id="${btn.id}" aria-label="Удалить кнопку">&times;</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Название</label>
                        <input type="text" class="interactive-title-input" data-id="${btn.id}" value="${escapeHtml(btn.title)}">
                    </div>
                    <div class="form-group">
                        <label>Описание</label>
                        <textarea class="interactive-description-input" data-id="${btn.id}">${escapeHtml(btn.description)}</textarea>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm interactive-save-btn" data-id="${btn.id}">Сохранить кнопку</button>

                    <div class="media-gallery-block">
                        <label class="media-section-label">Медиафайлы (до 10 штук, на странице листаются стрелками)</label>
                        <div class="media-gallery">${mediaTiles || '<p class="muted">Медиафайлы не добавлены</p>'}</div>
                        <label class="btn btn-outline btn-sm file-btn">
                            + Добавить медиа
                            <input type="file" class="interactive-media-input" data-id="${btn.id}" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" multiple hidden>
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        buttonsList.querySelectorAll('.block-move-btn').forEach((btn) => {
            btn.addEventListener('click', () => moveInteractiveButton(btn.dataset.id, btn.dataset.action));
        });
        buttonsList.querySelectorAll('.block-remove-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeInteractiveButton(btn.dataset.id));
        });
        buttonsList.querySelectorAll('.interactive-remove-media-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeInteractiveMedia(btn.dataset.buttonId, btn.dataset.mediaId));
        });
        buttonsList.querySelectorAll('.interactive-save-btn').forEach((btn) => {
            btn.addEventListener('click', () => saveInteractiveButton(btn.dataset.id));
        });
        buttonsList.querySelectorAll('.interactive-media-input').forEach((input) => {
            input.addEventListener('change', () => addInteractiveMedia(input.dataset.id, input));
        });
        buttonsList.querySelectorAll('.media-tile img').forEach((img) => {
            img.addEventListener('click', () => {
                const tile = img.closest('.media-tile');
                const video = tile.querySelector('video');
                window.openLightbox(img.src, video ? 'video' : 'image');
            });
        });
        buttonsList.querySelectorAll('.interactive-annotate-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const allMedia = buttons.flatMap((b) => b.media || []);
                const media = allMedia.find((m) => String(m.id) === String(btn.dataset.mediaId));
                if (media) {
                    window.openHotspotEditor(media, loadInteractiveButtons);
                }
            });
        });
    }

    async function loadInteractiveButtons() {
        try {
            const { buttons } = await apiFetch('/api/interactive');
            renderInteractiveButtons(buttons);
        } catch (err) {
            showError(err.message);
        }
    }

    newButtonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('new-button-title').value.trim();
        if (!title) {
            showError('Введите название кнопки');
            return;
        }

        try {
            const { buttons } = await apiFetch('/api/interactive', {
                method: 'POST',
                body: JSON.stringify({ title, description: document.getElementById('new-button-description').value }),
            });
            renderInteractiveButtons(buttons);
            newButtonForm.reset();
            showSuccess('Кнопка добавлена');
        } catch (err) {
            showError(err.message);
        }
    });

    async function saveInteractiveButton(id) {
        const title = buttonsList.querySelector(`.interactive-title-input[data-id="${id}"]`).value.trim();
        const description = buttonsList.querySelector(`.interactive-description-input[data-id="${id}"]`).value;

        if (!title) {
            showError('Название кнопки не может быть пустым');
            return;
        }

        try {
            const { buttons } = await apiFetch(`/api/interactive/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ title, description }),
            });
            renderInteractiveButtons(buttons);
            showSuccess('Кнопка сохранена');
        } catch (err) {
            showError(err.message);
        }
    }

    async function addInteractiveMedia(buttonId, input) {
        if (!input.files || input.files.length === 0) return;

        const formData = new FormData();
        Array.from(input.files).forEach((file) => formData.append('media', file));
        try {
            const { buttons } = await apiFetch(`/api/interactive/${buttonId}/media`, { method: 'POST', body: formData });
            renderInteractiveButtons(buttons);
            showSuccess('Медиафайлы добавлены');
        } catch (err) {
            showError(err.message);
        } finally {
            input.value = '';
        }
    }

    async function removeInteractiveMedia(buttonId, mediaId) {
        try {
            const { buttons } = await apiFetch(`/api/interactive/${buttonId}/media/${mediaId}`, { method: 'DELETE' });
            renderInteractiveButtons(buttons);
            showSuccess('Медиафайл удалён');
        } catch (err) {
            showError(err.message);
        }
    }

    async function removeInteractiveButton(id) {
        try {
            const { buttons } = await apiFetch(`/api/interactive/${id}`, { method: 'DELETE' });
            renderInteractiveButtons(buttons);
            showSuccess('Кнопка удалена');
        } catch (err) {
            showError(err.message);
        }
    }

    async function moveInteractiveButton(id, direction) {
        try {
            const { buttons } = await apiFetch(`/api/interactive/${id}/move`, {
                method: 'PUT',
                body: JSON.stringify({ direction }),
            });
            renderInteractiveButtons(buttons);
        } catch (err) {
            showError(err.message);
        }
    }

    // --- Пользователи ---
    function renderUsersTable(tbodyId, users, emptyMessage) {
        const tbody = document.getElementById(tbodyId);
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="muted">${emptyMessage}</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map((u) => `
            <tr>
                <td>${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
            </tr>
        `).join('');
    }

    async function loadUsers() {
        try {
            const { users } = await apiFetch('/api/admin/users');
            const admins = users.filter((u) => u.role === 'admin');
            const regular = users.filter((u) => u.role !== 'admin');
            renderUsersTable('admins-table-body', admins, 'Администраторов пока нет');
            renderUsersTable('users-table-body', regular, 'Пользователей пока нет');
        } catch (err) {
            document.getElementById('admins-table-body').innerHTML = `<tr><td colspan="3" class="muted">Ошибка загрузки: ${escapeHtml(err.message)}</td></tr>`;
            document.getElementById('users-table-body').innerHTML = '';
        }
    }

    loadHome();
    loadInteractiveButtons();
    loadUsers();
})();
