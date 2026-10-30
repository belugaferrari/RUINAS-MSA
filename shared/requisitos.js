// Pré-requisitos dos itens (coluna "Pré requisitos" da planilha de itens): "Nível 3", "FOR 14", "CON 12", "Medicina > 50",
// "Pilotagem 30%". Quem não atende usa a arma com −30% (Mestre de Armas: −15% nas armas de fogo), sem dano crítico, e
// ela trava se errar (autor, 30/10). O que o app não entende ("Energia Alta", "Bateria") fica só como texto.
import { derivados } from './regras.js';

const sem = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const SIGLA = { for: 'FOR', forca: 'FOR', con: 'CONS', cons: 'CONS', constituicao: 'CONS', agi: 'AGI', agilidade: 'AGI', des: 'DES', dex: 'DES', destreza: 'DES',
  int: 'INT', inteligencia: 'INT', per: 'PER', percepcao: 'PER', car: 'CAR', carisma: 'CAR', will: 'WILL', vontade: 'WILL' };

export function requisitosDoItem(item, sistema) {
  const out = [];
  for (const parte of String(item?.requisitos || '').split(/[;,/]| e /).map(x => x.trim()).filter(Boolean)) {
    const n = /^n[ií]vel\s*(\d+)/i.exec(parte);
    if (n) { out.push({ tipo: 'nivel', valor: Number(n[1]), texto: parte }); continue; }
    const a = /^([A-Za-zÀ-ú]+)\s*(\d+)$/.exec(parte);
    if (a && SIGLA[sem(a[1])]) { out.push({ tipo: 'atributo', alvo: SIGLA[sem(a[1])], valor: Number(a[2]), texto: parte }); continue; }
    const p = /^(?:per[ií]cia\s+)?([A-Za-zÀ-ú ]+?)\s*(?:>|≥|>=)?\s*(\d+)\s*%?$/i.exec(parte);
    const nome = p ? sem(p[1]) : '';
    const per = p && (sistema?.pericias || []).find(x => sem(x.nome) === nome || sem(x.nome).startsWith(nome));
    if (per) { out.push({ tipo: 'pericia', alvo: per.id, valor: Number(p[2]), texto: parte }); continue; }
    // Subperícia pelo nome ("Ocultismo > 20", "Perícia Pistolas > 30", "Pilotagem 30%").
    const sub = p && (sistema?.pericias || []).flatMap(x => x.subpericias).find(x => sem(x.nome) === nome || sem(x.nome).startsWith(nome) || (nome.length >= 5 && nome.startsWith(sem(x.nome))));
    if (sub) { out.push({ tipo: 'subpericia', alvo: sub.id, valor: Number(p[2]), texto: parte }); continue; }
    out.push({ tipo: 'texto', texto: parte });
  }
  return out;
}

// O que falta para usar o item sem penalidade (lista vazia = atende). Os que o app não entende não contam.
export function requisitosQueFaltam(p, sistema, item) {
  const req = requisitosDoItem(item, sistema);
  if (!req.length) return [];
  const d = derivados(p, sistema);
  return req.filter(r => (r.tipo === 'nivel' && (p.nivel || 1) < r.valor) || (r.tipo === 'atributo' && (d.atributos[r.alvo] ?? 0) < r.valor)
    || (r.tipo === 'pericia' && (d.pericias[r.alvo] ?? 0) < r.valor) || (r.tipo === 'subpericia' && (d.subpericias[r.alvo] ?? 0) < r.valor)).map(r => r.texto);
}
