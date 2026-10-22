import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const { lerPlanilhaMonstros, planilhaMonstros, salvarCatalogoMonstros, voltarMonstrosPadrao } = await import('../server/monstros.js');
const { novaCampanha, executar } = await import('../server/actions.js');
const { derivados } = await import('../shared/regras.js');
const { resolverAtaque, armasDisponiveis, defesaDoAlvo } = await import('../shared/combate.js');

const rino = {
  nome: 'Rinoceronte das Trevas', raca: 'Rinoceronte das Trevas', tipoCriatura: 'besta', tamanho: 'Grande', nivel: 6, dificuldade: 6, xp: 600, pv: 60,
  atributos: { FOR: 22, CONS: 18, AGI: 8, DES: 6, INT: 3, PER: 10, CAR: 4, WILL: 12 },
  pericias: { briga: 4 }, subpericias: { 'briga.esquiva': 2 }, ipGeral: 2, ipTipos: { Concussão: 1 },
  resistencias: ['Concussão'], imunidades: ['Dor'], vulnerabilidades: ['Calor'], deslocamento: 9, comportamento: 'Investe contra quem estiver mais perto.',
  imagem: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing', descricao: 'Exemplo.',
  ataques: [{ nome: 'Chifrada', pericia: 'briga.ataque-desarmado', dano: '2d8+3', tipoDano: 'Perfuração', alcance: 'corpo', efeitoDano: 3 },
    { nome: 'Pisotear', acerto: 35, dano: '1d10', tipoDano: 'Concussão', alcance: 'corpo' }],
  habilidades: [{ nome: 'Couro de pedra', modo: 'sempre', efeitos: '+1 IP geral', descricao: 'Pele grossa.' }, { nome: 'Sombra viva', modo: 'lembrete', efeitos: '', descricao: 'Some na escuridão.', unica: true }],
  afinidades: ['Frio', 'Elétrico'],
};

test('planilha de monstros: o que sai do app volta igual', async () => {
  const sis = sistema('mss');
  const buf = await planilhaMonstros(sis, [rino]);
  const { monstros, avisos } = await lerPlanilhaMonstros(Buffer.from(buf), sis);
  assert.deepEqual(avisos, []);
  const m = monstros[0];
  for (const k of ['nome', 'raca', 'tipoCriatura', 'tamanho', 'nivel', 'pv', 'ipGeral', 'deslocamento', 'comportamento', 'imagem']) assert.equal(m[k], rino[k], k);
  assert.deepEqual(m.atributos, rino.atributos);
  assert.deepEqual(m.pericias, rino.pericias);
  assert.deepEqual(m.subpericias, rino.subpericias);
  assert.deepEqual(m.ipTipos, rino.ipTipos);
  assert.deepEqual(m.resistencias, rino.resistencias);
  assert.equal(m.ataques.length, 2);
  assert.equal(m.ataques[1].acerto, 35);
  assert.equal(m.habilidades[0].modo, 'sempre');
  assert.ok(m.habilidades[1].unica && !m.habilidades[0].unica);
  assert.deepEqual(m.afinidades, ['Frio', 'Elétrico']);
});

test('monstro do livro vira NPC completo: atributos, defesa como a do personagem, ataques naturais, IP, resistência e sem SAN/HUM', () => {
  salvarCatalogoMonstros([rino], 'teste.xlsx');
  try {
    const sis = sistema('mss');
    assert.equal(sis.monstros[0].nome, rino.nome);
    const mestre = { id: 'm', name: 'M' };
    const ctxM = { user: mestre, mestre: true };
    const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
    executar(c, 'monstro.adicionar', { nome: rino.nome }, ctxM);
    const p = c.personagens.at(-1);
    assert.equal(p.pv.max, 60);
    assert.ok(!p.sanidade && !p.humanidade);
    assert.equal(p.foto, 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w1000');
    const d = derivados(p, sis);
    assert.equal(d.atributos.CONS, 18);
    assert.equal(d.ip.geral, 3); // 2 da planilha + 1 da habilidade "Couro de pedra"
    assert.equal(d.deslocamentoBase, 9);
    assert.deepEqual(p.afinidades, ['Frio', 'Elétrico']);
    const armas = armasDisponiveis(p, sis);
    assert.ok(armas.some(a => a.nome === 'Chifrada' && a.dano === '2d8+3'));
    // Defesa igual à do personagem: Esquiva = subperícia + 50.
    const atacante = { ...p, id: 'x' };
    const def = defesaDoAlvo(p, armas[0], sis, { escolha: 'esquiva' });
    assert.equal(def.total, d.subpericias['briga.esquiva'] + 50);
    // Pisotear usa o acerto fixo da planilha.
    const pis = resolverAtaque(p, atacante, sis, { armaUid: armas.find(a => a.nome === 'Pisotear').uid }, 'nenhuma', () => 0.5);
    assert.equal(pis.acao, 35);
    // Resistência a Concussão: metade do dano.
    const golpe = { ...atacante, itens: [{ uid: 'm1', nome: 'Marreta', tipo: 'arma', dano: '1d10', tipoDano: 'Concussão', equipado: true, alcance: 'corpo', pericia: 'arma-branca.concussao' }] };
    const r = resolverAtaque(golpe, p, sis, { armaUid: 'm1' }, 'nenhuma', () => 0.99);
    assert.equal(r.resistencia, 'Concussão');
    // Elemento principal (Frio): metade do dano de Frio; a 2ª afinidade (Elétrico) não reduz.
    const gelo = { ...atacante, itens: [{ uid: 'g1', nome: 'Lança de gelo', tipo: 'arma', dano: '2d6', tipoDano: 'Frio', equipado: true, alcance: 'corpo', pericia: 'arma-branca.haste' }] };
    assert.equal(resolverAtaque(gelo, p, sis, { armaUid: 'g1' }, 'nenhuma', () => 0.99).resistencia, 'Frio');
    const choque = { ...atacante, itens: [{ uid: 'e1', nome: 'Bastão de choque', tipo: 'arma', dano: '2d6', tipoDano: 'Elétrico', equipado: true, alcance: 'corpo', pericia: 'arma-branca.haste' }] };
    assert.ok(!resolverAtaque(choque, p, sis, { armaUid: 'e1' }, 'nenhuma', () => 0.99).resistencia);
  } finally {
    voltarMonstrosPadrao();
  }
});

test('afinidade principal reduz à metade os tipos ligados a ela; afinidade sem relação ainda não reduz', () => {
  const sis = sistema('mss');
  const alvo = (af) => ({ id: 'm', nome: 'M', pv: { max: 50, atual: 50 }, atributos: { FOR: 10, CONS: 10, AGI: 10, DES: 10, INT: 10, PER: 10, CAR: 10, WILL: 10 }, afinidades: [af] });
  const fogo = { id: 'a', nome: 'A', pv: { max: 10, atual: 10 }, atributos: { FOR: 10, CONS: 10, AGI: 10, DES: 10, INT: 10, PER: 10, CAR: 10, WILL: 10 },
    itens: [{ uid: 'f', nome: 'Lança-chamas', tipo: 'arma', dano: '2d6', tipoDano: 'Calor', equipado: true, alcance: 'corpo', pericia: 'arma-branca.lanca' }] };
  const r1 = resolverAtaque(fogo, alvo('Fogo'), sis, { armaUid: 'f' }, 'nenhuma', () => 0.99);
  assert.equal(r1.resistencia, 'Calor');
  assert.equal(r1.porAfinidade, 'Fogo');
  const r2 = resolverAtaque(fogo, alvo('Água'), sis, { armaUid: 'f' }, 'nenhuma', () => 0.99);
  assert.ok(!r2.resistencia);
});
