// Salva textos/fotos: valida cada campo contra o molde (index.html do repositório),
// grava content.json + fotos novas num único commit. A Vercel publica em seguida.
import * as cheerio from 'cheerio';
import { cleanValue, readField } from '../lib/cms.mjs';
import { BRANCH, guard, gh, readRepoFile, send } from './_lib.js';

export default async function handler(req, res) {
  if (guard(req, res) !== true) return;
  const incoming = req.body?.values;
  const images = Array.isArray(req.body?.images) ? req.body.images : [];
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return send(res, 400, { error: 'Nada para salvar.' });
  if (Object.keys(incoming).length > 300 || images.length > 30) return send(res, 400, { error: 'Alterações demais de uma vez.' });

  try {
    const template = await readRepoFile('index.html');
    if (!template) throw new Error('index.html não encontrado no repositório');
    const $ = cheerio.load(template, { decodeEntities: false });
    const types = {};
    $('[data-cms]').each((_, n) => {
      const f = readField($, $(n));
      types[f.key] ??= f.type;
    });

    const current = JSON.parse((await readRepoFile('content.json')) || '{"values":{}}');
    const values = current.values || {};
    const errors = [];
    for (const [key, raw] of Object.entries(incoming)) {
      if (!types[key]) {
        errors.push(`${key}: campo não existe`);
        continue;
      }
      try {
        values[key] = cleanValue(types[key], raw);
      } catch (e) {
        errors.push(`${key}: ${e.message}`);
      }
    }
    if (errors.length) return send(res, 422, { error: 'Corrija os campos destacados.', fields: errors });

    const uploads = [];
    for (const img of images) {
      if (!/^img\/uploads\/[\w.-]+\.(jpg|png|webp)$/.test(img?.path || '') || !/^[0-9a-f]{40}$/.test(img?.sha || ''))
        return send(res, 400, { error: 'Foto inválida.' });
      // só grava fotos que algum campo realmente usa
      if (Object.values(values).includes(img.path)) uploads.push(img);
    }

    const commitSha = await commit(
      [
        { path: 'content.json', content: JSON.stringify({ values }, null, 1) + '\n' },
        ...uploads.map((i) => ({ path: i.path, sha: i.sha })),
      ],
      `Admin: atualiza ${Object.keys(incoming).length} campo(s)${uploads.length ? ` e ${uploads.length} foto(s)` : ''}`
    );
    send(res, 200, { ok: true, commit: commitSha });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Não foi possível salvar no GitHub. Tente de novo em instantes.' });
  }
}

async function commit(files, message, attempt = 1) {
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
    if (e.status === 422 && attempt < 3) return commit(files, message, attempt + 1); // alguém salvou ao mesmo tempo
    throw e;
  }
  return c.sha;
}
