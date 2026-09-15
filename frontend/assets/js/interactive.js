(async function () {
    const root = document.getElementById('interactive-root');
    let carouselIndex = 0;
    let pinnedHotspots = new Set();
    let hoveredHotspotId = null;

    let user = null;
    try {
        user = await window.currentUserPromise;
    } catch (e) {
        user = null;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderHotspotPanel(hotspots) {
        const leftPanel = document.getElementById('hotspot-panel-left');
        const rightPanel = document.getElementById('hotspot-panel-right');
        if (!leftPanel || !rightPanel) return;

        function cardHtml(h) {
            const isPinned = pinnedHotspots.has(h.id);
            return `
                <div class="hotspot-card${isPinned ? '' : ' hotspot-card-preview'}" data-hotspot-id="${h.id}">
                    ${isPinned ? '<button type="button" class="hotspot-card-close" aria-label="Закрыть">&times;</button>' : ''}
                    <p class="hotspot-card-text">${escapeHtml(h.text)}</p>
                </div>
            `;
        }

        // Карточка появляется у того края фото, к которому ближе сама
        // область — так блоки естественно распределяются по обе стороны
        // от изображения, а не наваливаются в одну колонку.
        const visible = hotspots.filter((h) => pinnedHotspots.has(h.id) || h.id === hoveredHotspotId);
        const leftList = visible.filter((h) => h.x + h.width / 2 < 0.5);
        const rightList = visible.filter((h) => h.x + h.width / 2 >= 0.5);

        leftPanel.innerHTML = leftList.map(cardHtml).join('');
        rightPanel.innerHTML = rightList.map(cardHtml).join('');

        [leftPanel, rightPanel].forEach((panel) => {
            panel.querySelectorAll('.hotspot-card-close').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.closest('.hotspot-card').dataset.hotspotId);
                    togglePinnedHotspot(id, hotspots);
                });
            });
        });
    }

    function togglePinnedHotspot(id, hotspots) {
        if (pinnedHotspots.has(id)) {
            pinnedHotspots.delete(id);
        } else {
            pinnedHotspots.add(id);
        }
        document.querySelectorAll(`.hotspot[data-hotspot-id="${id}"]`).forEach((el) => {
            el.classList.toggle('active', pinnedHotspots.has(id));
        });
        renderHotspotPanel(hotspots);
    }

    function renderCarouselFrame(media) {
        const track = document.getElementById('carousel-track');
        if (!track) return;

        const item = media[carouselIndex];
        pinnedHotspots = new Set();
        hoveredHotspotId = null;

        if (item.type === 'video') {
            track.innerHTML = `<video src="${item.url}" controls></video>`;
        } else {
            const hotspots = item.hotspots || [];
            const hotspotsHtml = hotspots.map((h) => (
                `<div class="hotspot" data-hotspot-id="${h.id}" style="left:${h.x * 100}%;top:${h.y * 100}%;width:${h.width * 100}%;height:${h.height * 100}%"></div>`
            )).join('');
            track.innerHTML = `<div class="hotspot-wrapper"><img src="${item.url}" alt="">${hotspotsHtml}</div>`;

            track.querySelectorAll('.hotspot').forEach((el) => {
                const id = Number(el.dataset.hotspotId);
                el.addEventListener('mouseenter', () => {
                    hoveredHotspotId = id;
                    renderHotspotPanel(hotspots);
                });
                el.addEventListener('mouseleave', () => {
                    if (hoveredHotspotId === id) {
                        hoveredHotspotId = null;
                        renderHotspotPanel(hotspots);
                    }
                });
                el.addEventListener('click', () => togglePinnedHotspot(id, hotspots));
            });
        }

        renderHotspotPanel(item.hotspots || []);

        document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === carouselIndex);
        });

        const img = track.querySelector('img');
        if (img) {
            img.addEventListener('click', (e) => {
                if (e.target.closest('.hotspot')) return;
                window.openLightbox(item.url, item.type);
            });
        }
    }

    function attachCarouselHandlers(media) {
        renderCarouselFrame(media);

        const prevBtn = document.getElementById('carousel-prev');
        const nextBtn = document.getElementById('carousel-next');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                carouselIndex = (carouselIndex - 1 + media.length) % media.length;
                renderCarouselFrame(media);
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                carouselIndex = (carouselIndex + 1) % media.length;
                renderCarouselFrame(media);
            });
        }
        document.querySelectorAll('.carousel-dot').forEach((dot) => {
            dot.addEventListener('click', () => {
                carouselIndex = Number(dot.dataset.index);
                renderCarouselFrame(media);
            });
        });
    }

    function renderContent(button) {
        const content = document.getElementById('interactive-content');
        if (!content) return;

        const media = button.media || [];
        carouselIndex = 0;

        const carouselHtml = media.length > 0 ? `
            <div class="interactive-media-row">
                <div class="hotspot-panel hotspot-panel-left" id="hotspot-panel-left"></div>
                <div class="interactive-carousel">
                    <div class="interactive-carousel-track" id="carousel-track"></div>
                    ${media.length > 1 ? `
                        <button type="button" class="carousel-arrow prev" id="carousel-prev" aria-label="Предыдущее фото">&lsaquo;</button>
                        <button type="button" class="carousel-arrow next" id="carousel-next" aria-label="Следующее фото">&rsaquo;</button>
                    ` : ''}
                </div>
                <div class="hotspot-panel hotspot-panel-right" id="hotspot-panel-right"></div>
            </div>
            ${media.length > 1 ? `
                <div class="carousel-dots">
                    ${media.map((_, i) => `<button type="button" class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Показать фото ${i + 1}"></button>`).join('')}
                </div>
            ` : ''}
        ` : '';

        content.innerHTML = `
            <h2 class="interactive-content-title">${escapeHtml(button.title)}</h2>
            ${carouselHtml}
            ${button.description ? `<div class="interactive-description"><p class="home-block-text">${escapeHtml(button.description)}</p></div>` : ''}
        `;

        if (media.length > 0) {
            attachCarouselHandlers(media);
        }
    }

    function selectButton(buttons, id) {
        const button = buttons.find((b) => String(b.id) === String(id));
        if (!button) return;

        document.querySelectorAll('.interactive-btn-item').forEach((el) => {
            el.classList.toggle('active', String(el.dataset.id) === String(id));
        });
        renderContent(button);
    }

    try {
        const { buttons } = await apiFetch('/api/interactive');
        const isAdmin = user && user.role === 'admin';

        if (buttons.length === 0) {
            root.innerHTML = `
                <div class="page page-wide">
                    <h1 class="page-title">Интерактив</h1>
                    <div class="card placeholder-page">
                        <div class="placeholder-icon">🛠️</div>
                        <p>Кнопки пока не добавлены.</p>
                        ${isAdmin ? '<a class="btn btn-primary mt-16" href="/pages/admin.html">Добавить кнопку</a>' : ''}
                    </div>
                </div>
            `;
            return;
        }

        root.innerHTML = `
            <div class="interactive-shell">
                <aside class="interactive-sidebar">
                    ${buttons.map((b, i) => `
                        <button type="button" class="interactive-btn-item${i === 0 ? ' active' : ''}" data-id="${b.id}">${escapeHtml(b.title)}</button>
                    `).join('')}
                </aside>
                <div class="interactive-main">
                    <h1 class="page-title">Интерактив</h1>
                    <section class="interactive-content card" id="interactive-content"></section>
                </div>
            </div>
        `;

        document.querySelectorAll('.interactive-btn-item').forEach((el) => {
            el.addEventListener('click', () => selectButton(buttons, el.dataset.id));
        });

        renderContent(buttons[0]);
    } catch (e) {
        root.innerHTML = `<div class="card"><p class="muted text-center">Не удалось загрузить раздел «Интерактив».</p></div>`;
    }
})();
