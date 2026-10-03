(async function () {
    const root = document.getElementById('home-root');

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

    // Соседние медиаблоки объединяются в одну сетку: чем больше файлов
    // подряд, тем меньше и компактнее становятся плитки (см. .media-cluster-*).
    function renderBlocksHtml(blocks) {
        const pieces = [];
        let cluster = [];

        function clusterSizeClass(count) {
            if (count <= 3) return count;
            if (count <= 6) return 4;
            return 7;
        }

        function flushCluster() {
            if (cluster.length === 0) return;
            const sizeClass = clusterSizeClass(cluster.length);
            const tiles = cluster.map((block) => {
                const media = block.type === 'video'
                    ? `<video src="${block.content}" controls></video>`
                    : `<img src="${block.content}" alt="">`;
                return `<div class="home-block-media" data-url="${block.content}" data-type="${block.type}">${media}</div>`;
            }).join('');
            pieces.push(`<div class="media-cluster media-cluster-${sizeClass}">${tiles}</div>`);
            cluster = [];
        }

        function renderColumnsHtml(block) {
            const columns = block.columns.map((col) => {
                const media = !col.mediaUrl ? '' : `
                    <div class="home-block-media" data-url="${col.mediaUrl}" data-type="${col.mediaType}">
                        ${col.mediaType === 'video' ? `<video src="${col.mediaUrl}" controls></video>` : `<img src="${col.mediaUrl}" alt="">`}
                    </div>`;
                const text = col.text ? `<p class="home-block-text">${escapeHtml(col.text)}</p>` : '';
                return `<div class="home-column">${media}${text}</div>`;
            }).join('');
            return `<div class="home-columns">${columns}</div>`;
        }

        blocks.forEach((block) => {
            if (block.type === 'text') {
                flushCluster();
                pieces.push(`<p class="home-block-text">${escapeHtml(block.content)}</p>`);
            } else if (block.type === 'columns') {
                flushCluster();
                pieces.push(renderColumnsHtml(block));
            } else {
                cluster.push(block);
            }
        });
        flushCluster();

        return pieces.join('');
    }

    if (!user) {
        root.innerHTML = `
            <div class="card home-guest">
                <div class="home-guest-icon">👋</div>
                <h1 class="home-guest-title">Добро пожаловать в LamiaCRM</h1>
                <p class="home-guest-subtitle">Войдите в систему или зарегистрируйтесь, чтобы продолжить</p>
                <div class="home-guest-actions">
                    <a class="btn btn-primary" href="/pages/login.html">Войти</a>
                    <a class="btn btn-outline" href="/pages/register.html">Регистрация</a>
                </div>
            </div>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🔐</div>
                    <h3>Личный кабинет</h3>
                    <p>Зарегистрируйтесь и управляйте своим профилем — логин, почта и пароль всегда под рукой.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📰</div>
                    <h3>Лента в формате блога</h3>
                    <p>Администратор ведёт главную страницу как блог: текст и медиа можно чередовать в любом порядке.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🛠️</div>
                    <h3>Развивается</h3>
                    <p>Раздел «Интерактив» и новые возможности системы появятся здесь уже совсем скоро.</p>
                </div>
            </div>
        `;
        return;
    }

    const isAdmin = user.role === 'admin';

    try {
        const { home } = await apiFetch('/api/home');
        const blocks = home.blocks || [];
        const isEmpty = !home.title && blocks.length === 0;

        if (isEmpty) {
            root.innerHTML = `
                <div class="card home-empty">
                    <div class="home-empty-icon">📝</div>
                    <p>Главная страница пока не заполнена.</p>
                    ${isAdmin ? '<a class="btn btn-primary mt-16" href="/pages/admin.html">Заполнить страницу</a>' : ''}
                </div>
            `;
            return;
        }

        // Соседние медиаблоки группируются в одну адаптивную сетку —
        // чем больше файлов подряд, тем компактнее и презентабельнее плитки.
        const blocksHtml = renderBlocksHtml(blocks);

        root.innerHTML = `
            <div class="blog-meta">
                <span class="blog-tag">Главная страница</span>
                ${home.updatedAt ? `<span class="blog-date">Обновлено ${new Date(home.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>` : ''}
            </div>
            <article class="card blog-post">
                ${home.title ? `<h1 class="home-hero-title">${escapeHtml(home.title)}</h1>` : ''}
                <div class="blog-body">${blocksHtml}</div>
            </article>
        `;

        // Видео уже воспроизводится через нативные controls, лайтбокс нужен
        // только для увеличения изображений, чтобы клики не конфликтовали
        // с элементами управления плеера.
        root.querySelectorAll('.home-block-media img').forEach((img) => {
            const tile = img.closest('.home-block-media');
            img.addEventListener('click', () => window.openLightbox(tile.dataset.url, tile.dataset.type));
        });
    } catch (e) {
        root.innerHTML = `<div class="card"><p class="muted text-center">Не удалось загрузить главную страницу.</p></div>`;
    }
})();
