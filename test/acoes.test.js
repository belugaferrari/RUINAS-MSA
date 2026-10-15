import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1'; // testes usam a lista curta de itens de exemplo
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, entrarNaCampanha, visaoPara } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const sis = sistema();
const defeito = sis.defeitos.find(d => d.tipo === 'leve').id;
const fichaValida = extra => ({ nome: 'Lia', profissao: 'batedor', defeitos: [defeito], ...extra });

const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const beto = { id: 'b', name: 'Beto' };

test('fluxo básico de campanha e permissões', () => {
  const c = novaCampanha(mestre, { nome: 'Teste', maxJogadores: 1, nivel: 2, padraoMSA: true });
  assert.throws(() => entrarNaCampanha(c, ana, 'jogador'), /fechada/);
  executar(c, 'campanha.atualizar', { aberta: true }, { user: mestre, mestre: true });
  entrarNaCampanha(c, ana, 'jogador');
  assert.throws(() => entrarNaCampanha(c, beto, 'jogador'), /máximo/);

  const { id } = executar(c, 'personagem.criar', { ficha: fichaValida({ nivel: 20, itens: [{ itemId: 'faca' }], pv: { max: 999, atual: 999 } }) }, { user: ana, mestre: false });
  const lia = c.personagens.find(p => p.id === id);
  assert.equal(lia.nivel, 2, 'nível fixo da campanha prevalece');
  assert.equal(lia.donoId, 'a');
  assert.equal(lia.dinheiro, sis.regras.creditosIniciais - sis.itens.find(i => i.id === 'faca').preco);
  assert.notEqual(lia.pv.max, 999, 'PV é recalculado no servidor');

  // Jogador não altera atributos direto, só pela evolução.
  executar(c, 'personagem.atualizar', { id, patch: { atributos: { FOR: 14 }, anotacoes: 'oi' } }, { user: ana, mestre: false });
  assert.notEqual(lia.atributos.FOR, 14);
  assert.equal(lia.anotacoes, 'oi');

  // Pontos acima do padrão são recusados.
  assert.throws(() => executar(c, 'personagem.criar', { ficha: fichaValida({ pericias: { briga: 10, 'arma-branca': 10, 'armas-de-fogo': 10 } }) }, { user: ana, mestre: false }), /Perícias/);
  assert.throws(() => executar(c, 'personagem.criar', { ficha: { nome: 'Sem profissão', defeitos: [defeito] } }, { user: ana, mestre: false }), /profissão/);

  // Teste D-MIL calculado no servidor a partir da ficha.
  const r = executar(c, 'rolar', { id, acaoRef: 'sub:sentidos.visao', nd: 70 }, { user: ana, mestre: false });
  assert.equal(r.acao, 15, 'Visão = bônus pericial de PER 10 (10) + profissão Batedor (5)');

  // NPC só aparece para o jogador quando entra em sala ou é conhecido.
  const g = executar(c, 'grupo.criar', { nome: 'Piratas' }, { user: mestre, mestre: true });
  const npc = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: g.id, ficha: { nome: 'Vaz' } }, { user: mestre, mestre: true });
  assert.ok(!visaoPara(c, ana, 'jogador').personagens.some(p => p.id === npc.id));
  executar(c, 'sala.adicionar', { sala: 'social', id: npc.id }, { user: mestre, mestre: true });
  const visto = visaoPara(c, ana, 'jogador').personagens.find(p => p.id === npc.id);
  assert.ok(visto && visto.atributos === undefined, 'jogador vê só dados públicos do NPC');
  assert.equal(visaoPara(c, ana, 'jogador').anotacoes, undefined);

  // Evoluir guarda backup.
  // Subir de nível exige 100 XP por nível e desconta.
  executar(c, 'xp.dar', { id, qtd: 50 }, { user: mestre, mestre: true });
  assert.throws(() => executar(c, 'personagem.evoluir', { id, patch: { nivel: 3 } }, { user: ana, mestre: false }), /XP insuficiente/);
  assert.throws(() => executar(c, 'personagem.atualizar', { id, patch: { nivel: 3 } }, { user: mestre, mestre: true }), /faltam XP/, 'nem o mestre pula sem XP');
  executar(c, 'xp.dar', { id, qtd: 60 }, { user: mestre, mestre: true });
  assert.throws(() => executar(c, 'personagem.evoluir', { id, patch: { nivel: 4 } }, { user: ana, mestre: false }), /um nível de cada vez/);
  executar(c, 'personagem.evoluir', { id, patch: { nivel: 3 } }, { user: ana, mestre: false });
  assert.equal(lia.xp, 10);
  assert.equal(lia.nivel, 3);
  assert.equal(lia.backups.length, 1);
  assert.equal(lia.backups[0].ficha.nivel, 2);

  // Equipar respeita slots.
  const faca = lia.itens[0];
  executar(c, 'item.equipar', { id, uid: faca.uid, equipar: true }, { user: ana, mestre: false });
  assert.ok(faca.equipado);
  assert.throws(() => executar(c, 'item.equipar', { id, uid: faca.uid, equipar: true }, { user: beto, mestre: false }), /não é seu/);
});

test('confronto: ação × passiva e disputa', () => {
  const m = { id: 'm2', name: 'Mestre 2' };
  const j = { id: 'j2', name: 'Jo' };
  const c = novaCampanha(m, { nome: 'Confrontos', maxJogadores: 2, nivel: 1, padraoMSA: true });
  executar(c, 'campanha.atualizar', { aberta: true }, { user: m, mestre: true });
  entrarNaCampanha(c, j, 'jogador');
  const { id: pj } = executar(c, 'personagem.criar', { ficha: fichaValida({ nome: 'Ninja' }) }, { user: j, mestre: false });
  const g = executar(c, 'grupo.criar', { nome: 'Guardas' }, { user: m, mestre: true });
  const { id: npc } = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: g.id, ficha: { nome: 'Guarda' } }, { user: m, mestre: true });

  // Só o mestre cria.
  assert.throws(() => executar(c, 'confronto.criar', { modo: 'passiva', a: { personagemId: pj, acaoRef: 'sub:espionagem.furtividade' }, b: { personagemId: npc, acaoRef: 'sub:sentidos.visao' } }, { user: j, mestre: false }), /mestre/);
  const { id } = executar(c, 'confronto.criar', { titulo: 'Passar pelo guarda', modo: 'passiva', a: { personagemId: pj, acaoRef: 'sub:espionagem.furtividade' }, b: { personagemId: npc, acaoRef: 'sub:sentidos.visao' } }, { user: m, mestre: true });
  assert.throws(() => executar(c, 'confronto.rolar', { id, lado: 'b' }, { user: m, mestre: true }), /só o lado A/);
  const conf = executar(c, 'confronto.rolar', { id, lado: 'a' }, { user: j, mestre: false });
  // Passiva do guarda: Visão 10 (bônus de PER 10) + 50 = 60.
  assert.equal(conf.rolagens.a.nd, 60);
  assert.equal(conf.estado, 'resolvido');
  assert.ok(['a', 'b'].includes(conf.resultado.vencedor));
  assert.ok(c.log.at(-1).texto.includes(conf.lados.a.nome));

  // Disputa: o jogador não rola o lado do NPC; resolve quando os dois rolam.
  const d = executar(c, 'confronto.criar', { modo: 'disputa', a: { personagemId: pj, acaoRef: 'atr:FOR' }, b: { nome: 'Estivador', valor: 40 } }, { user: m, mestre: true });
  assert.throws(() => executar(c, 'confronto.rolar', { id: d.id, lado: 'b' }, { user: j, mestre: false }), /dono/);
  executar(c, 'confronto.rolar', { id: d.id, lado: 'a' }, { user: j, mestre: false });
  const fim = executar(c, 'confronto.rolar', { id: d.id, lado: 'b' }, { user: m, mestre: true });
  assert.equal(fim.estado, 'resolvido');
  assert.equal(fim.rolagens.b.acao, 40);

  // Confronto secreto não aparece para o jogador.
  executar(c, 'confronto.criar', { modo: 'disputa', secreto: true, a: { nome: 'X', valor: 1 }, b: { nome: 'Y', valor: 1 } }, { user: m, mestre: true });
  assert.equal(visaoPara(c, j, 'jogador').confrontos.length, 2);
});

test('trocar o sistema no meio da campanha mantém as fichas', () => {
  const m = { id: 'm3', name: 'Mestre 3' };
  const j = { id: 'j3', name: 'Ju' };
  const c = novaCampanha(m, { nome: 'Troca', maxJogadores: 2, nivel: 1, padraoMSA: true, sistema: 'msa' });
  assert.equal(c.sistema, 'msa');
  executar(c, 'campanha.atualizar', { aberta: true }, { user: m, mestre: true });
  entrarNaCampanha(c, j, 'jogador');
  const { id } = executar(c, 'personagem.criar', { ficha: fichaValida({ nome: 'Rui' }) }, { user: j, mestre: false });
  assert.throws(() => executar(c, 'rolar', { id, acaoRef: 'sub:briga.defesa-desarmada', nd: 70 }, { user: j, mestre: false }), /testar/);
  assert.throws(() => executar(c, 'campanha.atualizar', { sistema: 'mss' }, { user: j, mestre: false }), /mestre/);
  executar(c, 'campanha.atualizar', { sistema: 'mss' }, { user: m, mestre: true });
  assert.equal(c.sistema, 'mss');
  assert.match(c.log.at(-1).texto, /MSS/);
  assert.equal(visaoPara(c, j, 'jogador').sistema, 'mss');
  // A ficha continua e passa a usar as regras do MSS.
  const lia = c.personagens.find(p => p.id === id);
  assert.equal(lia.nome, 'Rui');
  const r = executar(c, 'rolar', { id, acaoRef: 'sub:briga.defesa-desarmada', nd: 70 }, { user: j, mestre: false });
  assert.equal(r.acao, 10, 'Defesa Desarmada só existe no MSS (bônus de AGI 10)');
  assert.throws(() => executar(c, 'rolar', { id, tipo: 'atributos' }, { user: j, mestre: false }), /não tem rolagem/);
  // Campanha antiga (sem o campo) é tratada como MSA.
  const antiga = novaCampanha(m, { nome: 'Antiga', maxJogadores: 1, nivel: 1, padraoMSA: true });
  delete antiga.sistema;
  assert.equal(visaoPara(antiga, m, 'mestre').sistema, 'msa');
});

test('evoluir: o jogador só gasta os pontos que o nível dá', () => {
  const m = { id: 'm4', name: 'Mestre 4' };
  const j = { id: 'j4', name: 'Lu' };
  const c = novaCampanha(m, { nome: 'Evolução', maxJogadores: 1, nivel: 1, padraoMSA: true, sistema: 'mss' });
  executar(c, 'campanha.atualizar', { aberta: true }, { user: m, mestre: true });
  entrarNaCampanha(c, j, 'jogador');
  const { id } = executar(c, 'personagem.criar', { ficha: fichaValida({ nome: 'Tom' }) }, { user: j, mestre: false });
  const p = c.personagens.find(x => x.id === id);
  // Nível 1 → 2: +2 de atributo (80 gastos de 88) e +1 vantagem.
  const atributos = { ...p.atributos, FOR: 14, CONS: 14 };
  assert.throws(() => executar(c, 'personagem.evoluir', { id, patch: { nivel: 1, atributos }, xpGasto: 0 }, { user: j, mestre: false }), /Atributos/);
  executar(c, 'xp.dar', { id, qtd: 100 }, { user: m, mestre: true });
  executar(c, 'personagem.evoluir', { id, patch: { nivel: 2, atributos: { ...p.atributos, FOR: 14, CONS: 14 } }, xpGasto: 0 }, { user: j, mestre: false });
  assert.equal(p.xp, 0);
  assert.equal(p.nivel, 2);
  assert.equal(p.atributos.FOR, 14);
  assert.throws(() => executar(c, 'personagem.evoluir', { id, patch: { nivel: 1 }, xpGasto: 0 }, { user: j, mestre: false }), /diminuir/);
  // Vantagens: 3 + 1 (nível 2); o defeito leve não dá ponto extra.
  const quatro = sis.vantagens.slice(0, 4).map(v => v.id);
  executar(c, 'personagem.evoluir', { id, patch: { vantagens: quatro }, xpGasto: 0 }, { user: j, mestre: false });
  assert.throws(() => executar(c, 'personagem.evoluir', { id, patch: { vantagens: sis.vantagens.slice(0, 5).map(v => v.id) }, xpGasto: 0 }, { user: j, mestre: false }), /Vantagens/);
});

test('mestre: travas na ficha de jogador, PV recalculado e Humanidade', () => {
  const m = { id: 'm5', name: 'Mestre 5' };
  const j = { id: 'j5', name: 'Bia' };
  const c = novaCampanha(m, { nome: 'Travas', maxJogadores: 1, nivel: 1, padraoMSA: true });
  const ctxM = { user: m, mestre: true };
  const { id } = executar(c, 'personagem.criar', { tipo: 'pj', ficha: { nome: 'Rafa' } }, ctxM);
  const p = c.personagens.find(x => x.id === id);
  // PV segue a fórmula quando o mestre mexe nos atributos.
  const pv0 = p.pv.max;
  executar(c, 'personagem.atualizar', { id, patch: { atributos: { ...p.atributos, FOR: 12, CONS: 12 } } }, ctxM);
  assert.equal(p.pv.max, pv0 + 2);
  // Passar dos pontos de atributo é recusado (e desfeito).
  assert.throws(() => executar(c, 'personagem.atualizar', { id, patch: { atributos: { ...p.atributos, FOR: 14, CONS: 14, AGI: 14, DES: 14 } } }, ctxM), /Atributos/);
  assert.equal(p.atributos.FOR, 12);
  // Edição livre desliga as travas.
  executar(c, 'campanha.atualizar', { edicaoLivre: true }, ctxM);
  executar(c, 'personagem.atualizar', { id, patch: { atributos: { ...p.atributos, FOR: 14, CONS: 14, AGI: 14, DES: 14 } } }, ctxM);
  assert.equal(p.atributos.AGI, 14);
  // Criação pelo assistente valida também para o mestre.
  assert.throws(() => executar(c, 'personagem.criar', { tipo: 'pj', validar: true, ficha: { nome: 'Sem profissão', defeitos: [sis.defeitos[0].id] } }, ctxM), /profissão/);
  // NPC do mestre não tem trava, mas o PV segue a fórmula.
  const npc = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Brutamontes', atributos: { ...p.atributos, FOR: 20, CONS: 20 } } }, ctxM);
  const n = c.personagens.find(x => x.id === npc.id);
  assert.equal(n.pv.max, 5 + 5 + 20);
  // Humanidade abaixo de 1: o jogador perde o controle.
  p.donoId = j.id;
  p.humanidade.atual = 0;
  assert.throws(() => executar(c, 'personagem.atualizar', { id, patch: { anotacoes: 'x' } }, { user: j, mestre: false }), /perdeu a Humanidade/);
});
