'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const packageJson = require('../../package.json');
const adminPinRouter = require('./routes/adminPin');
const fotAiRouter = require('./routes/fototimeStable');
const errorHandler = require('./middleware/errorHandler');

const CLIENT_DIR = path.join(__dirname, '..', 'client');
const CLIENT_ASSETS_DIR = path.join(CLIENT_DIR, 'assets');
const PUBLIC_ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');

function allowedOrigins() {
  return String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createApp() {
  const app = express();
  const origins = allowedOrigins();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || !origins.length || origins.includes(origin)) return callback(null, true);
        const error = new Error('Origin is not allowed');
        error.status = 403;
        return callback(error);
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'fot-ai', version: packageJson.version });
  });
  app.get('/api/version', (_req, res) => {
    res.json({
      version: packageJson.version,
      commit: String(process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local').slice(0, 12),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.use('/api/admin-pin', adminPinRouter);
  app.use('/api/fototime', fotAiRouter);

  app.use('/assets', express.static(CLIENT_ASSETS_DIR, { maxAge: '1h', immutable: false }));
  app.use('/assets', express.static(PUBLIC_ASSETS_DIR, { maxAge: '1h', immutable: false }));
  app.use(express.static(CLIENT_DIR, { etag: true, maxAge: '5m' }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'API endpoint not found' });
  });
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
  app.use(errorHandler);

  return app;
}

function startServer() {
  const app = createApp();
  const host = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || 3000);
  return app.listen(port, host, () => {
    console.log(`FOT AI is listening on http://${host}:${port}`);
  });
}

if (require.main === module) startServer();

module.exports = { createApp, startServer };
