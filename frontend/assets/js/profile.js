(async function () {
    const form = document.getElementById('profile-form');
    const errorBox = document.getElementById('error-box');
    const successBox = document.getElementById('success-box');
    const logoutBtn = document.getElementById('logout-btn');
    const backLink = document.getElementById('back-link');

    if (backLink) {
        backLink.addEventListener('click', (e) => {
            if (window.history.length > 1) {
                e.preventDefault();
                window.history.back();
            }
        });
    }

    const user = await window.currentUserPromise;
    if (!user) {
        window.location.href = '/pages/login.html';
        return;
    }

    document.getElementById('username').value = user.username;
    document.getElementById('email').value = user.email;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.classList.remove('visible');
        successBox.classList.remove('visible');

        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const currentPassword = document.getElementById('currentPassword').value;

        const payload = { currentPassword };
        if (username !== user.username) payload.username = username;
        if (email !== user.email) payload.email = email;
        if (password) payload.password = password;

        try {
            const { user: updated } = await apiFetch('/api/profile', {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            successBox.textContent = 'Изменения сохранены';
            successBox.classList.add('visible');
            document.getElementById('password').value = '';
            document.getElementById('currentPassword').value = '';
            user.username = updated.username;
            user.email = updated.email;
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.classList.add('visible');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await apiFetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    });
})();
