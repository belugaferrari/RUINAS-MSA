import test from 'node:test';
import assert from 'node:assert/strict';
import { imagemDeLink } from '../shared/imagens.js';

test('link do Google Drive vira o endereço da imagem', () => {
  const id = '1AbCdEfGhIjKlMnOp_qrs-TUV';
  const esperado = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  assert.equal(imagemDeLink(`https://drive.google.com/file/d/${id}/view?usp=sharing`), esperado);
  assert.equal(imagemDeLink(`https://drive.google.com/open?id=${id}`), esperado);
  assert.equal(imagemDeLink(`https://drive.google.com/uc?export=view&id=${id}`), esperado);
  assert.equal(imagemDeLink('https://exemplo.com/rino.webp'), 'https://exemplo.com/rino.webp');
  assert.equal(imagemDeLink('rino.png'), null);
  assert.equal(imagemDeLink(''), null);
});

test('foto do personagem e imagem do monstro aceitam link (Drive vira imagem) e o monstro leva a imagem para o campo', async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  process.env.ITENS_EXEMPLO = '1';
  process.env.DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
  const { novaCampanha, executar } = await import('../server/actions.js');
  const mestre = { id: 'm', name: 'Mestre' };
  const ctxM = { user: mestre, mestre: true };
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Vaz' } }, ctxM).id;
  executar(c, 'personagem.atualizar', { id, patch: { foto: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing' } }, ctxM);
  assert.equal(c.personagens.find(p => p.id === id).foto, 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w1000');
  assert.throws(() => executar(c, 'personagem.atualizar', { id, patch: { foto: 'javascript:alert(1)' } }, ctxM), /inválida/);
  const { sistema } = await import('../server/sistema.js');
  const monstro = sistema('mss').monstros[0].nome;
  executar(c, 'monstro.imagem', { nome: monstro, link: 'https://exemplo.com/fera.webp' }, ctxM);
  executar(c, 'monstro.adicionar', { nome: monstro }, ctxM);
  assert.equal(c.personagens.at(-1).foto, 'https://exemplo.com/fera.webp');
  executar(c, 'monstro.imagem', { nome: monstro, link: '' }, ctxM);
  assert.ok(!c.imagensMonstros[monstro]);
});
