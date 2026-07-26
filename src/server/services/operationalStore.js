const BUCKET = 'fototime-private';

function enabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function endpoint(pathname) {
  return new URL(`/storage/v1/${pathname.replace(/^\/+/, '')}`, process.env.SUPABASE_URL);
}

function headers(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function ensureBucket() {
  if (!enabled()) return false;
  const check = await fetch(endpoint(`bucket/${BUCKET}`), { headers: headers() });
  if (check.ok) return true;
  if (check.status !== 404) throw new Error(`Supabase storage check failed: ${check.status}`);
  const created = await fetch(endpoint('bucket'), {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: 12 * 1024 * 1024,
      allowed_mime_types: ['application/json', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    }),
  });
  if (!created.ok && created.status !== 409)
    throw new Error(`Supabase storage bucket creation failed: ${created.status}`);
  return true;
}

async function download(objectPath) {
  if (!enabled()) return null;
  await ensureBucket();
  const response = await fetch(endpoint(`object/${BUCKET}/${objectPath}`), { headers: headers() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Supabase storage download failed: ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

async function upload(objectPath, value, contentType = 'application/octet-stream') {
  if (!enabled()) return false;
  await ensureBucket();
  const response = await fetch(endpoint(`object/${BUCKET}/${objectPath}`), {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: value,
  });
  if (!response.ok) throw new Error(`Supabase storage upload failed: ${response.status}`);
  return true;
}

async function remove(objectPaths) {
  if (!enabled() || !objectPaths.length) return false;
  await ensureBucket();
  const response = await fetch(endpoint(`object/${BUCKET}`), {
    method: 'DELETE',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: objectPaths }),
  });
  if (!response.ok) throw new Error(`Supabase storage delete failed: ${response.status}`);
  return true;
}

async function readJson(objectPath) {
  const item = await download(objectPath);
  if (!item) return null;
  return JSON.parse(item.buffer.toString('utf8'));
}

async function writeJson(objectPath, value) {
  return upload(objectPath, Buffer.from(JSON.stringify(value, null, 2)), 'application/json');
}

module.exports = { enabled, download, upload, remove, readJson, writeJson };
