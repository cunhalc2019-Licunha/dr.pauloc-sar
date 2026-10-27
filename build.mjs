// Monta o site final: index.html (molde) + content.json (textos/fotos editados no /admin).
// Só os elementos marcados com data-cms podem mudar; a estrutura dos blocos vem sempre do molde.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { applyValue, readField } from './lib/cms.mjs';

const OUT = 'public';
const template = readFileSync('index.html', 'utf8');
const content = existsSync('content.json') ? JSON.parse(readFileSync('content.json', 'utf8')) : {};
const values = content.values || {};

const $ = cheerio.load(template, { decodeEntities: false });

// Coleta os campos na ordem em que aparecem, agrupados pelo bloco (section) onde estão.
const fields = [];
const seen = new Set();
$('[data-cms]').each((_, node) => {
  const el = $(node);
  const key = el.attr('data-cms');
  if (seen.has(key)) return;
  seen.add(key);
  const f = readField($, el);
  f.section = el.closest('[data-cms-section]').attr('data-cms-section') || 'Geral';
  fields.push(f);
});

// Aplica os valores salvos (ignora chaves que não existem mais no molde).
for (const f of fields) {
  if (!(f.key in values)) continue;
  applyValue($, f.key, f.type, values[f.key]);
  f.value = values[f.key];
}

// Remove as marcações de edição do HTML publicado.
$('[data-cms],[data-cms-href],[data-cms-section]').each((_, node) => {
  const el = $(node);
  for (const a of ['data-cms', 'data-cms-label', 'data-cms-type', 'data-cms-hint', 'data-cms-href', 'data-cms-section']) el.removeAttr(a);
});

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/admin`, { recursive: true });
writeFileSync(`${OUT}/index.html`, $.html());
cpSync('img', `${OUT}/img`, { recursive: true });
cpSync('admin', `${OUT}/admin`, { recursive: true });

const sections = [];
for (const f of fields) {
  let s = sections.find((x) => x.name === f.section);
  if (!s) sections.push((s = { name: f.section, fields: [] }));
  const { section, ...rest } = f;
  s.fields.push(rest);
}
writeFileSync(`${OUT}/admin/schema.json`, JSON.stringify({ sections }, null, 1));
console.log(`build ok: ${fields.length} campos editáveis, ${Object.keys(values).length} valores salvos`);
