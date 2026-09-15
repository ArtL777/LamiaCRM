(function () {
    function ensureOverlay() {
        let overlay = document.getElementById('lightbox-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = `
            <button type="button" class="lightbox-close" aria-label="Закрыть">&times;</button>
            <div class="lightbox-content"></div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeLightbox();
        });
        overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });

        return overlay;
    }

    function closeLightbox() {
        const overlay = document.getElementById('lightbox-overlay');
        if (!overlay) return;
        overlay.classList.remove('visible');
        overlay.querySelector('.lightbox-content').innerHTML = '';
    }

    window.openLightbox = function (url, type) {
        const overlay = ensureOverlay();
        overlay.querySelector('.lightbox-content').innerHTML = type === 'video'
            ? `<video src="${url}" controls autoplay></video>`
            : `<img src="${url}" alt="">`;
        overlay.classList.add('visible');
    };

    window.closeLightbox = closeLightbox;
})();
