// Relógio da campanha e clima, no topo da tela. O mestre passa o tempo de 6 em 6 horas (Fome, Sede e Sono
// dos personagens) e lança o caos meteorológico; os jogadores só veem o dia, a hora e o clima.
import { h, botao, icone, janela, aviso } from '../ui.js';
import { estado } from '../estado.js';
import { acao } from '../api.js';
import { descreverRelogio, CLIMAS } from '/shared/tempo.js';

const ICONE_CLIMA = { Tormenta: 'tornado', 'Frio intenso': 'thermometer-snowflake', 'Clima ameno': 'cloud-sun', 'Calor intenso': 'sun' };

export function relogioTopo(mestre) {
  const c = estado.campanha;
  const horas = c.relogio?.horas || 0;
  const k = c.clima;
  const chip = h('button', {
    type: 'button', class: `relogio-chip ${k?.intempere ? 'intempere' : ''}`, title: 'Tempo e clima', onclick: () => detalhes(mestre),
  }, icone('clock'), h('span', {}, descreverRelogio(horas)),
  k ? [h('span', { class: 'sep' }, '·'), icone(ICONE_CLIMA[k.nome] || 'cloud'), h('span', { class: 'clima-nome' }, k.nome)] : null);
  if (!mestre) return chip;
  return h('span', { class: 'relogio-topo' }, chip,
    botao('+6 h', passar, { class: 'pequeno compacto', icone: 'hourglass', title: 'Passar 6 horas (Fome, Sede e Sono dos personagens)', 'aria-label': 'Passar 6 horas' }));
}

async function passar() {
  const r = await acao('tempo.passar', { horas: 6 });
  const linhas = [...r.linhas, ...(r.clima ? [`Clima: ${r.clima.nome} (${r.clima.dias} dia(s))`] : [])];
  aviso(`${descreverRelogio(r.relogio.horas)}${linhas.length ? ` — ${linhas.join(' · ')}` : ' — ninguém sofreu com fome, sede ou sono.'}`);
}

function detalhes(mestre) {
  const c = estado.campanha;
  const k = c.clima;
  janela('Tempo e clima', h('div', { class: 'tempo-detalhes' },
    h('p', {}, icone('clock'), h('strong', {}, ` ${descreverRelogio(c.relogio?.horas || 0)}`)),
    k ? h('div', { class: `clima-cartao ${k.intempere ? 'intempere' : ''}` },
      h('strong', {}, icone(ICONE_CLIMA[k.nome] || 'cloud'), ` ${k.nome}${k.intempere ? ' — intempérie' : ''}`),
      h('p', {}, k.texto),
      h('small', {}, `Estável por mais ${k.dias} dia(s). A cada novo dia: 1d6; se der 1, o tempo muda e o caos é relançado.`))
      : h('p', { class: 'dica' }, 'O caos meteorológico ainda não foi lançado.'),
    mestre ? [
      h('div', { class: 'barra' },
        botao('Passar 6 horas', () => passar().then(() => detalhes(mestre)), { class: 'primario', icone: 'hourglass' }),
        botao('Caos meteorológico (2d20)', async () => {
          const r = await acao('clima.caos', {});
          aviso(`${r.clima.nome}: ${r.clima.texto} Estável por ${r.clima.dias} dia(s). [2d20: ${r.clima.dados.join(', ')}]`);
          detalhes(mestre);
        }, { icone: 'cloud-lightning' })),
      h('p', { class: 'dica' }, 'Passar o tempo conta as horas sem comer, sem beber e sem descanso longo de cada personagem-jogador: 24 h sem beber = Sede (+1 a cada 12 h); 24 h sem comer = teste de CONS% ND 90 (+10 a cada 2 h) para não ficar com Fome (+1 a cada 24 h); 24 h sem descanso longo = Sono (+1 a cada 24 h). Comer (ou o descanso curto), beber e o descanso longo zeram as contagens.'),
      h('details', {}, h('summary', {}, 'Tabela do caos (2º d20)'),
        h('ul', {}, CLIMAS.map(x => h('li', {}, `${x.de === x.ate ? x.de : `${x.de}–${x.ate}`}: ${x.nome}${x.intempere ? ' (intempérie)' : ''} — ${x.texto}`)))),
    ] : null), [['Fechar', () => true]]);
}
