// Passar do tempo e clima (livro: "Necessidades (Sobrevivência)" e "Caos meteorológico").
// O mestre avança o relógio de 6 em 6 horas; cada personagem-jogador conta as horas sem comer, sem beber e sem dormir:
// · Fome: 24 h sem comer → teste de CONS% ND 90 (sem comer, +10 no ND a cada 2 h); com fome, acumula a cada 24 h.
// · Sede: 24 h sem beber → Sede; sem beber, acumula a cada 12 h. Beber tira na hora.
// · Sono: 24 h sem descanso longo → Sono; acumula a cada 24 h. Some com 4 h seguidas de sono (descanso longo).
import { condicoesAtivas, testeDMil } from './regras.js';

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
  const notas = [];
  n.comida += horas;
  n.agua += horas;
  n.sono += horas;
  // Sede
  if (n.agua >= 24) {
    const novas = acumularAte(p, sistema, 'sede', 1 + Math.floor((n.agua - 24) / 12));
    if (novas) notas.push(`Sede${qtd(p, sistema, 'sede') > 1 ? ` ×${qtd(p, sistema, 'sede')}` : ''} (${n.agua} h sem beber)`);
  }
  // Fome
  if (n.comida >= 24) {
    if (!qtd(p, sistema, 'fome')) {
      const nd = 90 + 10 * Math.floor((n.comida - 24) / 2);
      const t = testeDMil(percentualCONS, nd, sistema, { rng });
      if (t.sucesso) notas.push(`${n.comida} h sem comer: CONS% ${t.total} × ND ${nd} — aguentou a fome`);
      else {
        acumularAte(p, sistema, 'fome', 1);
        n.fomeDesde = n.comida;
        notas.push(`${n.comida} h sem comer: CONS% ${t.total} × ND ${nd} — ficou com Fome`);
      }
    } else {
      const novas = acumularAte(p, sistema, 'fome', 1 + Math.floor((n.comida - (n.fomeDesde ?? 24)) / 24));
      if (novas) notas.push(`Fome ×${qtd(p, sistema, 'fome')} (${n.comida} h sem comer)`);
    }
  }
  // Sono
  if (n.sono >= 24) {
    const novas = acumularAte(p, sistema, 'sono', Math.floor(n.sono / 24));
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

