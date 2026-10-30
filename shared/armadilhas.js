// Montar armadilha (livro, Capítulo 8, e planilha do autor de 15/10): ND base 50 + gatilho + área + tamanho do dano + efeitos.
// Os números vêm da tabela de armadilhas (conteudo/sistemas/armadilhas.json ou a planilha do mestre).
import { PROGRESSAO_DANO } from './regras.js';

// escolha: { gatilho (nome), area (id), passos (quadrados de 1,5 m da área), dano ('1d4'…'2d20'), efeitos: [nomes] }
export function calcularArmadilha(tab, escolha) {
  const base = tab.base ?? 50;
  const g = (tab.gatilhos || []).find(x => x.nome === escolha.gatilho) || { criar: 0, armar: 0, encontrar: 0, desarmar: 0 };
  const a = (tab.areas || []).find(x => x.id === escolha.area) || (tab.areas || [])[0] || { id: 'unico', modFixo: 0, modPorPasso: 0, maxPassos: 1 };
  const passos = a.maxPassos === 1 ? 1 : Math.max(1, Math.min(a.maxPassos || 99, parseInt(escolha.passos, 10) || 1));
  const modArea = (a.modFixo || 0) + (a.modPorPasso || 0) * (a.modPorPasso ? passos : 0);
  const saltos = Math.max(0, PROGRESSAO_DANO.indexOf(String(escolha.dano || '1d4').toLowerCase()));
  // Dano em área: o modificador do dano conta de novo para cada passo a mais da área (explosão de 2 passos = 2×).
  const modDano = saltos * (tab.danoPorPasso ?? 5) * (a.maxPassos === 1 ? 1 : passos);
  const efeitos = (escolha.efeitos || []).map(n => (tab.efeitos || []).find(x => x.nome === n)).filter(Boolean);
  const modEfeitos = efeitos.reduce((s, e) => s + (e.criar || 0), 0);
  const criar = base + (g.criar || 0) + modArea + modDano + modEfeitos;
  return {
    criar, armar: base + (g.armar || 0), encontrar: base + (g.encontrar || 0), desarmar: base + (g.desarmar || 0),
    partes: [{ nome: 'base', valor: base }, { nome: `gatilho (${g.nome || '—'})`, valor: g.criar || 0 }, { nome: `área (${a.nome}${a.maxPassos === 1 ? '' : `, ${passos} passo${passos > 1 ? 's' : ''}`})`, valor: modArea },
      { nome: `dano ${escolha.dano || '1d4'} (${saltos} salto${saltos === 1 ? '' : 's'}${modDano && a.maxPassos !== 1 ? ` × ${passos}` : ''})`, valor: modDano },
      ...efeitos.map(e => ({ nome: e.nome, valor: e.criar || 0 }))],
    custo: a.custo, tempo: a.tempo, materiais: efeitos.map(e => e.material).filter(Boolean), passos,
  };
}
