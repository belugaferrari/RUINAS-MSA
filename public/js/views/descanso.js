// Janela do descanso (mestre): curto ou longo, com as condições do livro para o descanso longo —
// Conforto (roupas), Abrigo (frio e chuva), Ergonomia (acolchoado) e sono interrompido.
import { h, botao, janela, aviso } from '../ui.js';
import { acao } from '../api.js';

export function abrirDescanso({ ids = null, quem = 'o grupo' } = {}) {
  const cond = { confortavel: true, abrigado: true, ergonomico: true };
  const marca = (k, rotulo, dica) => h('label', { class: 'linha', title: dica },
    h('input', { type: 'checkbox', checked: cond[k], onchange: e => { cond[k] = e.target.checked; } }), ` ${rotulo}`);
  const fazer = async (tipo, interrompido = false) => {
    const r = await acao('descanso.fazer', { tipo, ids, ...cond, interrompido });
    fechar();
    janela(tipo === 'curto' ? 'Descanso curto' : interrompido ? 'Descanso longo interrompido' : 'Descanso longo', h('ul', { class: 'lista-descanso' }, r.linhas.map(l => h('li', {}, l))), [['OK', () => true]]);
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
