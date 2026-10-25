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

const { monstroNoEstagio, buscarMonstros, deslocamentosDoTexto, deslocamentosDe, ladoNoMapa } = await import('../shared/monstros.js');
const C = await import('../shared/combate.js');
const lula = {
  nome: 'Lula Abissal', raca: 'Lula Abissal', tipoCriatura: 'monstro', tamanho: 'Pequeno', dificuldade: 2, pv: 20, deslocamento: 3,
  deslocamentos: { andar: 3, nadar: 12 }, atributos: { FOR: 10, CONS: 10, AGI: 14, DES: 10, INT: 4, PER: 12, CAR: 4, WILL: 8 },
  ataques: [{ nome: 'Tentáculo', dano: '1d6', alcance: 'corpo' }, { nome: 'Jato de tinta', dano: '1d4', alcance: 'distancia', estagios: [2, 3] }],
  habilidades: [{ nome: 'Camuflagem', modo: 'lembrete', descricao: 'Muda de cor.' }, { nome: 'Voo de cardume', modo: 'lembrete', descricao: 'Plana.', estagios: [3] }],
  estagios: [
    { numero: 2, nome: 'Adulta', descricao: 'Cresce e solta tinta.', tamanho: 'Grande', nivel: 3, pv: 45, atributos: { FOR: 16 }, pericias: { briga: 5 }, subpericias: { 'briga.esquiva': 6 } },
    { numero: 3, nome: 'Anciã', pv: 80, deslocamentos: { voar: 9 }, resistencias: ['Frio'] },
  ],
};

test('estágios: cada estágio troca só o que preencheu; ataques e habilidades de estágio só aparecem nele', () => {
  const base = monstroNoEstagio(lula, null);
  assert.equal(base.pv, 20);
  assert.deepEqual(base.ataques.map(a => a.nome), ['Tentáculo']);
  const e2 = monstroNoEstagio(lula, 2);
  assert.equal(e2.pv, 45); assert.equal(e2.tamanho, 'Grande'); assert.equal(e2.atributos.FOR, 16); assert.equal(e2.atributos.AGI, 14);
  assert.deepEqual(e2.ataques.map(a => a.nome), ['Tentáculo', 'Jato de tinta']);
  assert.equal(e2.nomeEstagio, 'Adulta');
  const e3 = monstroNoEstagio(lula, 3);
  assert.deepEqual(e3.deslocamentos, { andar: 3, nadar: 12, voar: 9 });
  assert.deepEqual(e3.habilidades.map(x => x.nome), ['Camuflagem', 'Voo de cardume']);
  assert.deepEqual(e3.resistencias, ['Frio']);
});

test('planilha: aba Estágios, colunas de deslocamento e coluna Estágios em ataques/habilidades voltam iguais', async () => {
  const sis = sistema('mss');
  const buf = await planilhaMonstros(sis, [lula]);
  const { monstros, avisos } = await lerPlanilhaMonstros(Buffer.from(buf), sis);
  assert.deepEqual(avisos, []);
  const m = monstros[0];
  assert.deepEqual(m.deslocamentos, lula.deslocamentos);
  assert.deepEqual(m.estagios, lula.estagios);
  assert.deepEqual(m.ataques[1].estagios, [2, 3]);
  assert.deepEqual(m.habilidades[1].estagios, [3]);
});

test('deslocamentos do texto antigo: tipos, estágio e observações; sem nada, só anda', () => {
  const r = deslocamentosDoTexto('Natação em lava 12 m; Voo (Estágio 2) 12 m; Disparada 30 m');
  assert.deepEqual(r.base, { nadar: 12 });
  assert.deepEqual(r.porEstagio, { 2: { voar: 12 } });
  assert.deepEqual(r.resto, ['Natação em lava 12 m', 'Disparada 30 m']);
  assert.deepEqual(deslocamentosDe({ deslocamento: 6 }), { andar: 6 });
});

test('busca de monstro por palavra aproximada', () => {
  const lista = [lula, rino, { nome: 'Moolotos (Cavalgada da Tempestade)', afinidades: ['Tóxico'] }];
  assert.equal(buscarMonstros(lista, 'moloto')[0].nome, 'Moolotos (Cavalgada da Tempestade)');
  assert.equal(buscarMonstros(lista, 'rinoseronte')[0].nome, rino.nome);
  assert.equal(buscarMonstros(lista, 'toxico')[0].nome, 'Moolotos (Cavalgada da Tempestade)');
  assert.equal(buscarMonstros(lista, 'xyzw').length, 0);
});

test('Campo de Batalha: monstro entra no estágio pedido, vários de uma vez, e muda de estágio mantendo o dano', () => {
  salvarCatalogoMonstros([lula], 'teste.xlsx');
  try {
    const c = novaCampanha({ id: 'm', name: 'M' }, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
    const ctxM = { user: { id: 'm' }, mestre: true };
    const r = executar(c, 'monstro.adicionar', { nome: lula.nome, estagio: 2, quantidade: 2 }, ctxM);
    assert.equal(r.ids.length, 2);
    const p = c.personagens.find(x => x.id === r.ids[0]);
    assert.equal(p.nome, 'Lula Abissal 1');
    assert.equal(p.pv.max, 45);
    assert.deepEqual(p.monstro, { nome: lula.nome, estagio: 2, nomeEstagio: 'Adulta' });
    assert.ok(p.itens.some(i => i.nome === 'Jato de tinta'));
    p.pv.atual = 35; // tomou 10
    executar(c, 'monstro.estagio', { id: p.id, estagio: 3 }, ctxM);
    assert.equal(p.pv.max, 80); assert.equal(p.pv.atual, 70);
    assert.equal(p.deslocamentos.voar, 9);
    executar(c, 'monstro.estagio', { id: p.id, estagio: '' }, ctxM);
    assert.equal(p.pv.max, 20); assert.equal(p.pv.atual, 10);
    assert.ok(!p.itens.some(i => i.nome === 'Jato de tinta'));
    assert.throws(() => executar(c, 'monstro.estagio', { id: p.id, estagio: 7 }, ctxM), /não tem o estágio/);
    assert.throws(() => executar(c, 'monstro.estagio', { id: p.id, estagio: 2 }, { user: { id: 'a' }, mestre: false }));
  } finally { voltarMonstrosPadrao(); }
});

const { periciasAcimaDoLimite, textoND } = await import('../shared/monstros.js');
test('perícias do estágio substituem as da ficha base; o limite (5 + 5 × nível) vale para a criatura e cada estágio', async () => {
  const sis = sistema('mss');
  const base = { ...lula, nivel: 1, pericias: { briga: 4, esportes: 3 }, subpericias: { 'briga.esquiva': 7 } };
  const e2 = monstroNoEstagio(base, 2);
  assert.deepEqual(e2.pericias, { briga: 5, esportes: 3 });
  assert.equal(e2.subpericias['briga.esquiva'], 6);
  const avisos = periciasAcimaDoLimite(base, sis);
  assert.equal(avisos.length, 2, avisos.join(' | ')); // base: 4 + 7 = 11 > 10; estágio 3 (nível 1): idem; estágio 2 (nível 3): 11 ≤ 20
  assert.ok(avisos.every(a => /Esquiva 11/.test(a)));
  const { avisos: daPlanilha } = await lerPlanilhaMonstros(Buffer.from(await planilhaMonstros(sis, [base])), sis);
  assert.equal(daPlanilha.filter(a => /limite/.test(a)).length, 2);
});

test('ND menor que 1: planilha aceita 0,5 e 1/4; o app mostra como fração', async () => {
  const sis = sistema('mss');
  const { monstros } = await lerPlanilhaMonstros(Buffer.from(await planilhaMonstros(sis, [{ ...lula, dificuldade: 0.5 }])), sis);
  assert.equal(monstros[0].dificuldade, 0.5);
  assert.equal(textoND(0.5), '1/2'); assert.equal(textoND(0.25), '1/4'); assert.equal(textoND(1.5), '1,5'); assert.equal(textoND(null), '—');
});

test('monstro no Campo de Batalha vai sozinho para o mapa, com o tamanho do livro (Grande 2×2, Colossal 3×3; menores = 1)', () => {
  const { distanciaPecas } = C;
  salvarCatalogoMonstros([{ ...lula, tamanho: 'Grande', estagios: undefined }, { nome: 'Rato', tamanho: 'Miúdo', pv: 3 }, { nome: 'Titã', tamanho: 'Colossal', pv: 300 }], 'teste.xlsx');
  try {
    const c = novaCampanha({ id: 'm', name: 'M' }, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
    const ctxM = { user: { id: 'm' }, mestre: true };
    // Sem mapa escolhido, não põe; com mapa, põe no primeiro lugar livre que caiba.
    const [semMapa] = executar(c, 'monstro.adicionar', { nome: 'Rato' }, ctxM).ids;
    assert.ok(!c.mapa?.pecas?.[semMapa]);
    c.mapa = { imagemId: 'x', grade: { colunas: 6, ox: 0, oy: 0, visivel: true }, pecas: {} };
    const [lula1] = executar(c, 'monstro.adicionar', { nome: lula.nome }, ctxM).ids;
    const [tita] = executar(c, 'monstro.adicionar', { nome: 'Titã' }, ctxM).ids;
    const [rato] = executar(c, 'monstro.adicionar', { nome: 'Rato' }, ctxM).ids;
    assert.deepEqual(c.mapa.pecas[lula1], { col: 0, lin: 0 });
    assert.deepEqual(c.mapa.pecas[tita], { col: 2, lin: 0 }, 'o 3×3 cabe ao lado do 2×2');
    assert.deepEqual(c.mapa.pecas[rato], { col: 5, lin: 0 });
    assert.equal(ladoNoMapa(c.personagens.find(p => p.id === rato)), 1);
    assert.equal(ladoNoMapa(c.personagens.find(p => p.id === tita)), 3);
    // Distância conta do quadrado mais perto: o 2×2 (colunas 0–1) e o 3×3 (colunas 2–4) estão colados.
    assert.equal(distanciaPecas(c, lula1, tita), 1.5);
    executar(c, 'mapa.por', { ids: [semMapa] }, ctxM);
    assert.deepEqual(c.mapa.pecas[semMapa], { col: 5, lin: 1 });
  } finally { voltarMonstrosPadrao(); }
});
