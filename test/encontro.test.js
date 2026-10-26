import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const { salvarCatalogoMonstros, voltarMonstrosPadrao } = await import('../server/monstros.js');
const { novaCampanha, executar, visaoPara } = await import('../server/actions.js');
const { opcoesNaFaixa, variar, sortearEncontro, cenarioSemIA, pedidoIA } = await import('../shared/encontro.js');
const { lerConfigIA, salvarConfigIA, configPublica, gerarTexto } = await import('../server/ia.js');

const mss = sistema('mss');
const ctxM = { user: { id: 'm' }, mestre: true };
const lobo = { nome: 'Lobo Cinzento', tipoCriatura: 'animal', tamanho: 'Médio', nivel: 2, dificuldade: 1, pv: 20, habitat: 'Florestas das ruínas', comportamento: 'Caça em matilha.',
  atributos: { FOR: 12, CONS: 12, AGI: 14, DES: 10, INT: 3, PER: 14, CAR: 6, WILL: 10 }, pericias: { briga: 6 }, subpericias: { 'briga.ataque-desarmado': 8 },
  ataques: [{ nome: 'Mordida', dano: '1d6' }] };
const dragao = { nome: 'Serpe', tamanho: 'Grande', nivel: 5, dificuldade: 6, pv: 60, estagios: [{ numero: 1, nome: 'Filhote', dificuldade: 0.5, pv: 12, tamanho: 'Pequeno' }, { numero: 2, nome: 'Adulta', dificuldade: 6 }] };

test('faixa de ND: cada estágio conta com o ND dele (inclusive menor que 1)', () => {
  const ops = opcoesNaFaixa([lobo, dragao], 0, 1);
  assert.deepEqual(ops.map(o => `${o.nome}:${o.estagio}`).sort(), ['Lobo Cinzento:null', 'Serpe:1']);
  assert.throws(() => sortearEncontro([lobo], { ndMin: 3, ndMax: 4 }, mss), /Nenhuma criatura/);
});

test('variação de até 10% em atributos e perícias, dentro do limite; PV entre 50% e 100%', () => {
  for (let i = 0; i < 50; i++) {
    const v = variar(lobo, mss);
    for (const [k, x] of Object.entries(lobo.atributos)) assert.ok(Math.abs(v.atributos[k] - x) <= Math.ceil(x * 0.1), `${k} ${x}→${v.atributos[k]}`);
    assert.ok(v.pericias.briga + v.subpericias['briga.ataque-desarmado'] <= 15);
  }
  const [cr] = sortearEncontro([lobo], { ndMin: 0, ndMax: 2 }, mss);
  assert.ok(cr.fracaoPv >= 0.5 && cr.fracaoPv <= 1);
});

test('cenário sem IA usa o habitat e o comportamento; o pedido para a IA leva o livro e o contexto', () => {
  const cr = sortearEncontro([lobo], { ndMin: 0, ndMax: 2, quantidade: 3 }, mss);
  const t = cenarioSemIA(cr, [lobo], { hora: 22, clima: 'Chuva' });
  assert.match(t, /^Noite, Chuva\. Em florestas das ruínas, o grupo encontra 3 Lobo Cinzento\./);
  assert.match(t, /Caça em matilha/);
  const p = pedidoIA(cr, [lobo], { extra: 'perto do farol' });
  assert.match(p, /3× Lobo Cinzento/);
  assert.match(p, /perto do farol/);
});

test('encontro por ND: só o mestre gera; jogadores não veem; colocar põe no campo com a variação e o PV sorteado', () => {
  salvarCatalogoMonstros([lobo, dragao], 'teste.xlsx');
  try {
    const c = novaCampanha({ id: 'm', name: 'M' }, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
    assert.throws(() => executar(c, 'encontro.sortear', { ndMin: 0, ndMax: 1 }, { user: { id: 'j' }, mestre: false }));
    const g = executar(c, 'encontro.sortear', { ndMin: 0, ndMax: 0.5, quantidade: 2 }, ctxM);
    assert.equal(g.criaturas.length, 2);
    assert.ok(g.criaturas.every(x => x.nome === 'Serpe' && x.estagio === 1));
    assert.equal(g.cenario.fonte, 'sem IA');
    assert.equal(visaoPara(c, { id: 'j' }, 'jogador').encontroGerado, undefined, 'jogador não vê o encontro gerado');
    const { ids } = executar(c, 'encontro.colocar', {}, ctxM);
    const ps = ids.map(id => c.personagens.find(p => p.id === id));
    assert.deepEqual(ps.map(p => p.nome), ['Serpe 1', 'Serpe 2']);
    for (const [i, p] of ps.entries()) {
      assert.equal(p.pv.max, 12);
      assert.equal(p.pv.atual, Math.max(1, Math.round(12 * g.criaturas[i].fracaoPv)));
      assert.equal(p.tamanho, 'Pequeno');
    }
    executar(c, 'encontro.mostrar', {}, ctxM);
    assert.equal(c.salas.batalha.log.at(-1).rotulo, 'Cenário');
    executar(c, 'encontro.descartar', {}, ctxM);
    assert.ok(!c.encontroGerado);
  } finally { voltarMonstrosPadrao(); }
});

test('IA: a chave fica no PC e não volta ao navegador; Gemini e Ollama com resposta simulada', async () => {
  assert.equal(lerConfigIA().provedor, 'nenhum');
  await assert.rejects(gerarTexto('s', 'p'), /Nenhuma IA/);
  salvarConfigIA({ provedor: 'gemini', gemini: { chave: 'AIza-segredo' } });
  assert.deepEqual(configPublica().gemini, { modelo: 'gemini-2.5-flash', temChave: true });
  assert.ok(!JSON.stringify(configPublica()).includes('segredo'));
  salvarConfigIA({ gemini: { chave: '' } });
  assert.equal(lerConfigIA().gemini.chave, 'AIza-segredo', 'chave em branco mantém a salva');
  const original = globalThis.fetch;
  try {
    let pedido;
    globalThis.fetch = async (url, op) => { pedido = { url, op }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A névoa cobre o cais.' }] } }] }), { status: 200 }); };
    const r = await gerarTexto('sistema', 'pedido');
    assert.equal(r.texto, 'A névoa cobre o cais.');
    assert.match(r.fonte, /Gemini/);
    assert.equal(pedido.op.headers['x-goog-api-key'], 'AIza-segredo');
    globalThis.fetch = async () => new Response('{}', { status: 429 });
    await assert.rejects(gerarTexto('s', 'p'), /cota grátis/);
    salvarConfigIA({ provedor: 'ollama' });
    globalThis.fetch = async () => new Response(JSON.stringify({ message: { content: 'Um uivo distante.' } }), { status: 200 });
    assert.equal((await gerarTexto('s', 'p')).texto, 'Um uivo distante.');
    salvarConfigIA({ provedor: 'claude' });
    await assert.rejects(gerarTexto('s', 'p'), /Falta a chave da Anthropic/);
    assert.throws(() => salvarConfigIA({ ollama: { url: 'ftp://x' } }), /inválido/);
  } finally { globalThis.fetch = original; }
});

test('IA Claude: pedido pelo SDK oficial com fallbacks e esforço baixo; recusa vira aviso', async () => {
  salvarConfigIA({ provedor: 'claude', claude: { chave: 'sk-ant-teste' } });
  const original = globalThis.fetch;
  try {
    let corpo, cab;
    const resposta = (stop = 'end_turn') => new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop, stop_sequence: null,
      content: stop === 'refusal' ? [] : [{ type: 'text', text: 'O vento traz cheiro de ferrugem.' }], usage: { input_tokens: 10, output_tokens: 8 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    globalThis.fetch = async (url, op) => { corpo = JSON.parse(op.body); cab = new Headers(op.headers); return resposta(); };
    const r = await gerarTexto('sistema', 'pedido');
    assert.equal(r.texto, 'O vento traz cheiro de ferrugem.');
    assert.equal(corpo.model, 'claude-opus-5-5');
    assert.equal(corpo.fallbacks, 'default');
    assert.equal(corpo.output_config.effort, 'low');
    assert.match(cab.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
    assert.match(`${cab.get('x-api-key')} ${cab.get('authorization')}`, /sk-ant-teste/, 'a chave salva vai no pedido');
    globalThis.fetch = async () => resposta('refusal');
    await assert.rejects(gerarTexto('s', 'p'), /recusou/);
  } finally { globalThis.fetch = original; salvarConfigIA({ provedor: 'nenhum' }); }
});

test('ler o mapa com IA: caixas da IA viram objetos na grade; resposta da IA lida em JSON; o mestre aceita', async () => {
  const O = await import('../shared/objetosMapa.js');
  const { lerImagemJson } = await import('../server/ia.js');
  // Mapa 20 colunas, proporção 3:4 (altura/largura = 0,75 → 15 linhas).
  const objs = O.objetosDaIA([{ tipo: 'parede', nome: 'Muro', caixa: [100, 250, 110, 750] }, { tipo: 'arvore', nome: 'Árvore', caixa: [500, 500, 560, 550] }, { tipo: 'disco-voador', nome: 'x', caixa: [1, 1, 2, 2] }], { colunas: 20, ox: 0, oy: 0 }, 0.75);
  assert.deepEqual(objs, [{ tipo: 'parede', nome: 'Muro', col: 5, lin: 1, l: 10, a: 1 }, { tipo: 'arvore', nome: 'Árvore', col: 10, lin: 7, l: 1, a: 2 }]);
  assert.equal(O.objetosDaIA([{ tipo: 'parede', nome: 'Muro', caixa: [0, 0, 20, 1000] }], { colunas: 50 }, 1).length, 3, 'parede de 50 quadrados vira pedaços de até 20');
  const img = { data: 'iVBORw0KGgo=', mime: 'image/png' };
  const original = globalThis.fetch;
  try {
    salvarConfigIA({ provedor: 'gemini', gemini: { chave: 'AIza-x' } });
    let corpo;
    globalThis.fetch = async (u, op) => { corpo = JSON.parse(op.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"objetos":[{"tipo":"mesa","nome":"Mesa","caixa":[1,2,3,4]}]}\n```' }] } }] }), { status: 200 }); };
    const r = await lerImagemJson('s', 'p', img, O.ESQUEMA_MAPA_IA);
    assert.equal(r.dados.objetos[0].tipo, 'mesa');
    assert.equal(corpo.contents[0].parts[0].inline_data.mime_type, 'image/png');
    salvarConfigIA({ provedor: 'claude', claude: { chave: 'sk-ant-x' } });
    globalThis.fetch = async (u, op) => { corpo = JSON.parse(op.body); return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: '{"objetos":[{"tipo":"arvore","nome":"Carvalho","caixa":[10,10,50,50]}]}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
    const r2 = await lerImagemJson('s', 'p', img, O.ESQUEMA_MAPA_IA);
    assert.equal(r2.dados.objetos[0].nome, 'Carvalho');
    assert.equal(corpo.output_config.format.type, 'json_schema');
    assert.equal(corpo.messages[0].content[0].type, 'image');
    await assert.rejects(lerImagemJson('s', 'p', { data: 'x', mime: 'video/mp4' }, {}), /inválida/);
  } finally { globalThis.fetch = original; salvarConfigIA({ provedor: 'nenhum' }); }
  const c = novaCampanha({ id: 'm', name: 'M' }, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const r = executar(c, 'mapa.objetosAceitar', { objetos: [...objs, { tipo: 'nada', col: 1, lin: 1 }] }, ctxM);
  assert.equal(r.criados, 2);
  assert.deepEqual(c.mapa.objetos.map(o => [o.tipo, o.col, o.lin, o.l, o.a]), [['parede', 5, 1, 10, 1], ['arvore', 10, 7, 1, 2]]);
  assert.throws(() => executar(c, 'mapa.objetosAceitar', { objetos: objs }, { user: { id: 'j' }, mestre: false }));
});
