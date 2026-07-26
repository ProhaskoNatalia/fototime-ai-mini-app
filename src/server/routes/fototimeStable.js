const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const identityStore = require('../services/identityStore');
const { fetchPublicStyles, generateImage } = require('../services/imageProviderService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Only JPG, PNG, and WebP images are supported');
      error.code = 'INVALID_IMAGE_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

// Payment receipts are not photos: the admin may attach either an image or a
// PDF. Keep this separate from the stricter photo uploader used elsewhere.
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Receipt must be PDF, PNG, JPG, or WebP');
      error.code = 'INVALID_RECEIPT_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'fototime');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'fototime');
const RESULT_DIR = path.join(PUBLIC_DIR, 'results', 'fototime');
const RECEIPT_DIR = path.join(DATA_DIR, 'receipts');
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const BALANCE_COST = 40;
const DEMO_USER = {
  id: 'local-demo-user',
  username: 'local-demo-user',
  name: 'local-demo-user',
};

function ensureDirs() {
  [DATA_DIR, PUBLIC_DIR, UPLOAD_DIR, RESULT_DIR, RECEIPT_DIR].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

ensureDirs();

// A signed session is the source of truth whenever it is present.  Legacy
// callers still work during migration, but they cannot impersonate another
// signed-in account by changing id/username fields in a request.
router.use(async (req, _res, next) => {
  try {
    req.ftIdentity = await identityStore.resolveSession(req.headers['x-fot-session']);
    next();
  } catch (error) {
    next(error);
  }
});

function requestUserInput(req, input = {}) {
  if (!req.ftIdentity) return input;
  return {
    ...input,
    ...req.ftIdentity,
    id: req.ftIdentity.id,
    userId: req.ftIdentity.id,
    telegramId: req.ftIdentity.telegramId || '',
  };
}

function requireIdentity(req, res, next) {
  if (req.ftIdentity) return next();
  return res.status(401).json({ ok: false, message: 'IDENTITY_REQUIRED' });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

async function readJson(name, fallback) {
  try {
    const raw = await fsp.readFile(filePath(name), 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

async function writeJson(name, value) {
  ensureDirs();
  await fsp.writeFile(filePath(name), JSON.stringify(value, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function publicUrl(absPath) {
  const rel = path.relative(PUBLIC_DIR, absPath).split(path.sep).join('/');
  const file = path.basename(absPath);

  if (rel.startsWith('uploads/fototime/')) {
    return `/api/fototime/file/uploads/${encodeURIComponent(file)}`;
  }

  if (rel.startsWith('results/fototime/')) {
    return `/api/fototime/file/results/${encodeURIComponent(file)}`;
  }

  return `/${rel}`;
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function containsWatermarkMarker(buffer) {
  const text = buffer.toString('latin1').toLowerCase();
  return /adobe stock|adobestock|stock\.adobe|shutterstock|depositphotos|demo version|watermark/.test(text);
}

async function downloadGeneratedImage(resultUrl) {
  const value = String(resultUrl || '').trim();
  const dataUrl = value.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  if (dataUrl) return Buffer.from(dataUrl[1], 'base64');

  if (!/^https?:\/\//i.test(value)) {
    const error = new Error('Generation result URL is invalid');
    error.code = 'INVALID_GENERATION_RESULT';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(value, { signal: controller.signal });
    if (!response.ok) throw new Error(`Generation result download failed: HTTP ${response.status}`);
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.startsWith('image/'))
      throw new Error('Generation result is not an image');
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function repairStoredUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';

  const withoutOrigin = text.replace(/^https?:\/\/[^/]+/i, '');
  const match = withoutOrigin.match(/^\/(uploads|results)\/fototime\/([^?#]+)/i);

  if (!match) return text;

  const bucket = match[1].toLowerCase();
  const file = path.basename(decodeURIComponent(match[2]));

  return `/api/fototime/file/${bucket}/${encodeURIComponent(file)}`;
}

function repairDbUrls(db) {
  if (!db || typeof db !== 'object') return db;

  if (Array.isArray(db.generations)) {
    db.generations = db.generations.map((item) => ({
      ...item,
      sourceUrl: repairStoredUrl(item.sourceUrl),
      resultUrl: repairStoredUrl(item.resultUrl),
    }));
  }

  if (Array.isArray(db.feedback)) {
    db.feedback = db.feedback.map((item) => ({
      ...item,
      fileUrl: repairStoredUrl(item.fileUrl),
    }));
  }

  if (db.activeGenerations && typeof db.activeGenerations === 'object') {
    Object.keys(db.activeGenerations).forEach((key) => {
      const item = db.activeGenerations[key];
      db.activeGenerations[key] = {
        ...item,
        sourceUrl: repairStoredUrl(item.sourceUrl),
        resultUrl: repairStoredUrl(item.resultUrl),
      };
    });
  }

  return db;
}

function isExpired(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) && timestamp < Date.now() - RETENTION_MS;
}

async function removeStoredFile(url, receiptFile = '') {
  const file = path.basename(receiptFile || String(url || '').split('?')[0]);
  if (!file) return;
  const candidates = [path.join(UPLOAD_DIR, file), path.join(RESULT_DIR, file), path.join(RECEIPT_DIR, file)];
  await Promise.all(candidates.map((candidate) => fsp.unlink(candidate).catch(() => undefined)));
}

async function purgeExpiredData(db) {
  let changed = false;
  const expiredGenerations = (db.generations || []).filter((item) => isExpired(item.createdAt));
  await Promise.all(
    expiredGenerations.flatMap((item) => [
      removeStoredFile(item.sourceUrl),
      removeStoredFile(item.resultUrl),
    ]),
  );
  if (expiredGenerations.length) {
    db.generations = (db.generations || []).filter((item) => !isExpired(item.createdAt));
    changed = true;
  }

  const expiredFeedback = (db.feedback || []).filter((item) => isExpired(item.createdAt));
  await Promise.all(expiredFeedback.map((item) => removeStoredFile(item.fileUrl)));
  if (expiredFeedback.length) {
    db.feedback = (db.feedback || []).filter((item) => !isExpired(item.createdAt));
    changed = true;
  }

  const expiredNotes = (db.notifications || []).filter((item) => isExpired(item.createdAt));
  await Promise.all(expiredNotes.map((item) => removeStoredFile(item.receiptUrl, item.receiptFile)));
  if (expiredNotes.length) {
    db.notifications = (db.notifications || []).filter((item) => !isExpired(item.createdAt));
    changed = true;
  }

  Object.entries(db.auditSessions || {}).forEach(([id, session]) => {
    if (isExpired(session.updatedAt || session.startedAt)) {
      delete db.auditSessions[id];
      changed = true;
    }
  });
  return changed;
}

function sendMissingImage(res, name) {
  const safeName = String(name || 'file').replace(/[<>&"]/g, '');
  res.status(200);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#baff14"/>
          <stop offset="1" stop-color="#5ee7d0"/>
        </linearGradient>
      </defs>
      <rect width="800" height="800" rx="48" fill="#f7fbf2"/>
      <rect x="70" y="70" width="660" height="660" rx="36" fill="url(#g)" opacity=".22"/>
      <text x="400" y="360" text-anchor="middle" font-family="system-ui, sans-serif" font-size="42" font-weight="900" fill="#17342f">FOT AI</text>
      <text x="400" y="420" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#687a74">Файл не найден</text>
      <text x="400" y="462" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#687a74">${safeName}</text>
    </svg>
  `);
}

function normalizeUser(input = {}) {
  const id = cleanText(input.id || input.userId || input.telegramId, DEMO_USER.id);
  const telegramId = cleanText(input.telegramId, '');
  const username = cleanText(input.username || input.userName || input.login, DEMO_USER.username);
  const name = cleanText(input.name || input.firstName || input.fullName || input.username, DEMO_USER.name);
  const photoUrl = cleanText(input.photoUrl || input.photo_url || input.avatarUrl, '');
  const avatarEmoji = cleanText(input.avatarEmoji, '✨');
  const avatarGradient = cleanText(input.avatarGradient, 'lime');
  const authProvider = cleanText(input.authProvider, telegramId ? 'telegram' : 'local');
  const deviceName = cleanText(input.deviceName, '');
  const trafficSource = cleanText(input.trafficSource, 'direct').slice(0, 180);

  return {
    id,
    telegramId,
    username,
    name,
    photoUrl,
    avatarEmoji,
    avatarGradient,
    authProvider,
    deviceName,
    trafficSource,
  };
}

function environmentSet(name) {
  return new Set(
    String(process.env[name] || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

const ADMIN_USERNAMES = environmentSet('ADMIN_USERNAMES');
const ADMIN_EMAILS = environmentSet('ADMIN_USER_EMAILS');
const ADMIN_IDS = new Set(
  String(process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((v) => String(v || '').trim())
    .filter(Boolean),
);

function isAdminUser(user = {}) {
  const id = String(user.id || user.telegramId || '').trim();
  const telegramId = String(user.telegramId || '').trim();
  const username = String(user.username || '')
    .trim()
    .toLowerCase();
  const email = String(user.email || user.username || '')
    .trim()
    .toLowerCase();

  return Boolean(
    (id && ADMIN_IDS.has(id)) ||
    (telegramId && ADMIN_IDS.has(telegramId)) ||
    (username && ADMIN_USERNAMES.has(username)) ||
    (email && ADMIN_EMAILS.has(email)),
  );
}

function isAdminPinValid(req) {
  const provided = String(req.headers?.['x-admin-pin'] || req.body?.pin || req.query?.pin || '').trim();

  const accepted = new Set(
    String(process.env.ADMIN_PIN || '')
      .split(',')
      .map((pin) => pin.trim())
      .filter(Boolean),
  );

  return Boolean(provided) && accepted.has(provided);
}

function requireAdmin(req, res, next) {
  const candidate = normalizeUser(
    requestUserInput(req, {
      ...(req.query || {}),
      ...(req.body || {}),
    }),
  );

  if (!isAdminUser(candidate) && !isAdminPinValid(req)) {
    return res.status(403).json({
      ok: false,
      message: 'FORBIDDEN',
    });
  }

  req.ftAdminUser = candidate;
  next();
}

function shouldShowOnHomeNotification(note = {}) {
  const title = String(note.title || '').toLowerCase();
  const message = String(note.message || '').toLowerCase();
  const joined = `${title} ${message}`;

  if (joined.includes('баланс обновл')) return false;
  if (joined.includes('информация об оплате')) return false;
  if (joined.includes('запрос токен')) return false;
  if (joined.includes('чек')) return false;

  return true;
}

function normalizeProvider(value) {
  const raw = cleanText(value, 'SDXL');
  const low = raw.toLowerCase();

  if (low.includes('flux') || low.includes('edit')) return 'FLUX.2';
  if (low.includes('banana')) return 'Nano Banana';
  if (low.includes('head') || low.includes('голов')) return 'Замена Головы';
  if (low.includes('sdxl')) return 'SDXL';

  return raw;
}

function fallbackStyles() {
  const rows = [
    ['1001', 'Атлантида', 'SDXL'],
    ['1002', 'Барби', 'SDXL'],
    ['1003', 'Баблгам', 'SDXL'],
    ['1004', 'Бизнес', 'SDXL'],
    ['1005', 'Рождество', 'SDXL'],
    ['1006', 'Комикс', 'SDXL'],
    ['1007', 'Киберпанк', 'SDXL'],
    ['1008', 'Дубай', 'SDXL'],
    ['1009', 'Лесная сказка', 'SDXL'],
    ['2001', 'Поле боя', 'FLUX.2'],
    ['2002', 'Кибернетика', 'FLUX.2'],
    ['2003', 'Алхимик', 'FLUX.2'],
    ['2004', 'Пираты', 'FLUX.2'],
    ['2005', 'Кабаре', 'FLUX.2'],
    ['3001', 'White rabbits', 'Nano Banana'],
    ['3002', 'Diamonds', 'Nano Banana'],
    ['3003', 'Luxor', 'Nano Banana'],
    ['3004', 'Biker NB', 'Nano Banana'],
    ['3005', 'Business 001', 'Nano Banana'],
    ['3006', 'Пустыня', 'Nano Banana'],
  ];

  return rows.map(([id, title, provider]) => ({
    id,
    title,
    provider,
    preview: '',
    mode: provider.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
  }));
}

async function readStyles() {
  try {
    const list = await fetchPublicStyles();

    const normalized = list
      .map((item, index) => {
        const provider = normalizeProvider(
          item.provider ||
            item.styleProvider ||
            item.network ||
            item.neuralNetwork ||
            item.mode ||
            item.styleMode ||
            item.category ||
            item.modes?.[0]?.display_name ||
            item.modes?.[0]?.displayName ||
            item.modes?.[0]?.name,
        );

        const title = cleanText(
          item.display_name_ru ||
            item.displayNameRu ||
            item.display_name_en ||
            item.displayNameEn ||
            item.title ||
            item.name ||
            item.style_name,
          `Style ${index + 1}`,
        );

        const id = cleanText(item.id || item.style_id || item.styleId || item.slug || `${index + 1}`);

        const preview = cleanText(
          item.preview ||
            item.preview_url ||
            item.previewUrl ||
            item.preview_url_thumb ||
            item.preview_url_female ||
            item.preview_url_male ||
            item.assets?.[0]?.url ||
            '',
          '',
        );

        return {
          id,
          title,
          provider,
          preview,
          mode: provider.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
        };
      })
      .filter((style) => style.id && style.title);

    if (normalized.length) {
      return normalized;
    }

    return fallbackStyles();
  } catch (error) {
    console.error('[FOT AI] style catalog error:', error.message);
    return fallbackStyles();
  }
}

async function getDb() {
  const db = await readJson('stable-db.json', null);
  if (db) {
    repairDbUrls(db);
    if (await purgeExpiredData(db)) await writeJson('stable-db.json', db);
    return db;
  }

  const initial = {
    version: '1.1.0',
    users: {
      [DEMO_USER.id]: {
        ...DEMO_USER,
        balance: 50,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    },
    generations: [],
    feedback: [],
    notifications: [
      {
        id: makeId('note'),
        userId: DEMO_USER.id,
        title: 'Сервис настраивается',
        message: 'Мы улучшаем приложение и будем благодарны за обратную связь в личном кабинете.',
        unread: true,
        createdAt: nowIso(),
      },
    ],
    auditSessions: {},
    activeGenerations: {},
  };

  await writeJson('stable-db.json', initial);
  return initial;
}

async function saveDb(db) {
  repairDbUrls(db);
  db.updatedAt = nowIso();
  await writeJson('stable-db.json', db);
}

function getOrCreateUser(db, input = {}) {
  const user = normalizeUser(input);

  if (!db.users[user.id]) {
    db.users[user.id] = {
      ...user,
      balance: 50,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  } else {
    db.users[user.id] = {
      ...db.users[user.id],
      ...user,
      balance: safeNumber(db.users[user.id].balance, 50),
      updatedAt: nowIso(),
    };
  }

  return db.users[user.id];
}

function getSessionId(body = {}) {
  const user = normalizeUser(body);
  const explicit = cleanText(body.sessionId || body.session || '');

  if (explicit) return explicit;

  const date = new Date().toISOString().slice(0, 10);
  return `${user.id}_${date}`;
}

async function addAudit(db, payload) {
  const user = normalizeUser(payload);
  const sessionId = getSessionId(payload);

  const entry = {
    id: cleanText(payload.id, makeId('audit')),
    title: cleanText(payload.title || payload.message || 'Событие'),
    level: cleanText(payload.level, 'info'),
    type: cleanText(payload.type, 'event'),
    details: payload.details || {},
    user,
    page: cleanText(payload.page, ''),
    unread:
      payload.level === 'error' ||
      payload.important === true ||
      ['feedback', 'token_request', 'generation_error'].includes(payload.type),
    createdAt: cleanText(payload.createdAt, nowIso()),
  };

  if (!db.auditSessions[sessionId]) {
    db.auditSessions[sessionId] = {
      id: sessionId,
      user,
      startedAt: entry.createdAt,
      updatedAt: entry.createdAt,
      unread: false,
      entries: [],
      errors: [],
    };
  }

  const session = db.auditSessions[sessionId];

  session.user = user;
  session.updatedAt = entry.createdAt;
  session.entries.unshift(entry);
  session.entries = session.entries.slice(0, 200);

  if (entry.level === 'error') {
    session.errors.unshift(entry);
    session.errors = session.errors.slice(0, 50);
  }

  if (entry.unread) session.unread = true;

  return entry;
}

async function notifyTelegram(title, message) {
  const token = process.env.ADMIN_NOTIFICATION_BOT_TOKEN;
  const chatId = process.env.ADMIN_NOTIFICATION_CHAT_ID;

  if (!token || !chatId || typeof fetch !== 'function') return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${title}\n${message || ''}`.trim(),
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.warn('[FOT AI] notification delivery failed:', error.message);
  }
}

function adminPayload(db) {
  const sessions = Object.values(db.auditSessions || {}).sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt)),
  );

  const errors = sessions
    .flatMap((s) => (s.errors || []).map((e) => ({ ...e, sessionId: s.id })))
    .slice(0, 30);

  const visibleSessions = sessions.map((s) => ({
    id: s.id,
    user: s.user,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
    unread: Boolean(s.unread),
    entriesCount: (s.entries || []).length,
    errorsCount: (s.errors || []).length,
    important: (s.entries || [])
      .filter((e) => e.unread || e.level === 'error' || e.type === 'feedback' || e.type === 'token_request')
      .slice(0, 12),
    entries: (s.entries || []).slice(0, 30),
  }));

  const totalEvents = sessions.reduce((sum, s) => sum + (s.entries || []).length, 0);
  const totalErrors = errors.length;
  const stability = totalEvents
    ? Math.max(0, Math.round(((totalEvents - totalErrors) / totalEvents) * 100))
    : 100;

  return {
    users: Object.values(db.users || {}),
    feedback: (db.feedback || []).slice(-30).reverse(),
    generations: (db.generations || []).slice(-40).reverse(),
    photos: (db.generations || [])
      .filter((g) => g.sourceUrl && g.resultUrl && g.sourceUrl !== g.resultUrl)
      .slice(-40)
      .reverse(),
    sessions: visibleSessions,
    errors,
    activeGenerations: Object.values(db.activeGenerations || {}),
    stability,
  };
}

router.get('/file/:bucket/:name', async (req, res) => {
  try {
    const bucket = String(req.params.bucket || '').toLowerCase();
    const name = path.basename(String(req.params.name || ''));

    if (!name || !['uploads', 'results'].includes(bucket)) {
      return sendMissingImage(res, name || 'unknown');
    }

    const baseDir = bucket === 'uploads' ? UPLOAD_DIR : RESULT_DIR;
    const abs = path.join(baseDir, name);

    if (!fs.existsSync(abs)) {
      return sendMissingImage(res, name);
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(abs);
  } catch (error) {
    console.error('[FOT AI] file endpoint error:', error.message);
    return sendMissingImage(res, 'error');
  }
});

router.post('/identity/session', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const initData = String(req.body?.initData || '');
    const result = await (initData
      ? identityStore.createTelegramSession(initData, req.body || {})
      : identityStore.createBrowserSession(req.body || {}));
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(401).json({ ok: false, message: error.message || 'Identity session could not be created' });
  }
});

// The browser must never receive the bot token.  It only needs the public
// username in order to open the same bot that verifies Telegram WebApp data.
router.get('/telegram/config', async (_req, res) => {
  const configuredUsername = String(process.env.TELEGRAM_BOT_USERNAME || '')
    .replace(/^@/, '')
    .trim();
  if (configuredUsername) return res.json({ ok: true, username: configuredUsername });

  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return res.status(503).json({ ok: false, message: 'Telegram bot is not configured' });

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const payload = await response.json();
    const username = String(payload?.result?.username || '')
      .replace(/^@/, '')
      .trim();
    if (!response.ok || !username) throw new Error('Telegram bot username is unavailable');
    res.json({ ok: true, username });
  } catch (error) {
    res.status(503).json({ ok: false, message: error.message || 'Telegram bot is unavailable' });
  }
});

router.post('/identity/register', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const result = await identityStore.registerPasswordProfile(req.body || {});
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'Registration failed' });
  }
});

router.post('/identity/login', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const result = await identityStore.loginWithPassword(req.body || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(401).json({ ok: false, message: error.message || 'Login failed' });
  }
});

router.get('/state', requireIdentity, async (req, res) => {
  const db = await getDb();
  const userInput = requestUserInput(req, req.query || {});
  const user = getOrCreateUser(db, userInput);
  const normalizedUser = normalizeUser({ ...user, ...userInput });
  Object.assign(user, normalizedUser);
  user.updatedAt = nowIso();

  const styles = await readStyles();

  const userGenerations = (db.generations || [])
    .filter((g) => g.userId === user.id)
    .slice(-50)
    .reverse();
  const allNotifications = (db.notifications || [])
    .filter((n) => !n.userId || n.userId === user.id)
    .slice(-100)
    .reverse();
  const homeNotifications = allNotifications.filter(shouldShowOnHomeNotification).slice(0, 8);
  const activeGenerations = userGenerations
    .filter((g) => {
      const status = String(g.status || g.state || '').toLowerCase();
      return !['done', 'success', 'completed', 'failed', 'error', 'cancelled'].includes(status);
    })
    .slice(0, 10);

  await saveDb(db);

  res.json({
    ok: true,
    version: '1.1.0',
    isAdmin: isAdminUser(user),
    user,
    avatar: {
      photoUrl: user.photoUrl || '',
      emoji: user.avatarEmoji || '✨',
      gradient: user.avatarGradient || 'lime',
    },
    balance: safeNumber(user.balance, 50),
    cost: BALANCE_COST,
    styles,
    generations: userGenerations,
    activeGenerations,
    notifications: homeNotifications,
    cabinetNotifications: allNotifications,
  });
});

function storedGenerationFile(url) {
  const value = String(url || '').trim();
  const match =
    value.match(/\/(?:api\/fototime\/file\/)?(uploads|results)\/fototime\/([^?#/]+)$/i) ||
    value.match(/\/api\/fototime\/file\/(uploads|results)\/([^?#/]+)$/i);

  if (!match) return null;

  const bucket = match[1].toLowerCase();
  const name = path.basename(decodeURIComponent(match[2]));
  if (!name) return null;

  return path.join(bucket === 'uploads' ? UPLOAD_DIR : RESULT_DIR, name);
}

async function removeGenerationFiles(generation) {
  const files = [generation?.sourceUrl, generation?.resultUrl].map(storedGenerationFile).filter(Boolean);

  await Promise.all(
    files.map((file) =>
      fsp.unlink(file).catch((error) => {
        if (error.code !== 'ENOENT') {
          console.warn('[FOT AI] generation file delete failed:', file, error.message);
        }
      }),
    ),
  );
}

router.post('/generations/delete', express.json({ limit: '1mb' }), requireIdentity, async (req, res) => {
  const requestedIds = Array.isArray(req.body?.ids) ? req.body.ids : [req.body?.id];
  const ids = new Set(
    requestedIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .slice(0, 100),
  );

  if (!ids.size) {
    return res.status(400).json({ ok: false, message: 'Не выбраны изображения для удаления' });
  }

  const db = await getDb();
  const user = getOrCreateUser(db, requestUserInput(req, req.body || {}));
  const removed = [];
  const kept = [];

  for (const generation of db.generations || []) {
    const generationId = String(generation.id || generation.generationId || '');
    const belongsToUser = String(generation.userId || '') === String(user.id || '');

    if (belongsToUser && ids.has(generationId)) removed.push(generation);
    else kept.push(generation);
  }

  if (!removed.length) {
    return res.status(404).json({ ok: false, message: 'Выбранные изображения не найдены в вашей истории' });
  }

  db.generations = kept;
  await Promise.all(removed.map(removeGenerationFiles));

  await addAudit(db, {
    ...user,
    title: removed.length === 1 ? 'Изображение удалено из истории' : 'Изображения удалены из истории',
    type: 'generation_delete',
    details: { ids: removed.map((item) => item.id || item.generationId), count: removed.length },
  });

  await saveDb(db);

  const generations = (db.generations || [])
    .filter((generation) => String(generation.userId || '') === String(user.id || ''))
    .slice(-50)
    .reverse();

  return res.json({
    ok: true,
    deletedIds: removed.map((item) => String(item.id || item.generationId)),
    deletedCount: removed.length,
    generations,
  });
});

router.get('/styles', async (_req, res) => {
  res.json({ ok: true, styles: await readStyles() });
});

router.post('/audit', express.json({ limit: '1mb' }), requireIdentity, async (req, res) => {
  const db = await getDb();
  const entry = await addAudit(db, req.body || {});

  await saveDb(db);

  res.json({ ok: true, entry });
});

router.post('/generations/record', express.json({ limit: '1mb' }), requireIdentity, async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, requestUserInput(req, req.body || {}));
  const generation = req.body?.generation || {};
  const sourceUrl = cleanText(generation.sourceUrl, '');
  const resultUrl = cleanText(generation.resultUrl, '');

  if (!sourceUrl || !resultUrl || sourceUrl === resultUrl) {
    return res.status(400).json({ ok: false, message: 'Generation source and result must be different' });
  }

  const id = cleanText(generation.id, makeId('generation'));
  const entry = {
    id,
    userId: user.id,
    userName: user.username || user.name,
    styleId: cleanText(generation.styleId, ''),
    styleTitle: cleanText(generation.styleTitle, 'AI photo'),
    provider: normalizeProvider(generation.provider),
    participant: cleanText(generation.participant, ''),
    sourceUrl,
    resultUrl,
    cost: safeNumber(generation.cost, BALANCE_COST),
    balanceAfter: safeNumber(generation.balanceAfter, user.balance),
    status: 'success',
    createdAt: cleanText(generation.createdAt, nowIso()),
  };

  db.generations = [entry, ...(db.generations || []).filter((item) => String(item.id) !== id)].slice(0, 200);
  await addAudit(db, {
    ...user,
    title: 'Generation recorded for admin',
    type: 'generation_record',
    important: true,
    details: { id, sourceUrl, resultUrl },
  });
  await saveDb(db);
  res.json({ ok: true, generation: entry });
});

router.post('/balance/refresh', express.json({ limit: '1mb' }), requireIdentity, async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, requestUserInput(req, req.body || {}));

  await addAudit(db, {
    ...req.body,
    title: 'Баланс синхронизирован',
    type: 'balance_refresh',
    details: { balance: user.balance },
  });

  await saveDb(db);

  res.json({
    ok: true,
    balance: safeNumber(user.balance, 50),
    user,
  });
});

router.post('/profile/update', express.json({ limit: '1mb' }), requireIdentity, async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, requestUserInput(req, req.body || {}));
  const emoji = cleanText(req.body?.avatarEmoji, user.avatarEmoji || '✨').slice(0, 8);
  const gradient = cleanText(req.body?.avatarGradient, user.avatarGradient || 'lime');
  const allowedGradients = new Set(['lime', 'violet', 'sunset', 'ocean']);

  user.avatarEmoji = emoji;
  user.avatarGradient = allowedGradients.has(gradient) ? gradient : 'lime';
  user.updatedAt = nowIso();
  await saveDb(db);

  res.json({ ok: true, user });
});

router.post('/balance/set', requireAdmin, express.json({ limit: '1mb' }), async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, {
    id: req.body.userId,
    username: req.body.username,
    name: req.body.name,
  });

  const balance = Math.max(0, Math.floor(safeNumber(req.body.balance, user.balance)));

  user.balance = balance;
  user.updatedAt = nowIso();

  const note = {
    id: makeId('note'),
    userId: user.id,
    title: 'Баланс обновлён',
    message: `Администратор обновил баланс. Сейчас доступно ${balance} кредитов.`,
    unread: true,
    createdAt: nowIso(),
  };

  db.notifications.unshift(note);

  await addAudit(db, {
    title: 'Баланс пользователя изменён',
    type: 'admin_balance_set',
    important: true,
    details: { userId: user.id, balance },
  });

  await saveDb(db);

  res.json({ ok: true, user, notification: note });
});

router.post('/receipt/send', requireAdmin, receiptUpload.single('receipt'), async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, { id: req.body.userId });
  let receiptFile = '';

  if (req.file) {
    const extensionByType = {
      'application/pdf': '.pdf',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
    };
    const extension = extensionByType[req.file.mimetype];

    if (!extension) {
      return res.status(400).json({ ok: false, message: 'Чек должен быть PDF, PNG, JPG или WEBP' });
    }

    receiptFile = `${makeId('receipt')}${extension}`;
    await fsp.writeFile(path.join(RECEIPT_DIR, receiptFile), req.file.buffer);
  }

  const note = {
    id: makeId('note'),
    userId: user.id,
    title: 'Информация об оплате',
    message: cleanText(
      req.body.message,
      'Оплата получена. Чек от самозанятого будет отправлен администратором после проверки.',
    ),
    receiptFile,
    receiptUrl: receiptFile ? `/api/fototime/receipt/${encodeURIComponent(receiptFile)}` : '',
    unread: true,
    createdAt: nowIso(),
  };

  db.notifications.unshift(note);

  await addAudit(db, {
    title: 'Уведомление о чеке отправлено',
    type: 'receipt_notice',
    important: true,
    details: { userId: user.id },
  });

  await saveDb(db);

  res.json({ ok: true, notification: note });
});

router.get('/receipt/:name', async (req, res) => {
  const name = path.basename(String(req.params.name || ''));
  const user = normalizeUser(req.query || {});
  const db = await getDb();
  const allowed = (db.notifications || []).some(
    (note) => String(note.userId || '') === String(user.id || '') && note.receiptFile === name,
  );

  if (!name || !allowed) {
    return res.status(404).json({ ok: false, message: 'Чек не найден' });
  }

  const file = path.join(RECEIPT_DIR, name);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ ok: false, message: 'Файл чека не найден' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.download(file, name);
});

router.post('/notifications/read', express.json({ limit: '1mb' }), requireIdentity, async (req, res) => {
  const db = await getDb();
  const user = normalizeUser(req.body || {});

  db.notifications = (db.notifications || []).map((n) =>
    n.userId === user.id ? { ...n, unread: false } : n,
  );

  await saveDb(db);

  res.json({ ok: true });
});

router.post('/feedback', upload.any(), requireIdentity, async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, requestUserInput(req, req.body || {}));
  const file = (req.files || [])[0] || null;

  let fileUrl = '';

  if (file) {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const fileName = `${makeId('feedback')}${ext}`;
    const abs = path.join(UPLOAD_DIR, fileName);

    await fsp.writeFile(abs, file.buffer);
    fileUrl = publicUrl(abs);
  }

  const item = {
    id: makeId('feedback'),
    type: cleanText(req.body.kind || req.body.type, 'Отзыв'),
    name: cleanText(req.body.name, 'Анонимно'),
    contact: cleanText(req.body.contact, ''),
    message: cleanText(req.body.message, ''),
    userId: user.id,
    userName: user.username,
    fileName: file?.originalname || '',
    fileUrl,
    unread: true,
    createdAt: nowIso(),
  };

  db.feedback.unshift(item);
  db.feedback = db.feedback.slice(0, 100);

  await addAudit(db, {
    ...user,
    title: item.type === 'Запрос токенов' ? 'Запрос токенов' : 'Обратная связь отправлена',
    type: item.type === 'Запрос токенов' ? 'token_request' : 'feedback',
    important: true,
    details: item,
  });

  await saveDb(db);

  await notifyTelegram(`FOT AI: ${item.type}`, `${item.name}\n${item.contact}\n${item.message}`);

  res.json({ ok: true, item });
});

router.post('/generate', upload.any(), requireIdentity, async (req, res) => {
  const db = await getDb();
  const user = getOrCreateUser(db, requestUserInput(req, req.body || {}));
  const balance = safeNumber(user.balance, 50);

  const selected = {
    id: cleanText(req.body.styleId || req.body.id, ''),
    title: cleanText(req.body.styleTitle || req.body.title, 'AI photo'),
    provider: normalizeProvider(req.body.provider || req.body.styleProvider || req.body.mode),
  };

  const participant = cleanText(req.body.participant, '');
  const source = (req.files || [])[0] || null;

  const payloadInfo = {
    selected,
    participant,
    hasFile: Boolean(source),
    fileName: source?.originalname || '',
    balance,
  };

  const jobId = makeId('generation');

  if (!source) {
    const entry = await addAudit(db, {
      ...user,
      title: 'Ошибка генерации',
      level: 'error',
      type: 'generation_error',
      important: true,
      details: { message: 'Не загружено исходное фото', ...payloadInfo },
    });

    await saveDb(db);

    return res.status(400).json({
      ok: false,
      code: 'NO_FILE',
      message: 'Загрузите фото перед генерацией.',
      audit: entry,
    });
  }

  if (!selected.id) {
    const entry = await addAudit(db, {
      ...user,
      title: 'Ошибка генерации',
      level: 'error',
      type: 'generation_error',
      important: true,
      details: { message: 'Не выбран стиль', ...payloadInfo },
    });

    await saveDb(db);

    return res.status(400).json({
      ok: false,
      code: 'NO_STYLE',
      message: 'Выберите стиль обработки.',
      audit: entry,
    });
  }

  if (balance < BALANCE_COST) {
    const entry = await addAudit(db, {
      ...user,
      title: 'Ошибка генерации',
      level: 'error',
      type: 'generation_error',
      important: true,
      details: {
        message: `Недостаточно кредитов: нужно ${BALANCE_COST}, доступно ${balance}`,
        ...payloadInfo,
      },
    });

    await saveDb(db);

    return res.status(402).json({
      ok: false,
      code: 'NOT_ENOUGH_CREDITS',
      message: `Недостаточно кредитов. Нужно ${BALANCE_COST}, доступно ${balance}. Пополните баланс в личном кабинете.`,
      balance,
      audit: entry,
    });
  }

  const ext = path.extname(source.originalname || '') || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase()) ? ext : '.jpg';
  const sourceName = `${jobId}_source${safeExt}`;
  const resultName = `${jobId}_result.png`;
  const sourceAbs = path.join(UPLOAD_DIR, sourceName);
  const resultAbs = path.join(RESULT_DIR, resultName);
  const sourceUrl = publicUrl(sourceAbs);
  const resultUrl = publicUrl(resultAbs);

  db.activeGenerations[jobId] = {
    id: jobId,
    userId: user.id,
    userName: user.username,
    title: `Запуск генерации · ${selected.title} · ${selected.provider}`,
    selected,
    participant,
    sourceUrl,
    startedAt: nowIso(),
    status: 'active',
  };

  await addAudit(db, {
    ...user,
    title: 'Генерация запущена',
    type: 'generation_start',
    important: true,
    details: { jobId, ...payloadInfo },
  });

  await saveDb(db);

  try {
    await fsp.writeFile(sourceAbs, source.buffer);
    const providerResult = await generateImage({
      file: source,
      participantId: participant,
      styleId: selected.id,
      styleTitle: selected.title,
      styleModel: selected.provider,
      styleMode: cleanText(req.body.styleMode || req.body.mode, ''),
    });
    const resultBuffer = await downloadGeneratedImage(providerResult.resultUrl);

    if (hashBuffer(source.buffer) === hashBuffer(resultBuffer) || containsWatermarkMarker(resultBuffer)) {
      const invalidResult = new Error('The generated image did not pass integrity checks');
      invalidResult.code = 'INVALID_GENERATION_RESULT';
      throw invalidResult;
    }

    await fsp.writeFile(resultAbs, resultBuffer);

    user.balance = Math.max(0, balance - BALANCE_COST);
    user.updatedAt = nowIso();

    const generation = {
      id: jobId,
      userId: user.id,
      userName: user.username,
      styleId: selected.id,
      styleTitle: selected.title,
      provider: selected.provider,
      participant,
      sourceUrl,
      resultUrl,
      cost: BALANCE_COST,
      balanceBefore: balance,
      balanceAfter: user.balance,
      status: 'success',
      providerJobId: providerResult.jobId,
      processingTimeMs: providerResult.processingTimeMs,
      createdAt: nowIso(),
    };

    db.generations.unshift(generation);
    db.generations = db.generations.slice(0, 200);

    delete db.activeGenerations[jobId];

    await addAudit(db, {
      ...user,
      title: 'Генерация завершена',
      type: 'generation_success',
      important: true,
      details: generation,
    });

    await saveDb(db);

    return res.json({
      ok: true,
      generation,
      resultUrl,
      sourceUrl,
      balance: user.balance,
      cost: BALANCE_COST,
    });
  } catch (error) {
    delete db.activeGenerations[jobId];
    await Promise.all([
      fsp.unlink(sourceAbs).catch(() => undefined),
      fsp.unlink(resultAbs).catch(() => undefined),
    ]);

    const entry = await addAudit(db, {
      ...user,
      title: 'Ошибка генерации',
      level: 'error',
      type: 'generation_error',
      important: true,
      details: { message: error.message, code: error.code || 'GENERATION_FAILED', jobId, ...payloadInfo },
    });

    await saveDb(db);
    await notifyTelegram('FOT AI: generation error', `${user.username}: ${error.message}`);

    const statusCode =
      error.code === 'IMAGE_PROVIDER_NOT_CONFIGURED'
        ? 503
        : error.code === 'IMAGE_PROVIDER_TIMEOUT'
          ? 504
          : 502;

    return res.status(statusCode).json({
      ok: false,
      code: error.code || 'GENERATION_FAILED',
      message: 'Генерация не завершилась. Кредиты не списаны; ошибка сохранена для диагностики.',
      audit: entry,
    });
  }
});

router.get('/admin', requireAdmin, async (_req, res) => {
  const db = await getDb();

  res.json({
    ok: true,
    ...adminPayload(db),
  });
});

router.post('/admin/read-all', requireAdmin, express.json({ limit: '1mb' }), async (_req, res) => {
  const db = await getDb();

  Object.values(db.auditSessions || {}).forEach((session) => {
    session.unread = false;
    (session.entries || []).forEach((entry) => {
      entry.unread = false;
    });
  });

  (db.feedback || []).forEach((item) => {
    item.unread = false;
  });

  await saveDb(db);

  res.json({ ok: true });
});

router.post('/admin/audit-clear', requireAdmin, express.json({ limit: '1mb' }), async (_req, res) => {
  const db = await getDb();
  db.auditSessions = {};
  db.activeGenerations = {};
  await saveDb(db);
  res.json({ ok: true, message: 'Audit cleared. Users, balances, feedback and photos were preserved.' });
});

router.post('/admin/bulk-delete', requireAdmin, express.json({ limit: '1mb' }), async (req, res) => {
  const db = await getDb();
  const scope = cleanText(req.body?.scope);
  const ids = new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []);
  const all = req.body?.all === true;
  if (!['users', 'generations', 'feedback', 'audit', 'receipts', 'active'].includes(scope)) {
    return res.status(400).json({ ok: false, message: 'Unknown cleanup scope' });
  }
  if (!all && !ids.size) return res.status(400).json({ ok: false, message: 'Select at least one record' });
  const chosen = (value) => all || ids.has(String(value));
  let deleted = 0;

  if (scope === 'generations') {
    const doomed = (db.generations || []).filter((item) => chosen(item.id));
    await Promise.all(
      doomed.flatMap((item) => [removeStoredFile(item.sourceUrl), removeStoredFile(item.resultUrl)]),
    );
    db.generations = (db.generations || []).filter((item) => !chosen(item.id));
    deleted = doomed.length;
  }
  if (scope === 'feedback') {
    const doomed = (db.feedback || []).filter((item) => chosen(item.id));
    await Promise.all(doomed.map((item) => removeStoredFile(item.fileUrl)));
    db.feedback = (db.feedback || []).filter((item) => !chosen(item.id));
    deleted = doomed.length;
  }
  if (scope === 'audit') {
    Object.keys(db.auditSessions || {}).forEach((id) => {
      if (chosen(id)) {
        delete db.auditSessions[id];
        deleted += 1;
      }
    });
  }
  if (scope === 'active') {
    Object.keys(db.activeGenerations || {}).forEach((id) => {
      if (chosen(id)) {
        delete db.activeGenerations[id];
        deleted += 1;
      }
    });
  }
  if (scope === 'receipts') {
    const doomed = (db.notifications || []).filter((item) => item.receiptFile && chosen(item.id));
    await Promise.all(doomed.map((item) => removeStoredFile(item.receiptUrl, item.receiptFile)));
    db.notifications = (db.notifications || []).filter((item) => !(item.receiptFile && chosen(item.id)));
    deleted = doomed.length;
  }
  if (scope === 'users') {
    const doomedIds = Object.keys(db.users || {}).filter(chosen);
    for (const userId of doomedIds) {
      const userGenerations = (db.generations || []).filter((item) => String(item.userId) === userId);
      await Promise.all(
        userGenerations.flatMap((item) => [
          removeStoredFile(item.sourceUrl),
          removeStoredFile(item.resultUrl),
        ]),
      );
      const userFeedback = (db.feedback || []).filter((item) => String(item.userId) === userId);
      await Promise.all(userFeedback.map((item) => removeStoredFile(item.fileUrl)));
      const userNotes = (db.notifications || []).filter((item) => String(item.userId) === userId);
      await Promise.all(userNotes.map((item) => removeStoredFile(item.receiptUrl, item.receiptFile)));
      delete db.users[userId];
      deleted += 1;
    }
    db.generations = (db.generations || []).filter((item) => !doomedIds.includes(String(item.userId)));
    db.feedback = (db.feedback || []).filter((item) => !doomedIds.includes(String(item.userId)));
    db.notifications = (db.notifications || []).filter((item) => !doomedIds.includes(String(item.userId)));
    Object.entries(db.auditSessions || {}).forEach(([id, session]) => {
      if (doomedIds.includes(String(session.user?.id))) delete db.auditSessions[id];
    });
  }
  await saveDb(db);
  res.json({ ok: true, deleted, admin: adminPayload(db) });
});

router.get('/admin/audit-download', requireAdmin, async (_req, res) => {
  const db = await getDb();

  const payload = {
    exportedAt: nowIso(),
    version: db.version,
    admin: adminPayload(db),
    raw: db,
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="fototime-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json"`,
  );

  res.send(JSON.stringify(payload, null, 2));
});

router.get('/health', async (_req, res) => {
  res.json({
    ok: true,
    version: '1.1.0',
    time: nowIso(),
  });
});

module.exports = router;
