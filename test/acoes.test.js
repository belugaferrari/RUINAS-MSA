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
const fichaValida = extra => ({ nome: 'Lia', profissao: 'batedor', genero: 'feminino', defeitos: [defeito], ...extra });

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
  assert.equal(p.pv.max, pv0 + 4, "PV = FOR + CONS: +2 FOR e +2 CONS dão +4");
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
  assert.equal(n.pv.max, 20 + 20, "nível 1: FOR + CONS");
  // Humanidade abaixo de 1: o jogador perde o controle.
  p.donoId = j.id;
  p.humanidade.atual = 0;
  assert.throws(() => executar(c, 'personagem.atualizar', { id, patch: { anotacoes: 'x' } }, { user: j, mestre: false }), /perdeu a Humanidade/);
});

test('perícia base + subperícia não passa do limite do nível (em qualquer ordem)', () => {
  const c = novaCampanha(mestre, { nome: 'Limite', maxJogadores: 2, nivel: 1, padraoMSA: true });
  executar(c, 'campanha.atualizar', { aberta: true }, { user: mestre, mestre: true });
  entrarNaCampanha(c, ana, 'jogador');
  const per = sis.pericias.find(p => p.subpericias.length);
  const sub = per.subpericias[0].id;
  const lim = sis.regras.pericias?.limiteBase ?? 10;
  assert.throws(() => executar(c, 'personagem.criar', { ficha: fichaValida({ pericias: { [per.id]: 5 }, subpericias: { [sub]: 10 } }) }, { user: ana, mestre: false }), /limite|Perícias/);
  assert.ok(lim > 0);
});

test('mapa e Suporte: mestre escolhe e ajusta, Suporte move peões e mostra só imagens liberadas', async () => {
  const m = { id: 'mm', name: 'Mestra' };
  const sup = { id: 'ss', name: 'Ajudante' };
  const jog = { id: 'jj', name: 'Jogadora' };
  const { db } = await import('../server/db.js');
  db.users.push({ ...sup });
  const c = novaCampanha(m, { nome: 'Mapa', maxJogadores: 2, nivel: 1, padraoMSA: true });
  const ctxM = { user: m, mestre: true };
  c.imagens.push({ id: 'i1', titulo: 'Ilha', url: '/uploads/a.png', tipo: 'imagem', mostrando: false }, { id: 'i2', titulo: 'Segredo', url: '/uploads/b.png', mostrando: false });
  const { id } = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Rato' } }, ctxM);
  executar(c, 'mapa.definir', { imagemId: 'i1' }, ctxM);
  executar(c, 'mapa.grade', { colunas: 500, ox: 2 }, ctxM);
  assert.equal(c.mapa.grade.colunas, 200);
  assert.equal(c.mapa.grade.ox, 0.99);
  executar(c, 'mapa.mover', { id, col: 3, lin: 4 }, ctxM);
  // Jogador não mexe; Suporte só entra se liberado.
  assert.throws(() => executar(c, 'mapa.mover', { id, col: 1, lin: 1 }, { user: jog, mestre: false }), /mestre ou o Suporte/);
  assert.throws(() => entrarNaCampanha(c, sup, 'suporte'), /não liberou/);
  entrarNaCampanha(c, m, 'suporte');
  executar(c, 'suporte.adicionar', { nome: 'ajudante' }, ctxM);
  assert.throws(() => executar(c, 'suporte.adicionar', { nome: 'ninguém' }, ctxM), /Nenhuma conta/);
  entrarNaCampanha(c, sup, 'suporte');
  const ctxS = { user: sup, mestre: false, suporte: true };
  executar(c, 'mapa.mover', { id, col: 5, lin: 6 }, ctxS);
  assert.deepEqual(c.mapa.pecas[id], { col: 5, lin: 6 });
  assert.throws(() => executar(c, 'imagem.mostrar', { id: 'i2', mostrando: true }, ctxS), /mestre/);
  executar(c, 'imagem.suporte', { id: 'i2', liberada: true }, ctxM);
  executar(c, 'imagem.mostrar', { id: 'i2', mostrando: true }, ctxS);
  const v = visaoPara(c, sup, 'suporte');
  assert.equal(v.papel, 'suporte');
  assert.deepEqual(v.imagens.map(i => i.id), ['i2']);
  assert.equal(v.mapa.midia.url, '/uploads/a.png');
  assert.deepEqual(v.personagens.map(p => p.nome), ['Rato']);
  assert.equal(v.personagens[0].atributos, undefined, 'o Suporte não vê a ficha');
});

test('mapa: marcações secretas e NPC fantasma só aparecem para o mestre', () => {
  const m = { id: 'mx', name: 'M' };
  const j = { id: 'jx', name: 'J' };
  const c = novaCampanha(m, { nome: 'Segredos', maxJogadores: 2, nivel: 1, padraoMSA: true });
  const ctxM = { user: m, mestre: true };
  const { id } = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Fantasma' } }, ctxM);
  executar(c, 'mapa.mover', { id, col: 2, lin: 2 }, ctxM);
  executar(c, 'mapa.marcar', { col: 5, lin: 5, texto: 'Armadilha: fosso' }, ctxM);
  executar(c, 'mapa.ocultar', { id, oculto: true }, ctxM);
  assert.equal(visaoPara(c, m, 'mestre').mapa.marcas.length, 1);
  assert.ok(visaoPara(c, m, 'mestre').mapa.pecas[id].oculto);
  const vj = visaoPara(c, j, 'jogador');
  assert.deepEqual(vj.mapa.marcas, []);
  assert.equal(vj.mapa.pecas[id], undefined);
  assert.ok(!vj.personagens.some(p => p.id === id), 'o NPC fantasma nem aparece na lista do jogador');
  const vs = visaoPara(c, m, 'suporte');
  assert.equal(vs.mapa.pecas[id], undefined);
  assert.throws(() => executar(c, 'mapa.mover', { id, col: 1, lin: 1 }, { user: m, mestre: false, suporte: true }), /não encontrado/);
  executar(c, 'mapa.mover', { id, col: 3, lin: 3 }, ctxM);
  assert.ok(c.mapa.pecas[id].oculto, 'mover não revela o fantasma');
  executar(c, 'mapa.desmarcar', { id: c.mapa.marcas[0].id }, ctxM);
  assert.equal(c.mapa.marcas.length, 0);
});

test('Sedução só em quem se atrai pelo gênero de quem seduz; fichas de teste nível 6 sem erro de pontos', async () => {
  const { podeSeduzir } = await import('../shared/regras.js');
  const homem = { nome: 'Rui', genero: 'masculino' };
  assert.ok(podeSeduzir(homem, { nome: 'Ana', atracao: ['masculino'] }).ok);
  assert.ok(!podeSeduzir(homem, { nome: 'Bia', atracao: ['feminino'] }).ok);
  assert.ok(!podeSeduzir(homem, { nome: 'Caio', atracao: [] }).ok, 'quem não se atrai por ninguém');
  assert.ok(podeSeduzir(homem, { nome: 'NPC sem dados' }).ok, 'sem atração definida não limita');
  const m = { id: 'm6', name: 'M6' };
  const c = novaCampanha(m, { nome: 'Teste 6', maxJogadores: 2, nivel: 1, padraoMSA: true });
  const { relatorio } = executar(c, 'teste.fichas', { nivel: 6 }, { user: m, mestre: true });
  assert.equal(relatorio.length, sis.classes.length);
  for (const r of relatorio) assert.ok(!r.avisos.some(a => a.startsWith('Pontos')), `${r.nome}: ${r.avisos.join('; ')}`);
  assert.equal(c.personagens.filter(p => p.nivel === 6 && p.tipo === 'pj' && !p.donoId).length, sis.classes.length);
});

test('PV persistentes/permanentes baixam o máximo; descanso do grupo; capacidades com usos por descanso longo', () => {
  const m = { id: 'm7', name: 'M7' };
  const c = novaCampanha(m, { nome: 'Teste 7', maxJogadores: 2, nivel: 1, padraoMSA: true });
  executar(c, 'teste.fichas', { nivel: 6 }, { user: m, mestre: true });
  const p = c.personagens[0];
  const max = p.pv.max;
  executar(c, 'pv.perdas', { id: p.id, persistente: 3, permanente: 2 }, { user: m, mestre: true });
  assert.equal(p.pv.max, max - 5);
  assert.equal(p.pv.atual, max - 5);
  // O jogador não consegue apagar as perdas mexendo no PV.
  executar(c, 'personagem.atualizar', { id: p.id, patch: { pv: { max: p.pv.max, atual: 1 } } }, { user: m, mestre: true });
  assert.equal(p.pv.persistente, 3);
  executar(c, 'pv.perdas', { id: p.id, persistente: 0 }, { user: m, mestre: true });
  assert.equal(p.pv.max, max - 2);
  const { linhas } = executar(c, 'descanso.fazer', { tipo: 'longo' }, { user: m, mestre: true });
  assert.equal(linhas.length, c.personagens.filter(x => x.tipo === 'pj').length);
  assert.ok(p.pv.atual > 1 && p.pv.atual <= p.pv.max);
  const cap = sis.capacidades.find(x => (p.atributos[x.atributo] ?? 0) >= 12);
  if (cap) {
    executar(c, 'capacidade.usar', { id: p.id, nome: cap.nome }, { user: m, mestre: true });
    assert.equal(p.capacidadesUsadas[cap.nome], 1);
    executar(c, 'descanso.fazer', { tipo: 'longo', ids: [p.id] }, { user: m, mestre: true });
    assert.deepEqual(p.capacidadesUsadas, {});
  }
  assert.throws(() => executar(c, 'descanso.fazer', { tipo: 'curto' }, { user: { id: 'x' }, mestre: false }));
});

test('durabilidade (livro, cap. 5): desgaste com DS maior, quebra em 0, reparo 1 por desgaste; consumíveis sem contagem', async () => {
  const R = await import('../shared/regras.js');
  const it = { nome: 'Faca', durabilidade: 2 };
  assert.equal(R.desgastarItem(it, 2), null, 'DS igual não desgasta');
  assert.match(R.desgastarItem(it, 3), /perdeu 1/);
  assert.match(R.desgastarItem(it, 5), /quebrou/);
  assert.equal(R.durabilidadeDe(it).quebrado, true);
  assert.equal(R.desgastarItem(it, 9), null, 'quebrado não perde mais');
  R.repararItem(it);
  R.repararItem(it);
  assert.equal(it.durabilidadeAtual, 2);
  assert.throws(() => R.repararItem(it));
  const sem = { nome: 'Lança', durabilidade: 5 };
  assert.match(R.desgastarItem(sem, 1, { semPrerequisito: true }), /perdeu 1/, 'sem pré-requisito, qualquer falha desgasta');
  assert.equal(R.durabilidadeDe({ consumivel: true }).texto, 'Consumível');
  const cons = sis.itens.filter(i => i.consumivel);
  assert.ok(cons.every(i => i.durabilidade == null));
});
