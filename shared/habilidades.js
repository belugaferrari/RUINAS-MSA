// Vantagens e habilidades ativadas fazendo efeito: o app lê os números do texto do livro
// ("+5% em Sobrevivência", "Negociação +10%", "+5% em todos os testes", "FOR +1", "+5 PVs", "IP 3 contra Frio",
// "Dano +1", "+1d6 de dano") e aplica enquanto a habilidade estiver ativa. Ativar = o jogador diz que a condição
// do texto vale agora. O mestre pode corrigir o que o app entendeu escrevendo os efeitos no mesmo formato.

const semAcento = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SIGLAS = ['FOR', 'CONS', 'AGI', 'DES', 'INT', 'PER', 'CAR', 'WILL'];
const COMBATE = ['briga', 'arma-branca', 'armas-de-fogo'];

// Além dos números do texto, as regras próprias de cada habilidade (habilidades-regras.json) trazem:
// R.MNP, imunidades, vantagens (em testes, ataque, iniciativa), defesa extra (às vezes só contra certos tipos de criatura)
// e mudança na Humanidade máxima.
const vazio = () => ({ atributos: {}, testes: 0, pericias: {}, subpericias: {}, pv: 0, ip: { geral: 0, tipos: {} }, danoFixo: 0, danoDados: [], notas: [],
  rmnp: 0, imune: [], vantagens: [], defesas: [], humanidadeMax: 0 });

// Nomes de perícias e subperícias para achar no texto (os mais longos primeiro, para "Armas de Fogo" ganhar de "Armas").
function nomesDoSistema(sistema) {
  const lista = [];
  for (const p of sistema.pericias || []) {
    lista.push({ nome: semAcento(p.nome), tipo: 'pericia', id: p.id, rotulo: p.nome });
    for (const s of p.subpericias) lista.push({ nome: semAcento(s.nome), tipo: 'sub', id: s.id, rotulo: s.nome });
  }
  return lista.filter(x => x.nome.length >= 4).sort((a, b) => b.nome.length - a.nome.length);
}

export function efeitosDoTexto(texto, sistema, { tipoIp = () => null } = {}) {
  const r = vazio();
  if (!texto) return r;
  const t = String(texto);
  const ts = semAcento(t);
  const nomes = nomesDoSistema(sistema);
  const fmt = v => (v > 0 ? `+${v}` : `${v}`);

  // Atributos: "FOR +1", "+1 FOR" (sem %).
  for (const m of t.matchAll(/\b(FOR|CONS|AGI|DES|INT|PER|CAR|WILL)\s*([+-]\s*\d+)(?!\s*%|\d)/g)) {
    if (/MOD\s*$/i.test(t.slice(Math.max(0, m.index - 5), m.index))) continue;
    const v = parseInt(m[2].replace(/\s/g, ''), 10);
    r.atributos[m[1]] = (r.atributos[m[1]] || 0) + v;
    r.notas.push(`${m[1]} ${fmt(v)}`);
  }
  for (const m of t.matchAll(/([+-]\s*\d+)\s+(FOR|CONS|AGI|DES|INT|PER|CAR|WILL)\b(?!\s*%)/g)) {
    if (/cada\s*$/i.test(t.slice(Math.max(0, m.index - 8), m.index))) continue;
    const v = parseInt(m[1].replace(/\s/g, ''), 10);
    r.atributos[m[2]] = (r.atributos[m[2]] || 0) + v;
    r.notas.push(`${m[2]} ${fmt(v)}`);
  }

  // Porcentagens: todos os testes, acerto (ataques) ou a perícia/subperícia mais perto do número.
  for (const m of ts.matchAll(/([+-])\s*(\d+)\s*%/g)) {
    const v = parseInt(m[2], 10) * (m[1] === '-' ? -1 : 1);
    const depois = ts.slice(m.index + m[0].length, m.index + m[0].length + 70);
    const antes = ts.slice(Math.max(0, m.index - 45), m.index);
    const todos = /^\s*(?:em|nos|a)\s+todos\s+os\s+testes(?:\s+(?:de|da|do)\s+(?:pericia\s+(?:base\s+)?)?)?/.exec(depois);
    if (todos) {
      const nomeDepois = nomes.find(x => depois.slice(todos[0].length).startsWith(x.nome));
      if (nomeDepois && /\s(?:de|da|do)\s/.test(todos[0])) {
        const alvo = nomeDepois.tipo === 'pericia' ? r.pericias : r.subpericias;
        alvo[nomeDepois.id] = (alvo[nomeDepois.id] || 0) + v;
        r.notas.push(`${nomeDepois.rotulo} ${fmt(v)}%`);
      } else { r.testes += v; r.notas.push(`${fmt(v)}% em todos os testes`); }
      continue;
    }
    if (/^\s*(?:a\s+sua\s+|na\s+sua\s+|de\s+|no\s+)?(?:chance\s+de\s+)?acerto/.test(depois)) {
      for (const id of COMBATE) r.pericias[id] = (r.pericias[id] || 0) + v;
      r.notas.push(`${fmt(v)}% de acerto (Briga, Armas Brancas e Armas de Fogo)`);
      continue;
    }
    if (/^\s*(?:de\s+)?(?:defesa|margem|chance de critico|critico)/.test(depois)) continue;
    // Nome logo depois ("+10% em Furtividade", "+5% nos testes de Sentidos") ou logo antes ("Negociação +10%").
    const alvoDepois = /^\s*(?:em|no|na|nos|nas|de|a|ao)?\s*(?:testes?\s+(?:de|da|do)\s+)?(?:pericia\s+(?:base\s+)?)?/.exec(depois);
    const resto = depois.slice(alvoDepois[0].length);
    let achado = nomes.find(x => resto.startsWith(x.nome));
    if (!achado) {
      const fim = antes.replace(/[\s:([]+$/, '');
      achado = nomes.find(x => fim.endsWith(x.nome));
    }
    if (!achado) continue;
    const alvo = achado.tipo === 'pericia' ? r.pericias : r.subpericias;
    alvo[achado.id] = (alvo[achado.id] || 0) + v;
    r.notas.push(`${achado.rotulo} ${fmt(v)}%`);
  }

  // PV a mais: "+5 PVs", "receba +3 PV" (não conta "recupera 2 PVs por refeição" nem dano).
  for (const m of t.matchAll(/\+\s*(\d+)\s*PVs?\b(?!\s*(?:de dano|por|a cada|ao inv))/gi)) {
    if (/recupera|cura|regenera/i.test(t.slice(Math.max(0, m.index - 25), m.index))) continue;
    r.pv += parseInt(m[1], 10);
    r.notas.push(`+${m[1]} PV máximo`);
  }

  // IP: "IP 3 contra Frio", "+1 de IP Físico", "+1 IP elemental", "+1 IP geral".
  const addIp = (v, tipoTexto) => {
    const tipo = tipoTexto ? tipoIp(tipoTexto) : null;
    if (tipo) r.ip.tipos[tipo] = (r.ip.tipos[tipo] || 0) + v;
    else r.ip.geral += v;
    r.notas.push(`+${v} IP ${tipo || 'geral'}`);
  };
  for (const m of t.matchAll(/\bIP\s*\+?\s*(\d+)\s+contra\s+([A-Za-zÀ-ú]+(?:\s+de\s+[A-Za-zÀ-ú]+)?)/g)) addIp(parseInt(m[1], 10), m[2]);
  for (const m of t.matchAll(/\+\s*(\d+)\s*(?:de\s+)?IP\b(?:\s*\([^)]*\))?(?:\s+([A-Za-zÀ-ú]+))?/g)) addIp(parseInt(m[1], 10), m[2]);

  // Dano: "Dano +1", "+1 ao dano", "+1 de dano", "+1d6 de dano".
  for (const m of t.matchAll(/(?:\bdano\s*\+\s*(\d+)(?!\s*d\d)|\+\s*(\d+)\s+(?:(?:ao|de|no)\s+)?dano\b)/gi)) {
    const v = parseInt(m[1] || m[2], 10);
    r.danoFixo += v;
    r.notas.push(`dano +${v}`);
  }
  for (const m of t.matchAll(/\+\s*(\d*)\s*[dD](\d+)\s+(?:de\s+)?dano/g)) {
    const expr = `${m[1] || 1}d${m[2]}`;
    r.danoDados.push(expr);
    r.notas.push(`+${expr} de dano`);
  }
  // Formato do mestre (lápis) para o que não é número de perícia: "R.MNP +20", "imune: Dor", "vantagem: Briga › Deslocar, iniciativa".
  for (const m of t.matchAll(/\bR\.?\s?MNP\s*([+-]\s*\d+)/gi)) {
    const v = parseInt(m[1].replace(/\s/g, ''), 10);
    r.rmnp += v;
    r.notas.push(`R.MNP ${fmt(v)}`);
  }
  for (const m of t.matchAll(/\bimune\s*:\s*([^;]+)/gi)) {
    const nomesImune = m[1].split(/,|\se\s/).map(x => x.trim()).filter(Boolean);
    r.imune.push(...nomesImune);
    r.notas.push(`imune a ${nomesImune.join(', ')}`);
  }
  for (const m of t.matchAll(/\bvantagem\s*:\s*([^;]+)/gi)) {
    for (const parte of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
      const ps = semAcento(parte).replace(/[›>\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      const achado = nomesDoSistema(sistema).find(x => ps.endsWith(x.nome));
      const alvo = /iniciativa/.test(ps) ? 'iniciativa' : /ataque/.test(ps) && !achado ? 'ataque' : /todos/.test(ps) ? 'testes' : achado?.id;
      if (!alvo) continue;
      r.vantagens.push({ alvo, contra: null });
      r.notas.push(`vantagem em ${achado?.rotulo || parte}`);
    }
  }
  return r;
}

// Junta os campos das regras próprias (habilidades-regras.json) ao que veio do texto.
export function efeitosDaRegra(regra, base, sistema, rotulos = {}) {
  const r = base;
  const contra = regra.contra?.length ? regra.contra : null;
  const nomeContra = contra ? ` contra ${contra.map(id => rotulos.tipos?.[id] || id).join(' e ')}` : '';
  if (regra.rmnp) { r.rmnp += regra.rmnp; r.notas.push(`R.MNP ${regra.rmnp > 0 ? '+' : ''}${regra.rmnp}`); }
  if (regra.imune?.length) { r.imune.push(...regra.imune); r.notas.push(`imune a ${regra.imune.join(', ')}`); }
  if (regra.humanidadeMax) { r.humanidadeMax += regra.humanidadeMax; r.notas.push(`Humanidade máxima ${regra.humanidadeMax}`); }
  if (regra.vantagem?.length) {
    for (const alvo of regra.vantagem) r.vantagens.push({ alvo, contra });
    const nomes = regra.vantagem.map(a => ({ testes: 'todos os testes', ataque: 'ataques', iniciativa: 'iniciativa' }[a] || rotulos.sub?.(a) || a));
    r.notas.push(`vantagem em ${nomes.join(', ')}${nomeContra}`);
  }
  if (regra.defesa) { r.defesas.push({ valor: regra.defesa, contra }); r.notas.push(`defesa +${regra.defesa}%${nomeContra}`); }
  if (regra.texto) r.notas.push(regra.texto);
  return r;
}

export function somarEfeitos(lista) {
  const r = vazio();
  for (const x of lista) {
    for (const [k, v] of Object.entries(x.atributos)) r.atributos[k] = (r.atributos[k] || 0) + v;
    for (const [k, v] of Object.entries(x.pericias)) r.pericias[k] = (r.pericias[k] || 0) + v;
    for (const [k, v] of Object.entries(x.subpericias)) r.subpericias[k] = (r.subpericias[k] || 0) + v;
    for (const [k, v] of Object.entries(x.ip.tipos)) r.ip.tipos[k] = (r.ip.tipos[k] || 0) + v;
    r.testes += x.testes; r.pv += x.pv; r.ip.geral += x.ip.geral; r.danoFixo += x.danoFixo;
    r.danoDados.push(...x.danoDados); r.notas.push(...x.notas);
    r.rmnp += x.rmnp || 0; r.humanidadeMax += x.humanidadeMax || 0;
    r.imune.push(...(x.imune || [])); r.vantagens.push(...(x.vantagens || [])); r.defesas.push(...(x.defesas || []));
  }
  return r;
}

export { SIGLAS };
