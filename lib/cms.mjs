// Regras compartilhadas entre o build e a API do /admin: tipos de campo, validação e aplicação.

const MULTILINE = new Set(['p', 'blockquote']);

export const TYPES = ['text', 'image', 'email', 'phone', 'whatsapp', 'youtube'];

export function fieldType(tag, declared) {
  if (declared && TYPES.includes(declared)) return declared;
  return tag === 'img' ? 'image' : 'text';
}

export function readField($, el) {
  const tag = el.get(0).tagName.toLowerCase();
  const type = fieldType(tag, el.attr('data-cms-type'));
  let value;
  if (type === 'image') value = el.attr('src');
  else if (type === 'youtube') value = el.attr('data-yt');
  else value = el.text();
  return {
    key: el.attr('data-cms'),
    label: el.attr('data-cms-label') || el.attr('data-cms'),
    hint: el.attr('data-cms-hint') || undefined,
    type,
    multiline: type === 'text' && MULTILINE.has(tag),
    value,
  };
}

const digits = (v) => String(v).replace(/\D/g, '');
const brPhone = (v) => {
  let d = digits(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
};

// Valida e normaliza um valor vindo do /admin. Lança erro com mensagem amigável.
export function cleanValue(type, raw) {
  if (typeof raw !== 'string') throw new Error('valor inválido');
  const v = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  switch (type) {
    case 'text':
      if (!v) throw new Error('o texto não pode ficar vazio');
      if (v.length > 3000) throw new Error('texto longo demais (máx. 3000 caracteres)');
      return v;
    case 'image':
      if (!/^(img\/[A-Za-z0-9._\/-]+\.(jpe?g|png|webp)|https:\/\/[^\s"'<>()]+)$/i.test(v) || v.includes('..'))
        throw new Error('imagem inválida');
      return v;
    case 'email':
      if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(v)) throw new Error('e-mail inválido');
      return v.toLowerCase();
    case 'phone':
    case 'whatsapp': {
      const d = brPhone(v);
      if (d.length < 10 || d.length > 11) throw new Error('telefone inválido (use DDD + número)');
      return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    case 'youtube': {
      const m = v.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || v.match(/^([\w-]{11})$/);
      if (!m) throw new Error('link do YouTube inválido');
      return m[1];
    }
    default:
      throw new Error('tipo de campo desconhecido');
  }
}

// Aplica um valor em todos os elementos com aquela chave (e nos links ligados a ela).
export function applyValue($, key, type, value) {
  const els = $(`[data-cms="${key}"]`);
  const links = $(`[data-cms-href="${key}"]`);
  if (type === 'image') {
    els.attr('src', value);
  } else if (type === 'youtube') {
    els.attr('data-yt', value).attr('style', `background-image:url(https://img.youtube.com/vi/${value}/hqdefault.jpg)`);
  } else {
    els.text(value);
  }
  if (type === 'email') {
    els.filter('a').add(links).attr('href', `mailto:${value}`);
  } else if (type === 'phone') {
    els.filter('a').add(links).attr('href', `tel:+55${brPhone(value)}`);
  } else if (type === 'whatsapp') {
    $('body').attr('data-wa', `55${brPhone(value)}`);
  }
}
