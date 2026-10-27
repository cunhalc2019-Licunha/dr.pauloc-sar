// Cria (ou troca) a senha do administrador depois de confirmar o código enviado por e-mail.
import { checkTicket, guard, savePassword, send, setSession, slow } from './_lib.js';

export default async function handler(req, res) {
  if (guard(req, res, { auth: false }) !== true) return;
  const { ticket, code, password } = req.body || {};
  if (!checkTicket(ticket, code)) {
    await slow();
    return send(res, 401, { error: 'Código incorreto ou expirado. Peça um novo código.' });
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 200)
    return send(res, 400, { error: 'A senha precisa ter pelo menos 10 caracteres.' });
  try {
    await savePassword(password);
    setSession(res);
    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Não foi possível salvar a senha agora. Tente de novo.' });
  }
}
