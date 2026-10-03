async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        credentials: 'same-origin',
        headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
        ...options,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
        if (res.status === 413) {
            throw new Error('Файл слишком большой для загрузки (максимум 100 МБ)');
        }
        throw new Error((data && data.error) || 'Ошибка запроса');
    }
    return data;
}
