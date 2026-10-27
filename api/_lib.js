// Utilitários das funções do /admin: sessão por cookie assinado e acesso ao GitHub.
import crypto from 'node:crypto';

const COOKIE = 'pc_admin';
const SESSION_HOURS = 8;

export const REPO = process.env.GITHUB_REPO || 'cunhalc2019-Licunha/dr.pauloc-sar';
export const BRANCH = process.env.GITHUB_BRANCH || 'main';

export function configured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.GITHUB_TOKEN);
}

// A chave da sessão muda se a senha ou o token mudarem: trocar a senha derruba todas as sessões.
function secret() {
  return crypto
    .createHash('sha256')
    .update(`${process.env.SESSION_SECRET || ''}|${process.env.ADMIN_PASSWORD}|${process.env.GITHUB_TOKEN}`)
    .digest();
}

const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function passwordMatches(given) {
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
  const b = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

export function setSession(res) {
  const exp = Date.now() + SESSION_HOURS * 3600e3;
  const payload = `admin.${exp}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function isAuthed(req) {
  if (!configured()) return false;
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [who, exp, mac] = raw.slice(COOKIE.length + 1).split('.');
  if (who !== 'admin' || !exp || !mac) return false;
  const expected = sign(`${who}.${exp}`);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  return Number(exp) > Date.now();
}

// Garante POST com JSON (junto com SameSite=Strict, bloqueia envios de outros sites).
export function guard(req, res, { auth = true } = {}) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'Envie JSON' });
  if (!configured()) return send(res, 503, { error: 'Painel ainda não configurado: defina ADMIN_PASSWORD e GITHUB_TOKEN na Vercel.' });
  if (auth && !isAuthed(req)) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });
  return true;
}

export function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(body);
  return false;
}

export async function gh(path, { method = 'GET', body } = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'site-dr-paulo-cesar-admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(`GitHub ${r.status}: ${data?.message || 'erro'}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

export async function readRepoFile(path) {
  try {
    const f = await gh(`/contents/${path}?ref=${BRANCH}`);
    return Buffer.from(f.content, 'base64').toString('utf8');
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
