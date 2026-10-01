// Postgres prints jsonb in one canonical way: object keys sorted by byte
// length and then bytewise, ", " between items and ": " after keys. Writing a
// value in that exact form lets us compare md5(value::text) computed in the
// database with the md5 of a file here, so an exported copy is proven
// identical to what the API would have returned.

import crypto from 'node:crypto';

const keyOrder = (a, b) => {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length - bb.length || Buffer.compare(ab, bb);
};

function str(s) {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}

export function jsonbText(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return str(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return '[' + value.map(jsonbText).join(', ') + ']';
  // jsonb keeps the last of duplicate keys; JSON.parse already did the same.
  return '{' + Object.keys(value).sort(keyOrder).map(k => str(k) + ': ' + jsonbText(value[k])).join(', ') + '}';
}

export const jsonbMd5 = value => crypto.createHash('md5').update(jsonbText(value), 'utf8').digest('hex');
