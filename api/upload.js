// Recebe uma foto (já reduzida no navegador) e guarda no GitHub como "blob".
// Ela só entra no site quando o usuário clica em Salvar (tudo vai num único commit).
import crypto from 'node:crypto';
import { guard, gh, send } from './_lib.js';

const MAX_BYTES = 3.3 * 1024 * 1024;
const KINDS = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
];

export default async function handler(req, res) {
  if (guard(req, res) !== true) return;
  const data = String(req.body?.data || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return send(res, 400, { error: 'Arquivo inválido.' });
  const buf = Buffer.from(data, 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return send(res, 413, { error: 'Foto grande demais (máx. 3 MB depois de reduzida).' });
  const kind = KINDS.find((k) => k.test(buf));
  if (!kind) return send(res, 415, { error: 'Use uma foto JPG, PNG ou WEBP.' });

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const path = `img/uploads/${stamp}-${crypto.randomBytes(3).toString('hex')}.${kind.ext}`;
  try {
    const blob = await gh('/git/blobs', { method: 'POST', body: { content: data, encoding: 'base64' } });
    send(res, 200, { path, sha: blob.sha });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Não foi possível enviar a foto ao GitHub. Verifique o GITHUB_TOKEN.' });
  }
}
