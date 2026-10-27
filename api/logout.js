import { clearSession, send } from './_lib.js';

export default function handler(req, res) {
  clearSession(res);
  send(res, 200, { ok: true });
}
