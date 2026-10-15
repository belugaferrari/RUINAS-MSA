import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1'; // testes usam a lista curta de itens de exemplo
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

test('humanidade: de 1 a 100, inicial de 51 até 50 + 2×CAR + 2×PER, e estágio', () => {
  const f = R.novaFicha(sis, { nivel: 1 });
  assert.equal(f.humanidade.max, 100);
  assert.equal(f.humanidade.atual, 90, 'começa no limite');
  assert.equal(R.derivados(f, sis).humanidadeLimite, 90);
  assert.equal(R.derivados(f, sis).estagioHumanidade.nome, 'Compassivo');
  f.humanidade.atual = 45;
  assert.match(R.derivados(f, sis).estagioHumanidade.nome, /Calculista/);
  f.atributos.CAR = 20; f.atributos.PER = 20;
  assert.equal(R.derivados(f, sis).humanidadeLimite, 100, 'limite máximo 100');
  const g = R.novaFicha(sis, { nivel: 1 });
  g.humanidade.atual = 50;
  assert.ok(R.problemasFicha(g, sis).some(x => /Humanidade inicial/.test(x)), 'abaixo de 51 não vale');
  g.humanidade.atual = 91;
  assert.ok(R.problemasFicha(g, sis).some(x => /Humanidade inicial/.test(x)), 'acima do limite não vale');
  g.humanidade.atual = 51;
  assert.ok(!R.problemasFicha(g, sis).some(x => /Humanidade inicial/.test(x)));
});

test('vantagens de classe abrem quando a classe é escolhida (nível 3)', () => {
  const f = R.novaFicha(sis, { nivel: 3 });
  const classe = sis.classes[0];
  const deClasse = `${classe.id}/${classe.vantagens[0].id}`;
  assert.ok(!R.vantagensDisponiveis(f, sis).some(v => v.id === deClasse), 'sem classe, só as gerais');
  f.classe = classe.id;
  assert.ok(R.vantagensDisponiveis(f, sis).some(v => v.id === deClasse && v.origem === classe.nome));
  f.vantagens = [deClasse];
  assert.equal(R.pontosGastos(f, sis).vantagens, 1);
  f.nivel = 2;
  assert.ok(!R.vantagensDisponiveis(f, sis).some(v => v.id === deClasse), 'abaixo do nível 3 não abre');
});

test('XP para subir de nível: 100 por nível', () => {
  assert.equal(R.xpParaSubir(1, sis), 100);
  assert.equal(R.xpParaSubir(4, sis), 100);
});

test('rolagem de atributos da criação respeita a soma 70–102', () => {
  for (let i = 0; i < 30; i++) {
    const r = R.rolarAtributosCriacao(sis);
    assert.equal(r.valores.length, 8);
    assert.ok(r.soma >= 70 && r.soma <= 102);
  }
  assert.deepEqual(R.ndPorNivel(3, sis).map(x => x.nd), [65, 91, 120]);
});

test('MSS: carrega o próprio conteúdo e as diferenças para o MSA', () => {
  const mss = sistema('mss');
  assert.equal(mss.id, 'mss');
  assert.equal(sis.id, 'msa');
  const subs = s => new Set(s.pericias.flatMap(p => p.subpericias.map(x => x.id)));
  assert.ok(subs(mss).has('briga.defesa-desarmada'), 'MSS tem Defesa Desarmada');
  assert.ok(!subs(sis).has('briga.defesa-desarmada'));
  assert.equal(mss.regras.rolagemAtributos, null, 'MSS não tem rolagem de atributos');
  assert.ok(sis.regras.rolagemAtributos);
  assert.equal(mss.atributos.length, 8, 'base comum');
  for (const c of mss.classes) for (const e of c.especializacoes) assert.equal(e.progressao?.length, 18, `${c.nome} › ${e.nome}`);
  // Humanidade: mesma fórmula e mesmos estágios nos dois sistemas.
  const f = R.novaFicha(mss, { nivel: 1 });
  assert.equal(f.humanidade.atual, 90);
  assert.equal(R.derivados(f, mss).estagioHumanidade.nome, R.derivados(f, sis).estagioHumanidade.nome);
  assert.ok(sistema('xyz').id === 'msa', 'id desconhecido cai no padrão');
});

test('pontos por nível (Tabela de Progressão) valem para MSA e MSS', () => {
  for (const s of [sis, sistema('mss')]) {
    assert.deepEqual(R.pontosDoNivel(1, s, { padraoMSA: true }), { atributos: 86, vantagens: 3, pericias: null });
    assert.deepEqual(R.pontosDoNivel(2, s, { padraoMSA: true }), { atributos: 88, vantagens: 4, pericias: null });
    assert.deepEqual(R.pontosDoNivel(5, s, { padraoMSA: true }), { atributos: 94, vantagens: 5, pericias: null });
    assert.equal(R.pontosDoNivel(20, s, { padraoMSA: true }).vantagens, 13);
  }
  // Campanha com pontos próprios: o mestre define o nível 1, a progressão soma por cima.
  assert.equal(R.pontosDoNivel(3, sis, { padraoMSA: false, pontos: { atributos: 90, vantagens: 2 } }).atributos, 94);
  // Ficha de nível 3 pode gastar 90 pontos de atributo; 91 é demais.
  const f = R.novaFicha(sis, { nivel: 3 });
  Object.assign(f.atributos, { FOR: 14, CONS: 12, AGI: 12, DES: 10, INT: 10, PER: 10, CAR: 12, WILL: 10 });
  assert.deepEqual(R.problemasFicha(f, sis, { padraoMSA: true }, { apenasPontos: true }), []);
  f.atributos.WILL = 11;
  assert.ok(R.problemasFicha(f, sis, { padraoMSA: true }, { apenasPontos: true }).some(x => /Atributos: 91 de 90/.test(x)));
});

test('vantagens: depois da classe valem só as Vantagem Extra da tabela da classe', () => {
  const f = R.novaFicha(sis, { nivel: 6 });
  assert.equal(R.pontosDoNivel(6, sis, null, f).vantagens, 3 + 3, 'sem classe: +1 nos níveis pares (2, 4, 6)');
  f.classe = sis.classes[0].id; // Caçador: Vantagem Extra no nível 6 (especialização padrão)
  const extras = R.ganhosDeClasse(f, sis).filter(g => /vantagem extra/i.test(g.nome)).length;
  assert.equal(R.pontosDoNivel(6, sis, null, f).vantagens, 3 + 1 + extras, 'nível 2 (antes da classe) + Vantagens Extras da classe');
  assert.equal(R.pontosDoNivel(2, sis, null, f).vantagens, 4, 'antes do nível 3 nada muda');
});

test('condições entram nas estatísticas', () => {
  const f = R.novaFicha(sis, { nivel: 1 });
  const antes = R.derivados(f, sis);
  f.marcadores = ['Fome', 'Fome', 'Cansado', 'Alerta'];
  const d = R.derivados(f, sis);
  assert.equal(d.atributos.CONS, antes.atributos.CONS - 2, 'Fome acumula: CONS −1 duas vezes');
  assert.equal(d.condTestes, -5 * 2 - 10);
  assert.equal(d.percentual.PER, antes.percentual.PER - 20 + 20, 'Alerta +20 em PER compensa −20 dos testes');
  assert.equal(d.percentual.INT, antes.percentual.INT - 20 - 20);
  assert.equal(d.subpericias['sentidos.visao'], antes.subpericias['sentidos.visao'] - 20 + 20);
  f.marcadores = ['Cansado (-10%)'];
  assert.equal(R.derivados(f, sis).condTestes, -10, 'nome antigo do marcador ainda vale');
});
