async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        credentials: 'same-origin',
        headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
        ...options,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
        throw new Error((data && data.error) || 'Ошибка запроса');
    }
    return data;
}
