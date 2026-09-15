(async function () {
    const form = document.getElementById('login-form');
    const errorBox = document.getElementById('error-box');

    const user = await window.currentUserPromise;
    if (user) {
        window.location.href = '/';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.classList.remove('visible');

        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value;

        try {
            await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ identifier, password }),
            });
            window.location.href = '/';
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.classList.add('visible');
        }
    });
})();
