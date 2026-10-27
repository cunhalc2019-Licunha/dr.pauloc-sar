import { guard, passwordMatches, setSession, send } from './_lib.js';

export default async function handler(req, res) {
  if (guard(req, res, { auth: false }) !== true) return;
  if (!passwordMatches(req.body?.password)) {
    await new Promise((r) => setTimeout(r, 1200)); // atrasa tentativas de adivinhar a senha
    return send(res, 401, { error: 'Senha incorreta.' });
  }
  setSession(res);
  send(res, 200, { ok: true });
}
