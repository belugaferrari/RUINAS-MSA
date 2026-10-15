import express from 'express';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { Server } from 'socket.io';
import { db, save, uid, RAIZ, UPLOADS } from './db.js';
import { registrar, entrar, usuarioDoToken, sair } from './auth.js';
import { sistema, listaSistemas, CONTEUDO } from './sistema.js';
import { novaCampanha, resumoCampanha, visaoPara, entrarNaCampanha, executar, acoes } from './actions.js';
import { modeloNpcs, lerNpcs } from './excel.js';
import { catalogoItens, origemCatalogo, lerPlanilhaItens, planilhaDoCatalogo, salvarCatalogoMestre, voltarCatalogoPadrao } from './itens.js';
import { montarSprite } from './icones.js';

const PORTA = parseInt(process.env.PORT, 10) || 3000;
const LIVROS = new Set(['regras-msa', 'regras-mss', 'mestre']);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(RAIZ, 'public')));
app.use('/shared', express.static(path.join(RAIZ, 'shared')));
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));
const SPRITE = montarSprite();
app.get('/icones.svg', (_req, res) => res.type('image/svg+xml').set('Cache-Control', 'max-age=3600').send(SPRITE));
app.get('/vendor/marked.js', (_req, res) => res.sendFile(path.join(RAIZ, 'node_modules/marked/lib/marked.esm.js')));

const rota = fn => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (e) {
    res.status(e.status || 400).json({ erro: e.message });
  }
};

function autenticado(req) {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '') || req.query.token;
  const user = usuarioDoToken(token);
  if (!user) throw Object.assign(new Error('Sessão expirada. Entre novamente.'), { status: 401 });
  return user;
}

function campanhaDoMestre(req) {
  const user = autenticado(req);
  const c = db.campaigns.find(x => x.id === req.params.id);
  if (!c || c.mestreId !== user.id) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
  return c;
}

app.post('/api/registrar', rota(req => registrar(req.body.nome, req.body.senha)));
app.post('/api/entrar', rota(req => entrar(req.body.nome, req.body.senha)));
app.post('/api/sair', rota(req => { sair((req.get('authorization') || '').replace(/^Bearer /, '')); return {}; }));
app.get('/api/eu', rota(req => { const u = autenticado(req); return { id: u.id, name: u.name }; }));
app.get('/api/sistema', rota(req => sistema(req.query.id)));
app.get('/api/sistemas', rota(() => listaSistemas()));

app.get('/api/livro/:nome', (req, res) => {
  const nome = req.params.nome === 'regras' ? 'regras-msa' : req.params.nome;
  if (!LIVROS.has(nome)) return res.status(404).send('Livro não encontrado');
  res.type('text/markdown').sendFile(path.join(CONTEUDO, 'livros', `${nome}.md`));
});

app.get('/api/modelo-npcs.xlsx', async (req, res) => {
  res.attachment('modelo_npcs.xlsx');
  res.send(Buffer.from(await modeloNpcs(req.query.sistema)));
});

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 }, storage: multer.memoryStorage() });

const EXT_IMAGEM = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

function salvarImagem(file) {
  const ext = EXT_IMAGEM[file?.mimetype];
  if (!ext) throw new Error('Envie uma imagem PNG, JPG, GIF ou WEBP.');
  const nome = `${uid()}${uid()}${ext}`;
  fs.writeFileSync(path.join(UPLOADS, nome), file.buffer);
  return `/uploads/${nome}`;
}

app.post('/api/campanhas/:id/imagens', upload.single('arquivo'), rota(req => {
  const c = campanhaDoMestre(req);
  const img = { id: uid(), titulo: String(req.body.titulo || req.file?.originalname || 'Imagem').slice(0, 120), categoria: String(req.body.categoria || 'Geral').slice(0, 40), url: salvarImagem(req.file), mostrando: false };
  c.imagens.push(img);
  save();
  transmitir(c);
  return img;
}));

// Foto do personagem: o mestre envia para qualquer um; o jogador só para os seus.
app.post('/api/campanhas/:id/personagens/:pid/foto', upload.single('arquivo'), rota(req => {
  const user = autenticado(req);
  const c = db.campaigns.find(x => x.id === req.params.id);
  const p = c?.personagens.find(x => x.id === req.params.pid);
  if (!p || (c.mestreId !== user.id && p.donoId !== user.id)) throw Object.assign(new Error('Personagem não encontrado.'), { status: 404 });
  p.foto = salvarImagem(req.file);
  save();
  transmitir(c);
  return { foto: p.foto };
}));

app.post('/api/campanhas/:id/importar-npcs', upload.single('arquivo'), rota(async req => {
  const c = campanhaDoMestre(req);
  if (!req.file) throw new Error('Envie a planilha .xlsx.');
  const linhas = await lerNpcs(req.file.buffer, c);
  for (const { grupo, ficha } of linhas) {
    let g = c.grupos.find(x => x.nome.toLowerCase() === grupo.toLowerCase());
    if (!g) {
      g = { id: uid(), nome: grupo };
      c.grupos.push(g);
    }
    executar(c, 'personagem.criar', { tipo: 'npc', grupoId: g.id, ficha }, { user: autenticado(req), mestre: true });
  }
  transmitir(c);
  return { importados: linhas.length };
}));

// ---------- catálogo de itens (planilha) ----------
// Qualquer mestre de campanha pode atualizar o catálogo; vale para todas as campanhas deste PC.
function exigirAlgumMestre(req) {
  const user = autenticado(req);
  if (!db.campaigns.some(c => c.mestreId === user.id)) throw Object.assign(new Error('Só quem é mestre de uma campanha pode mudar o catálogo de itens.'), { status: 403 });
  return user;
}

app.get('/api/itens/origem', rota(req => { autenticado(req); return origemCatalogo(); }));

app.get('/api/itens.xlsx', async (req, res) => {
  try {
    exigirAlgumMestre(req);
    res.attachment('itens-ilhas-das-ruinas.xlsx');
    res.send(Buffer.from(await planilhaDoCatalogo(catalogoItens() || [])));
  } catch (e) {
    res.status(e.status || 400).send(e.message);
  }
});

// modo "atualizar": junta com o catálogo atual (mesmo "num ctrl" ou mesmo nome = substitui); "substituir": troca tudo.
app.post('/api/itens', upload.single('arquivo'), rota(async req => {
  exigirAlgumMestre(req);
  if (!req.file) throw new Error('Envie a planilha .xlsx.');
  const novos = await lerPlanilhaItens(req.file.buffer, sistema('mss'));
  if (!novos.length) throw new Error('A planilha não tem itens.');
  let itens = novos;
  if (req.body.modo !== 'substituir') {
    const sem = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const nomes = new Set(novos.map(i => sem(i.nome)));
    const ids = new Set(novos.map(i => i.id));
    itens = [...(catalogoItens() || []).filter(i => !ids.has(i.id) && !nomes.has(sem(i.nome))), ...novos];
  }
  salvarCatalogoMestre(itens, req.file.originalname);
  io.emit('sistema:atualizado');
  return { recebidos: novos.length, total: itens.length };
}));

app.post('/api/itens/padrao', rota(req => {
  exigirAlgumMestre(req);
  voltarCatalogoPadrao();
  io.emit('sistema:atualizado');
  return origemCatalogo();
}));

// ---------- tempo real ----------

const sala = c => `c:${c.id}`;

async function transmitir(c) {
  const sockets = await io.in(sala(c)).fetchSockets();
  for (const s of sockets) s.emit('estado', visaoPara(c, s.data.user, s.data.area));
}

io.use((socket, next) => {
  const user = usuarioDoToken(socket.handshake.auth?.token);
  if (!user) return next(new Error('nao-autenticado'));
  socket.data.user = user;
  next();
});

io.on('connection', socket => {
  const { user } = socket.data;
  const responder = (ack, fn) => {
    try {
      ack?.({ ok: true, dados: fn() });
    } catch (e) {
      if (!e.publico) console.error(e);
      ack?.({ ok: false, erro: e.publico ? e.message : 'Erro inesperado no servidor.' });
    }
  };

  socket.on('saguao', (area, ack) => responder(ack, () => {
    if (area === 'mestre') return db.campaigns.filter(c => c.mestreId === user.id).map(resumoCampanha);
    return db.campaigns
      .filter(c => c.mestreId !== user.id && (c.aberta || c.jogadores.includes(user.id)))
      .map(c => ({ ...resumoCampanha(c), participando: c.jogadores.includes(user.id) }));
  }));

  socket.on('campanha:criar', (dados, ack) => responder(ack, () => resumoCampanha(novaCampanha(user, dados || {}))));

  socket.on('campanha:abrir', ({ id, aberta }, ack) => responder(ack, () => {
    const c = db.campaigns.find(x => x.id === id && x.mestreId === user.id);
    if (!c) throw Object.assign(new Error('Campanha não encontrada.'), { publico: true });
    executar(c, 'campanha.atualizar', { aberta }, { user, mestre: true });
    transmitir(c);
    if (!c.aberta) expulsarJogadores(c);
  }));

  socket.on('campanha:apagar', (id, ack) => responder(ack, () => {
    const c = db.campaigns.find(x => x.id === id && x.mestreId === user.id);
    if (!c) throw Object.assign(new Error('Campanha não encontrada.'), { publico: true });
    db.campaigns = db.campaigns.filter(x => x !== c);
    save();
    io.to(sala(c)).emit('expulso', 'A campanha foi apagada pelo mestre.');
    io.in(sala(c)).socketsLeave(sala(c));
  }));

  socket.on('campanha:entrar', ({ id, area }, ack) => responder(ack, () => {
    const c = db.campaigns.find(x => x.id === id);
    if (!c) throw Object.assign(new Error('Campanha não encontrada.'), { publico: true });
    entrarNaCampanha(c, user, area);
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.join(sala(c));
    socket.data.area = area === 'mestre' ? 'mestre' : 'jogador';
    socket.data.campanhaId = c.id;
    if (area !== 'mestre') transmitir(c);
    return visaoPara(c, user, socket.data.area);
  }));

  socket.on('campanha:sair', () => {
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.data.campanhaId = null;
  });

  socket.on('acao', ({ tipo, dados }, ack) => responder(ack, () => {
    const c = db.campaigns.find(x => x.id === socket.data.campanhaId);
    if (!c) throw Object.assign(new Error('Entre em uma campanha primeiro.'), { publico: true });
    if (!(tipo in acoes)) throw Object.assign(new Error('Ação desconhecida.'), { publico: true });
    const mestre = socket.data.area === 'mestre' && c.mestreId === user.id;
    if (!mestre && !c.aberta) throw Object.assign(new Error('A campanha foi fechada pelo mestre.'), { publico: true });
    const r = executar(c, tipo, dados, { user, mestre });
    transmitir(c);
    if (tipo === 'campanha.atualizar' && !c.aberta) expulsarJogadores(c);
    if (tipo === 'jogador.remover') expulsarJogadores(c, dados.userId);
    return r;
  }));
});

async function expulsarJogadores(c, apenas) {
  for (const s of await io.in(sala(c)).fetchSockets()) {
    if (s.data.area === 'mestre') continue;
    if (apenas && s.data.user.id !== apenas) continue;
    s.emit('expulso', apenas ? 'O mestre removeu você da campanha.' : 'O mestre fechou a campanha.');
    s.leave(sala(c));
    s.data.campanhaId = null;
  }
}

server.listen(PORTA, () => {
  console.log(`\n  Ilhas das Ruínas MSA rodando!\n`);
  console.log(`  Neste PC:        http://localhost:${PORTA}`);
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  Na mesma Wi-Fi:  http://${i.address}:${PORTA}`);
    }
  }
  console.log('');
});
