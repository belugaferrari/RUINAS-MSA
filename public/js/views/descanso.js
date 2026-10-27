// Janela do descanso (mestre): curto ou longo, com as condições do livro para o descanso longo —
// Conforto (roupas), Abrigo (frio e chuva), Ergonomia (acolchoado) e sono interrompido.
import { h, botao, janela, aviso, icone } from '../ui.js';
import { acao } from '../api.js';
import { estado } from '../estado.js';

// Resultado do descanso de cada personagem: os dados da recuperação (PV, Sanidade) e os testes dos marcadores.
const resultado = lista => h('div', { class: 'lista-descanso' }, lista.map(x => h('div', { class: 'descanso-personagem' },
  h('h4', {}, icone('bed'), ` ${x.nome}`),
  h('ul', {}, (x.notas.length ? x.notas : ['nada a recuperar']).map(l => h('li', { class: /MUTAÇÃO|ficou Doente|agravou/.test(l) ? 'perigo' : /resistiu|curou/.test(l) ? 'ok' : '' }, l))))));

// Jogador: quando o mestre faz o descanso, o resultado de cada personagem dele aparece numa janela (com os dados e os testes).
const vistos = new Set();
let campanhaVista = null;
export function observarDescanso(c) {
  if (!c?.log) return;
  const novos = c.log.filter(e => e.tipo === 'descanso' && !vistos.has(e.id));
  for (const e of novos) vistos.add(e.id);
  if (campanhaVista !== c.id) { campanhaVista = c.id; return; } // ao entrar na campanha, não mostra os antigos
  const meus = novos.filter(e => e.donoId && e.donoId === estado.usuario?.id && c.papel !== 'mestre');
  if (meus.length) janela(meus[0].rotulo, resultado(meus.map(e => ({ nome: e.autor, notas: e.linhas || [e.texto] }))), [['OK', () => true]]);
}

export function abrirDescanso({ ids = null, quem = 'o grupo' } = {}) {
  const cond = { confortavel: true, abrigado: true, ergonomico: true };
  const marca = (k, rotulo, dica) => h('label', { class: 'linha', title: dica },
    h('input', { type: 'checkbox', checked: cond[k], onchange: e => { cond[k] = e.target.checked; } }), ` ${rotulo}`);
  const fazer = async (tipo, interrompido = false) => {
    const r = await acao('descanso.fazer', { tipo, ids, ...cond, interrompido });
    fechar();
    janela(tipo === 'curto' ? 'Descanso curto' : interrompido ? 'Descanso longo interrompido' : 'Descanso longo',
      r.porPersonagem ? resultado(r.porPersonagem) : h('ul', { class: 'lista-descanso' }, r.linhas.map(l => h('li', {}, l))), [['OK', () => true]]);
  };
  const fechar = janela(`Descanso de ${quem}`, h('div', { class: 'descanso' },
    h('p', { class: 'dica' }, 'Curto (refeição de meia ração + 1 hora): 1 PV e conta como refeição. Longo (6 h de sono, ou 8 h em até duas partes): 1d4 PV por nível, 1d6 de Sanidade, testes de CONS% dos marcadores (vulnerabilidade → doença; genéticos → mutação), marcadores zerados, Sono some e as capacidades voltam. Interrompido (não voltou a dormir): 1d2 PV por nível e 1 de Sanidade, e o Sono não some.'),
    h('fieldset', {}, h('legend', {}, 'Descanso longo'),
      marca('confortavel', 'Confortável (roupas) — tira a armadura e as armas para dormir', 'Marcado: as armaduras e armas equipadas são guardadas antes de dormir.'),
      marca('abrigado', 'Abrigado (frio e chuva)', ''),
      marca('ergonomico', 'Ergonômico (acolchoado)', ''),
      h('small', { class: 'dica' }, 'Cada critério que faltar: −1 PV por dado lançado (mínimo geral de 1 PV).')),
    h('div', { class: 'barra' },
      botao('Descanso curto', () => fazer('curto').catch(e => aviso(e.message, 'erro')), { icone: 'coffee' }),
      botao('Descanso longo', () => fazer('longo').catch(e => aviso(e.message, 'erro')), { class: 'primario', icone: 'bed' }),
      botao('Descanso interrompido', () => fazer('longo', true).catch(e => aviso(e.message, 'erro')), { icone: 'bed-single', title: 'Acordou e não voltou a dormir: 1d2 PV por nível e 1 de Sanidade' }))),
  [['Cancelar', () => true]]);
}
