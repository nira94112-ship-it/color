const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.OWNER_SECRET || 'rohith-portfolio-secret-key-2025';

// On Vercel, only /tmp is writable. Locally, use current directory.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_FILE = IS_SERVERLESS
  ? path.join('/tmp', 'portfolio-db.json')
  : path.join(__dirname, 'portfolio-db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initial Clean Database for Rohith
const initialDatabase = {
  ownerPasswordHash: hashText(process.env.OWNER_PASSWORD || 'rohith123'), // Default password: rohith123
  portfolio: {
    home: {
      badge: 'PORTFOLIO',
      name: 'ROHITH',
      role: 'Developer & Creator',
      bio: 'Welcome to my official portfolio. Explore my skills, projects, and achievements below.'
    },
    about: {
      description: 'Hi, I am Rohith. Click Owner Login in the top bar to edit this bio and add details.',
      cards: []
    },
    skills: [],
    projects: [],
    achievements: [],
    contact: [],
    messages: []
  }
};

// In-memory backup so the server never crashes even if filesystem is restricted
let memoryDB = JSON.parse(JSON.stringify(initialDatabase));

function hashText(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function createSignedToken(passwordHash) {
  const payload = `owner:${passwordHash}`;
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${sig}`;
}

function verifySignedToken(token, currentPasswordHash) {
  if (!token || !token.includes('.')) return false;
  const [b64, sig] = token.split('.');
  const payload = Buffer.from(b64, 'base64').toString('utf8');
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return sig === expectedSig && payload === `owner:${currentPasswordHash}`;
}

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryDB = JSON.parse(raw);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(memoryDB, null, 2));
    }
  } catch (err) {
    // Fallback to memoryDB without crashing
  }
  return memoryDB;
}

function writeDB(data) {
  memoryDB = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    // Ignore read-only disk errors in serverless environments
  }
}

// Middleware: Verify Owner Access
function requireOwnerAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const db = readDB();

  if (!verifySignedToken(token, db.ownerPasswordHash)) {
    return res.status(401).json({ error: 'Unauthorized: Owner access required.' });
  }
  next();
}

// Explicitly serve CSS & JS with correct headers
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

// GET Portfolio Data
app.get('/api/portfolio', (req, res) => {
  const db = readDB();
  res.json(db.portfolio);
});

// POST Owner Login
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  const db = readDB();

  if (hashText(password || '') === db.ownerPasswordHash) {
    const token = createSignedToken(db.ownerPasswordHash);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid password' });
});

// GET Verify Token
app.get('/api/verify', requireOwnerAuth, (req, res) => {
  res.json({ valid: true });
});

// POST Change Password
app.post('/api/change-password', requireOwnerAuth, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const db = readDB();
  db.ownerPasswordHash = hashText(newPassword);
  writeDB(db);
  const newToken = createSignedToken(db.ownerPasswordHash);
  res.json({ success: true, token: newToken });
});

// PUT Save Updated Portfolio Details (Owner Only)
app.put('/api/portfolio', requireOwnerAuth, (req, res) => {
  const db = readDB();
  const updated = req.body || {};

  db.portfolio = {
    home: updated.home || db.portfolio.home,
    about: updated.about || db.portfolio.about,
    skills: Array.isArray(updated.skills) ? updated.skills : db.portfolio.skills,
    projects: Array.isArray(updated.projects) ? updated.projects : db.portfolio.projects,
    achievements: Array.isArray(updated.achievements) ? updated.achievements : db.portfolio.achievements,
    contact: Array.isArray(updated.contact) ? updated.contact : db.portfolio.contact,
    messages: Array.isArray(updated.messages) ? updated.messages : db.portfolio.messages
  };

  writeDB(db);
  res.json(db.portfolio);
});

// POST Public Contact Message
app.post('/api/messages', (req, res) => {
  const { name, email, body, date } = req.body || {};
  if (!name || !email || !body) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const db = readDB();
  db.portfolio.messages.unshift({
    name,
    email,
    body,
    date: date || new Date().toLocaleDateString()
  });
  writeDB(db);
  res.json({ success: true });
});

// Serve index.html for root and unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Only call app.listen when running locally (NOT on Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Required by Vercel Serverless Functions
module.exports = app;