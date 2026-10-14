import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './db.js';

export const CONTEUDO = path.join(RAIZ, 'conteudo');
const ARQ = path.join(CONTEUDO, 'sistema.json');
const MSA = path.join(CONTEUDO, 'msa');
let cache = null;
let assinatura = '';

const arquivos = () => [ARQ, ...['pericias', 'profissoes', 'classes', 'vantagens'].map(n => path.join(MSA, `${n}.json`))];
const ler = arq => JSON.parse(fs.readFileSync(arq, 'utf8'));
const dadosMsa = nome => ler(path.join(MSA, `${nome}.json`)).dados;

// Relê o conteúdo sempre que algum arquivo muda — dá pra editar as regras com o app rodando.
export function sistema() {
  const atual = arquivos().map(a => fs.statSync(a).mtimeMs).join('|');
  if (!cache || atual !== assinatura) {
    const vantagens = dadosMsa('vantagens');
    cache = {
      ...ler(ARQ),
      pericias: dadosMsa('pericias'),
      profissoes: dadosMsa('profissoes'),
      classes: dadosMsa('classes'),
      vantagens: vantagens.gerais,
      defeitos: [...vantagens.defeitosLeves, ...vantagens.defeitosNormais],
      capacidades: vantagens.capacidades,
    };
    assinatura = atual;
  }
  return cache;
}
