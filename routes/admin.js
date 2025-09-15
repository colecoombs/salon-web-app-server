const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
});

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Secure appointments endpoint
const supabase = require('../supabaseClient');
router.get('/appointments', verifyToken, async (req, res) => {
  const { data, error } = await supabase.from('appointments').select('*');
  if (error) return res.status(500).json({ error });
  res.json(data);
});

module.exports = router;
