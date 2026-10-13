import crypto from 'node:crypto';
import { db, save, uid } from './db.js';

function derivar(senha, salt) {
  return crypto.scryptSync(senha, salt, 64).toString('hex');
}

function emitirToken(user) {
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens[token] = { userId: user.id, criado: Date.now() };
  save();
  return { token, user: { id: user.id, name: user.name } };
}

function validar(nome, senha) {
  nome = String(nome || '').trim();
  if (nome.length < 2) throw new Error('O nome precisa ter ao menos 2 letras.');
  if (String(senha || '').length < 4) throw new Error('A senha precisa ter ao menos 4 caracteres.');
  return nome;
}

export function registrar(nome, senha) {
  nome = validar(nome, senha);
  if (db.users.some(u => u.name.toLowerCase() === nome.toLowerCase())) throw new Error('Esse nome já está em uso.');
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: uid(), name: nome, salt, hash: derivar(senha, salt) };
  db.users.push(user);
  return emitirToken(user);
}

export function entrar(nome, senha) {
  nome = validar(nome, senha);
  const user = db.users.find(u => u.name.toLowerCase() === nome.toLowerCase());
  const ok = user && crypto.timingSafeEqual(Buffer.from(user.hash, 'hex'), Buffer.from(derivar(senha, user.salt), 'hex'));
  if (!ok) throw new Error('Nome ou senha incorretos.');
  return emitirToken(user);
}

export function usuarioDoToken(token) {
  const s = token && db.tokens[token];
  return s ? db.users.find(u => u.id === s.userId) : null;
}

export function sair(token) {
  delete db.tokens[token];
  save();
}
