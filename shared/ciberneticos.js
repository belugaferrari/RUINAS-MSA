// Cibernéticos (regras implícitas na classe Ciborgue e respostas do autor, 30/10). Os implantes são itens do catálogo
// (tipo "cibernetico"); a tabela de cibernéticos completa o que é próprio de implante (tipo, local, Humanidade…).

// Implantes do catálogo com os dados da tabela (sem linha na tabela: Humanidade padrão).
export function implantesDoCatalogo(sistema) {
  const tab = sistema.ciberneticos || {};
  const porItem = new Map((tab.implantes || []).map(x => [x.item, x]));
  const padrao = tab.regras?.humanidadePorImplante ?? -10;
  return (sistema.itens || []).filter(i => i.tipo === 'cibernetico').map(i => {
    const x = porItem.get(i.id) || {};
    return { ...x, item: i.id, nome: i.nome, efeitos: i.efeitos || '', descricao: i.descricao || '', humanidade: x.humanidade ?? padrao, local: x.local ?? i.subcategoria ?? '' };
  });
}

// Quantos implantes o personagem pode ter: 1 (qualquer um); Ciborgue: no nível 3 um a mais e +1 a cada 4 níveis (até 6).
export function limiteImplantes(ficha, sistema) {
  const r = sistema.ciberneticos?.regras || {};
  const normal = r.limiteNormal ?? 1;
  const ciborgue = sistema.classes?.find(c => c.id === ficha.classe)?.nome === 'Ciborgue' && (ficha.nivel || 1) >= 3;
  if (!ciborgue) return normal;
  const extra = Math.floor(((ficha.nivel || 1) - 3) / (r.ciborgueACadaNiveis ?? 4));
  return Math.min(r.ciborgueMaximo ?? 6, (r.ciborgueNoNivel3 ?? normal + 1) + extra);
}
