import { checkPassword, guard, send, setSession, slow } from './_lib.js';

export default async function handler(req, res) {
  if (guard(req, res, { auth: false }) !== true) return;
  try {
    const ok = await checkPassword(req.body?.email, req.body?.password);
    if (ok === 'no-password') return send(res, 409, { error: 'A senha ainda não foi criada. Clique em "Primeiro acesso".' });
    if (!ok) {
      await slow();
      return send(res, 401, { error: 'E-mail ou senha incorretos.' });
    }
    setSession(res);
    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Não foi possível verificar o acesso agora. Tente de novo.' });
  }
}
