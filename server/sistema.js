import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './db.js';

export const CONTEUDO = path.join(RAIZ, 'conteudo');
const SISTEMAS = path.join(CONTEUDO, 'sistemas');
export const SISTEMA_PADRAO = 'msa';
export const IDS_SISTEMAS = ['msa', 'mss'];

const cache = new Map();

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
    ...['pericias', 'profissoes', 'classes', 'vantagens'].map(n => path.join(SISTEMAS, id, `${n}.json`))];
}

export const idSistema = id => (IDS_SISTEMAS.includes(id) ? id : SISTEMA_PADRAO);

// Regras de um sistema (MSA ou MSS). Relê os arquivos sempre que algum muda.
export function sistema(id = SISTEMA_PADRAO) {
  id = idSistema(id);
  const lista = arquivos(id);
  const assinatura = lista.map(a => fs.statSync(a).mtimeMs).join('|');
  const atual = cache.get(id);
  if (atual && atual.assinatura === assinatura) return atual.dados;
  const [base, proprio, pericias, profissoes, classes, vantagens] = lista.map(ler);
  const v = vantagens.dados;
  const dados = {
    ...mesclar(base, proprio),
    pericias: pericias.dados,
    profissoes: profissoes.dados,
    classes: classes.dados,
    vantagens: v.gerais,
    defeitos: [...v.defeitosLeves, ...v.defeitosNormais],
    capacidades: v.capacidades,
  };
  cache.set(id, { assinatura, dados });
  return dados;
}

export function listaSistemas() {
  return IDS_SISTEMAS.map(id => {
    const s = sistema(id);
    return { id, nome: s.nome, nomeCompleto: s.nomeCompleto, descricao: s.descricao };
  });
}
