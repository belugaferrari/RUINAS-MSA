# Extrai o texto do .docx marcando grifos amarelos e quebras de página.
import sys, re, zipfile
from lxml import etree
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns = {'w': W}
z = zipfile.ZipFile(sys.argv[1])
# Com "--imagens", cada imagem sai como [IMAGEM:arquivo] (usado pelo Livro de Regras do app).
COM_IMAGENS = '--imagens' in sys.argv
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
rels = {r.get('Id'): r.get('Target').split('/')[-1]
        for r in etree.fromstring(z.read('word/_rels/document.xml.rels'))}

def imagem(el):
    if not COM_IMAGENS: return '[IMAGEM]'
    for b in el.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
        alvo = rels.get(b.get(f'{{{REL}}}embed'))
        if alvo: return f'[IMAGEM:{alvo}]'
    return '[IMAGEM]'
doc = etree.fromstring(z.read('word/document.xml'))
body = doc.find('w:body', ns)
stats = {'page_br': 0, 'last_rendered': 0, 'sect': 0, 'hl': {}, 'shd': {}, 'imgs': 0, 'tables': 0, 'paras': 0}
out = []
pagina = 1

def amarelo(rpr):
    if rpr is None: return False
    h = rpr.find('w:highlight', ns)
    if h is not None:
        v = h.get(f'{{{W}}}val'); stats['hl'][v] = stats['hl'].get(v, 0) + 1
        if v == 'yellow': return True
    s = rpr.find('w:shd', ns)
    if s is not None:
        f = (s.get(f'{{{W}}}fill') or '').upper(); stats['shd'][f] = stats['shd'].get(f, 0) + 1
        if f in ('FFFF00',): return True
    return False

def paragrafo(p):
    global pagina
    partes = []; atual = None; buf = ''
    estilo = p.find('w:pPr/w:pStyle', ns)
    estilo = estilo.get(f'{{{W}}}val') if estilo is not None else ''
    if p.find('w:pPr/w:sectPr', ns) is not None: stats['sect'] += 1
    pb = p.find('w:pPr/w:pageBreakBefore', ns)
    if pb is not None and pb.get(f'{{{W}}}val', '1') not in ('0', 'false'):
        pagina += 1; partes.append(f'\n=== [PÁGINA {pagina}] ===\n')
    for r in p.iter(f'{{{W}}}r'):
        y = amarelo(r.find('w:rPr', ns))
        for ch in r:
            tag = etree.QName(ch).localname
            t = ''
            if tag == 't': t = ch.text or ''
            elif tag == 'tab': t = '\t'
            elif tag == 'br':
                if ch.get(f'{{{W}}}type') == 'page':
                    stats['page_br'] += 1; pagina += 1; t = f'\n=== [PÁGINA {pagina}] ===\n'
                else: t = '\n'
            elif tag == 'lastRenderedPageBreak': stats['last_rendered'] += 1
            elif tag == 'drawing' or tag == 'pict': stats['imgs'] += 1; t = imagem(ch)
            if not t: continue
            if y != atual:
                if atual: buf += '⟧'
                if y: buf += '⟦AMARELO:'
                atual = y
            buf += t
    if atual: buf += '⟧'
    texto = ''.join(partes) + buf
    if estilo.lower().startswith(('heading', 'ttulo', 'title')) and texto.strip():
        nivel = re.sub(r'\D', '', estilo) or '1'
        texto = '#' * min(int(nivel), 4) + ' ' + texto
    return texto

for el in body:
    tag = etree.QName(el).localname
    if tag == 'p':
        stats['paras'] += 1; out.append(paragrafo(el))
    elif tag == 'tbl':
        stats['tables'] += 1
        out.append(f'[TABELA {stats["tables"]}]')
        for tr in el.findall('w:tr', ns):
            cels = []
            for tc in tr.findall('w:tc', ns):
                cels.append(' / '.join(paragrafo(p).strip() for p in tc.findall('.//w:p', ns) if paragrafo(p).strip()))
            out.append('| ' + ' | '.join(cels) + ' |')
        out.append('[/TABELA]')
open(sys.argv[2], 'w').write('\n'.join(out))
print(stats, 'páginas por quebra:', pagina)
