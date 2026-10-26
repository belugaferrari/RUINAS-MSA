// IA para textos de mesa (cenário do encontro aleatório). O mestre escolhe o provedor na aba Campanha:
// · Gemini (Google AI Studio): chave grátis, com cota diária.
// · Ollama: IA instalada no próprio PC (grátis, sem internet, mais lenta).
// · Claude (Anthropic): pago por uso, melhor texto.
// A configuração (com as chaves) fica em data/ia.json, só neste PC: nunca vai para o navegador nem para os jogadores.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';

const ARQ = path.join(DATA_DIR, 'ia.json');
export const PROVEDORES = ['nenhum', 'gemini', 'ollama', 'claude'];
const PADRAO = { provedor: 'nenhum', gemini: { chave: '', modelo: 'gemini-2.5-flash' }, ollama: { url: 'http://localhost:11434', modelo: 'llama3.1', modeloVisao: 'llama3.2-vision' }, claude: { chave: '', modelo: 'claude-opus-5-5' } };

export function lerConfigIA() {
  try {
    const c = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
    return { ...PADRAO, ...c, gemini: { ...PADRAO.gemini, ...c.gemini }, ollama: { ...PADRAO.ollama, ...c.ollama }, claude: { ...PADRAO.claude, ...c.claude } };
  } catch { return structuredClone(PADRAO); }
}

// O que o navegador do mestre vê: sem as chaves (só se estão preenchidas).
export function configPublica() {
  const c = lerConfigIA();
  return {
    provedor: c.provedor,
    gemini: { modelo: c.gemini.modelo, temChave: !!c.gemini.chave },
    ollama: { url: c.ollama.url, modelo: c.ollama.modelo, modeloVisao: c.ollama.modeloVisao },
    claude: { modelo: c.claude.modelo, temChave: !!c.claude.chave },
  };
}

// Chave em branco = mantém a que já estava (o navegador nunca recebe a chave de volta).
export function salvarConfigIA(novo = {}) {
  const c = lerConfigIA();
  if (PROVEDORES.includes(novo.provedor)) c.provedor = novo.provedor;
  const txt = (v, max = 300) => String(v ?? '').trim().slice(0, max);
  for (const p of ['gemini', 'claude']) {
    if (txt(novo[p]?.chave)) c[p].chave = txt(novo[p].chave);
    if (novo[p]?.apagarChave) c[p].chave = '';
    if (txt(novo[p]?.modelo, 80)) c[p].modelo = txt(novo[p].modelo, 80);
  }
  if (txt(novo.ollama?.url)) {
    if (!/^https?:\/\//i.test(txt(novo.ollama.url))) throw new Error('Endereço do Ollama inválido (ex.: http://localhost:11434).');
    c.ollama.url = txt(novo.ollama.url).replace(/\/+$/, '');
  }
  if (txt(novo.ollama?.modelo, 80)) c.ollama.modelo = txt(novo.ollama.modelo, 80);
  if (txt(novo.ollama?.modeloVisao, 80)) c.ollama.modeloVisao = txt(novo.ollama.modeloVisao, 80);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ARQ, JSON.stringify(c, null, 1));
  return configPublica();
}

const TEMPO = 60_000;

async function gemini(cfg, sistemaTxt, pedido) {
  if (!cfg.chave) throw new Error('Falta a chave do Gemini (aba Campanha > Inteligência artificial).');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.modelo)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(TEMPO),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.chave },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistemaTxt }] }, contents: [{ role: 'user', parts: [{ text: pedido }] }] }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429) throw new Error('A cota grátis do Gemini acabou por agora. Tente mais tarde ou use o cenário sem IA.');
  if (!r.ok) throw new Error(`O Gemini recusou o pedido: ${d.error?.message || r.status}`);
  const texto = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!texto) throw new Error('O Gemini não devolveu texto (pode ter bloqueado o pedido). Tente de novo.');
  return texto;
}

async function ollama(cfg, sistemaTxt, pedido) {
  let r;
  try {
    r = await fetch(`${cfg.url}/api/chat`, {
      method: 'POST', signal: AbortSignal.timeout(TEMPO * 3),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.modelo, stream: false, messages: [{ role: 'system', content: sistemaTxt }, { role: 'user', content: pedido }] }),
    });
  } catch { throw new Error(`Não achei o Ollama em ${cfg.url}. Ele está instalado e aberto neste PC?`); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`O Ollama recusou: ${d.error || r.status} (o modelo "${cfg.modelo}" foi baixado? No terminal: ollama pull ${cfg.modelo})`);
  const texto = String(d.message?.content || '').trim();
  if (!texto) throw new Error('O Ollama não devolveu texto.');
  return texto;
}

async function claude(cfg, sistemaTxt, pedido) {
  if (!cfg.chave) throw new Error('Falta a chave da Anthropic (aba Campanha > Inteligência artificial).');
  let Anthropic;
  try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); } catch { throw new Error('Falta instalar o pacote da Anthropic: use "Atualizar agora" (ele instala as dependências).'); }
  const client = new Anthropic({ apiKey: cfg.chave, timeout: TEMPO * 2, maxRetries: 1 });
  try {
    // Texto curto: esforço baixo. Se o modelo recusar por segurança, o servidor tenta outro modelo sozinho (fallbacks).
    const resposta = await client.beta.messages.create({
      model: cfg.modelo, max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low' },
      system: sistemaTxt,
      messages: [{ role: 'user', content: pedido }],
    });
    if (resposta.stop_reason === 'refusal') throw new Error('O Claude recusou este pedido. Use o cenário sem IA ou tente de novo.');
    const texto = resposta.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!texto) throw new Error('O Claude não devolveu texto.');
    return texto;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('A chave da Anthropic não foi aceita. Confira em console.anthropic.com.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Limite de uso da Anthropic atingido. Tente daqui a pouco.');
    if (e instanceof Anthropic.APIError) throw new Error(`A Anthropic recusou o pedido (${e.status}): ${e.message}`);
    throw e;
  }
}

// Gera o texto com o provedor configurado. Sem provedor ("nenhum"), quem chama usa a versão sem IA.
export async function gerarTexto(sistemaTxt, pedido) {
  const c = lerConfigIA();
  if (c.provedor === 'gemini') return { texto: await gemini(c.gemini, sistemaTxt, pedido), fonte: `Gemini (${c.gemini.modelo})` };
  if (c.provedor === 'ollama') return { texto: await ollama(c.ollama, sistemaTxt, pedido), fonte: `Ollama (${c.ollama.modelo})` };
  if (c.provedor === 'claude') return { texto: await claude(c.claude, sistemaTxt, pedido), fonte: `Claude (${c.claude.modelo})` };
  throw new Error('Nenhuma IA configurada (aba Campanha > Inteligência artificial).');
}

// ---------- Ler uma imagem e devolver JSON (mapa → objetos) ----------
// imagem: { data (base64), mime }. Devolve o objeto JSON que a IA escreveu (o chamador valida).
const lerJson = t => {
  const limpo = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(limpo); } catch { /* tenta achar o objeto no meio do texto */ }
  const m = /\{[\s\S]*\}/.exec(limpo);
  if (m) { try { return JSON.parse(m[0]); } catch { /* cai no erro */ } }
  throw new Error('A IA não devolveu uma lista válida. Tente de novo.');
};
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function lerImagemJson(sistemaTxt, pedido, imagem, esquema) {
  if (!imagem?.data || !MIMES.includes(imagem.mime)) throw new Error('Imagem do mapa inválida (use PNG, JPG ou WEBP).');
  const c = lerConfigIA();
  if (c.provedor === 'gemini') {
    if (!c.gemini.chave) throw new Error('Falta a chave do Gemini (aba Campanha > Inteligência artificial).');
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.gemini.modelo)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(TEMPO * 2),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.gemini.chave },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sistemaTxt }] },
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: imagem.mime, data: imagem.data } }, { text: pedido }] }],
        generationConfig: { responseMimeType: 'application/json' } }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) throw new Error('A cota grátis do Gemini acabou por agora. Tente mais tarde.');
    if (!r.ok) throw new Error(`O Gemini recusou o pedido: ${d.error?.message || r.status}`);
    return { dados: lerJson((d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')), fonte: `Gemini (${c.gemini.modelo})` };
  }
  if (c.provedor === 'ollama') {
    let r;
    try {
      r = await fetch(`${c.ollama.url}/api/chat`, {
        method: 'POST', signal: AbortSignal.timeout(TEMPO * 5), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: c.ollama.modeloVisao, stream: false, format: 'json',
          messages: [{ role: 'system', content: sistemaTxt }, { role: 'user', content: pedido, images: [imagem.data] }] }),
      });
    } catch { throw new Error(`Não achei o Ollama em ${c.ollama.url}. Ele está instalado e aberto neste PC?`); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`O Ollama recusou: ${d.error || r.status} (o modelo de imagem "${c.ollama.modeloVisao}" foi baixado? No terminal: ollama pull ${c.ollama.modeloVisao})`);
    return { dados: lerJson(d.message?.content), fonte: `Ollama (${c.ollama.modeloVisao})` };
  }
  if (c.provedor === 'claude') {
    if (!c.claude.chave) throw new Error('Falta a chave da Anthropic (aba Campanha > Inteligência artificial).');
    let Anthropic;
    try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); } catch { throw new Error('Falta instalar o pacote da Anthropic: use "Atualizar agora".'); }
    const client = new Anthropic({ apiKey: c.claude.chave, timeout: TEMPO * 4, maxRetries: 1 });
    try {
      // Ler um mapa pede mais cuidado que um parágrafo: esforço médio. A resposta segue o esquema (structured outputs).
      const resposta = await client.beta.messages.create({
        model: c.claude.modelo, max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema } },
        system: sistemaTxt,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: imagem.mime, data: imagem.data } },
          { type: 'text', text: pedido },
        ] }],
      });
      if (resposta.stop_reason === 'refusal') throw new Error('O Claude recusou ler esta imagem.');
      if (resposta.stop_reason === 'max_tokens') throw new Error('A lista ficou longa demais. Tente com um mapa menor ou com menos detalhes.');
      return { dados: lerJson(resposta.content.filter(b => b.type === 'text').map(b => b.text).join('')), fonte: `Claude (${c.claude.modelo})` };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new Error('A chave da Anthropic não foi aceita. Confira em console.anthropic.com.');
      if (e instanceof Anthropic.RateLimitError) throw new Error('Limite de uso da Anthropic atingido. Tente daqui a pouco.');
      if (e instanceof Anthropic.APIError) throw new Error(`A Anthropic recusou o pedido (${e.status}): ${e.message}`);
      throw e;
    }
  }
  throw new Error('Nenhuma IA configurada (aba Campanha > Inteligência artificial).');
}
