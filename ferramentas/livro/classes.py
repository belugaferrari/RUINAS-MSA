import re


def extrair_classes(t):
    ini=[i for i,l in enumerate(t) if l.startswith('# CAPÍTULO 3')][0]
    fim=[i for i,l in enumerate(t) if l.startswith('# CAPÍTULO 4')][0]
    limpa=lambda s: re.sub(r'⟦AMARELO:|⟧','',s).strip()
    classes=[]; c=None; esp=None; modo=None
    for l in t[ini:fim]:
        am='⟦AMARELO' in l; s=limpa(l)
        if not s or s=='[IMAGEM]': continue
        s=re.sub(r'^#+\s*','',s) if s.startswith('#') else s
        m=re.match(r'(\d+)\. (?:O |A )?([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,})$', s)
        if m and (l.startswith('### ') or re.match(r'\d+\. [A-Z]{5,}\s*$', l.strip())):
            c={'nome':m.group(2).strip().title(),'descricao':'','marca':'','caracteristicas':[],'especializacoes':[],'vantagens':[],'revisao':[],'extras':''}; classes.append(c); esp=None; modo='desc'; continue
        if not c: continue
        if am: c['revisao'].append(s[:160])
        me=re.match(r'Especialização \d+:\s*(.+)', s)
        if me:
            esp={'nome':me.group(1).strip(),'descricao':'','habilidades':[]}; c['especializacoes'].append(esp); modo='esp'; continue
        if re.match(r'(Vantagens? (dos|das|de|Específicas)|Vantagens dos)', s) and len(s)<70:
            modo='vant'; esp=None; continue
        if re.match(r'Especializações', s): modo='antesesp'; continue
        if re.match(r'Caracter[ií]sticas? de [Cc]lasse', s) or re.match(r'Ao (se tornar|selar)', s): modo='car'; continue
        if modo in ('car','extra') and ':' not in s and len(s) < 40 and not s.startswith('A cada'):
            modo='extra'; c['extras']+=f'\n### {s}\n'; continue
        if modo=='extra': c['extras']+=s+'\n'; continue
        if 'Marca' in s and ('Destino' in s or 'ganha' in s) and not c['marca']:
            c['marca']=s; continue
        mn=re.match(r'N[ií]vel (\d+)\s*[:.]\s*([^.:]+)[.:]\s*(.*)', s)
        if modo=='esp' and mn:
            esp['habilidades'].append({'nivel':int(mn.group(1)),'nome':mn.group(2).strip(),'descricao':mn.group(3).strip()}); continue
        if modo=='esp':
            if esp['habilidades']: esp['habilidades'][-1]['descricao']+=' '+s
            else: esp['descricao']+=(' ' if esp['descricao'] else '')+s
            continue
        mv=re.match(r'([^:]{3,60}):\s*(.+)', s)
        if modo=='vant' and mv:
            c['vantagens'].append({'nome':mv.group(1).strip(),'descricao':mv.group(2).strip()}); continue
        if modo=='vant':
            if c['vantagens']: c['vantagens'][-1]['descricao']+=' '+s
            continue
        if modo=='car' and mv and not s.lower().startswith('ao se tornar'):
            c['caracteristicas'].append({'nome':mv.group(1).strip(),'descricao':mv.group(2).strip()}); continue
        if modo=='car' and c['caracteristicas'] and not s.lower().startswith('ao se tornar'):
            c['caracteristicas'][-1]['descricao']+=' '+s; continue
        if modo=='desc': c['descricao']+=(' ' if c['descricao'] else '')+s

    return classes
