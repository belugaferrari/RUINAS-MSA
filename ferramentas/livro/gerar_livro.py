"""Gera o Livro de Regras do app (conteudo/livros/regras.md + imagens) a partir do .docx.

Uso:
    python3 -I ferramentas/livro/extrair_docx.py LIVRO.docx /tmp/texto_img.md --imagens
    python3 -I ferramentas/livro/gerar_livro.py /tmp/texto_img.md LIVRO.docx conteudo/livros/regras.md public/livro-img

- Trechos grifados de amarelo viram ==texto== (o app destaca como "em revisão").
- Combate e regras sociais do MSS ficam de fora: no MSA elas serão diferentes.
"""
import json
import os
import re
import sys
import zipfile
from datetime import date

# Títulos cujo conteúdo (até o próximo título) fica de fora.
TITULOS_FORA = [
    'Regras de Combate', 'Iniciativa: Quem Atira Primeiro', 'A Economia do Turno', 'Manobras Táticas e Sobrevivência Bruta',
    'Salvaguardar', 'O Ambiente como Arma', 'Sobrevida', 'Ataque Localizado', 'Humorado – Mal estar', 'Humorado – Bem estar',
]
# Blocos sem título de Markdown: (linha que começa, linha que termina — exclusiva).
BLOCOS_FORA = [('EFEITOS SOCIAIS (HUMOR)', '### SANIDADE')]
FIM = 'COMENTÁRIOS E OBSERVAÇÕES GERAIS'

AMARELO = re.compile(r'⟦AMARELO:(.*?)⟧', re.S)


def nivel_titulo(l):
    m = re.match(r'^(#+)\s*(.*)$', l)
    return (len(m.group(1)), m.group(2).strip()) if m else (0, '')


def tabela_md(linhas):
    cel = [[c.strip() for c in l.strip().strip('|').split('|')] for l in linhas if l.strip().startswith('|')]
    if not cel:
        return []
    n = max(len(r) for r in cel)
    cel = [r + [''] * (n - len(r)) for r in cel]
    return ['| ' + ' | '.join(cel[0]) + ' |', '|' + '---|' * n] + ['| ' + ' | '.join(r) + ' |' for r in cel[1:]] + ['']


def profissoes_md(dir_msa):
    dados = json.load(open(os.path.join(dir_msa, 'profissoes.json'), encoding='utf-8'))['dados']
    out = ['### Profissões iniciais', '']
    for p in dados:
        out += [f"**{p['nome']}** — {p['descricao']}", '', f"*Vantagem:* {p['vantagem']}", '',
                f"*+{p['bonus']}% em:* {'; '.join(p['subpericiasLivro'])}", '']
    return out


def principal(entrada, docx, saida, dir_img, dir_msa='conteudo/msa'):
    t = open(entrada, encoding='utf-8').read().split('\n')
    ini = next(i for i, l in enumerate(t) if l.startswith('# CAPÍTULO 1'))
    fim = next((i for i, l in enumerate(t) if FIM in l), len(t))
    linhas = t[ini:fim]

    out, imagens = [], []
    pular_ate_nivel = None
    bloco_fim = None
    tabela = None
    em_profissoes = False
    for l in linhas:
        lt = l.strip()
        # blocos sem título
        if bloco_fim:
            if lt.startswith(bloco_fim):
                bloco_fim = None
            else:
                continue
        b = next((f for i, f in BLOCOS_FORA if AMARELO.sub(r'\1', lt).startswith(i)), None)
        if b:
            bloco_fim = b
            continue
        nv, titulo = nivel_titulo(lt)
        titulo_limpo = AMARELO.sub(r'\1', titulo)
        # títulos fora
        if pular_ate_nivel is not None:
            if nv and nv <= pular_ate_nivel and not any(titulo_limpo.startswith(x) for x in TITULOS_FORA):
                pular_ate_nivel = None
            else:
                continue
        if nv and any(titulo_limpo.startswith(x) for x in TITULOS_FORA):
            pular_ate_nivel = nv
            continue
        # profissões estão embaralhadas em caixas de texto: usa a lista já organizada
        if titulo_limpo.startswith('PROFISSÕES'):
            out += profissoes_md(dir_msa)
            em_profissoes = True
            continue
        if em_profissoes:
            if nv:
                em_profissoes = False
            else:
                continue
        # tabelas
        if lt.startswith('[TABELA'):
            tabela = []
            continue
        if lt == '[/TABELA]':
            out += tabela_md(tabela)
            tabela = None
            continue
        if tabela is not None:
            tabela.append(lt)
            continue
        # imagens
        for arq in re.findall(r'\[IMAGEM:([^\]]+)\]', lt):
            imagens.append(arq)
            out += [f'![](/livro-img/{arq})', '']
        lt = re.sub(r'\[IMAGEM(:[^\]]+)?\]', '', lt).strip()
        if not lt:
            continue
        lt = AMARELO.sub(lambda m: f'=={m.group(1).strip()}==' if m.group(1).strip() else '', lt)
        if nv:
            texto = re.sub(r'^#+\s*', '', lt).strip()
            if not texto or texto == '====':
                continue
            if nv == 1 and not re.match(r'(CAP[IÍ]TULO|Cap[ií]tulo)', AMARELO.sub(r'\1', texto)):
                nv = 3
            out += ['', '#' * nv + ' ' + texto, '']
        elif re.match(r'^Passo \d+\.', lt) and len(lt) < 60:
            out += ['', '## ' + lt, '']
        elif re.match(r'^\d+\. [A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,}$', lt):
            out += ['', '### ' + lt, '']
        elif lt.isupper() and len(lt) < 60 and not lt.startswith('='):
            out += ['', '### ' + lt.title(), '']
        else:
            out += [lt, '']

    cabecalho = [
        '# Livro do Jogador — Ilhas das Ruínas',
        '',
        f'> Gerado do documento de revisão em {date.today().strftime("%d/%m/%Y")}. ==Trechos destacados assim== estão grifados no livro e ainda podem mudar.',
        '> As regras de **combate** e **sociais** do sistema MSS foram deixadas de fora: no MSA elas serão diferentes.',
        '',
    ]
    texto = '\n'.join(cabecalho + out)
    texto = re.sub(r'\n{3,}', '\n\n', texto)
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    open(saida, 'w', encoding='utf-8').write(texto)

    os.makedirs(dir_img, exist_ok=True)
    for f in os.listdir(dir_img):
        os.remove(os.path.join(dir_img, f))
    z = zipfile.ZipFile(docx)
    for arq in set(imagens):
        with open(os.path.join(dir_img, arq), 'wb') as f:
            f.write(z.read(f'word/media/{arq}'))
    print(f'{len(texto)} caracteres, {len(set(imagens))} imagens')


if __name__ == '__main__':
    principal(*sys.argv[1:5])
