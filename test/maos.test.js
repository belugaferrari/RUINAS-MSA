// Botões de ataque: trocar o item de uma mão (o que estava sai; item de duas mãos esvazia as duas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };

test('trocar o item da mão: o antigo é guardado; o de duas mãos esvazia as duas; da outra mão, muda de mão', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Eu' } }, ctxM).id;
  const p = c.personagens.find(x => x.id === id);
  const arma = (uid, ocupa = 1) => ({ uid, nome: uid, tipo: 'arma', slot: 'maos', dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo', ocupa });
  p.itens = [{ ...arma('faca'), equipado: true, mao: 0 }, { ...arma('adaga'), equipado: true, mao: 1 }, arma('espada'), arma('lanca', 2)];
  executar(c, 'item.equipar', { id, uid: 'espada', equipar: true, mao: 0, sai: 'faca' }, ctxM);
  const por = u => p.itens.find(i => i.uid === u);
  assert.deepEqual([por('espada').equipado, por('espada').mao, por('faca').equipado, por('adaga').mao], [true, 0, false, 1]);
  executar(c, 'item.equipar', { id, uid: 'adaga', equipar: true, mao: 0, sai: 'espada' }, ctxM);
  assert.deepEqual([por('adaga').mao, por('espada').equipado], [0, false]);
  executar(c, 'item.equipar', { id, uid: 'lanca', equipar: true, mao: 1, sai: null }, ctxM);
  assert.deepEqual(p.itens.filter(i => i.equipado).map(i => i.uid), ['lanca']);
});
