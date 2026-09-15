(function () {
    async function renderNav() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return null;

        let user = null;
        try {
            const data = await apiFetch('/api/auth/me');
            user = data.user;
        } catch (e) {
            user = null;
        }

        const path = window.location.pathname;
        const isActive = (href) => (path === href ? ' active' : '');

        // Для неавторизованных гостей навигация не нужна: на каждой странице
        // уже есть свой путь ко входу/регистрации (форма, центральный блок и т.п.).
        if (!user) {
            navbar.style.display = 'none';
            return user;
        }

        const adminLink = user.role === 'admin'
            ? `<a class="nav-link${isActive('/pages/admin.html')}" href="/pages/admin.html">Админ-панель</a>`
            : '';

        navbar.classList.add('navbar');
        navbar.innerHTML = `
            <div class="navbar-left">
                <div class="navbar-links">
                    <a class="nav-link${isActive('/')}" href="/">Главная</a>
                    <a class="nav-link${isActive('/pages/interactive.html')}" href="/pages/interactive.html">Интерактив</a>
                    ${adminLink}
                </div>
            </div>
            <div class="navbar-right">
                <button class="avatar-circle" id="profile-avatar-btn" title="${escapeHtml(user.username)}">${escapeHtml(user.username.charAt(0).toUpperCase())}</button>
            </div>
        `;

        const avatarBtn = document.getElementById('profile-avatar-btn');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', () => {
                window.location.href = '/pages/profile.html';
            });
        }

        return user;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    window.currentUserPromise = renderNav();
})();
