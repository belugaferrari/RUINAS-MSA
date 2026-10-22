import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, DATA_DIR } from './db.js';
import { ARQ_MONSTROS } from './monstros.js';

export const CONTEUDO = path.join(RAIZ, 'conteudo');
const SISTEMAS = path.join(CONTEUDO, 'sistemas');
export const SISTEMA_PADRAO = 'msa';
export const IDS_SISTEMAS = ['msa', 'mss'];

const cache = new Map();

// Catálogo de itens: o que o mestre enviou pela planilha (data/) ou o padrão gerado das planilhas do autor.
// Com ITENS_EXEMPLO=1 (testes) fica só a lista curta de exemplo do base.json.
const ITENS_MESTRE = path.join(DATA_DIR, 'catalogo-itens.json');
const ITENS_PADRAO = path.join(SISTEMAS, 'itens.json');
const MONSTROS_PADRAO = path.join(SISTEMAS, 'monstros.json');
function arquivoItens() {
  if (process.env.ITENS_EXEMPLO) return null;
  return [ITENS_MESTRE, ITENS_PADRAO].find(a => fs.existsSync(a)) || null;
}

const ler = arq => JSON.parse(fs.readFileSync(arq, 'utf8'));

// Mescla objetos recursivamente; listas e valores simples do sistema substituem os da base.
function mesclar(base, extra) {
  if (extra === undefined) return base;
  if (base && extra && typeof base === 'object' && typeof extra === 'object' && !Array.isArray(base) && !Array.isArray(extra)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(extra)) out[k] = mesclar(base[k], v);
    return out;
  }
  return extra;
}

function arquivos(id) {
  return [path.join(SISTEMAS, 'base.json'), path.join(SISTEMAS, `${id}.json`),
    ...['pericias', 'profissoes', 'classes', 'vantagens'].map(n => path.join(SISTEMAS, id, `${n}.json`)),
    path.join(SISTEMAS, 'habilidades-regras.json')];
}

export const idSistema = id => (IDS_SISTEMAS.includes(id) ? id : SISTEMA_PADRAO);

// Regras de um sistema (MSA ou MSS). Relê os arquivos sempre que algum muda.
export function sistema(id = SISTEMA_PADRAO) {
  id = idSistema(id);
  const lista = arquivos(id);
  const arqItens = arquivoItens();
  // Livro dos Monstros: o enviado pelo mestre (data/), senão o do autor (conteudo/sistemas/monstros.json).
  // Nos testes (ITENS_EXEMPLO=1) ficam só os exemplos do base.json.
  const arqMonstros = fs.existsSync(ARQ_MONSTROS) ? ARQ_MONSTROS : !process.env.ITENS_EXEMPLO && fs.existsSync(MONSTROS_PADRAO) ? MONSTROS_PADRAO : null;
  const assinatura = [...lista, ...(arqItens ? [arqItens] : []), ...(arqMonstros ? [arqMonstros] : [])].map(a => `${a}:${fs.statSync(a).mtimeMs}`).join('|');
  const atual = cache.get(id);
  if (atual && atual.assinatura === assinatura) return atual.dados;
  const [base, proprio, pericias, profissoes, classes, vantagens, habRegras] = lista.map(ler);
  const v = vantagens.dados;
  const { _aviso, ...habilidadesRegras } = habRegras;
  // Subperícias que só existem para quem tem certa habilidade (ex.: Sentidos › Ondas, do Receptor Neural).
  const listaPericias = pericias.dados.map(p => ({ ...p, subpericias: [...p.subpericias] }));
  for (const [chave, r] of Object.entries(habilidadesRegras)) {
    for (const sp of r.subpericias || []) {
      const per = listaPericias.find(p => p.id === sp.pericia);
      if (per && !per.subpericias.some(x => x.id === sp.id)) per.subpericias.push({ id: sp.id, nome: sp.nome, descricao: sp.descricao, exige: chave });
    }
  }
  const dados = {
    ...mesclar(base, proprio),
    habilidadesRegras,
    pericias: listaPericias,
    profissoes: profissoes.dados,
    classes: classes.dados,
    vantagens: v.gerais,
    defeitos: [...v.defeitosLeves, ...v.defeitosNormais],
    capacidades: v.capacidades,
  };
  // As colunas originais da planilha ("planilha") só servem para exportar de volta: não vão para o navegador.
  if (arqItens) dados.itens = ler(arqItens).itens.map(({ planilha, ...it }) => it);
  // Livro dos Monstros enviado pelo mestre por planilha (sem ele, os exemplos do base.json).
  if (arqMonstros) dados.monstros = ler(arqMonstros).monstros;
  cache.set(id, { assinatura, dados });
  return dados;
}

export function listaSistemas() {
  return IDS_SISTEMAS.map(id => {
    const s = sistema(id);
    return { id, nome: s.nome, nomeCompleto: s.nomeCompleto, descricao: s.descricao };
  });
}
