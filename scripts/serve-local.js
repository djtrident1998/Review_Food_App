// Run the built site and the /api functions on one local port, with no Vercel account needed.
// Without KV_REST_API_URL set, it stands in for Upstash with an in-memory store (data is lost on exit).
// Usage: npm run serve:local   (then open http://localhost:3000)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json', '.png':'image/png', '.ico':'image/x-icon'};

/* Minimal Upstash-compatible pipeline over memory: only the commands the API uses. */
const mem = new Map();
function run([cmd, key, ...a]){
  cmd = String(cmd).toUpperCase();
  const hash = () => { if (!mem.has(key)) mem.set(key, new Map()); return mem.get(key); };
  const set = () => { if (!mem.has(key)) mem.set(key, new Set()); return mem.get(key); };
  switch (cmd) {
    case 'SET': if (a.includes('NX') && mem.has(key)) return null; mem.set(key, a[0]); return 'OK';
    case 'INCR': { const n = (Number(mem.get(key)) || 0) + 1; mem.set(key, String(n)); return n; }
    case 'EXPIRE': return mem.has(key) ? 1 : 0;
    case 'DEL': return mem.delete(key) ? 1 : 0;
    case 'HSET': { const h = hash(); let n = 0; for (let i = 0; i < a.length; i += 2) { if (!h.has(a[i])) n++; h.set(a[i], a[i + 1]); } return n; }
    case 'HGET': return mem.has(key) ? (mem.get(key).get(a[0]) ?? null) : null;
    case 'HGETALL': return mem.has(key) ? [...mem.get(key)].flat() : [];
    case 'HDEL': return mem.has(key) && mem.get(key).delete(a[0]) ? 1 : 0;
    case 'HLEN': return mem.has(key) ? mem.get(key).size : 0;
    case 'SADD': { const s = set(), had = s.has(a[0]); s.add(a[0]); return had ? 0 : 1; }
    case 'SREM': return mem.has(key) && mem.get(key).delete(a[0]) ? 1 : 0;
    case 'SISMEMBER': return mem.has(key) && mem.get(key).has(a[0]) ? 1 : 0;
    case 'SCARD': return mem.has(key) ? mem.get(key).size : 0;
    default: return {error: 'ERR unsupported command ' + cmd};
  }
}
if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
  process.env.KV_REST_API_URL = 'http://127.0.0.1:' + PORT + '/__redis';
  process.env.KV_REST_API_TOKEN = 'local';
  console.log('No Redis configured: using an in-memory store.');
}

const handlers = {};
async function api(name){ return handlers[name] ||= (await import(pathToFileURL(path.join(root, 'api', name + '.js')).href)).default; }

function readBody(req){ return new Promise(res => { let s = ''; req.on('data', c => { s += c; }); req.on('end', () => res(s)); }); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__redis/pipeline') {
    const cmds = JSON.parse(await readBody(req) || '[]');
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(cmds.map(c => { const r = run(c); return r && r.error ? r : {result: r}; })));
  }
  const m = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (m && fs.existsSync(path.join(root, 'api', m[1] + '.js'))) {
    // A small subset of Vercel's Node request/response helpers.
    const raw = await readBody(req);
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch (e) { req.body = raw; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
    return (await api(m[1]))(req, res);
  }
  let file = path.join(root, 'dist', decodeURIComponent(url.pathname));
  if (!file.startsWith(path.join(root, 'dist')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'dist', 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('Plate Index running at http://localhost:' + PORT));
