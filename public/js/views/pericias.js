import { h, icone, passador, seloRevisao } from '../ui.js';
import { estado, render } from '../estado.js';
import { custoPericiaBase } from '/shared/regras.js';

// Painel das 20 perícias base com suas subperícias.
// opts: { d (derivados), editar: { base(id,v), sub(id,v), minBase, minSub, maxRestante, limite }, rolar(ref, nome) }
// Fora da edição, cada perícia base mostra só as subperícias treinadas (com pontos gastos); "Todas" abre a lista completa.
export function painelPericias(ficha, opts) {
  const sis = estado.sistema;
  const { d, editar, rolar, chave = 'pericias' } = opts;
  const chaveModo = `${chave}:soTreinadas`;
  const soTreinadas = estado.sel[chaveModo] ?? !editar;
  const busca = (estado.sel[`${chave}:busca`] || '').toLowerCase().trim();
  const lista = sis.pericias.filter(p => !busca || p.nome.toLowerCase().includes(busca) || p.subpericias.some(s => s.nome.toLowerCase().includes(busca)));
  return h('div', { class: 'pericias' },
    h('div', { class: 'barra' },
      h('label', { class: 'busca' }, icone('search'), h('input', {
        type: 'search', placeholder: 'Buscar perícia ou subperícia…', 'data-key': `${chave}:busca`, value: estado.sel[`${chave}:busca`] || '',
        oninput: e => { estado.sel[`${chave}:busca`] = e.target.value; render(); },
      })),
      h('button', { type: 'button', class: `pequeno ${soTreinadas ? 'primario' : ''}`, 'aria-pressed': soTreinadas,
        onclick: () => { estado.sel[chaveModo] = !soTreinadas; render(); } }, icone('target'), soTreinadas ? 'Só treinadas' : 'Todas as subperícias'),
      h('button', { type: 'button', class: 'pequeno', onclick: () => { for (const p of sis.pericias) estado.sel[`${chave}:${p.id}`] = true; render(); } }, icone('chevron-down'), 'Abrir todas'),
      h('button', { type: 'button', class: 'pequeno', onclick: () => { for (const p of sis.pericias) estado.sel[`${chave}:${p.id}`] = false; render(); } }, icone('chevron-up'), 'Fechar')),
    lista.map(p => grupo(ficha, p, d, editar, rolar, chave, !!busca, soTreinadas)));
}

function grupo(ficha, p, d, editar, rolar, chave, forcarAberto, soTreinadas) {
  const sis = estado.sistema;
  const base = ficha.pericias?.[p.id] ?? 0;
  const gastoSubs = p.subpericias.reduce((s, x) => s + (ficha.subpericias?.[x.id] ?? 0), 0);
  const maiorSub = Math.max(0, ...p.subpericias.map(x => ficha.subpericias?.[x.id] ?? 0));
  const aberto = forcarAberto || estado.sel[`${chave}:${p.id}`] === true;
  const treinada = base > 0 || gastoSubs > 0;
  const custo = custoPericiaBase(p, sis);
  return h('section', { class: `grupo-pericia ${treinada ? 'treinada' : ''}` },
    h('div', { class: 'grupo-pericia-topo' },
      h('button', {
        type: 'button', class: 'link grupo-nome', 'aria-expanded': aberto,
        onclick: () => { estado.sel[`${chave}:${p.id}`] = !aberto; render(); },
      }, icone(aberto ? 'chevron-down' : 'chevron-up'), h('strong', {}, p.nome), h('small', {}, ` ${p.atributo}`), p.combate ? h('span', { class: 'selo', title: 'Perícia de combate' }, icone('swords')) : null),
      h('span', { class: 'espaco' }),
      editar ? h('span', { class: 'mini', title: `Perícia base: cada ponto custa ${custo} PP e melhora todas as subperícias` },
        `Base (${custo} PP) `,
        // Base + subperícia não passa do limite do nível: a base desconta a subperícia mais treinada desta perícia.
        passador(base, editar.minBase?.(p.id) ?? 0, Math.min(editar.limite - maiorSub, base + Math.floor(editar.maxRestante() / custo)), v => editar.base(p.id, v), `${p.nome} base`)) : null,
      h('span', { class: 'valor-final', title: 'Valor da perícia base (pontos + bônus pericial)' }, `${d.pericias[p.id]}%`),
      rolar ? h('button', { type: 'button', class: 'so-icone pequeno', title: `Testar ${p.nome}`, 'aria-label': `Testar ${p.nome}`, onclick: () => rolar(`per:${p.id}`, p.nome) }, icone('dices')) : null),
    aberto || (soTreinadas && gastoSubs > 0) ? h('div', { class: 'subpericias' },
      aberto ? h('p', { class: 'dica' }, p.descricao) : null,
      p.subpericias.filter(s => aberto || (ficha.subpericias?.[s.id] ?? 0) > 0).map(s => {
        const pts = ficha.subpericias?.[s.id] ?? 0;
        const prof = d.bonusProfissao[s.id];
        return h('div', { class: `subpericia ${pts ? 'treinada' : ''}`, title: s.descricao },
          h('span', { class: 'sub-nome' }, s.nome, prof ? h('span', { class: 'selo ok', title: 'Bônus da profissão' }, `+${prof} prof.`) : null, seloRevisao(s.revisao)),
          editar ? passador(pts, editar.minSub?.(s.id) ?? 0, Math.min(editar.limite - base, pts + editar.maxRestante()), v => editar.sub(s.id, v), s.nome) : (pts ? h('small', {}, `${pts} pts`) : h('span')),
          h('strong', { class: 'valor-final' }, `${d.subpericias[s.id]}%`),
          rolar ? h('button', { type: 'button', class: 'so-icone pequeno', title: `Testar ${s.nome}`, 'aria-label': `Testar ${s.nome}`, onclick: () => rolar(`sub:${s.id}`, s.nome) }, icone('dices')) : null);
      })) : null);
}
