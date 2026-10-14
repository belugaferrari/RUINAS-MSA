import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-regras-'));
const { sistema } = await import('../server/sistema.js');
const R = await import('../shared/regras.js');
const sis = sistema();

test('conteúdo do livro carregado', () => {
  assert.equal(sis.atributos.length, 8);
  assert.equal(sis.pericias.length, 20);
  assert.equal(sis.profissoes.length, 6);
  assert.equal(sis.classes.length, 10);
  for (const c of sis.classes) for (const e of c.especializacoes) assert.equal(e.progressao?.length, 18, `${c.nome} › ${e.nome}`);
  assert.ok(sis.vantagens.length > 30 && sis.defeitos.length > 30);
});

test('derivados batem com o exemplo da Dormet (livro, nível 2)', () => {
  const f = R.novaFicha(sis, { nivel: 2 });
  Object.assign(f.atributos, { FOR: 11, CONS: 10, AGI: 12, DES: 15, INT: 8, PER: 12, WILL: 8, CAR: 13 });
  f.profissao = 'sobrevivente';
  f.pericias = { esportes: 5 };
  f.subpericias = { 'esportes.natacao': 10, 'esportes.mergulho': 10 };
  const d = R.derivados(f, sis);
  assert.deepEqual([d.percentual.FOR, d.percentual.DES, d.percentual.CAR], [44, 60, 52]);
  assert.deepEqual([d.bonusPericial.FOR, d.bonusPericial.AGI, d.bonusPericial.DES, d.bonusPericial.INT], [12, 14, 20, 6]);
  assert.deepEqual([d.mod.FOR, d.mod.CONS, d.mod.AGI, d.mod.DES, d.mod.INT, d.mod.WILL], [0, 1, 1, 2, 0, 0]);
  // Natação 34 = 15 gastos + 14 de AGI + 5 da profissão; Mergulho 29; demais esportes 19.
  assert.equal(d.subpericias['esportes.natacao'], 34);
  assert.equal(d.subpericias['esportes.mergulho'], 29);
  assert.equal(d.subpericias['esportes.corrida'], 19);
  assert.equal(R.pontosGastos(f, sis).pericias, 35);
  assert.equal(R.limitePericia(2, sis), 15);
});

test('pontos de perícia e sanidade seguem as fórmulas', () => {
  const f = R.novaFicha(sis, { nivel: 1 });
  f.atributos.INT = 12;
  assert.equal(R.pontosPericiaTotal(f, sis), 150);
  f.atributos.WILL = 11;
  assert.equal(R.derivados(f, sis).sanidadeMax, 33);
});

test('validação da criação', () => {
  const c = { nivel: 1, padraoMSA: true };
  const f = R.novaFicha(sis, c);
  f.nome = 'Teste';
  let p = R.problemasFicha(f, sis, c);
  assert.ok(p.some(x => /profissão/.test(x)) && p.some(x => /defeito/.test(x)));
  f.profissao = 'batedor';
  f.defeitos = [sis.defeitos.find(d => d.tipo === 'normal').id];
  f.vantagens = sis.vantagens.slice(0, 4).map(v => v.id); // 3 + 1 do defeito normal
  assert.deepEqual(R.problemasFicha(f, sis, c), []);
  f.atributos.FOR = 15;
  assert.ok(R.problemasFicha(f, sis, c).some(x => /máximo/.test(x)));
  f.atributos.FOR = 10;
  f.pericias.briga = 11;
  assert.ok(R.problemasFicha(f, sis, c).some(x => /limite/.test(x)));
  f.classe = 'cacador';
  assert.ok(R.problemasFicha(f, sis, c).some(x => /nível 3/.test(x)));
});

test('teste D-MIL: soma, ND e críticos', () => {
  const seq = v => () => v;
  let r = R.testeDMil(40, 70, sis, { rng: seq(0.5) }); // d100 = 51
  assert.equal(r.total, 91);
  assert.equal(r.sucesso, true);
  r = R.testeDMil(90, 70, sis, { rng: seq(0) }); // d100 = 1 → erro crítico
  assert.equal(r.critico, 'erro');
  assert.equal(r.sucesso, false);
  r = R.testeDMil(0, 100, sis, { rng: seq(0.99) }); // d100 = 100 → acerto crítico
  assert.equal(r.sucesso, true);
  r = R.testeDMil(60, 100, sis, { metade: true, rng: seq(0.5) });
  assert.equal(r.acao, 30);
});

test('ganhos de classe pela tabela de progressão', () => {
  const f = R.novaFicha(sis, { nivel: 8 });
  f.classe = 'cacador';
  f.especializacao = 'o-armadilheiro-trapper';
  const g = R.ganhosDeClasse(f, sis);
  assert.ok(g.some(x => x.nivel === 3 && x.nome === 'Marca do Predador' && x.descricao));
  assert.ok(g.some(x => x.nivel === 8 && x.nome === 'Reação preparada'));
  assert.ok(!g.some(x => x.nivel > 8));
});

test('slots e bônus de itens', () => {
  const f = R.novaFicha(sis, {});
  const item = id => ({ ...sis.itens.find(i => i.id === id), equipado: false });
  f.itens = [{ ...item('machado'), equipado: true }];
  assert.equal(R.podeEquipar(f, item('faca'), sis).ok, false);
  f.itens = [{ ...item('anel'), equipado: true }, { ...item('gibao'), equipado: true }];
  const d = R.derivados(f, sis);
  assert.equal(d.atributos.CAR, f.atributos.CAR + 1);
  assert.equal(d.atributos.DES, f.atributos.DES - 1);
});

test('encontro aleatório não passa do limite', () => {
  for (let i = 0; i < 50; i++) assert.ok(R.gerarEncontro(sis.monstros, 7).soma <= 7);
});

test('humanidade: 50 + 2×CAR + 2×PER e estágio', () => {
  const f = R.novaFicha(sis, { nivel: 1 });
  assert.equal(f.humanidade.max, 90);
  assert.equal(R.derivados(f, sis).estagioHumanidade.nome, 'Compassivo');
  f.humanidade.atual = 45;
  assert.match(R.derivados(f, sis).estagioHumanidade.nome, /Calculista/);
  f.atributos.CAR = 20; f.atributos.PER = 20;
  assert.equal(R.derivados(f, sis).humanidadeMax, 100, 'máximo natural 100');
});

test('rolagem de atributos da criação respeita a soma 70–102', () => {
  for (let i = 0; i < 30; i++) {
    const r = R.rolarAtributosCriacao(sis);
    assert.equal(r.valores.length, 8);
    assert.ok(r.soma >= 70 && r.soma <= 102);
  }
  assert.deepEqual(R.ndPorNivel(3, sis).map(x => x.nd), [65, 91, 120]);
});
