// Mutações do personagem (tabela d100 do autor): controlada, descontrolada e temporária. O mestre põe (escolhida ou
// sorteada), troca o tipo e tira; o Mutante (nível 3+) escolhe as dele (Genes mutantes: 1 controlada e 1 descontrolada).
import { h, botao, selecao, aviso, confirmar, icone } from '../ui.js';
import { estado, render } from '../estado.js';
import { acao } from '../api.js';
import { TIPOS_MUTACAO, mutacaoDaTabela, efeitosHabilidade, listaHabilidades } from '/shared/regras.js';

const ehMutante = p => /mutante/i.test(estado.sistema.classes?.find(c => c.id === p.classe)?.nome || '') && (p.nivel || 1) >= 3;

export function mutacoesView(p, mestre) {
  const sis = estado.sistema;
  if (!sis.mutacoes?.length) return null;
  const minhas = p.mutacoes || [];
  const podeEscolher = mestre || (ehMutante(p) && TIPOS_MUTACAO.some(t => t.id !== 'temporaria' && !minhas.some(x => x.tipo === t.id)));
  if (!minhas.length && !podeEscolher) return null;
  const habs = listaHabilidades(p, sis).filter(x => x.mutacao);
  const sel = estado.sel[`mut:${p.id}`] ||= { n: '', tipo: mestre ? 'temporaria' : 'controlada' };
  const tipos = TIPOS_MUTACAO.filter(t => mestre || (t.id !== 'temporaria' && !minhas.some(x => x.tipo === t.id)));
  if (!tipos.some(t => t.id === sel.tipo)) sel.tipo = tipos[0]?.id;
  return h('div', { class: 'mutacoes' },
    minhas.length ? h('ul', { class: 'lista-habilidades' }, minhas.map(x => {
      const m = mutacaoDaTabela(sis, x.n);
      const hab = habs.find(y => y.id === `mut:${x.id}`);
      const ef = hab ? efeitosHabilidade(p, sis, hab).notas.join(' · ') : '';
      const tipo = TIPOS_MUTACAO.find(t => t.id === x.tipo);
      return h('li', { class: x.tipo === 'controlada' ? 'ativa' : '' },
        h('div', { class: 'hab-texto' },
          h('details', {}, h('summary', {}, h('strong', {}, `${x.n}. ${m?.nome || '?'}`), h('small', { class: `selo ${x.tipo === 'controlada' ? 'ok' : x.tipo === 'descontrolada' ? 'perigo' : ''}` }, tipo?.nome || x.tipo)),
            h('p', { class: 'bloco-texto' }, m?.efeito || ''), m?.obs ? h('p', { class: 'dica' }, m.obs) : null, h('p', { class: 'dica' }, tipo?.texto || '')),
          ef ? h('small', { class: 'hab-efeito' }, icone('zap'), ` ${ef}`) : h('small', { class: 'dica' }, 'Sem número para o app aplicar: lembrete.')),
        mestre ? h('div', { class: 'hab-botoes' },
          selecao(TIPOS_MUTACAO.map(t => ({ valor: t.id, rotulo: t.nome })), x.tipo, v => acao('mutacao.tipo', { id: p.id, mutacao: x.id, tipo: v }), { 'aria-label': `Tipo da mutação ${m?.nome}` }),
          botao('', async () => { if (await confirmar(`Tirar a mutação ${m?.nome} de ${p.nome}?`)) await acao('mutacao.remover', { id: p.id, mutacao: x.id }); },
            { class: 'pequeno perigo', icone: 'trash-2', title: `Tirar ${m?.nome}` })) : null);
    })) : h('p', { class: 'dica' }, 'Nenhuma mutação.'),
    podeEscolher && tipos.length ? h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: 'Sortear (d100)' }, ...sis.mutacoes.map(m => ({ valor: String(m.n), rotulo: `${m.n}. ${m.nome}` }))], sel.n, v => { sel.n = v; render(); }, { 'aria-label': 'Mutação' }),
      selecao(tipos.map(t => ({ valor: t.id, rotulo: t.nome })), sel.tipo, v => { sel.tipo = v; }, { 'aria-label': 'Tipo' }),
      botao(sel.n ? 'Adicionar' : 'Sortear', async () => {
        const r = await acao('mutacao.adicionar', { id: p.id, n: sel.n || null, tipo: sel.tipo });
        aviso(`${p.nome}: ${r.n}. ${r.nome}`);
        sel.n = '';
      }, { class: 'pequeno primario', icone: sel.n ? 'plus' : 'dices' })) : null,
    !mestre && ehMutante(p) ? h('p', { class: 'dica' }, 'Genes mutantes: escolha 1 mutação controlada (só os benefícios) e 1 descontrolada (benefícios e ônus). Para trocar, peça ao mestre.') : null);
}
