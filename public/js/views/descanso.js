// Janela do descanso (mestre): curto ou longo, com as condições do livro para o descanso longo —
// Conforto (roupas), Abrigo (frio e chuva), Ergonomia (acolchoado) e sono interrompido.
import { h, botao, janela, aviso } from '../ui.js';
import { acao } from '../api.js';

export function abrirDescanso({ ids = null, quem = 'o grupo' } = {}) {
  const cond = { confortavel: true, abrigado: true, ergonomico: true, interrompido: false };
  const marca = (k, rotulo, dica) => h('label', { class: 'linha', title: dica },
    h('input', { type: 'checkbox', checked: cond[k], onchange: e => { cond[k] = e.target.checked; } }), ` ${rotulo}`);
  const fazer = async tipo => {
    const r = await acao('descanso.fazer', { tipo, ids, ...cond });
    fechar();
    janela(`Descanso ${tipo}`, h('ul', { class: 'lista-descanso' }, r.linhas.map(l => h('li', {}, l))), [['OK', () => true]]);
  };
  const fechar = janela(`Descanso de ${quem}`, h('div', { class: 'descanso' },
    h('p', { class: 'dica' }, 'Curto (meia ração + 1 hora): 1 PV. Longo (6 h de sono, ou 8 h em até duas partes): 1d4 PV por nível, 1d6 de Sanidade, testes de CONS% dos marcadores (vulnerabilidade → doença; genéticos → mutação) e os marcadores são zerados. As capacidades dos atributos voltam.'),
    h('fieldset', {}, h('legend', {}, 'Descanso longo'),
      marca('confortavel', 'Confortável (roupas)', 'Quem dorme com item de proteção equipado fica sem Conforto mesmo marcado.'),
      marca('abrigado', 'Abrigado (frio e chuva)', ''),
      marca('ergonomico', 'Ergonômico (acolchoado)', ''),
      h('small', { class: 'dica' }, 'Cada critério que faltar: −1 PV por dado lançado (mínimo geral de 1 PV).'),
      marca('interrompido', 'Sono interrompido (não voltou a dormir): metade dos dados', '')),
    h('div', { class: 'barra' },
      botao('Descanso curto', () => fazer('curto').catch(e => aviso(e.message, 'erro')), { icone: 'coffee' }),
      botao('Descanso longo', () => fazer('longo').catch(e => aviso(e.message, 'erro')), { class: 'primario', icone: 'bed' }))),
  [['Cancelar', () => true]]);
}
