// Passar do tempo e clima (livro: "Necessidades (Sobrevivência)" e "Caos meteorológico").
// O mestre avança o relógio de 6 em 6 horas; cada personagem-jogador conta as horas sem comer, sem beber e sem dormir:
// · Fome: 24 h sem comer → teste de CONS% ND 90 (sem comer, +10 no ND a cada 2 h); com fome, acumula a cada 24 h.
// · Sede: 24 h sem beber → Sede; sem beber, acumula a cada 12 h. Beber tira na hora.
// · Sono: 24 h sem descanso longo → Sono; acumula a cada 24 h. Some com 4 h seguidas de sono (descanso longo).
import { condicoesAtivas, testeDMil, listaHabilidades } from './regras.js';

// Tabela do livro (2º d20 do caos meteorológico).
export const CLIMAS = [
  { de: 1, ate: 1, nome: 'Tormenta', intempere: true, texto: 'Nevascas, inundações, furacões, avalanche.' },
  { de: 2, ate: 4, nome: 'Frio intenso', intempere: true, texto: 'Geadas, tufões, chuvas, granizo, trombas d’água.' },
  { de: 5, ate: 16, nome: 'Clima ameno', intempere: false, texto: 'Clima comum, com chuvas e ventos esporádicos.' },
  { de: 17, ate: 19, nome: 'Calor intenso', intempere: true, texto: 'Ventos, ondas, chuvas, neblinas, deslizamentos.' },
  { de: 20, ate: 20, nome: 'Tormenta', intempere: true, texto: 'Terremotos, erupções, tsunamis, pragas, deslizamentos.' },
];

// Caos meteorológico: 2d20 — o 1º diz quantos dias o clima fica estável (1 a 20); o 2º, qual é o clima.
export function rolarCaos(rng = Math.random) {
  const dias = 1 + Math.floor(rng() * 20);
  const d = 1 + Math.floor(rng() * 20);
  const c = CLIMAS.find(x => d >= x.de && d <= x.ate);
  return { nome: c.nome, intempere: c.intempere, texto: c.texto, dias, dados: [dias, d] };
}

// Novo dia com o clima estável: 1d6; se der 1, o tempo muda inesperadamente e o caos é relançado.
// Quando os dias de estabilidade acabam, também relança.
export function climaDoDia(clima, rng = Math.random) {
  if (!clima || clima.dias <= 1) return { clima: rolarCaos(rng), mudou: true, motivo: clima ? 'a estabilidade acabou' : 'primeiro lançamento' };
  const d6 = 1 + Math.floor(rng() * 6);
  if (d6 === 1) return { clima: rolarCaos(rng), mudou: true, motivo: '1d6 deu 1: o tempo mudou inesperadamente', d6 };
  return { clima: { ...clima, dias: clima.dias - 1 }, mudou: false, d6 };
}

export const descreverRelogio = horas => `Dia ${Math.floor(horas / 24) + 1}, ${String(horas % 24).padStart(2, '0')}h`;

const condicao = (sistema, id) => (sistema.condicoes || []).find(c => c.id === id);
const qtd = (p, sistema, id) => condicoesAtivas(p, sistema).find(c => c.id === id)?.qtd || 0;
function acumularAte(p, sistema, id, alvo) {
  const c = condicao(sistema, id);
  if (!c) return 0;
  let n = 0;
  while (qtd(p, sistema, id) < alvo) { (p.marcadores ||= []).push(c.nome); n++; }
  return n;
}
function tirarTudo(p, sistema, id) {
  const c = condicao(sistema, id);
  if (!c) return false;
  const antes = (p.marcadores || []).length;
  const s = x => String(x).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  p.marcadores = (p.marcadores || []).filter(m => !s(m).startsWith(s(c.nome)));
  return p.marcadores.length !== antes;
}

// Avança "horas" para um personagem. percentualCONS = CONS% (para o teste da Fome).
export function passarNecessidades(p, sistema, horas, percentualCONS = 0, rng = Math.random) {
  const n = (p.necessidades ||= { comida: 0, agua: 0, sono: 0 });
  const m = regrasNecessidades(p, sistema);
  const teto = x => Math.min(x, m.acumuloMax);
  const notas = [];
  n.comida += horas;
  n.agua += horas;
  n.sono += horas;
  // Sede
  if (n.agua >= 24 && !m.imune.sede) {
    const novas = acumularAte(p, sistema, 'sede', teto(1 + Math.floor((n.agua - 24) / 12)));
    if (novas) notas.push(`Sede${qtd(p, sistema, 'sede') > 1 ? ` ×${qtd(p, sistema, 'sede')}` : ''} (${n.agua} h sem beber)`);
  }
  // Fome
  // Fome: a partir de 24 h (Absorver Nutrientes 36 h; Metabolismo Acelerado 12 h); Raquítico +25%; vantagem com Soldado de Campanha/Marcha.
  if (n.comida >= m.fomeHoras && !m.imune.fome) {
    if (!qtd(p, sistema, 'fome')) {
      const nd = 90 + 10 * Math.floor((n.comida - m.fomeHoras) / 2);
      const t = testeVantagem(percentualCONS + m.fomeBonus, nd, sistema, m.vantagemFadiga, rng);
      const como = `CONS% ${t.total} × ND ${nd}${t.vantagem ? ' com vantagem' : ''}`;
      if (t.sucesso) notas.push(`${n.comida} h sem comer: ${como} — aguentou a fome`);
      else {
        acumularAte(p, sistema, 'fome', 1);
        n.fomeDesde = n.comida;
        notas.push(`${n.comida} h sem comer: ${como} — ficou com Fome`);
      }
    } else {
      const novas = acumularAte(p, sistema, 'fome', teto(1 + Math.floor((n.comida - (n.fomeDesde ?? m.fomeHoras)) / 24)));
      if (novas) notas.push(`Fome ×${qtd(p, sistema, 'fome')} (${n.comida} h sem comer)`);
    }
  }
  // Sono
  if (n.sono >= 24 && !m.imune.sono) {
    const novas = acumularAte(p, sistema, 'sono', teto(Math.floor(n.sono / 24)));
    if (novas) notas.push(`Sono${qtd(p, sistema, 'sono') > 1 ? ` ×${qtd(p, sistema, 'sono')}` : ''} (${n.sono} h sem descanso longo; teste de CONS% ND 50 + 5 × hora, a cada hora, para não dormir)`);
  }
  return notas;
}

// Comeu (refeição ou descanso curto): zera a contagem e tira a Fome.
export function comer(p, sistema) {
  const n = (p.necessidades ||= { comida: 0, agua: 0, sono: 0 });
  n.comida = 0;
  delete n.fomeDesde;
  return tirarTudo(p, sistema, 'fome') ? 'comeu: a Fome passou' : 'comeu';
}
// Bebeu: zera a contagem e a Sede acaba na hora.
export function beber(p, sistema) {
  const n = (p.necessidades ||= { comida: 0, agua: 0, sono: 0 });
  n.agua = 0;
  return tirarTudo(p, sistema, 'sede') ? 'bebeu: a Sede passou' : 'bebeu';
}
// Dormiu ao menos 4 h seguidas (descanso longo não interrompido): zera a contagem e tira o Sono.
export function dormir(p, sistema) {
  const n = (p.necessidades ||= { comida: 0, agua: 0, sono: 0 });
  n.sono = 0;
  return tirarTudo(p, sistema, 'sono') ? 'dormiu: o Sono passou' : null;
}


// ---------- Vantagens, defeitos e habilidades que mudam as necessidades e o descanso ----------
const norm = x => String(x || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function regrasNecessidades(p, sistema) {
  const lista = [
    ...listaHabilidades(p, sistema),
    ...(p.defeitos || []).map(id => (sistema.defeitos || []).find(d => d.id === id)).filter(Boolean),
  ];
  const m = { fomeHoras: 24, imune: {}, acumuloMax: Infinity, fomeBonus: 0, vantagemFadiga: false, vantagemDoenca: false,
    curtoPv: 1, pvPorDado: 0, regenMetade: false, semOnusConfortoErgo: false, insonia: false, insoniaPos: false, fontes: [] };
  const tem = (nome, fn) => { for (const x of lista) if (norm(x.nome) === nome) { fn(x); m.fontes.push(x.nome); } };
  tem('absorver nutrientes', () => { m.fomeHoras = Math.max(m.fomeHoras, 36); m.curtoPv = Math.max(m.curtoPv, 2); });
  tem('metabolismo acelerado', x => {
    if (/12\s*horas/i.test(x.descricao)) m.fomeHoras = Math.min(m.fomeHoras, 12);
    if (/descanso curto,?\s*voc[eê] recupera 2/i.test(x.descricao)) { m.curtoPv = Math.max(m.curtoPv, 2); m.pvPorDado += 1; }
  });
  tem('apoteose sintetica', () => { m.imune = { fome: true, sede: true, sono: true }; });
  tem('mutacoes decrepitas', () => { m.acumuloMax = 1; });
  tem('raquitico', () => { m.fomeBonus += 25; });
  tem('soldado de campanha', () => { m.vantagemFadiga = true; m.vantagemDoenca = true; m.semOnusConfortoErgo = true; });
  tem('marcha', () => { m.vantagemFadiga = true; });
  tem('regeneracao lenta', () => { m.regenMetade = true; });
  tem('insonia', () => { m.insonia = true; });
  tem('insonia pos traumatica', () => { m.insoniaPos = true; });
  return m;
}

// Teste D-MIL com vantagem (rola duas vezes e fica com o melhor).
export function testeVantagem(acao, nd, sistema, vantagem, rng = Math.random) {
  const a = testeDMil(acao, nd, sistema, { rng });
  if (!vantagem) return a;
  const b = testeDMil(acao, nd, sistema, { rng });
  return (b.sucesso && !a.sucesso) || (b.sucesso === a.sucesso && b.total > a.total) ? { ...b, vantagem: true } : { ...a, vantagem: true };
}

// Fim do combate (livro): quem estava com efeitos de Necessidades faz um teste de CONS% difícil (ND 100);
// se falhar, fica Exausto e recebe um Marcador de Vulnerabilidade.
export function fimDoCombate(p, sistema, percentualCONS = 0, rng = Math.random) {
  delete p.emCombate;
  const necessidades = condicoesAtivas(p, sistema).filter(c => c.grupo === 'Necessidades');
  if (!necessidades.length) return null;
  const m = regrasNecessidades(p, sistema);
  const t = testeVantagem(percentualCONS, 100, sistema, m.vantagemFadiga, rng);
  const nomes = necessidades.map(c => c.nome).join(', ');
  if (t.sucesso) return `${p.nome} (${nomes}): CONS% ${t.total} × ND 100${t.vantagem ? ' com vantagem' : ''} — aguentou o fim do combate`;
  const exausto = condicao(sistema, 'exausto');
  const vul = condicao(sistema, 'vulnerabilidade');
  if (exausto && !qtd(p, sistema, 'exausto')) (p.marcadores ||= []).push(exausto.nome);
  if (vul) (p.marcadores ||= []).push(vul.nome);
  return `${p.nome} (${nomes}): CONS% ${t.total} × ND 100 — ficou Exausto e recebeu um Marcador de Vulnerabilidade`;
}
