// Utilitários das funções do /admin: sessão, senha do administrador e acesso ao GitHub.
//
// A senha é criada pelo próprio administrador no primeiro acesso (confirmado por código no
// e-mail cadastrado). Ela é guardada como hash scrypt, criptografado (AES-256-GCM), em
// auth/admin.json no repositório — esse arquivo não vai para o site publicado.
import crypto from 'node:crypto';

const COOKIE = 'pc_admin';
const SESSION_HOURS = 8;
const AUTH_FILE = 'auth/admin.json';

export const REPO = process.env.GITHUB_REPO || 'cunhalc2019-Licunha/dr.pauloc-sar';
export const BRANCH = process.env.GITHUB_BRANCH || 'main';
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'paulocesardrpc123@gmail.com').trim().toLowerCase();

export function configured() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.RESEND_API_KEY);
}

// Chave mestra do servidor. Se o GITHUB_TOKEN mudar, a senha precisa ser criada de novo.
function key(purpose) {
  return crypto.createHash('sha256').update(`${purpose}|${process.env.SESSION_SECRET || ''}|${process.env.GITHUB_TOKEN}`).digest();
}
const hmac = (purpose, data) => crypto.createHmac('sha256', key(purpose)).update(data).digest('base64url');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const slow = () => new Promise((r) => setTimeout(r, 1200)); // atrasa tentativas de adivinhar

// ---------- sessão ----------
export function setSession(res) {
  const payload = `admin.${Date.now() + SESSION_HOURS * 3600e3}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${payload}.${hmac('session', payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`);
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
  return safeEq(mac, hmac('session', `${who}.${exp}`)) && Number(exp) > Date.now();
}

// ---------- senha ----------
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));

export async function readAuth() {
  const raw = await readRepoFile(AUTH_FILE);
  if (!raw) return null;
  try {
    const box = JSON.parse(raw);
    const d = crypto.createDecipheriv('aes-256-gcm', key('auth'), Buffer.from(box.iv, 'base64'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString());
  } catch {
    return null; // chave do servidor mudou: o administrador precisa criar a senha de novo
  }
}

export async function checkPassword(email, password) {
  const auth = await readAuth();
  if (!auth) return 'no-password';
  if (String(email || '').trim().toLowerCase() !== ADMIN_EMAIL) return false;
  const got = await scrypt(String(password || ''), Buffer.from(auth.salt, 'base64'));
  return crypto.timingSafeEqual(got, Buffer.from(auth.hash, 'base64'));
}

export async function savePassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt);
  const plain = JSON.stringify({ email: ADMIN_EMAIL, salt: salt.toString('base64'), hash: hash.toString('base64'), updated: new Date().toISOString() });
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key('auth'), iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  const box = { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
  await commitFiles([{ path: AUTH_FILE, content: JSON.stringify(box) + '\n' }], 'Admin: senha do administrador definida');
}

// ---------- código por e-mail ----------
// O código não fica guardado em lugar nenhum: o navegador recebe um "ticket" assinado com o
// hash do código e a validade; para criar a senha é preciso apresentar ticket + código.
export function makeTicket(code) {
  const exp = Date.now() + 10 * 60e3;
  const payload = `${exp}`;
  return `${payload}.${hmac('code', `${payload}.${code}`)}`;
}

export function checkTicket(ticket, code) {
  const [exp, mac] = String(ticket || '').split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  return safeEq(mac, hmac('code', `${exp}.${String(code || '').trim()}`));
}

export async function sendCodeEmail(code) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Site Dr. PC <onboarding@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `Seu código de acesso ao painel: ${code}`,
      text: `Seu código para criar a senha do painel do site é: ${code}\n\nEle vale por 10 minutos.\nSe você não pediu este código, ignore este e-mail.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0d1b2e"><p>Seu código para criar a senha do painel do site é:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#b8913f">${code}</p><p>Ele vale por 10 minutos.</p><p style="color:#5d6878;font-size:13px">Se você não pediu este código, ignore este e-mail.</p></div>`,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// ---------- requisições ----------
// Garante POST com JSON (junto com SameSite=Strict, bloqueia envios de outros sites).
export function guard(req, res, { auth = true } = {}) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'Envie JSON' });
  if (!configured()) return send(res, 503, { error: 'Painel ainda não configurado na Vercel (GITHUB_TOKEN e RESEND_API_KEY).' });
  if (auth && !isAuthed(req)) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });
  return true;
}

export function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(body);
  return false;
}

// ---------- GitHub ----------
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

// Grava vários arquivos num único commit. files: [{path, content}] ou [{path, sha}] (blob já enviado).
export async function commitFiles(files, message, attempt = 1) {
  const ref = await gh(`/git/ref/heads/${BRANCH}`);
  const parent = await gh(`/git/commits/${ref.object.sha}`);
  const tree = await gh('/git/trees', {
    method: 'POST',
    body: {
      base_tree: parent.tree.sha,
      tree: files.map((f) => (f.sha ? { path: f.path, mode: '100644', type: 'blob', sha: f.sha } : { path: f.path, mode: '100644', type: 'blob', content: f.content })),
    },
  });
  const c = await gh('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [ref.object.sha] } });
  try {
    await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: c.sha, force: false } });
  } catch (e) {
    if (e.status === 422 && attempt < 3) return commitFiles(files, message, attempt + 1); // alguém salvou ao mesmo tempo
    throw e;
  }
  return c.sha;
}
