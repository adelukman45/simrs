const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token autentikasi tidak ditemukan.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      status: 'error',
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Akses ditolak. Peran '${req.user?.role || 'UNKNOWN'}' tidak memiliki kewenangan.`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };