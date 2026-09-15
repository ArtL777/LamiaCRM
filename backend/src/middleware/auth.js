function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Требуются права администратора' });
    }
    next();
}

module.exports = { requireAuth, requireAdmin };
