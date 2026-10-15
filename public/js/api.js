/* global io */
const CHAVE = 'msa.sessao';

export const sessao = {
  obter() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) || sessionStorage.getItem(CHAVE) || 'null');
    } catch {
      return null;
    }
  },
  // "Lembrar neste dispositivo" guarda só o token de acesso (nunca a senha).
  salvar(s, lembrar) {
    try {
      (lembrar ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(s));
    } catch { /* navegador sem armazenamento: segue só na memória */ }
  },
  limpar() {
    try {
      localStorage.removeItem(CHAVE);
      sessionStorage.removeItem(CHAVE);
    } catch { /* ignore */ }
  },
};

function cabecalhos() {
  const s = sessao.obter();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

async function tratar(res) {
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(corpo.erro || `Erro ${res.status}`);
  return corpo;
}

export const get = url => fetch(url, { headers: cabecalhos() }).then(tratar);
export const post = (url, corpo) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos() }, body: JSON.stringify(corpo || {}) }).then(tratar);
// Baixa um arquivo que exige login (o token vai no cabeçalho, não no endereço).
export async function baixarArquivo(url, nome) {
  const r = await fetch(url, { headers: cabecalhos() });
  if (!r.ok) throw new Error((await r.text()) || 'Não foi possível baixar.');
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: nome });
  document.body.append(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
}
export const enviarArquivo = (url, form) => fetch(url, { method: 'POST', headers: cabecalhos(), body: form }).then(tratar);

export let socket = null;

export function conectar(token, eventos) {
  socket?.disconnect();
  socket = io({ auth: { token } });
  for (const [nome, fn] of Object.entries(eventos)) socket.on(nome, fn);
  return socket;
}

export function emitir(evento, dados) {
  return new Promise((ok, falha) => {
    if (!socket) return falha(new Error('Sem conexão.'));
    socket.timeout(10000).emit(evento, dados, (err, r) => {
      if (err) return falha(new Error('O servidor não respondeu. Verifique a conexão.'));
      if (!r.ok) return falha(new Error(r.erro));
      ok(r.dados);
    });
  });
}

export const acao = (tipo, dados) => emitir('acao', { tipo, dados });
