// Revisão dos capítulos de Itens e Regras do livro (autor, 31/10): as 10 divergências resolvidas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, migrarCampanhas } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const { db } = await import('../server/db.js');
const R = await import('../shared/regras.js');
const C = await import('../shared/combate.js');

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };
function campo(nomes = ['Eu', 'Ele'], { sistema: idSis = 'mss', batalha = true } = {}) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: idSis });
  const ids = nomes.map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  if (batalha) for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  return { c, ps: ids.map(id => c.personagens.find(p => p.id === id)) };
}
const minhaVez = (c, p) => { const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === p.id); };
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}

test('regiões do corpo: nome → região; 1 roupa e 1 proteção por região; 2 roupas na mesma região não; o que não se veste fica sem espaço', () => {
  const reg = (nome, extra = {}) => R.regiaoDoItem({ nome, slot: 'vestimenta', tipo: 'vestimenta', ...extra });
  assert.equal(reg('Botas de Combate'), 'pes');
  assert.equal(reg('Óculos de Sol Espelhados', { slot: 'cabeca' }), 'olhos');
  assert.equal(reg('Colete de Kevlar'), 'tronco');
  assert.equal(reg('Pingente de Proteção Natural'), 'pescoco');
  assert.equal(R.regiaoDoItem({ nome: 'Barricada Inflável Instantânea', slot: 'corpo', tipo: 'defesa', categoria: 'Comum' }), null);
  assert.equal(R.regiaoDoItem({ nome: 'Capacete de Obra', slot: 'cabeca', tipo: 'defesa' }), 'cabeca');
  const p = { itens: [{ uid: 'r', nome: 'Roupa Comum', tipo: 'vestimenta', slot: 'tronco', equipado: true }] };
  assert.ok(R.podeEquipar(p, { nome: 'Armadura de Refugo', tipo: 'defesa', slot: 'tronco' }, mss).ok, 'proteção por cima da roupa');
  assert.ok(!R.podeEquipar(p, { nome: 'Jaqueta', tipo: 'vestimenta', slot: 'tronco' }, mss).ok, 'duas roupas no tronco não');
});

test('migração: fichas com os espaços antigos passam para as regiões; o que sobra na região vai para a mochila', () => {
  const { c, ps: [eu] } = campo(['Eu'], { batalha: false });
  eu.itens = [
    { uid: 'a', nome: 'Roupa Comum', tipo: 'vestimenta', slot: 'vestimenta', equipado: true },
    { uid: 'b', nome: 'Jaqueta de Couro', tipo: 'vestimenta', slot: 'vestimenta', equipado: true },
    { uid: 'c', nome: 'Bracelete de Fertilidade', tipo: 'joia', slot: 'joia', equipado: true },
    { uid: 'd', nome: 'Barricada Inflável', tipo: 'defesa', slot: 'corpo', categoria: 'Comum', equipado: true },
  ];
  c.migracoes = (c.migracoes || []).filter(x => x !== 'regioes-do-corpo');
  db.campaigns.push(c);
  migrarCampanhas();
  const [a, b, cc, d] = eu.itens;
  assert.deepEqual([a.slot, a.equipado, b.slot, b.equipado], ['tronco', true, 'tronco', false]);
  assert.deepEqual([cc.slot, cc.equipado], ['pulsos', true]);
  assert.deepEqual([d.slot, d.equipado], [null, false]);
});

test('Radiação = Radioativo; o Marcador Genético vem mesmo errando (DS na margem); IP Químico protege contra Radiação', () => {
  assert.equal(C.tipoDanoDoLivro('Radioativo'), 'Radiação');
  assert.equal(R.ipContraDano({ geral: 0, tipos: { Químico: 3 } }, 'Radiação'), 3);
  assert.equal(R.ipContraDano({ geral: 0, tipos: { Físico: 3 } }, 'Não letal'), 0, 'Físico = corte, perfuração e concussão');
  assert.equal(R.ipContraDano({ geral: 0, tipos: { Impacto: 2 } }, 'Queda'), 2);
  const { c, ps: [eu, ele] } = campo();
  eu.itens = [{ uid: 'rx', nome: 'Pistola de raios', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d6', tipoDano: 'Radioativo', pericia: 'armas-de-fogo.pistolas', alcance: 'distancia' }];
  minhaVez(c, eu);
  comDados(0.02, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'rx' } }, ctxM));
  assert.ok((ele.marcadores || []).some(m => /gen[ée]tico/i.test(m)), 'errou, mas DS dentro da margem (Radiação: 10)');
});

test('descanso tira os efeitos de dano; ferramental não perde durabilidade', () => {
  const { c, ps: [eu] } = campo(['Eu'], { batalha: false });
  eu.marcadores = ['Dor', 'Sangramento', 'Marcador de vulnerabilidade'];
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [eu.id] }, ctxM);
  assert.deepEqual(eu.marcadores, ['Marcador de vulnerabilidade']);
  const kit = { nome: 'Kit Mecânico', finalidade: 'Ferramental', durabilidade: 3, durabilidadeAtual: 3 };
  assert.equal(R.desgastarItem(kit, 10), null);
  assert.equal(kit.durabilidadeAtual, 3);
});

test('duas armas: ação completa e só 1 passo; Disparada proibida para Exausto e Manco', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.itens = ['d', 'e'].map(uid => ({ uid, nome: `Faca ${uid}`, tipo: 'arma', slot: 'maos', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo', mao: uid === 'd' ? 0 : 1 }));
  minhaVez(c, eu);
  comDados(0.5, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'd', doisAtaques: true, surpresa: true } }, ctxM));
  assert.equal(c.salas.batalha.combate.gasto[eu.id].movimento, 1);
  assert.equal(R.derivados(eu, mss).deslocamento, 1.5);
  ele.marcadores = ['Exausto'];
  minhaVez(c, ele);
  assert.throws(() => executar(c, 'combate.disparada', { id: ele.id }, ctxM), /Exausto/);
  ele.marcadores = []; ele.defeitos = ['manco'];
  assert.throws(() => executar(c, 'combate.disparada', { id: ele.id }, ctxM), /Manco/);
});

test('sem pré-requisito, errou: além de travar, a durabilidade segue a regra normal (DS maior que a durabilidade)', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.itens = [{ uid: 'pst', nome: 'Pistola', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d6', pericia: 'armas-de-fogo.pistolas', alcance: 'distancia', requisitos: 'DES 30', durabilidade: 2, durabilidadeAtual: 2 }];
  minhaVez(c, eu);
  comDados(0.02, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'pst' } }, ctxM));
  assert.ok(eu.itens[0].travado);
  // DS 1 (0.02 → 1) não passa da durabilidade 2: não perde.
  assert.equal(eu.itens[0].durabilidadeAtual, 2);
});

test('desvio do arremesso só no MSS', () => {
  const msa = campo(['Eu'], { sistema: 'msa', batalha: false });
  const r = comDados(0.01, () => executar(msa.c, 'rolar', { id: msa.ps[0].id, acaoRef: 'sub:esportes.arremessar', nd: 70 }, ctxM));
  assert.ok(!/desvia/.test(r.texto || ''));
});
