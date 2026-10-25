// Monstros: tipos de deslocamento, estágios (o mesmo monstro mudando/crescendo) e busca por palavra aproximada.
// Vale no servidor (planilha, Campo de Batalha) e na tela (Livro dos Monstros).

import { limitePericia } from './regras.js';

const sem = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Tipos de deslocamento (autor, 24/10). Sem nada descrito, o monstro só anda em terreno padrão.
export const TIPOS_DESLOCAMENTO = [
  { id: 'andar', nome: 'Andar', re: /\b(andar|caminhada|corrida|terrestre|terreno)/ },
  { id: 'nadar', nome: 'Nadar', re: /\b(nada|natacao|nado|aquatic)/ },
  { id: 'voar', nome: 'Voar', re: /\b(voo|voar|voa)\b/ },
  { id: 'flutuar', nome: 'Flutuar', re: /\b(flutua|levita)/ },
  { id: 'escalar', nome: 'Escalar', re: /\b(escala)/ },
  { id: 'escavar', nome: 'Escavar', re: /\b(escava|subterran|cavar)/ },
  { id: 'saltar', nome: 'Saltar', re: /\b(salto|saltar|salta)\b/ },
];
export const nomeDeslocamento = id => TIPOS_DESLOCAMENTO.find(t => t.id === id)?.nome || id;

// Estágios citados num trecho: "(Estágio 2)", "(Estágios 2 e 3)", "Estágios 2-4".
export function estagiosDoTexto(t) {
  const m = /est[aá]gios?\s+([\d\s,e\-–a]+)/i.exec(String(t || ''));
  if (!m) return null;
  const nums = new Set();
  for (const parte of m[1].split(/,|\be\b/)) {
    const r = /(\d+)\s*(?:-|–|\ba\b)\s*(\d+)/.exec(parte);
    if (r) for (let i = Number(r[1]); i <= Number(r[2]); i++) nums.add(i);
    else for (const n of parte.match(/\d+/g) || []) nums.add(Number(n));
  }
  return nums.size ? [...nums].sort((a, b) => a - b) : null;
}

// Texto livre ("Natação 15 m; Voo (Estágio 2) 12 m") → { base: {nadar: 15}, porEstagio: {2: {voar: 12}}, resto: [...] }.
// O que não tem tipo conhecido ("Disparada de Rastilho 30 m") fica no texto.
export function deslocamentosDoTexto(texto) {
  const base = {}, porEstagio = {}, resto = [];
  for (const parte of String(texto || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const t = sem(parte);
    // "Escalada e Subterrâneo 9 m" vale para os dois; "incapaz de nadar" não conta como nadar.
    const semNegacao = t.replace(/incapaz de \w+( ou \w+)?/g, '');
    const tipos = TIPOS_DESLOCAMENTO.filter(x => x.re.test(semNegacao));
    const m = [...parte.matchAll(/(\d+(?:[.,]\d+)?)\s*m\b/gi)].pop();
    if (!tipos.length || !m) { resto.push(parte); continue; }
    const valor = Number(m[1].replace(',', '.'));
    const est = estagiosDoTexto(parte);
    for (const tipo of tipos) {
      if (est) for (const n of est) (porEstagio[n] ||= {})[tipo.id] = valor;
      else if (base[tipo.id] == null) base[tipo.id] = valor;
    }
    // Qualificação ("em lava", "incapaz de andar em terra") fica como observação.
    if (/\(|\bem\b|incapaz|so |apenas/i.test(t.replace(/\(estagios?[^)]*\)/i, ''))) resto.push(parte);
  }
  return { base, porEstagio, resto };
}

// Deslocamentos do monstro (já no estágio, se for o caso): { andar, nadar, … } em metros.
export function deslocamentosDe(m) {
  const d = { ...(m.deslocamentos || {}) };
  if (d.andar == null && m.deslocamento != null) d.andar = m.deslocamento;
  if (!m.deslocamentos && m.outrosDeslocamentos) {
    for (const [k, v] of Object.entries(deslocamentosDoTexto(m.outrosDeslocamentos).base)) if (d[k] == null) d[k] = v;
  }
  return d;
}
export const textoDeslocamentos = d => TIPOS_DESLOCAMENTO.filter(t => d[t.id] != null).map(t => `${t.nome} ${String(d[t.id]).replace('.', ',')} m`).join(' · ');

// Vale no estágio n? Sem lista de estágios, vale em todos (e na ficha base); com lista, só nos estágios dela.
export const valeNoEstagio = (x, n) => !x?.estagios?.length || (n != null && x.estagios.includes(Number(n)));

// O monstro no estágio n: o estágio troca só o que preencheu (PV, tamanho, atributos, deslocamentos…); ataques e
// habilidades marcados com estágios só aparecem neles. Sem estágios (ou n vazio), devolve o monstro como está.
export function monstroNoEstagio(m, n) {
  const est = (m.estagios || []).find(e => e.numero === Number(n));
  const v = { ...m, deslocamentos: deslocamentosDe(m) };
  if (est) {
    for (const k of ['tamanho', 'nivel', 'dificuldade', 'xp', 'pv', 'ipGeral', 'comportamento', 'sentidos', 'imagem']) if (est[k] != null && est[k] !== '') v[k] = est[k];
    if (est.atributos) v.atributos = { ...(m.atributos || {}), ...est.atributos };
    // Perícias do estágio: substituem as de mesmo nome da aba Monstros (as outras ficam).
    if (est.pericias) v.pericias = { ...(m.pericias || {}), ...est.pericias };
    if (est.subpericias) v.subpericias = { ...(m.subpericias || {}), ...est.subpericias };
    if (est.deslocamentos) v.deslocamentos = { ...v.deslocamentos, ...est.deslocamentos };
    for (const k of ['resistencias', 'imunidades', 'vulnerabilidades']) if (est[k]?.length) v[k] = [...new Set([...(m[k] || []), ...est[k]])];
    if (est.descricao) v.descricaoEstagio = est.descricao;
    v.estagio = est.numero;
    v.nomeEstagio = est.nome || `Estágio ${est.numero}`;
  }
  const num = est?.numero ?? null;
  v.ataques = (m.ataques || []).filter(a => valeNoEstagio(a, num));
  v.habilidades = (m.habilidades || []).filter(h => valeNoEstagio(h, num));
  if (v.deslocamentos.andar != null) v.deslocamento = v.deslocamentos.andar;
  return v;
}

// Distância de edição (para achar "lobisomen" → "Lobisomem", "moloto" → "Moolotos").
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const at = [i];
    for (let j = 1; j <= b.length; j++) at[j] = Math.min(ant[j] + 1, at[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = at;
  }
  return ant[b.length];
}
// Nota de 0 (não serve) para cima: nome conta mais que o resto do texto; cada palavra da busca precisa achar par
// (igual, começo de palavra, dentro da palavra ou com 1–2 letras trocadas).
export function notaBusca(termo, nome, extra = '') {
  const q = sem(termo).split(' ').filter(Boolean);
  if (!q.length) return 1;
  const pNome = sem(nome).split(/[^a-z0-9]+/).filter(Boolean);
  const pExtra = sem(extra).split(/[^a-z0-9]+/).filter(Boolean);
  let nota = 0;
  for (const w of q) {
    const casa = (palavras, aproximada) => {
      let melhor = 0;
      for (const p of palavras) {
        if (p === w) return 4;
        if (p.startsWith(w)) melhor = Math.max(melhor, 3);
        else if (w.length >= 3 && p.includes(w)) melhor = Math.max(melhor, 2);
        else if (aproximada && w.length >= 4 && distancia(w, p.slice(0, w.length + 1)) <= (w.length >= 7 ? 2 : 1)) melhor = Math.max(melhor, 1.5);
      }
      return melhor;
    };
    // Erro de digitação só conta no nome; no resto (afinidade, lugar…) precisa da palavra certa ou do começo dela.
    const n = casa(pNome, true) * 2 || casa(pExtra, false);
    if (!n) return 0;
    nota += n;
  }
  return nota;
}
export function buscarMonstros(lista, termo) {
  if (!sem(termo)) return lista;
  return lista.map(m => ({ m, n: notaBusca(termo, `${m.nome} ${m.raca || ''}`, [m.tipoCriatura, m.habitat, (m.afinidades || []).join(' '), m.tamanho].join(' ')) }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n).map(x => x.m);
}

// Limite de perícia (o mesmo do personagem, com o nível da criatura): perícia base + subperícia ≤ 5 + 5 × nível.
// Devolve os avisos da ficha base e de cada estágio (com o nível e as perícias daquele estágio).
export function periciasAcimaDoLimite(m, sistema) {
  const subDe = Object.fromEntries((sistema.pericias || []).flatMap(p => p.subpericias.map(x => [x.id, p])));
  const nomePer = Object.fromEntries((sistema.pericias || []).map(p => [p.id, p.nome]));
  const avisos = [];
  for (const n of [null, ...(m.estagios || []).map(e => e.numero)]) {
    const v = monstroNoEstagio(m, n);
    const lim = limitePericia(v.nivel || 1, sistema);
    const onde = n == null ? '' : ` (estágio ${n})`;
    for (const [id, x] of Object.entries(v.pericias || {})) if (x > lim) avisos.push(`${nomePer[id] || id} ${x}${onde}: passa do limite ${lim} do nível ${v.nivel || 1}`);
    for (const [id, x] of Object.entries(v.subpericias || {})) {
      const p = subDe[id];
      const total = x + (v.pericias?.[p?.id] || 0);
      if (total > lim) avisos.push(`${p ? `${p.nome} › ${p.subpericias.find(s => s.id === id).nome}` : id} ${total}${onde}: passa do limite ${lim} do nível ${v.nivel || 1}`);
    }
  }
  return [...new Set(avisos)];
}

// ND pode ser menor que 1 (0,5 = 1/2; 0,25 = 1/4…): mostra como fração quando for uma das comuns.
const FRACOES = { 0.5: '1/2', 0.25: '1/4', 0.125: '1/8', 0.75: '3/4' };
export const textoND = nd => (nd == null || nd === '' ? '—' : FRACOES[nd] || String(nd).replace('.', ','));

// Quadrados que a criatura ocupa no mapa (livro, Categorias de Tamanho): Grande e Enorme 2×2; Imenso e Colossal 3×3.
// Médio e menores ficam com 1 quadrado (os menores aparecem como médios para não ficarem minúsculos — autor, 25/10).
export function ladoNoMapa(p) {
  const t = sem(p?.tamanho);
  return t === 'grande' || t === 'enorme' ? 2 : t === 'imenso' || t === 'colossal' ? 3 : 1;
}
