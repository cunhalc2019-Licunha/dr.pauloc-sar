// Primeiro acesso / esqueci a senha: envia um código de 6 dígitos ao e-mail cadastrado.
// A resposta é a mesma para qualquer e-mail, para não revelar qual é o cadastrado.
import crypto from 'node:crypto';
import { ADMIN_EMAIL, guard, makeTicket, send, sendCodeEmail, slow } from './_lib.js';

export default async function handler(req, res) {
  if (guard(req, res, { auth: false }) !== true) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  if (email !== ADMIN_EMAIL) {
    await slow();
    return send(res, 200, { ticket: makeTicket(crypto.randomBytes(8).toString('hex')) });
  }
  try {
    await sendCodeEmail(code);
    send(res, 200, { ticket: makeTicket(code) });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' });
  }
}
