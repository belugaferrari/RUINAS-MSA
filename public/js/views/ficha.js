import { h, campo, botao, selecao, aviso, confirmar, pedirTexto, formatarData, vazio } from '../ui.js';
import { estado, render } from '../estado.js';
import { acao, enviarArquivo } from '../api.js';
import { derivados, slotsOcupados } from '/shared/regras.js';

const atualizar = (p, patch) => acao('personagem.atualizar', { id: p.id, patch });

// Valores marcados para o próximo teste, por personagem (local a este dispositivo).
const selecionados = new Map();
const marcados = id => {
  if (!selecionados.has(id)) selecionados.set(id, new Set());
  return selecionados.get(id);
};

export function fichaView(p, { mestre = false } = {}) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  return h('div', { class: 'ficha' },
    cabecalho(p, mestre),
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco' }, h('h3', {}, 'Identidade'), identidade(p)),
      h('section', { class: 'bloco' }, h('h3', {}, 'Estado'), trilhas(p, mestre)),
      h('section', { class: 'bloco' }, h('h3', {}, 'Atributos'), valores(p, 'atributos', sis.atributos, d.atributos, d.bonus, mestre)),
      h('section', { class: 'bloco' }, h('h3', {}, 'Perícias'), valores(p, 'pericias', sis.pericias, d.pericias, d.bonus, mestre)),
      h('section', { class: 'bloco largo' }, h('h3', {}, 'Teste'), painelTeste(p)),
      h('section', { class: 'bloco' }, h('h3', {}, 'Classe e vantagens'), classeVantagens(p, mestre)),
      h('section', { class: 'bloco' }, h('h3', {}, `Equipamento · Defesa ${d.defesa} · Carga ${d.carga.toFixed(1)}`), equipamento(p, mestre)),
      h('section', { class: 'bloco largo' }, h('h3', {}, 'Anotações'),
        campo(`${p.id}:anotacoes`, p.anotacoes, v => atualizar(p, { anotacoes: v }), { multilinha: true, rows: 5, placeholder: 'Suas anotações…' })),
      h('section', { class: 'bloco largo' }, h('h3', {}, 'Background'),
        campo(`${p.id}:background`, p.background, v => atualizar(p, { background: v }), { multilinha: true, rows: 6 })),
      mestre ? h('section', { class: 'bloco largo' }, h('h3', {}, 'Controle do mestre'), controleMestre(p)) : null));
}

function cabecalho(p, mestre) {
  const arquivo = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      const form = new FormData();
      form.append('arquivo', f);
      try {
        await enviarArquivo(`/api/campanhas/${estado.campanha.id}/personagens/${p.id}/foto`, form);
        aviso('Foto atualizada.');
      } catch (err) {
        aviso(err.message, 'erro');
      }
    },
  });
  return h('header', { class: 'ficha-topo' },
    h('button', { class: 'foto', title: 'Trocar foto', onclick: () => arquivo.click() },
      p.foto ? h('img', { src: p.foto, alt: p.nome }) : h('span', {}, '📷')),
    arquivo,
    h('div', { class: 'ficha-titulo' },
      campo(`${p.id}:nome`, p.nome, v => atualizar(p, { nome: v }), { class: 'nome-grande' }),
      h('p', { class: 'meta' },
        `${p.tipo === 'npc' ? 'NPC' : 'Personagem-jogador'} · ${p.classe || 'Sem classe'} · Nível ${p.nivel} · XP ${p.xp || 0} · Dinheiro ${p.dinheiro ?? 0}`,
        p.tipo === 'pj' ? ` · Jogador: ${p.dono || 'livre'}` : null)),
    mestre ? h('label', { class: 'mini' }, 'Nível',
      campo(`${p.id}:nivel`, p.nivel, v => atualizar(p, { nivel: v }), { tipo: 'number', min: 1, max: 20 })) : null);
}

function identidade(p) {
  const linha = (rot, k) => h('label', {}, rot, campo(`${p.id}:${k}`, p[k], v => atualizar(p, { [k]: v })));
  return h('div', { class: 'form' },
    h('div', { class: 'grade3' }, linha('Idade', 'idade'), linha('Peso', 'peso'), linha('Tamanho', 'altura')),
    linha('Instinto', 'instinto'),
    h('label', {}, 'Características', campo(`${p.id}:caracteristicas`, p.caracteristicas, v => atualizar(p, { caracteristicas: v }), { multilinha: true, rows: 2 })));
}

function trilha(p, chave, rotulo) {
  const t = p[chave] || { max: 0, atual: 0 };
  const caixas = [];
  for (let i = 1; i <= Math.min(t.max, 40); i++) {
    caixas.push(h('button', {
      class: `caixa ${i <= t.atual ? 'cheia' : ''}`, title: `${rotulo}: ${i}`,
      onclick: () => atualizar(p, { [chave]: { ...t, atual: i === t.atual ? i - 1 : i } }).catch(e => aviso(e.message, 'erro')),
    }));
  }
  return h('div', { class: 'trilha' },
    h('div', { class: 'trilha-topo' },
      h('strong', {}, rotulo),
      botao('−', () => atualizar(p, { [chave]: { ...t, atual: t.atual - 1 } }), { class: 'pequeno' }),
      h('span', { class: `valor ${t.atual <= 0 ? 'perigo' : ''}` }, `${t.atual} / ${t.max}`),
      botao('+', () => atualizar(p, { [chave]: { ...t, atual: Math.min(t.max, t.atual + 1) } }), { class: 'pequeno' })),
    h('div', { class: 'caixas' }, caixas));
}

function trilhas(p, mestre) {
  const novoMarcador = async () => {
    const t = await pedirTexto('Novo marcador', 'Descrição (ex.: Envenenado, Assustado)');
    if (t) await atualizar(p, { marcadores: [...(p.marcadores || []), t] });
  };
  return h('div', {},
    trilha(p, 'pv', 'PV'),
    trilha(p, 'sanidade', 'Sanidade'),
    trilha(p, 'humanidade', 'Humanidade'),
    mestre ? h('div', { class: 'grade3 mini' },
      ...['pv', 'sanidade', 'humanidade'].map(k => h('label', {}, `${k === 'pv' ? 'PV' : k[0].toUpperCase() + k.slice(1)} máx.`,
        campo(`${p.id}:${k}:max`, p[k]?.max, v => atualizar(p, { [k]: { ...p[k], max: v } }), { tipo: 'number', min: 0 })))) : null,
    h('div', { class: 'marcadores' },
      h('strong', {}, 'Marcadores: '),
      (p.marcadores || []).map((m, i) => h('span', { class: 'etiqueta' }, m,
        h('button', { class: 'x', title: 'Remover', onclick: () => atualizar(p, { marcadores: p.marcadores.filter((_, j) => j !== i) }) }, '×'))),
      botao('+ marcador', novoMarcador, { class: 'pequeno' })));
}

function valores(p, chave, lista, finais, bonus, mestre) {
  const sel = marcados(p.id);
  return h('div', { class: 'valores' }, lista.map(item => {
    const base = p[chave]?.[item.nome] ?? 0;
    const b = bonus[item.nome] || 0;
    const id = `${chave}:${item.nome}`;
    return h('div', { class: `valor-linha ${sel.has(id) ? 'marcado' : ''}` },
      h('label', { class: 'linha', title: 'Marcar para o teste' },
        h('input', { type: 'checkbox', checked: sel.has(id), onchange: e => { e.target.checked ? sel.add(id) : sel.delete(id); render(); } }),
        item.nome, item.atributo ? h('small', {}, ` (${item.atributo})`) : null),
      mestre
        ? campo(`${p.id}:${id}`, base, v => atualizar(p, { [chave]: { ...p[chave], [item.nome]: v } }), { tipo: 'number', class: 'num' })
        : h('span', { class: 'num' }, base),
      b ? h('span', { class: `bonus ${b > 0 ? 'ok' : 'perigo'}`, title: 'Bônus/ônus de itens equipados' }, b > 0 ? `+${b}` : b) : h('span', { class: 'bonus' }),
      h('strong', { class: 'final' }, finais[item.nome]));
  }));
}

function painelTeste(p) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  const sel = [...marcados(p.id)];
  const componentes = sel.map(id => {
    const [chave, nome] = id.split(/:(.*)/s);
    return { nome, valor: (chave === 'atributos' ? d.atributos : d.pericias)[nome] ?? 0 };
  });
  const rotulo = h('input', { placeholder: 'Nome do teste (opcional)' });
  const dado = h('input', { value: sis.teste.dado, class: 'curto', title: 'Dado (ex.: 1d20, 2d6+1)' });
  const ondeOpcoes = [{ valor: '', rotulo: 'Rolagens gerais' }, { valor: 'social', rotulo: 'Sala Social' }, { valor: 'batalha', rotulo: 'Campo de Batalha' }];
  const onde = selecao(ondeOpcoes, estado.sel.ondeRolar || '', v => { estado.sel.ondeRolar = v; });
  const ultimo = (estado.campanha.log || []).filter(e => e.autor === p.nome).at(-1);
  return h('div', {},
    h('p', { class: 'dica' }, sel.length ? `Somando: ${componentes.map(c => `${c.nome} (${c.valor})`).join(' + ')}` : 'Marque atributos e perícias acima para somar no teste.'),
    h('div', { class: 'barra' },
      rotulo, dado, onde,
      botao('🎲 Rolar', async () => {
        const r = await acao('rolar', { id: p.id, sala: onde.value || null, rotulo: rotulo.value || componentes.map(c => c.nome).join(' + ') || 'Teste', componentes, dado: dado.value });
        aviso(`${r.rotulo}: ${r.total} (dados ${r.dados.join(', ')})`);
        marcados(p.id).clear();
        render();
      }, { class: 'primario' }),
      sel.length ? botao('Limpar', () => { marcados(p.id).clear(); render(); }) : null),
    h('p', { class: 'dica' }, sis.teste.descricao),
    ultimo ? h('p', {}, 'Último teste geral: ', linhaRolagem(ultimo)) : null);
}

export function linhaRolagem(e) {
  if (e.texto) return h('span', {}, h('strong', {}, e.rotulo), ': ', e.texto);
  const partes = [`${e.dado}: [${e.dados.join(', ')}]${e.mod ? (e.mod > 0 ? ` +${e.mod}` : ` ${e.mod}`) : ''}`, ...e.componentes.map(c => `${c.nome} ${c.valor}`)];
  return h('span', {}, h('strong', {}, `${e.autor} — ${e.rotulo}: `), h('span', { class: 'total' }, e.total), h('small', {}, ` (${partes.join(' + ')})`), e.secreta ? h('span', { class: 'selo' }, 'secreta') : null);
}

function classeVantagens(p, mestre) {
  const sis = estado.sistema;
  const classe = sis.classes.find(c => c.nome === p.classe);
  return h('div', {},
    mestre
      ? h('label', {}, 'Classe', selecao(sis.classes.map(c => c.nome), p.classe, v => atualizar(p, { classe: v })))
      : h('p', {}, h('strong', {}, 'Classe: '), p.classe || 'Sem classe'),
    classe?.escolhas?.length ? h('ul', {}, classe.escolhas.map(e => h('li', {}, h('strong', {}, `${e.rotulo}: `), (p.escolhasClasse?.[e.id] || []).join(', ') || '—'))) : null,
    h('p', {}, h('strong', {}, 'Vantagens: ')),
    (p.vantagens || []).length
      ? h('ul', {}, p.vantagens.map(v => h('li', { title: sis.vantagens.find(x => x.nome === v)?.descricao }, v,
        mestre ? h('button', { class: 'x', onclick: () => atualizar(p, { vantagens: p.vantagens.filter(x => x !== v) }) }, '×') : null)))
      : vazio('Nenhuma.'),
    mestre ? selecao([{ valor: '', rotulo: '+ adicionar vantagem' }, ...sis.vantagens.filter(v => !p.vantagens?.includes(v.nome)).map(v => ({ valor: v.nome, rotulo: `${v.nome} (${v.custo})` }))], '',
      v => v && atualizar(p, { vantagens: [...(p.vantagens || []), v] })) : null);
}

export function equipamento(p, mestre, filtro = null) {
  const sis = estado.sistema;
  const uso = slotsOcupados(p);
  const itens = (p.itens || []).filter(i => !filtro || filtro(i));
  return h('div', {},
    filtro ? null : h('div', { class: 'slots' }, sis.slots.map(s => h('span', { class: `selo ${(uso[s.id] || 0) >= s.capacidade ? 'cheio' : ''}` }, `${s.nome} ${uso[s.id] || 0}/${s.capacidade}`))),
    itens.length ? h('table', { class: 'tabela' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Slot'), h('th', {}, 'Durab.'), h('th', {}, 'Dano/Def.'), h('th', {}, 'Bônus'), h('th', {}, 'Venda'), h('th', {}))),
      h('tbody', {}, itens.map(i => h('tr', { class: i.equipado ? 'equipado' : '' },
        h('td', {}, i.nome),
        h('td', {}, sis.slots.find(s => s.id === i.slot)?.nome || '—', i.ocupa > 1 ? ` (${i.ocupa})` : ''),
        h('td', {}, mestre
          ? campo(`${p.id}:dur:${i.uid}`, i.durabilidadeAtual ?? i.durabilidade, v => acao('item.durabilidade', { id: p.id, uid: i.uid, valor: v }), { tipo: 'number', class: 'num' })
          : `${i.durabilidadeAtual ?? i.durabilidade}/${i.durabilidade}`),
        h('td', {}, [i.dano, i.defesa ? `Def ${i.defesa}` : null].filter(Boolean).join(' · ') || '—'),
        h('td', {}, Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—'),
        h('td', {}, i.venda ?? '—'),
        h('td', { class: 'acoes' },
          i.slot ? botao(i.equipado ? 'Desequipar' : 'Equipar', () => acao('item.equipar', { id: p.id, uid: i.uid, equipar: !i.equipado }), { class: i.equipado ? '' : 'primario pequeno' }) : null,
          (mestre || estado.campanha.lojaAberta) ? botao('Vender', async () => {
            if (await confirmar(`Vender ${i.nome} por ${i.venda ?? 0}?`)) await acao('item.vender', { id: p.id, uid: i.uid });
          }, { class: 'pequeno' }) : null,
          botao('×', async () => {
            if (await confirmar(`Descartar ${i.nome}?`)) await acao('item.remover', { id: p.id, uid: i.uid });
          }, { class: 'pequeno perigo', title: 'Descartar' })))))) : vazio('Nenhum item.'),
    mestre && !filtro ? selecao([{ valor: '', rotulo: '+ dar item do catálogo' }, ...sis.itens.map(i => ({ valor: i.id, rotulo: i.nome }))], '',
      v => v && acao('item.adicionar', { id: p.id, itemId: v }).catch(e => aviso(e.message, 'erro'))) : null);
}

function controleMestre(p) {
  const xp = h('input', { type: 'number', value: 10, class: 'curto' });
  return h('div', {},
    h('div', { class: 'barra' },
      h('span', {}, 'Dar XP:'), xp, botao('Dar', () => acao('xp.dar', { id: p.id, qtd: xp.value })),
      h('label', { class: 'mini' }, 'Dinheiro', campo(`${p.id}:dinheiro`, p.dinheiro, v => atualizar(p, { dinheiro: v }), { tipo: 'number', class: 'num' })),
      p.tipo === 'pj' && p.donoId ? botao('Liberar do jogador', async () => {
        if (await confirmar(`Tirar ${p.nome} do controle de ${p.dono}?`)) await acao('personagem.liberar', { id: p.id });
      }) : null,
      botao('Duplicar', () => acao('personagem.duplicar', { id: p.id })),
      botao('Apagar ficha', async () => {
        if (await confirmar(`Apagar a ficha de ${p.nome}?`)) {
          await acao('personagem.remover', { id: p.id });
          estado.sel.personagem = null;
        }
      }, { class: 'perigo' })),
    h('h4', {}, 'Backups (feitos ao evoluir)'),
    (p.backups || []).length
      ? h('ul', {}, [...p.backups].reverse().map(b => h('li', {}, `${formatarData(b.em)} — nível ${b.ficha.nivel}, XP ${b.ficha.xp} `,
        botao('Restaurar', async () => {
          if (await confirmar('Restaurar este backup? A ficha atual será substituída.')) await acao('backup.restaurar', { id: p.id, backupId: b.id });
        }, { class: 'pequeno' }))))
      : vazio('Nenhum backup ainda.'));
}
