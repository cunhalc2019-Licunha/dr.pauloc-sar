import { configured, isAuthed, send } from './_lib.js';

export default function handler(req, res) {
  send(res, 200, { configured: configured(), authed: isAuthed(req) });
}
