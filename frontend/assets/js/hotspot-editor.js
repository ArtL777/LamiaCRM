(function () {
    function ensureOverlay() {
        let overlay = document.getElementById('hotspot-editor-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'hotspot-editor-overlay';
        overlay.className = 'hotspot-editor-overlay';
        overlay.innerHTML = `
            <div class="hotspot-editor-panel">
                <div class="hotspot-editor-header">
                    <h3>Разметка изображения</h3>
                    <button type="button" class="hotspot-editor-close" aria-label="Закрыть">&times;</button>
                </div>
                <p class="muted hotspot-editor-hint">Зажмите левую кнопку мыши на изображении и выделите область, затем впишите текст подсказки.</p>
                <div class="hotspot-editor-canvas-wrap">
                    <div class="hotspot-editor-canvas" id="hotspot-canvas"></div>
                </div>
                <div class="hotspot-draft-form" id="hotspot-draft-form" hidden>
                    <textarea id="hotspot-draft-text" placeholder="Текст подсказки, которая появится при наведении"></textarea>
                    <div class="form-actions">
                        <button type="button" class="btn btn-primary btn-sm" id="hotspot-save-btn">Сохранить область</button>
                        <button type="button" class="btn btn-outline btn-sm" id="hotspot-cancel-btn">Отмена</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeEditor();
        });
        overlay.querySelector('.hotspot-editor-close').addEventListener('click', closeEditor);
        setupDrawing();

        return overlay;
    }

    function closeEditor() {
        const overlay = document.getElementById('hotspot-editor-overlay');
        if (overlay) overlay.classList.remove('visible');
    }

    let state = null; // { media, onSaved, draft }

    function renderHotspots() {
        const canvas = document.getElementById('hotspot-canvas');
        canvas.querySelectorAll('.hotspot-box').forEach((el) => el.remove());

        (state.media.hotspots || []).forEach((h) => {
            const box = document.createElement('div');
            box.className = 'hotspot-box';
            box.style.left = (h.x * 100) + '%';
            box.style.top = (h.y * 100) + '%';
            box.style.width = (h.width * 100) + '%';
            box.style.height = (h.height * 100) + '%';
            box.title = h.text;
            box.innerHTML = `<button type="button" class="hotspot-box-remove" aria-label="Удалить область">&times;</button>`;
            box.querySelector('.hotspot-box-remove').addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await apiFetch(`/api/interactive/media/${state.media.id}/hotspots/${h.id}`, { method: 'DELETE' });
                    state.media.hotspots = state.media.hotspots.filter((x) => x.id !== h.id);
                    renderHotspots();
                    if (state.onSaved) state.onSaved();
                } catch (err) {
                    alert(err.message);
                }
            });
            canvas.appendChild(box);
        });
    }

    function setupDrawing() {
        const canvas = document.getElementById('hotspot-canvas');
        const form = document.getElementById('hotspot-draft-form');
        const textarea = document.getElementById('hotspot-draft-text');
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let draftEl = null;

        function clamp(v) {
            return Math.max(0, Math.min(1, v));
        }

        function pointFromEvent(e) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: clamp((e.clientX - rect.left) / rect.width),
                y: clamp((e.clientY - rect.top) / rect.height),
            };
        }

        function resetDraft() {
            if (draftEl) draftEl.remove();
            draftEl = null;
            form.hidden = true;
            textarea.value = '';
        }

        canvas.addEventListener('mousedown', (e) => {
            // Существующие области не должны мешать рисовать новые — даже
            // поверх них. Блокируем старт только на самой кнопке удаления.
            if (e.target.closest('.hotspot-box-remove')) return;
            resetDraft();
            dragging = true;
            const p = pointFromEvent(e);
            startX = p.x;
            startY = p.y;
            draftEl = document.createElement('div');
            draftEl.className = 'hotspot-box hotspot-box-draft';
            canvas.appendChild(draftEl);
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!dragging || !draftEl) return;
            const p = pointFromEvent(e);
            const x = Math.min(startX, p.x);
            const y = Math.min(startY, p.y);
            const w = Math.abs(p.x - startX);
            const h = Math.abs(p.y - startY);
            draftEl.style.left = (x * 100) + '%';
            draftEl.style.top = (y * 100) + '%';
            draftEl.style.width = (w * 100) + '%';
            draftEl.style.height = (h * 100) + '%';
            draftEl.dataset.x = x;
            draftEl.dataset.y = y;
            draftEl.dataset.w = w;
            draftEl.dataset.h = h;
        });

        window.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            if (!draftEl) return;
            const w = Number(draftEl.dataset.w || 0);
            const h = Number(draftEl.dataset.h || 0);
            if (w < 0.02 || h < 0.02) {
                resetDraft();
                return;
            }
            form.hidden = false;
            textarea.focus();
        });

        document.getElementById('hotspot-save-btn').addEventListener('click', async () => {
            if (!draftEl) return;
            const text = textarea.value.trim();
            if (!text) {
                alert('Введите текст подсказки');
                return;
            }
            try {
                const { buttons } = await apiFetch(`/api/interactive/media/${state.media.id}/hotspots`, {
                    method: 'POST',
                    body: JSON.stringify({
                        x: Number(draftEl.dataset.x),
                        y: Number(draftEl.dataset.y),
                        width: Number(draftEl.dataset.w),
                        height: Number(draftEl.dataset.h),
                        text,
                    }),
                });
                const updatedMedia = buttons.flatMap((b) => b.media || []).find((m) => m.id === state.media.id);
                state.media.hotspots = updatedMedia ? updatedMedia.hotspots : state.media.hotspots;
                resetDraft();
                renderHotspots();
                if (state.onSaved) state.onSaved();
            } catch (err) {
                alert(err.message);
            }
        });

        document.getElementById('hotspot-cancel-btn').addEventListener('click', resetDraft);
    }

    window.openHotspotEditor = function (media, onSaved) {
        const overlay = ensureOverlay();
        state = { media, onSaved };

        const canvas = document.getElementById('hotspot-canvas');
        canvas.innerHTML = `<img src="${media.url}" alt="" draggable="false">`;
        renderHotspots();

        overlay.classList.add('visible');
    };
})();
