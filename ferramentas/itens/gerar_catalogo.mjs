// Gera conteudo/sistemas/itens.json a partir das planilhas de itens do autor (.xlsx ou .csv transcrito).
// Uso: node ferramentas/itens/gerar_catalogo.mjs conteudo/planilhas/itens-revisao conteudo/planilhas/itens/01-itens.csv
// (ou as planilhas .xlsx baixadas do Drive no lugar dos .csv transcritos)
// Regra: a revisão parcial tem prioridade; itens só da planilha original entram marcados "em revisão".
import fs from 'node:fs';
import path from 'node:path';
import { sistema } from '../../server/sistema.js';
import { converterLinha, lerPlanilhaItens, ARQ_PADRAO } from '../../server/itens.js';

const sis = sistema('mss');
const sem = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// CSV simples (aspas duplas, vírgula), suficiente para as transcrições.
function lerCsv(texto) {
  const linhas = []; let campo = ''; let linha = []; let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas.filter(l => l.some(x => x !== ''));
  return resto.map(l => Object.fromEntries(cab.map((c, i) => [c, l[i]])));
}

async function ler(origem, opcoes) {
  const arquivos = fs.statSync(origem).isDirectory() ? fs.readdirSync(origem).filter(f => /\.(csv|xlsx)$/.test(f) && !f.startsWith('_')).sort().map(f => path.join(origem, f)) : [origem];
  const itens = [];
  for (const a of arquivos) {
    if (a.endsWith('.xlsx')) itens.push(...await lerPlanilhaItens(fs.readFileSync(a), sis, opcoes));
    else for (const l of lerCsv(fs.readFileSync(a, 'utf8'))) { const it = converterLinha(l, sis, opcoes); if (it) itens.push(it); }
  }
  return new Map(itens.map(i => [i.id, i])); // "num ctrl" repetido: vale a última linha
}

const [revisaoDir, originalArq] = process.argv.slice(2);
const revisados = await ler(revisaoDir, { revisao: false });
const originais = await ler(originalArq, { revisao: true });
const nomesRevisados = new Set([...revisados.values()].map(i => sem(i.nome)));
const final = new Map(revisados);
let mesmos = 0, renomeados = 0;
for (const it of originais.values()) {
  if (nomesRevisados.has(sem(it.nome))) { mesmos++; continue; }
  if (final.has(it.id)) { it.id = `${it.id}a`; renomeados++; }
  final.set(it.id, it);
}
const itens = [...final.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
fs.writeFileSync(ARQ_PADRAO, JSON.stringify({ _fonte: 'Planilhas "Sistema MSS - itens revisao parcial 1" (prioridade) e "Sistema MSS - itens"', atualizadoEm: Date.now(), itens }, null, 0));
const cont = {};
for (const i of itens) cont[i.tipo] = (cont[i.tipo] || 0) + 1;
console.log({ revisados: revisados.size, originais: originais.size, jaNaRevisao: mesmos, idsRenomeados: renomeados, total: itens.length, porTipo: cont,
  armasSemPericia: itens.filter(i => i.tipo === 'arma' && !i.pericia).length, comIP: itens.filter(i => i.defesa).length });
