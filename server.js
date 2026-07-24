const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_PWD = process.env.ADMIN_PWD || '8888';
const DATA_FILE = path.join(__dirname, 'data.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ===== 数据存储层：有 DATABASE_URL 用 PostgreSQL，否则用本地 JSON 文件 =====
let pool = null;

if (DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.log('使用 PostgreSQL 数据库');
} else {
  console.log('使用本地 JSON 文件存储（开发模式）');
}

// 初始化数据库表（仅 PostgreSQL）
async function initDB() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('数据库表就绪');
}

// 读取全部
async function getAll() {
  if (pool) {
    const { rows } = await pool.query('SELECT data FROM registrations ORDER BY created_at DESC');
    return rows.map(r => r.data);
  }
  // JSON 文件模式
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch (e) { return []; }
}

// 添加一条
async function addOne(reg) {
  if (pool) {
    await pool.query(
      'INSERT INTO registrations (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data=$2, updated_at=NOW()',
      [reg.id, JSON.stringify(reg)]
    );
    return;
  }
  // JSON 文件模式
  const regs = await getAll();
  regs.push(reg);
  fs.writeFileSync(DATA_FILE, JSON.stringify(regs, null, 2), 'utf-8');
}

// ===== 配置存储（密码、管理员姓名，全设备共享）=====
function getConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); }
  catch (e) { return { pwd: ADMIN_PWD, adminName: '周海红' }; }
}
function setConfig(updates) {
  const current = getConfig();
  const updated = Object.assign(current, updates);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

// 批量替换
async function batchReplace(regs) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM registrations');
      for (const reg of regs) {
        await client.query('INSERT INTO registrations (id, data) VALUES ($1, $2)', [reg.id, JSON.stringify(reg)]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  // JSON 文件模式
  fs.writeFileSync(DATA_FILE, JSON.stringify(regs, null, 2), 'utf-8');
}
function bodyParser(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');

  try {
    // --- API Routes ---
    if (url.pathname === '/api/regs') {
      if (req.method === 'GET') {
        const regs = await getAll();
        return json(res, 200, regs);
      }
      if (req.method === 'POST') {
        const reg = await bodyParser(req);
        await addOne(reg);
        return json(res, 200, { ok: true, id: reg.id });
      }
    }

    if (url.pathname === '/api/regs/batch') {
      if (req.method === 'POST') {
        const regs = await bodyParser(req);
        await batchReplace(regs);
        return json(res, 200, { ok: true, count: regs.length });
      }
    }

    if (url.pathname === '/api/verify-pwd') {
      if (req.method === 'POST') {
        const { password } = await bodyParser(req);
        const config = getConfig();
        return json(res, 200, { ok: password === config.pwd });
      }
    }

    if (url.pathname === '/api/config') {
      if (req.method === 'GET') {
        const config = getConfig();
        return json(res, 200, config);
      }
      if (req.method === 'POST') {
        const updates = await bodyParser(req);
        const config = setConfig(updates);
        return json(res, 200, { ok: true, config });
      }
    }

    // --- Static Files ---
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath).toLowerCase();

    if (MIME[ext]) {
      fs.readFile(fullPath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': MIME[ext] });
          res.end(data);
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  } catch (e) {
    console.error('API Error:', e.message);
    json(res, 500, { ok: false, error: e.message });
  }
});

// 启动
initDB().then(() => {
  // JSON 模式下初始化数据文件
  if (!pool && !fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
  server.listen(PORT, () => {
    console.log('周礼婚礼管家服务已启动，端口：' + PORT);
  });
}).catch(err => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
