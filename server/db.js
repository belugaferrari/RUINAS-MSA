import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(RAIZ, 'data');
export const UPLOADS = path.join(DATA_DIR, 'uploads');
const ARQUIVO = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(UPLOADS, { recursive: true });

export const db = fs.existsSync(ARQUIVO)
  ? JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))
  : { users: [], tokens: {}, campaigns: [] };

export const uid = () => crypto.randomBytes(6).toString('hex');

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

export function flush() {
  clearTimeout(timer);
  const tmp = `${ARQUIVO}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, ARQUIVO);
}

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => { flush(); process.exit(0); });
}
