import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, DATA_DIR } from './db.js';
import { ARQ_MONSTROS } from './monstros.js';
import { ARQ_HABILIDADES } from './habilidadesPlanilha.js';
import { ARQ_MUTACOES } from './mutacoesPlanilha.js';
import { ARQ_PROFISSOES } from './profissoesPlanilha.js';
import { ARQ_ARMADILHAS } from './armadilhasPlanilha.js';
import { ARQ_APRIMORAMENTOS } from './aprimoramentosPlanilha.js';
import { ARQ_CIBERNETICOS } from './ciberneticosPlanilha.js';
const CIBERNETICOS_PADRAO = path.join(RAIZ, 'conteudo', 'sistemas', 'ciberneticos.json');
const APRIMORAMENTOS_PADRAO = path.join(RAIZ, 'conteudo', 'sistemas', 'aprimoramentos.json');
const ARMADILHAS_PADRAO = path.join(RAIZ, 'conteudo', 'sistemas', 'armadilhas.json');

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
    path.join(SISTEMAS, 'habilidades-regras.json'), path.join(SISTEMAS, 'mutacoes.json')];
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
  // Habilidades por planilha do mestre (classes, vantagens, defeitos, capacidades e as regras do app).
  const arqHabilidades = fs.existsSync(ARQ_HABILIDADES) ? ARQ_HABILIDADES : null;
  // Tabela de mutações por planilha do mestre.
  const arqMutacoes = fs.existsSync(ARQ_MUTACOES) ? ARQ_MUTACOES : null;
  const arqProfissoes = fs.existsSync(ARQ_PROFISSOES) ? ARQ_PROFISSOES : null;
  // Armadilhas (prontas e tabelas de montar): a planilha do mestre ou a tabela do autor.
  const arqArmadilhas = fs.existsSync(ARQ_ARMADILHAS) ? ARQ_ARMADILHAS : fs.existsSync(ARMADILHAS_PADRAO) ? ARMADILHAS_PADRAO : null;
  // Aprimoramentos de itens: a planilha do mestre ou a lista do livro.
  const arqAprimoramentos = fs.existsSync(ARQ_APRIMORAMENTOS) ? ARQ_APRIMORAMENTOS : fs.existsSync(APRIMORAMENTOS_PADRAO) ? APRIMORAMENTOS_PADRAO : null;
  // Cibernéticos (o que é próprio dos implantes do catálogo de itens): a planilha do mestre ou a tabela padrão.
  const arqCiberneticos = fs.existsSync(ARQ_CIBERNETICOS) ? ARQ_CIBERNETICOS : fs.existsSync(CIBERNETICOS_PADRAO) ? CIBERNETICOS_PADRAO : null;
  const assinatura = [...lista, ...[arqItens, arqMonstros, arqHabilidades, arqMutacoes, arqProfissoes, arqArmadilhas, arqAprimoramentos, arqCiberneticos].filter(Boolean)].map(a => `${a}:${fs.statSync(a).mtimeMs}`).join('|');
  const atual = cache.get(id);
  if (atual && atual.assinatura === assinatura) return atual.dados;
  const [base, proprio, pericias, profissoes, classesArq, vantagens, habRegras, mutacoes] = lista.map(ler);
  let v = vantagens.dados;
  let { _aviso, ...habilidadesRegras } = habRegras;
  let classes = classesArq.dados;
  if (arqHabilidades) {
    const cat = ler(arqHabilidades);
    const doSis = cat.sistemas?.[id];
    if (doSis?.classes) classes = doSis.classes;
    if (doSis?.vantagens) v = doSis.vantagens;
    if (cat.regras) habilidadesRegras = cat.regras;
  }
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
    // Profissões por planilha do mestre (cada sistema com as suas).
    profissoes: (arqProfissoes && ler(arqProfissoes).sistemas?.[id]) || profissoes.dados,
    classes,
    vantagens: v.gerais,
    defeitos: [...v.defeitosLeves, ...v.defeitosNormais],
    capacidades: v.capacidades,
    // Tabela de mutações (d100), igual no MSA e no MSS.
    mutacoes: arqMutacoes ? ler(arqMutacoes).mutacoes : mutacoes.mutacoes,
    ciberneticos: arqCiberneticos ? (({ atualizadoEm, arquivo, googleSheets, _fonte, total, ...t }) => t)(ler(arqCiberneticos)) : null,
    aprimoramentos: arqAprimoramentos ? ler(arqAprimoramentos).aprimoramentos : [],
    armadilhas: arqArmadilhas ? (({ atualizadoEm, arquivo, googleSheets, _fonte, total, ...t }) => t)(ler(arqArmadilhas)) : null,
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
