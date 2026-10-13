import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, entrarNaCampanha, visaoPara } = await import('../server/actions.js');

const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const beto = { id: 'b', name: 'Beto' };

test('fluxo básico de campanha e permissões', () => {
  const c = novaCampanha(mestre, { nome: 'Teste', maxJogadores: 1, nivel: 2, padraoMSA: true });
  assert.throws(() => entrarNaCampanha(c, ana, 'jogador'), /fechada/);
  executar(c, 'campanha.atualizar', { aberta: true }, { user: mestre, mestre: true });
  entrarNaCampanha(c, ana, 'jogador');
  assert.throws(() => entrarNaCampanha(c, beto, 'jogador'), /máximo/);

  const { id } = executar(c, 'personagem.criar', { ficha: { nome: 'Lia', nivel: 20, itens: [{ itemId: 'faca' }] } }, { user: ana, mestre: false });
  const lia = c.personagens.find(p => p.id === id);
  assert.equal(lia.nivel, 2, 'nível fixo da campanha prevalece');
  assert.equal(lia.donoId, 'a');
  assert.equal(lia.dinheiro, 90);

  // Jogador não altera atributos direto, só pela evolução.
  executar(c, 'personagem.atualizar', { id, patch: { atributos: { Força: 10 }, anotacoes: 'oi' } }, { user: ana, mestre: false });
  assert.notEqual(lia.atributos.Força, 10);
  assert.equal(lia.anotacoes, 'oi');

  // Pontos acima do padrão são recusados.
  assert.throws(() => executar(c, 'personagem.criar', { ficha: { nome: 'X', pericias: { Briga: 5, Lábia: 5, Medicina: 5, Atletismo: 5 } } }, { user: ana, mestre: false }), /Perícias/);

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
