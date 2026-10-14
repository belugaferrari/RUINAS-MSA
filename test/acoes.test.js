import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  executar(c, 'xp.dar', { id, qtd: 5 }, { user: mestre, mestre: true });
  executar(c, 'personagem.evoluir', { id, patch: { nivel: 3 }, xpGasto: 5 }, { user: ana, mestre: false });
  assert.equal(lia.nivel, 3);
  assert.equal(lia.backups.length, 1);
  assert.equal(lia.backups[0].ficha.nivel, 2);

  // Equipar respeita slots.
  const faca = lia.itens[0];
  executar(c, 'item.equipar', { id, uid: faca.uid, equipar: true }, { user: ana, mestre: false });
  assert.ok(faca.equipado);
  assert.throws(() => executar(c, 'item.equipar', { id, uid: faca.uid, equipar: true }, { user: beto, mestre: false }), /não é seu/);
});
