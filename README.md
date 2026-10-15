# Ilhas das Ruínas MSA — aplicativo de mesa

Aplicativo de apoio ao RPG **Ilhas das Ruínas MSA**: o Mestre e até 9 jogadores acessam ao mesmo tempo, pelo navegador, na mesma Wi‑Fi ou pela internet. Tudo atualiza em tempo real (fichas, salas, rolagens, imagens).

> **Fase atual: esqueleto visual funcional.** As telas e o fluxo estão prontos; as regras do MSA ainda são **exemplos provisórios** em `conteudo/sistema.json` e `conteudo/livros/*.md`, que serão trocados pelo conteúdo real.

## Como rodar (no PC do Mestre)

> Passo a passo para quem não programa: **[INSTALAR.md](INSTALAR.md)** — no Windows é só dar dois cliques em `iniciar-windows.bat`. Ele se atualiza sozinho pelo GitHub a cada abertura (`iniciar.ps1` / `atualizar.ps1`), sem mexer na pasta `data`.

1. Instale o [Node.js](https://nodejs.org) (versão 20 ou mais nova).
2. Na pasta do projeto:
   ```bash
   npm install
   npm start
   ```
3. O terminal mostra dois endereços:
   - `http://localhost:3000` → abra neste PC.
   - `http://192.168.x.x:3000` → os jogadores abrem esse no celular/PC **na mesma Wi‑Fi**.
   (Se não abrir nos outros aparelhos, libere a porta 3000 no firewall do Windows quando ele perguntar.)

Os dados ficam em `data/` (contas, campanhas, fichas, imagens). **Faça backup dessa pasta.**

Para jogar pela internet (sem estar na mesma Wi‑Fi), o mesmo app pode ser publicado em um servidor (Render, Railway, VPS…) — fica para uma próxima etapa.

## O que já existe

**Contas**: nome + senha (senha guardada com hash). "Lembrar neste dispositivo" mantém a pessoa conectada (guarda só um token, nunca a senha). Ao entrar, escolhe **Área do Mestre** ou **Área do Jogador**.

**Área do Mestre**
- Criar campanha (nome, máx. jogadores até 9, nível inicial 1–20 ou *Variável*, início padrão MSA ou pontos de Atributos/Vantagens/Perícias), abrir/fechar (fechar expulsa os jogadores na hora), apagar.
- Abas: Jogadores · NPCs (grupos, ficha, importar Excel, mapa de relacionamento) · Imagens (mostrar/ocultar para os jogadores) · Sala Social · Campo de Batalha (encontro aleatório por dificuldade) · Resumo · Livro de Regras · Livro dos Monstros · Livro do Mestre · Loja · Classes · Lore · Campanha.
- Edita qualquer ficha em tempo real, cria personagens‑jogador que um jogador pode assumir, dá XP e itens, restaura backups, faz rolagens secretas.

**Área do Jogador**
- Procura campanhas abertas / continua nas que já participa; escolhe ou cria personagem.
- Criação em 10 passos: pontos e nível → identidade → classe (com escolhas próprias da classe) → vantagens → atributos → perícias → itens → humanidade e sanidade → background → revisão. O rascunho fica salvo no aparelho. O servidor confere os limites do mestre.
- Abas: Ficha (marcar dano, marcadores, selecionar perícias para testes, equipar com controle de slots, anotações) · Lore · Redes Sociais · Itens · Armas e Armadilhas · Sala Social · Campo de Batalha · Evoluir (guarda backup da ficha anterior) · Livro de Regras · Loja (quando o mestre libera).

**Planilha de NPCs**: `modelos/modelo_npcs.xlsx` (ou o botão "Planilha modelo" na aba NPCs). As colunas acompanham os atributos e perícias de `sistema.json`; rode `npm run modelo` para regenerar depois de mudar as regras.

## Rolador de dados, Confronto e Livro de Regras

- **Rolador na lateral direita** (botão de dado no celular): teste D-MIL com ND fixo, ND por nível, contra ação passiva ou livre; intuição (−20%); iniciativa, d100, DS; perda e recuperação de Sanidade (aplica direto na ficha); rolagem de atributos da criação; dados livres; histórico das últimas rolagens.
- **Confronto** (aba própria, fora do combate): o mestre cria Ação × Ação passiva (regra do livro) ou disputa (provisória); cada jogador rola o lado do próprio personagem; resultado em tempo real.
- **Livro de Regras**: gerado do .docx com índice, busca, imagens e grifos destacados. Combate e regras sociais do MSS ficam de fora.

## Catálogo de itens (planilha)

- Os itens vêm das planilhas do autor: `conteudo/sistemas/itens.json` (1449 itens, gerado por `ferramentas/itens/gerar_catalogo.mjs`).
- **Atualizar pelo app**: aba **Loja** (Mestre) → "Catálogo de itens (planilha)" → *Baixar planilha atual*, edite no Excel/Google Planilhas e *Enviar planilha*. "Atualizar" troca só os itens da planilha (mesmo "num ctrl" ou mesmo nome); "Substituir" deixa o catálogo só com eles. Fica salvo em `data/catalogo-itens.json` (não é apagado nas atualizações do app) e vale para todas as campanhas do PC. Itens que os personagens já têm não mudam.
- A planilha é a mesma do autor (colunas "num ctrl", "Item", "Preço (créditos)"…); colunas extras "App: …" são opcionais.

## Turnos, XP e munição (qualquer sistema)

- **Campo de Batalha**: o mestre inicia o combate (iniciativa de todos), o app mostra a rodada, de quem é a vez e um painel com os atalhos de quem está na vez (rolar teste, munição, passar a vez). O jogador recebe um aviso quando chega a vez dele.
- **XP**: barra de XP na ficha e na tela Evoluir; o nível só sobe com o XP necessário (100 XP por nível, descontado ao confirmar). O mestre dá XP para um personagem ou para todos os PJs da sala de uma vez.
- **Munição**: armas de fogo mostram as balas carregadas, gastam 1 por tiro e recarregam com as caixas de munição do inventário.
- **Boneco do personagem** (ficha e aba Itens): cabeça, corpo, mãos, vestimenta, joias e costas com o que está equipado; tocar numa parte mostra o que serve ali para equipar ou trocar, e o link leva ao inventário.
- **Dados na tela de todos**: cada D-MIL (teste, ataque ou manipulação) aparece para todos com o DP (d100) branco, o DS (d10) vermelho e os dados de dano. O mestre desliga em Campanha → "Mostrar as rolagens na tela de todos"; rolagens secretas nunca aparecem.

## Combate e social automáticos (campanhas no MSS)

- **Campo de Batalha**: o mestre inicia o combate e o app rola a iniciativa de todos (AGI + 1d10; humores Corajoso, Amedrontado e Enojado rolam com vantagem). Mostra rodada e de quem é a vez; quem entra no meio rola na hora. Cada um declara o ataque com a arma equipada (ou desarmado) e quem controla o alvo escolhe a defesa (Esquiva, Defesa desarmada, Defesa armada ou Evasão em área): vantagem/desvantagem automáticas (surpresa, alvo caído, terreno elevado…), ataque localizado, duas armas, Sacrifício, crítico (+1 dado), dano − IP aplicado direto nos PV, efeito de dano pelo DS e sobrevida abaixo de 0 PV.
- **Ação no cartão**: cada personagem tem, no próprio cartão, o alvo, a arma (ou a subperícia de manipulação) e o botão "Atacar"/"Manipular". Clicar no cartão de outro personagem marca o alvo para todos os seus.
- **Sala Social (MSA e MSS)**: humor real × máscara (o que a sala vê); Empatia "ler o humor real"; rebote da manipulação pelo relacionamento (Aliado/Amigável · Desconhecido · Rival/Inimigo); dissonância (quebrar humor imposto custa Sanidade) e agressão súbita (atacar humano no meio da conversa custa Humanidade, botão "Agredir").
- **Sala Social**: humor de cada personagem (Roda do Humor) com os efeitos, e manipulação: escolha a subperícia e o humor desejado; o teste é contra a Resistência à Manipulação do alvo (perícia base Manipulação + 50 + modificadores).
- No MSA essas partes ficam desligadas até as regras do MSA chegarem. Escolhas provisórias em `PENDENCIAS.md`.

## Visual e celular

- Ícones [Lucide](https://lucide.dev) (licença ISC), servidos pelo próprio app em `/icones.svg` — funcionam sem internet. Para usar um ícone novo, adicione o nome em `public/js/icones.js` (o teste `npm test` avisa se faltar).
- No celular: abas com ícone, tabelas viram cartões, listas e fichas aparecem uma de cada vez, e os botões têm área de toque de pelo menos 40px.

## Sistemas de regras: MSA e MSS

Cada campanha usa um sistema — **MSA** (Modern Survival Auto) ou **MSS** (Modern Survival Simplificado) — escolhido ao criar a campanha. O mestre pode **trocar no meio** (aba Campanha): as fichas continuam, e cálculos, criação, rolador e Livro de Regras passam a seguir o novo sistema na hora, para todos.

| Arquivo | O que tem |
|---|---|
| `conteudo/sistemas/base.json` | Regras comuns: atributos, pontos, fórmulas, teste D-MIL, sanidade, origens, progressão por nível, estados, slots, itens e monstros (exemplos). |
| `conteudo/sistemas/msa.json` · `mss.json` | Só o que muda em cada sistema (Humanidade, Sacrifício, rolagem de atributos, iniciativa…). |
| `conteudo/sistemas/msa/` · `mss/` | Perícias, profissões, classes (com tabela de progressão), vantagens, defeitos e capacidades — **gerados do livro de cada sistema**. |
| `shared/combate.js` | Combate (iniciativa, ataque × defesa, dano − IP, efeitos pelo DS, sobrevida) e Roda do Humor / manipulação — ligados só nos sistemas com `modulos.combate` / `modulos.social` (hoje, o MSS). |
| `conteudo/sistemas/PENDENCIAS.md` | Inconsistências dos livros, diferenças MSA × MSS e escolhas provisórias. |
| `conteudo/livros/regras-msa.md` · `regras-mss.md` | Livro de Regras de cada sistema (o do MSS é completo; o do MSA deixa combate e social de fora). |
| `shared/regras.js` | Toda a matemática (vale para os dois sistemas, guiada pelos dados de cada um). |

Trechos grifados de amarelo nos livros aparecem no app com o selo **"em revisão"**.

### Atualizar a partir de uma nova versão de um livro

```bash
# MSA
python3 -I ferramentas/livro/extrair_docx.py "livro MSA.docx" /tmp/msa.md
python3 -I ferramentas/livro/gerar_conteudo.py /tmp/msa.md conteudo/sistemas/msa
python3 -I ferramentas/livro/extrair_docx.py "livro MSA.docx" /tmp/msa_img.md --imagens
python3 -I ferramentas/livro/gerar_livro.py /tmp/msa_img.md "livro MSA.docx" conteudo/livros/regras-msa.md public/livro-img/msa conteudo/sistemas/msa
# MSS (livro completo; imagens .emf viram .png com o LibreOffice)
python3 -I ferramentas/livro/extrair_docx.py "livro MSS.docx" /tmp/mss.md
python3 -I ferramentas/livro/gerar_conteudo.py /tmp/mss.md conteudo/sistemas/mss
python3 -I ferramentas/livro/extrair_docx.py "livro MSS.docx" /tmp/mss_img.md --imagens
python3 -I ferramentas/livro/gerar_livro.py /tmp/mss_img.md "livro MSS.docx" conteudo/livros/regras-mss.md public/livro-img/mss conteudo/sistemas/mss --completo
npm run modelo && npm test
```

As tabelas de progressão das classes estão em imagens nos livros (iguais nos dois), então ficam transcritas em `ferramentas/livro/progressao.py`.

## Estrutura

```
server/      servidor (Express + Socket.IO), contas, ações da campanha, Excel
shared/      regras usadas pelo servidor e pelo navegador
ferramentas/ scripts que leem os livros (.docx) e geram conteudo/sistemas
public/      interface (HTML/CSS/JS sem etapa de build)
conteudo/    regras e livros editáveis
modelos/     planilha modelo de NPCs
test/        testes (npm test)
```
