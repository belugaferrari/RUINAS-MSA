import express from 'express';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { Server } from 'socket.io';
import { db, save, flush, uid, RAIZ, UPLOADS } from './db.js';
import { execSync } from 'node:child_process';
import { registrar, entrar, usuarioDoToken, sair } from './auth.js';
import { sistema, listaSistemas, CONTEUDO } from './sistema.js';
import { novaCampanha, resumoCampanha, visaoPara, entrarNaCampanha, executar, acoes, migrarCampanhas, podeSuporte } from './actions.js';

// Catálogo do mestre lido de novo quando a leitura da planilha muda (28/10: bônus com %, IP por tipo).
try { reconverterCatalogos(sistema('mss')); } catch (e) { console.log(`Catálogo de itens: ${e.message}`); }
migrarCampanhas();
import { modeloNpcs, lerNpcs } from './excel.js';
import { lerPlanilhaMonstros, planilhaMonstros, catalogoMonstros, salvarCatalogoMonstros, voltarMonstrosPadrao } from './monstros.js';
import { configPublica, salvarConfigIA, gerarTexto, lerImagemJson } from './ia.js';
import { objetosDaIA, PEDIDO_MAPA_IA, ESQUEMA_MAPA_IA } from '../shared/objetosMapa.js';
import { SISTEMA_IA, pedidoIA } from '../shared/encontro.js';
import { catalogoItens, origemCatalogo, lerPlanilhaItens, planilhaDoCatalogo, salvarCatalogoMestre, voltarCatalogoPadrao, reconverterCatalogos, linkGoogleItens } from './itens.js';
import { montarSprite } from './icones.js';
import { avatarPorId, svgAvatar } from '../shared/avatares.js';

const PORTA = parseInt(process.env.PORT, 10) || 3000;
const LIVROS = new Set(['regras-msa', 'regras-mss', 'mestre']);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(RAIZ, 'public')));
app.use('/shared', express.static(path.join(RAIZ, 'shared')));
// Avatares prontos: desenhados na hora (e guardados em memória) a partir de shared/avatares.js.
app.get('/avatares/:id.svg', (req, res) => {
  const a = avatarPorId(req.params.id);
  if (!a) return res.status(404).end();
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svgAvatar(a));
});
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

const upload = multer({ limits: { fileSize: 60 * 1024 * 1024 }, storage: multer.memoryStorage() });

const EXT_IMAGEM = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
// Vídeos (para mapas animados): só na aba Imagens do mestre.
const EXT_VIDEO = { 'video/mp4': '.mp4', 'video/webm': '.webm' };

function salvarImagem(file, { video = false } = {}) {
  const ext = EXT_IMAGEM[file?.mimetype] || (video ? EXT_VIDEO[file?.mimetype] : null);
  if (!ext) throw new Error(video ? 'Envie uma imagem (PNG, JPG, GIF, WEBP) ou um vídeo (MP4, WEBM).' : 'Envie uma imagem PNG, JPG, GIF ou WEBP.');
  if (!EXT_VIDEO[file.mimetype] && file.size > 10 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 10 MB).');
  const nome = `${uid()}${uid()}${ext}`;
  fs.writeFileSync(path.join(UPLOADS, nome), file.buffer);
  return `/uploads/${nome}`;
}

app.post('/api/campanhas/:id/imagens', upload.single('arquivo'), rota(req => {
  const c = campanhaDoMestre(req);
  const tipo = EXT_VIDEO[req.file?.mimetype] ? 'video' : 'imagem';
  const img = { id: uid(), titulo: String(req.body.titulo || req.file?.originalname || 'Imagem').slice(0, 120), categoria: String(req.body.categoria || 'Outros').slice(0, 40), url: salvarImagem(req.file, { video: true }), tipo, mostrando: false };
  c.imagens.push(img);
  save();
  transmitir(c);
  return img;
}));

// IA para o cenário do encontro (Gemini grátis, Ollama no PC ou Claude). As chaves ficam só neste PC (data/ia.json).
app.get('/api/ia', rota(req => { exigirAlgumMestre(req); return configPublica(); }));
app.post('/api/ia', rota(req => { exigirAlgumMestre(req); return salvarConfigIA(req.body || {}); }));
// Reescreve o cenário do encontro gerado com a IA configurada (o sorteio e a variação já foram feitos).
app.post('/api/campanhas/:id/encontro/cenario', rota(async req => {
  const c = campanhaDoMestre(req);
  const g = c.encontroGerado;
  if (!g) throw new Error('Gere um encontro primeiro.');
  const sis = sistema(c.sistema);
  const { texto, fonte } = await gerarTexto(SISTEMA_IA, pedidoIA(g.criaturas, sis.monstros, { hora: c.relogio?.horas ?? null, clima: c.clima?.nome || null, extra: g.contexto }));
  if (c.encontroGerado?.id !== g.id) throw new Error('O encontro mudou enquanto a IA escrevia. Tente de novo.');
  g.cenario = { texto: texto.slice(0, 4000), fonte };
  save();
  transmitir(c);
  return g.cenario;
}));

// Ler o mapa com IA: a tela manda a imagem do mapa (reduzida) e a proporção; a IA devolve caixas, o app converte para
// a grade e devolve a proposta. Nada entra no mapa até o mestre revisar e aceitar (ação mapa.objetosAceitar).
app.post('/api/campanhas/:id/mapa/ler', rota(async req => {
  const c = campanhaDoMestre(req);
  if (!c.mapa?.imagemId) throw new Error('Escolha o mapa primeiro.');
  const { imagem, aspecto } = req.body || {};
  const asp = Number(aspecto);
  if (!(asp > 0.05 && asp < 20)) throw new Error('Não deu para medir o mapa. Recarregue a página e tente de novo.');
  if (!imagem?.data || String(imagem.data).length > 2_700_000) throw new Error('Imagem do mapa grande demais para a IA.');
  const { dados, fonte } = await lerImagemJson('Você identifica objetos em mapas de RPG vistos de cima e responde só com JSON.', PEDIDO_MAPA_IA, { data: String(imagem.data), mime: String(imagem.mime) }, ESQUEMA_MAPA_IA);
  const objetos = objetosDaIA(dados?.objetos, c.mapa.grade, asp);
  return { objetos, fonte, lidos: Array.isArray(dados?.objetos) ? dados.objetos.length : 0 };
}));

// Imagem de um monstro do Livro dos Monstros (só o mestre). A alternativa é colar um link (ação monstro.imagem).
app.post('/api/campanhas/:id/monstros/imagem', upload.single('arquivo'), rota(req => {
  const c = campanhaDoMestre(req);
  const nome = String(req.body.nome || '');
  if (!sistema(c.sistema).monstros.some(m => m.nome === nome)) throw Object.assign(new Error('Criatura não encontrada.'), { status: 404 });
  (c.imagensMonstros ||= {})[nome] = salvarImagem(req.file);
  save();
  transmitir(c);
  return { url: c.imagensMonstros[nome] };
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

// Imagem de corpo inteiro do personagem (aparece no painel de equipamento). Mestre ou dono.
app.post('/api/campanhas/:id/personagens/:pid/corpo', upload.single('arquivo'), rota(req => {
  const user = autenticado(req);
  const c = db.campaigns.find(x => x.id === req.params.id);
  const p = c?.personagens.find(x => x.id === req.params.pid);
  if (!p || (c.mestreId !== user.id && p.donoId !== user.id)) throw Object.assign(new Error('Personagem não encontrado.'), { status: 404 });
  p.imagemCorpo = salvarImagem(req.file);
  save();
  transmitir(c);
  return { imagemCorpo: p.imagemCorpo };
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
    res.send(Buffer.from(await planilhaDoCatalogo(catalogoItens() || [], sistema('mss'))));
  } catch (e) {
    res.status(e.status || 400).send(e.message);
  }
});

// modo "atualizar": junta com o catálogo atual (mesmo "num ctrl" ou mesmo nome = substitui); "substituir": troca tudo.
async function importarItens(buffer, modo, arquivo, extra = {}) {
  const novos = await lerPlanilhaItens(buffer, sistema('mss'));
  if (!novos.length) throw new Error('A planilha não tem itens.');
  let itens = novos;
  if (modo !== 'substituir') {
    const sem = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const nomes = new Set(novos.map(i => sem(i.nome)));
    const ids = new Set(novos.map(i => i.id));
    itens = [...(catalogoItens() || []).filter(i => !ids.has(i.id) && !nomes.has(sem(i.nome))), ...novos];
  }
  salvarCatalogoMestre(itens, arquivo, extra);
  io.emit('sistema:atualizado');
  return { recebidos: novos.length, total: itens.length };
}
app.post('/api/itens', upload.single('arquivo'), rota(async req => {
  exigirAlgumMestre(req);
  if (!req.file) throw new Error('Envie a planilha .xlsx.');
  // Enviar arquivo troca a origem: a planilha do Google para de atualizar sozinha.
  return importarItens(req.file.buffer, req.body.modo, req.file.originalname);
}));
// Catálogo de itens ligado a uma planilha do Google (como o Livro dos Monstros): o link fica guardado e o app puxa sozinho
// ao abrir e a cada 30 minutos.
app.post('/api/itens/google', rota(async req => {
  exigirAlgumMestre(req);
  return puxarItensDoGoogle(req.body?.link, req.body?.modo);
}));
async function puxarItensDoGoogle(link, modo) {
  const { id, buffer } = await baixarDoGoogle(link);
  return importarItens(buffer, modo, 'Google Planilhas', { googleSheets: `https://docs.google.com/spreadsheets/d/${id}/edit`, modo });
}
async function atualizarItensDoGoogle() {
  const g = linkGoogleItens();
  if (!g) return;
  try { const r = await puxarItensDoGoogle(g.link, g.modo); console.log(`Catálogo de itens atualizado do Google: ${r.recebidos} itens.`); } catch (e) { console.log(`Catálogo de itens: não deu para puxar do Google (${e.message})`); }
}
if (!process.env.ITENS_EXEMPLO) { setTimeout(atualizarItensDoGoogle, 8000); setInterval(atualizarItensDoGoogle, 30 * 60 * 1000).unref(); }

// Livro dos Monstros por planilha (abas Monstros, Ataques, Habilidades). Vale para todas as campanhas deste PC.
app.get('/api/monstros/origem', rota(req => {
  autenticado(req);
  const cat = catalogoMonstros();
  return cat ? { origem: 'mestre', atualizadoEm: cat.atualizadoEm, arquivo: cat.arquivo, total: cat.monstros.length, googleSheets: cat.googleSheets || null } : { origem: 'padrao', total: sistema('mss').monstros.length };
  // (sem envio do mestre, o livro é o do autor: conteudo/sistemas/monstros.json)
}));

app.get('/api/monstros.xlsx', async (req, res) => {
  try {
    exigirAlgumMestre(req);
    const sis = sistema(req.query.sistema || 'mss');
    res.attachment('monstros-ilhas-das-ruinas.xlsx');
    res.send(Buffer.from(await planilhaMonstros(sis, sis.monstros)));
  } catch (e) {
    res.status(e.status || 400).send(e.message);
  }
});

// modo "atualizar": troca os monstros de mesmo nome e mantém os outros; "substituir": fica só com os da planilha.
async function importarMonstros(buffer, modo, arquivo, extra = {}) {
  const { monstros: novos, avisos } = await lerPlanilhaMonstros(buffer, sistema('mss'));
  if (!novos.length) throw new Error('A planilha não tem monstros (aba "Monstros", coluna "Nome").');
  let monstros = novos;
  if (modo !== 'substituir') {
    const sem = x => String(x).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const nomes = new Set(novos.map(m => sem(m.nome)));
    monstros = [...sistema('mss').monstros.filter(m => !nomes.has(sem(m.nome))), ...novos];
  }
  salvarCatalogoMonstros(monstros, arquivo, extra);
  io.emit('sistema:atualizado');
  return { recebidos: novos.length, total: monstros.length, avisos: avisos.slice(0, 30) };
}
app.post('/api/monstros', upload.single('arquivo'), rota(async req => {
  exigirAlgumMestre(req);
  if (!req.file) throw new Error('Envie a planilha .xlsx.');
  // Enviar arquivo troca a origem: a planilha do Google para de atualizar sozinha.
  return importarMonstros(req.file.buffer, req.body.modo, req.file.originalname);
}));
// Puxa direto da planilha do Google (compartilhada como "Qualquer pessoa com o link pode ver"): o Google entrega
// a planilha como .xlsx e ela entra igual ao envio do arquivo. O link fica guardado para a próxima vez.
app.post('/api/monstros/google', rota(async req => {
  exigirAlgumMestre(req);
  return puxarDoGoogle(req.body?.link, req.body?.modo);
}));
// Baixa a planilha do Google como .xlsx (compartilhada como "Qualquer pessoa com o link pode ver").
async function baixarDoGoogle(link) {
  link = String(link || '').trim();
  const id = /\/spreadsheets\/d\/([\w-]{20,})/.exec(link)?.[1] || (/^[\w-]{20,}$/.test(link) ? link : null);
  if (!id) throw new Error('Cole o link da planilha do Google (docs.google.com/spreadsheets/d/…).');
  let r;
  try { r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { redirect: 'follow' }); } catch { throw new Error('Não consegui falar com o Google. Confira a internet deste PC.'); }
  const tipo = r.headers.get('content-type') || '';
  if (!r.ok || !/spreadsheetml|octet-stream/.test(tipo)) {
    throw new Error('O Google não liberou a planilha. No Google Planilhas: Compartilhar > Acesso geral > "Qualquer pessoa com o link" (Leitor) e tente de novo.');
  }
  return { id, buffer: Buffer.from(await r.arrayBuffer()) };
}
async function puxarDoGoogle(link, modo) {
  const { id, buffer } = await baixarDoGoogle(link);
  return importarMonstros(buffer, modo, 'Google Planilhas', { googleSheets: `https://docs.google.com/spreadsheets/d/${id}/edit`, modo });
}
// Livro ligado a uma planilha do Google: o app puxa sozinho ao abrir e a cada 30 minutos (sem internet, fica o último).
async function atualizarDoGoogle() {
  const cat = catalogoMonstros();
  if (!cat?.googleSheets) return;
  try { const r = await puxarDoGoogle(cat.googleSheets, cat.modo); console.log(`Livro dos Monstros atualizado do Google: ${r.recebidos} criaturas.`); } catch (e) { console.log(`Livro dos Monstros: não deu para puxar do Google (${e.message})`); }
}
if (!process.env.ITENS_EXEMPLO) { setTimeout(atualizarDoGoogle, 5000); setInterval(atualizarDoGoogle, 30 * 60 * 1000).unref(); }

app.post('/api/monstros/padrao', rota(req => {
  exigirAlgumMestre(req);
  voltarMonstrosPadrao();
  io.emit('sistema:atualizado');
  return { ok: true };
}));

app.post('/api/itens/padrao', rota(req => {
  exigirAlgumMestre(req);
  voltarCatalogoPadrao();
  io.emit('sistema:atualizado');
  return origemCatalogo();
}));

// ---------- versão e atualização do app ----------
// O iniciar-windows.bat (iniciar.ps1) baixa a versão nova do GitHub ao abrir. O botão "Atualizar agora" fecha o servidor
// com o código 75; o iniciar.ps1 então atualiza e abre de novo, e as páginas recarregam sozinhas.
const REPO = 'belugaferrari/RUINAS-MSA';
function versaoAtual() {
  try { return fs.readFileSync(path.join(RAIZ, 'versao.txt'), 'utf8').trim(); } catch { /* sem versao.txt */ }
  try { return execSync('git rev-parse HEAD', { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}
let ultimaConsulta = { em: 0, sha: null };
async function versaoNova() {
  if (Date.now() - ultimaConsulta.em < 5 * 60 * 1000) return ultimaConsulta.sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/commits/HEAD`, { headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'ilhas-das-ruinas' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Não foi possível consultar o GitHub agora.');
  ultimaConsulta = { em: Date.now(), sha: (await r.text()).trim() };
  return ultimaConsulta.sha;
}
const VERSAO_INICIAL = versaoAtual();

app.get('/api/versao', rota(async req => {
  autenticado(req);
  const atual = VERSAO_INICIAL;
  let nova = null; let aviso = null;
  if (req.query.verificar) {
    try { nova = await versaoNova(); } catch (e) { aviso = e.message; }
  }
  return { atual, nova, haNova: !!(nova && atual && nova !== atual), podeReiniciar: !!process.env.ILHAS_INICIADOR, aviso };
}));

app.post('/api/atualizar', rota(req => {
  exigirAlgumMestre(req);
  if (!process.env.ILHAS_INICIADOR) throw new Error('Este app não foi aberto pelo iniciar-windows.bat: feche a janela preta e abra o iniciar-windows.bat de novo para atualizar.');
  io.emit('app:reiniciando');
  flush();
  setTimeout(() => process.exit(75), 800);
  return { ok: true };
}));

// ---------- tempo real ----------

const sala = c => `c:${c.id}`;
const ACOES_SUPORTE = new Set(['mapa.mover', 'mapa.tirar', 'imagem.mostrar']);

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
    if (area === 'suporte') return db.campaigns.filter(c => podeSuporte(c, user)).map(resumoCampanha);
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
    socket.data.area = ['mestre', 'suporte'].includes(area) ? area : 'jogador';
    socket.data.campanhaId = c.id;
    if (socket.data.area === 'jogador') transmitir(c);
    return visaoPara(c, user, socket.data.area);
  }));

  // Responde ao navegador (sem a resposta, o botão "Campanhas" ficava esperando até dar erro de conexão).
  socket.on('campanha:sair', (...args) => {
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.data.campanhaId = null;
    const ack = args.find(a => typeof a === 'function');
    ack?.({ ok: true, dados: null });
  });

  socket.on('acao', ({ tipo, dados }, ack) => responder(ack, () => {
    const c = db.campaigns.find(x => x.id === socket.data.campanhaId);
    if (!c) throw Object.assign(new Error('Entre em uma campanha primeiro.'), { publico: true });
    if (!(tipo in acoes)) throw Object.assign(new Error('Ação desconhecida.'), { publico: true });
    const mestre = socket.data.area === 'mestre' && c.mestreId === user.id;
    // Suporte: só mexe no mapa e mostra/esconde as imagens que o mestre liberou.
    const suporte = socket.data.area === 'suporte' && podeSuporte(c, user);
    if (suporte && !ACOES_SUPORTE.has(tipo)) throw Object.assign(new Error('O Suporte só mexe no mapa e nas imagens liberadas.'), { publico: true });
    if (!mestre && !suporte && !c.aberta) throw Object.assign(new Error('A campanha foi fechada pelo mestre.'), { publico: true });
    const r = executar(c, tipo, dados, { user, mestre, suporte });
    transmitir(c);
    if (tipo === 'campanha.atualizar' && !c.aberta) expulsarJogadores(c);
    if (tipo === 'jogador.remover') expulsarJogadores(c, dados.userId);
    return r;
  }));
});

async function expulsarJogadores(c, apenas) {
  for (const s of await io.in(sala(c)).fetchSockets()) {
    if (s.data.area === 'mestre' || s.data.area === 'suporte') continue;
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
