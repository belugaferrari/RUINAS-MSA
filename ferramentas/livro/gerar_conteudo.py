"""Gera conteudo/sistemas/<msa|mss>/*.json a partir do Livro do Jogador (.docx).

Uso:
    python3 -I ferramentas/livro/extrair_docx.py LIVRO.docx /tmp/texto.md
    python3 -I ferramentas/livro/gerar_conteudo.py /tmp/texto.md conteudo/sistemas/msa

Trechos grifados de amarelo no livro saem com "revisao": true.
O livro descreve o sistema MSS: tudo aqui é base para o MSA e precisa ser conferido.
"""
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classes import extrair_classes  # noqa: E402
from progressao import P as PROGRESSAO  # noqa: E402

AMARELO = re.compile(r'⟦AMARELO:|⟧')
FONTE = 'Livro do Jogador (gerado pelo app; trechos grifados = em revisão)'

SIGLAS = {
    'Força': 'FOR', 'Constituição': 'CONS', 'Agilidade': 'AGI', 'Destreza': 'DES',
    'Inteligência': 'INT', 'Percepção': 'PER', 'Carisma': 'CAR', 'Vontade': 'WILL', 'Força de Vontade': 'WILL',
}
PERICIAS_COMBATE = {'briga', 'arma-branca', 'armas-de-fogo'}


def slug(texto):
    t = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def limpa(s):
    return AMARELO.sub('', s).strip()


def secao(linhas, ini_pat, fim_pat):
    i = next(k for k, l in enumerate(linhas) if re.match(ini_pat, l))
    j = next(k for k, l in enumerate(linhas) if k > i and re.match(fim_pat, l))
    return linhas[i + 1:j]


def extrair_pericias(t):
    pericias, atual, modo = [], None, None
    for l in secao(t, r'### LISTA DE PERÍCIAS', r'## Passo 4'):
        m = re.match(r'### (\d+)\. (.+)', l)
        if m:
            nome = m.group(2).strip().title().replace(' De ', ' de ')
            atual = {'id': slug(nome), 'nome': nome, 'atributo': None, 'descricao': '', 'subpericias': []}
            atual['combate'] = atual['id'] in PERICIAS_COMBATE
            pericias.append(atual)
            modo = None
            continue
        if not atual:
            continue
        am, s = '⟦AMARELO' in l, limpa(l)
        if s.startswith('Atributo Base'):
            nome_atr = re.sub(r'\s*\(.*', '', s.split(':', 1)[1]).strip()
            atual['atributo'] = SIGLAS[nome_atr]
        elif s.startswith('Descrição'):
            atual['descricao'] = s.split(':', 1)[1].strip()
            modo = 'desc'
        elif re.match(r'sub-?perícias', s.lower()):
            modo = 'subs'
        elif modo == 'subs' and ':' in s and len(s.split(':')[0]) < 45:
            nome, desc = s.split(':', 1)
            atual['subpericias'].append({'id': f"{atual['id']}.{slug(nome)}", 'nome': nome.strip(), 'descricao': desc.strip(), 'revisao': am})
        elif modo == 'subs' and s and atual['subpericias']:
            atual['subpericias'][-1]['descricao'] += ' ' + s
            atual['subpericias'][-1]['revisao'] |= am
        elif modo == 'desc' and s:
            atual['descricao'] += ' ' + s
    return pericias


# As profissões estão em caixas de texto no .docx (a ordem sai embaralhada), por isso ficam transcritas aqui.
PROFISSOES = [
    ('Sobrevivente', 'Você aprendeu a se virar em todas as situações. Estar preparado é seu lema e você sabe que há um dia seguinte para quem fizer tudo certo.',
     'Receba +5 PVs. Jogue a Iniciativa com Vantagem caso você ou algum aliado tenha sofrido um ataque surpresa.',
     ['Espionagem/Camuflagem', 'Esportes/Escalada', 'Sobrevivência/Sobrevivência básica', 'Esportes/Natação'], {'pv': 5}),
    ('Batedor', 'Batedores são abre-alas. Especializados em avaliar situações, desbravar terrenos e identificar perigos, os batedores são informantes importantes para os grupos.',
     'Caso você tenha sucesso em um teste de CONCENTRAÇÃO, você pode se deslocar por terrenos naturalmente acidentados sem penalidade.',
     ['Sobrevivência/Rastreio', 'Espionagem/Furtividade', 'Sentidos/Visão', 'Armadilhas/Encontrar'], {}),
    ('Socorrista', 'Socorristas se especializaram em prestar socorros ao grupo e aos próximos. Em meio ao caos e tempestade, os socorristas estão dispostos a ajudar seus companheiros.',
     'Caso o aliado fique com menos de 0 PVs, você recebe Vantagem nos testes de primeiros socorros.',
     ['Medicina/Primeiros Socorros', 'Ciência/Botânica', 'Trato de Animais/Veterinária', 'Briga/Salvaguardar'], {}),
    ('Protetor', 'Algumas pessoas assumem a linha de frente quando ninguém mais quer. Arriscam suas vidas pelo time e tentam chamar a atenção dos inimigos.',
     'Nos turnos em que você fizer uma Salvaguarda, seu deslocamento base sobe +3m e você recebe +1 IP geral.',
     ['Briga/Escudo', 'Briga/Defesa Desarmada', 'Briga/Salvaguardar', 'Trato de Animais/Doma'], {}),
    ('Coletor', 'Recursos são essenciais para novos aventureiros e coletá-los é de extrema importância. Alimentos, medicação, armas, vestes. Tudo pode lhe ajudar a resistir mais um dia.',
     'A durabilidade dos itens encontrados pelos coletores é sempre +1 (até o limite de 9). Os coletores podem pegar um item caído como uma ação livre.',
     ['Espionagem/Furtar', 'Extração/Mineração', 'Extração/Colheita', 'Avaliação de Objetos/Identificação'], {}),
    ('Zelador', 'Ter um objeto é importante, mas mantê-lo é ainda mais. Algumas pessoas se preocupam em manter os itens e equipamentos em bom uso e sem surpresas desagradáveis.',
     'Faça testes com VANTAGEM para Reparar Armamentos e Vestes.',
     ['Engenharia/Mecânica', 'Engenharia/Militar', 'Computação/Manutenção', 'Arte/Costura'], {}),
]


def montar_profissoes(pericias):
    ids = {}
    for p in pericias:
        for s in p['subpericias']:
            ids[(slug(p['nome']), slug(s['nome']))] = s['id']
    saida, avisos = [], []
    for nome, desc, vant, subs, extras in PROFISSOES:
        encontradas = []
        for ref in subs:
            base, sub = ref.split('/')
            sid = ids.get((slug(base), slug(sub)))
            if sid:
                encontradas.append(sid)
            else:
                avisos.append(f'{nome}: subperícia "{ref}" não existe na lista de perícias')
        saida.append({'id': slug(nome), 'nome': nome, 'descricao': desc, 'vantagem': vant, 'bonus': 5,
                      'subpericias': encontradas, 'subpericiasLivro': subs, 'extras': extras})
    return saida, avisos


def itens_lista(linhas, pular=()):
    out = []
    for l in linhas:
        am, s = '⟦AMARELO' in l, limpa(l)
        # Títulos colados a imagens no começo da linha (ex.: "DEFEITOS LEVES[IMAGEM]Fotofobia: ...").
        s = re.sub(r'\[IMAGEM[^\]]*\]', '', s).strip()
        s = re.sub(r'^[A-ZÇÃÕÁÉÍÓÚÂÊÔ ]{6,}(?=[A-ZÁÉÍÓÚ][a-zçãõáéíóúâêô])', '', s)
        if not s or s.startswith('[') or s.isupper() or s.startswith('#'):
            continue
        m = re.match(r'([^:]{3,70}?)(?:\s*\[([^\]]+)\])?:\s*(.+)', s)
        if m and not any(s.startswith(p) for p in pular) and len(m.group(1)) < 60:
            out.append({'nome': m.group(1).strip().lstrip('* ').strip(), 'requisito': (m.group(2) or '').strip(),
                        'descricao': m.group(3).strip(), 'revisao': am})
        elif out:
            out[-1]['descricao'] += ' ' + s
            out[-1]['revisao'] |= am
    for o in out:
        o['id'] = slug(o['nome'])
    return out


def extrair_capitulo4(t):
    gerais = itens_lista(secao(t, r'## VANTAGENS GERAIS', r'## CARACATERISTICAS'), ('As vantagens', 'Abaixo', 'Caso perca'))
    for v in gerais:
        v['custo'] = 1
    leves = itens_lista(secao(t, r'### Defeitos Leves', r'### Defeitos Normais'))
    normais = itens_lista(secao(t, r'### Defeitos Normais', r'## HABILIDADES'))
    for d in leves:
        d['tipo'] = 'leve'
    for d in normais:
        d['tipo'] = 'normal'
    caps, atr = [], None
    nomes_atr = {'FORÇA': 'FOR', 'CONSTITUIÇÃO': 'CONS', 'DESTREZA': 'DES', 'AGILIDADE': 'AGI', 'INTELIGÊNCIA': 'INT',
                 'VONTADE': 'WILL', 'PERCEPÇÃO': 'PER', 'CARISMA': 'CAR'}
    for l in secao(t, r'## CAPACIDADES', r'## DEFEITOS'):
        s = limpa(l)
        m = re.match(r'^(FORÇA|CONSTITUIÇÃO|DESTREZA|AGILIDADE|INTELIGÊNCIA|VONTADE|PERCEPÇÃO|CARISMA)\b', s)
        if m and len(s) < 30:
            atr = nomes_atr[m.group(1)]
            continue
        mm = re.match(r'([^:]{3,40}):\s*(.+)', s)
        if atr and mm and not s.startswith(('NORMAL', 'Nota')):
            caps.append({'id': slug(mm.group(1)), 'atributo': atr, 'nome': mm.group(1).strip(), 'descricao': mm.group(2).strip(), 'revisao': True})
        elif caps and s:
            caps[-1]['descricao'] += ' ' + s
    return {'gerais': gerais, 'defeitosLeves': leves, 'defeitosNormais': normais, 'capacidades': caps}


def montar_classes(t):
    classes = extrair_classes(t)
    for c in classes:
        c['id'] = slug(c['nome'])
        # "Normal" no Soldado é continuação de "Mestre de Armas".
        caract = []
        for x in c['caracteristicas']:
            if x['nome'] == 'Normal' and caract:
                caract[-1]['descricao'] += ' NORMAL: ' + x['descricao']
            else:
                caract.append(x)
        c['caracteristicas'] = caract
        tabela = PROGRESSAO.get(c['nome'], {})
        for e in c['especializacoes']:
            e['id'] = slug(e['nome'])
            prog = tabela.get(e['nome'])
            if prog:
                e['progressao'] = [{'nivel': 3 + i, 'ganhos': ['Vantagem Extra' if g == 'VE' else g for g in cel.split(', ')]}
                                   for i, cel in enumerate(prog)]
        for v in c['vantagens']:
            v['id'] = slug(v['nome'])
    return classes


def principal(entrada, saida_dir):
    t = open(entrada, encoding='utf-8').read().split('\n')
    os.makedirs(saida_dir, exist_ok=True)
    pericias = extrair_pericias(t)
    profissoes, avisos = montar_profissoes(pericias)
    dados = {
        'pericias.json': pericias,
        'profissoes.json': profissoes,
        'classes.json': montar_classes(t),
        'vantagens.json': extrair_capitulo4(t),
    }
    for nome, conteudo in dados.items():
        with open(os.path.join(saida_dir, nome), 'w', encoding='utf-8') as f:
            json.dump({'_fonte': FONTE, 'dados': conteudo}, f, ensure_ascii=False, indent=1)
    for a in avisos:
        print('AVISO:', a)
    print({k: len(v) if isinstance(v, list) else {kk: len(vv) for kk, vv in v.items()} for k, v in dados.items()})


if __name__ == '__main__':
    principal(sys.argv[1], sys.argv[2])
