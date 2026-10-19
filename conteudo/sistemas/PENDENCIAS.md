# Pendências dos livros (MSA rev. 14/10/2026 15:29 · MSS rev. 14/10/2026 20:26)

## Livro MSA

Pontos em que o app precisou escolher um caminho. Confira e me diga se a escolha está certa para o **MSA**.

## Inconsistências no texto
| # | Onde | O que o livro diz | O que o app faz |
|---|---|---|---|
| 1 | PV — Passo 0 × Passo 6 | Passo 0: `5 + 5×nível + (FOR+CONS)/2`. Passo 6: `FOR + CONS + 1` | **Resolvido:** `FOR + CONS` no 1º nível, +5 por nível (sem o +1; confirmado pelo autor) |
| 2 | Tabela da Dormet (Passo 1) | CAR 13 → Bônus pericial 14 e MOD 3 | Pela fórmula do texto dá Bônus 16 e MOD 2 (+1 racial). O app segue a fórmula; o resto da tabela bate |
| 3 | Profissão Protetor | Bônus em "Defesa Desarmada" | Essa subperícia só existe no livro MSS. No MSA o bônus fica sem efeito até definir |
| 4 | Profissão Protetor | "Salvaguarda" | Entendido como Briga › Salvaguardar |
| 5 | Nomes nas profissões | "Encontrar armadilhas", "Engenharia Mecânica", "Manutenção de Computadores", "Identificação de objetos" | Armadilhas › Encontrar, Engenharia › Mecânica, Computação › Manutenção, Avaliação de Objetos › Identificação |
| 6 | Humanidade (Passo 6) | "HUM = 50 + 2×CAR + 2×PER, mas você pode escolher valores melhores que esse até o limite de 51 no primeiro nível" | O app usa a fórmula (máx. 100). Não ficou claro o que é o "limite de 51" |
| 7 | Grafia texto × tabelas de classe | Gerigonça/Geringonça, Artificie/Artífice, Ultimo/Último, Autopsia/Autópsia | **Resolvido:** o app usa a grafia das tabelas e acha o texto mesmo com até 2 letras de diferença |

## Regras que ainda não existem no livro
- **Custo de cada vantagem**: o app considera 1 ponto por vantagem.
- **Custo em XP** da evolução: lançado à mão no Evoluir. Os pontos por nível já seguem a Tabela de Progressão (confirmado: vale para MSA e MSS).
- **Vantagem Extra × +1 dos níveis pares** (confirmado): depois que o personagem escolhe a classe, o +1 dos níveis pares da Tabela de Progressão para de contar; valem só as "Vantagem Extra" da tabela da classe (não acumulam). Antes da especialização, conta a tabela da primeira especialização.
- **Humanidade**: fórmula e estágios (a cada 10 pontos) valem para MSA e MSS (confirmado). Os efeitos de Combate e Social de cada estágio aparecem só como texto.
- **Disputa** no Confronto (os dois lados rolam): o livro só descreve Ação × Ação passiva. A disputa é provisória — maior total vence, empate pela maior ação, acerto crítico vence quem não tirou crítico.
- **Tabela de itens** (capítulo 5): o app ainda usa itens de exemplo.
- **Capacidades dos atributos**: grifadas ("rever regras dentro do MSA") — aparecem com o selo "em revisão".
- **Penalidade de idade** (abaixo de 15 / acima de 60): o app só avisa, não aplica sozinho.

## Diferenças MSA × MSS que o app já respeita
| Assunto | MSA | MSS |
|---|---|---|
| Subperícia Briga › Defesa Desarmada | não existe | existe |
| Rolagem alternativa de atributos (4D4…) | existe | não existe |
| Sacrifício (habilidade única humana) | sucesso automático + 1D6 de dano puro | +10% de acerto e perde o D6 atual de vida |
| Iniciativa | quem cai primeiro quando os dois lados chegam a 0 PV | quem começa atacando |
| Corrida e Natação | efeitos do texto antigo | +1,5 m de deslocamento em teste bem-sucedido |

## Livro MSS
- **Tabela de Progressão por Nível**: só o livro MSS traz a tabela preenchida (+2 atributo, +20 perícia, +5 PV por nível, +1 vantagem nos níveis pares). Confirmado que vale para os dois sistemas — o livro MSA ainda está com a tabela vazia.
- **Humanidade no livro MSS** ainda diz "Desenvolver": o app usa as mesmas regras do MSA (confirmado).
- As tabelas de classe do MSS são iguais às do MSA (conferido).

## Combate e social automáticos (só MSS)
Ligados por `modulos.combate` / `modulos.social` em `mss.json`; no MSA ficam só os testes, a iniciativa e os PV. Regras em `shared/combate.js`.

**Confirmado pelo autor**
- **Defesa**: quem escolhe é o defensor (o jogador do alvo; o mestre nos NPCs). O atacante declara o ataque e ele fica "aguardando defesa". Esquiva vale contra Briga e Armas Brancas e, se o defensor não for acertado, permite deslocar até 1,5 m. Defesa desarmada só contra Briga. Evasão só contra ataque em área e exige deslocamento. Cobertura (+30) só contra ataques a distância.
- **R.MNP** = perícia base Manipulação + 50 + outros modificadores (humor e o campo "Mod. R.MNP" que o mestre ajusta no cartão). Usa o valor final da perícia base (pontos + bônus pericial de CAR + itens), para escalar com o personagem.
- **IP** subtrai do dano recebido. Vem dos itens equipados (campo "defesa") e de habilidades (campo "IP de habilidades" que o mestre ajusta no cartão).
- **Vantagem / Desvantagem**: rola 2d100 e fica com o maior / menor; uma anula a outra.
- **Tiro** (a distância, fora de área): não há defesa; a dificuldade é 50 + 5 × nível do alvo (+30 com cobertura parcial).
- **Esquiva contra ataque armado**: se o defensor for acertado, o dano é +2.
- **Defesa armada** usa a perícia da arma que o defensor está empunhando.
- **Só o ataque rola**: o valor da defesa é a subperícia escolhida + 50.
- **IP não zera o dano**: mínimo 1.

**Ainda provisório — conferir**
- **+2 da Esquiva** entra antes do IP (soma ao dano bruto).
- **Defesa armada** só com armas brancas (Toque e Chicote não servem); arma de fogo empunhada não defende corpo a corpo.
- **Evasão bem-sucedida** contra ataque em área: metade do dano (texto do livro).
- **Efeito de dano**: marcador quando o ataque acerta e o DS ≤ "efeitoDano" da arma (sem o campo, 3). Corte = Sangramento, Perfuração = Ferida aberta, Concussão/Elétrico = Aturdido, Calor/Frio/Ácido = Queimadura, desarmado = Dor. Sangramento, Ferida aberta e Dor ainda são descontados à mão.
- **Vantagem automática**: surpresa, terreno elevado, alvo caído (corpo a corpo), alvo Aturdido/Imobilizado, atacante Enojado. **Desvantagem**: atacante caído ou aturdido, atacante Amedrontado.
- **Crítico**: +1 dado igual ao primeiro dado da arma. Erro crítico sempre erra.
- **PV**: 0 ou menos → Desmaiado; dano com PV já negativo → Morto (exceto não letal). Sobrevida: −1 PV no turno de quem está abaixo de 0 (sem "Estabilizado"); morre ao chegar a −CONS.
- **Sacrifício (MSS)**: +10% no acerto; o D6 de vida atual vai para o dano e o atacante perde esses PV.
- **Manipulação**: subperícia + Amigável/Indisposto de quem manipula e do alvo (±10) + bônus geral do humor. Sucesso troca o humor do alvo; falha libera o humor de falha do livro (Liderança → Desmotivado, Intimidação → Corajoso, Interrogatório/Lábia → Desconfiado) para o dono do alvo escolher.
- **Bônus geral do humor** (Apático −5, Desmotivado −5, Confiante +5, Desconfiado −5) entra sozinho nos testes D-MIL do rolador da sala e no ataque. Motivado e as desvantagens por tipo de teste ainda são aplicados à mão.
- **Itens de exemplo** ganharam `pericia`, `tipoDano`, `efeitoDano` e `alcance` até a tabela de itens real chegar.

**Resolvido**
- **Humores Raivoso e Sereno** (autor): Raivoso = vantagem na iniciativa e R.MNP −20; Sereno = R.MNP +10 e desvantagem na iniciativa.

## Ficha, criação e evolução (15/10)
**Confirmado pelo autor**
- **R.MNP** = Manipulação (perícia base) + 50 + modificadores. CAR% é só para testes genéricos de Carisma.
- **Humanidade** vai de 1 a 100 (o limite depois da criação é 100; 50 + 2×CAR + 2×PER vale só para o valor inicial); abaixo de 1 o jogador perde o controle do personagem (o app só deixa o mestre agir por ele). Inicial: o jogador escolhe de 51 até 50 + 2×CAR + 2×PER.
- **Instintos** são fixos e pré-estipulados (mais voltados ao MSA).
- **Vantagens de classe**: abrem quando a classe é escolhida (nível 3); numa "Vantagem Extra" escolhe-se entre as gerais e as da classe (livro, cap. 4).
- **Nível** só sobe depois de distribuir o XP necessário: 100 XP por nível (regras.xp em base.json).

**Provisório — conferir**
- **Lista de instintos**: só Sobrevivente, Protetor, Altruísta e Dominador (+ "Outro" com texto). Falta a lista completa com descrições.
- **Custo das vantagens de classe**: 1 ponto, como as gerais.
- **Mestre**: edita fichas de jogador com as mesmas travas de pontos e de XP; a opção "Edição livre das fichas de jogador" (aba Campanha) desliga as travas para correções. NPCs não têm trava.
- **Munição**: cada ataque com arma de fogo gasta 1 bala (cadência natural); arma nova vem carregada; recarregar usa as caixas de munição do mesmo tipo do inventário. Cadência maior que 1 (Rifle de Assalto) ainda não gasta mais balas.

## Planilhas do autor (15/10): itens, armadilhas e regras gerais
Regra combinada: **o livro é mais atual**; das planilhas só entra o que o livro não traz.

**Itens** (`conteudo/sistemas/itens.json`, gerado por `ferramentas/itens/gerar_catalogo.mjs`)
- 1449 itens: os 574 da "itens revisao parcial 1" (prioridade) + os da "itens" que não estão na revisão (marcados "em revisão"). Mesmo nome nas duas = vale a revisão. 23 itens da planilha original tinham o mesmo "num ctrl" de outro item da revisão e ganharam o id com "a" no fim.
- O app deduz das colunas: tipo (Finalidade/Categoria), slot (arma = mãos; escudo = mãos; capacete = cabeça; armadura = corpo; vestuário = vestimenta; acessório = joias), mãos = MAESTRIA 2 → duas mãos, IP ("IP +N", "Defesa +N", "RD N" nos efeitos), bônus de atributo ("CAR +1", "Penalidade AGI -1"), penetração ("Ignora RD N"), perícia (Pericia Base + Subgrupo; nomes antigos como "Combate / Haste" viram Arma Branca › Lança).
- Colunas opcionais "App: …" corrigem a dedução item a item (tipo, slot, mãos, IP, bônus, alcance, capacidade de munição, tipo de munição, quantidade, efeito de dano, em revisão).
- **Munição**: as planilhas não têm capacidade do pente; armas sem "App: capacidade (balas)" não contam balas.
- **"Defesa +N"** dos itens de proteção foi tratado como IP. Conferir.
- Na criação ficam de fora itens Raros, Lendários, Únicos e Ilegais (planilha de regras gerais: créditos iniciais não compram raros). Créditos iniciais: 300 (livro), não 400 (planilha).
- 23 armas ainda sem perícia reconhecida (ex.: "Ciências / Psiquismo", "Armadilhas / Explosivos"); usam o ataque desarmado até ganharem perícia.
- 3 danos não roláveis ("Variável", "Vício ND30") ficam só como texto.

**Regras gerais (planilha mais antiga que o livro)**
- Adotado (o livro não trazia o número): margem do efeito de dano por tipo — Corte 2, Perfuração 3, Concussão 1, Elétrico 2, Calor 4, Frio 2, Ácido 8 (DS ≤ margem aplica o efeito). Penetração N ignora N pontos de IP (também está no livro).
- Ignorado por conflito com o livro: PV = FOR + CONS; acerto crítico em 1–5 e erro em 96–100; morto em −10 PV; Amigável/Indisposto ±5%; Abalado < 20 / Instável < 12 / Surtado < 6; créditos iniciais 400.
- Já usado no app: carga (carregamento = 40 × 2^((FOR−10)/6), levantamento = 2×, sobrecarregado/supercarregado; o círculo do mapa lembra o deslocamento menor).
- Ainda não usado no app (sem conflito, fica para depois): esmagado (automático), Dureza, PVs persistentes/permanentes, regeneração (1d4 × nível no descanso longo), deslocamento 9 m, capacidades com descrição.

**Armadilhas** (planilha lida; ainda não automatizadas)
- 7 armadilhas prontas (Alarme de Latas, Buraco de Estacas, Pêndulo de Sucata, Garra Enferrujada, Chicote de Espinhos, Rede de Queda, Mina Química Improvisada), tabelas de gatilho, área, progressão de dano e efeitos com modificador de ND.

## Sala Social (padrão do autor, 15/10) — vale para MSA e MSS
**Confirmado pelo autor**
- **Rebote** (falha na manipulação) pelo espectro do relacionamento — como o alvo vê quem manipula no mapa de relacionamento: A Aliado/Amigável, B Desconhecido (Neutro ou sem relação), C Rival/Inimigo. Matriz de Lábia, Sedução, Intimidação, Liderança e Empatia conforme o texto do autor; sucessos novos dessas cinco.
- **Máscara**: humor real (oculto; dá os bônus/ônus) × humor aparente (o que a sala vê). Empatia → "ler o humor real": no sucesso, só quem testou vê "A máscara caiu…".
- **Dissonância**: agir contra o humor imposto = dano de Sanidade. **Agressão súbita**: atacar um humano no meio do diálogo = dano de Humanidade.

- **Rebote com duas opções**: o alvo escolhe (botões no cartão dele).
- **Dano temporário**: dissonância (Sanidade), agressão súbita e Apático (Humanidade) são temporários; no descanso longo, teste de **Consciência** (WILL%, ND 100) recupera.
- **Apático** custa só Humanidade (1D6 temporária); quebrar outro humor imposto custa Sanidade.

**Provisório — conferir**
- "Neutro" sozinho no rebote = sem efeito.
- Dano da dissonância e da agressão: 1d6 temporário (valor ainda não definido pelo autor).
- Teste de Consciência que falha: a perda temporária vira permanente (uma tentativa por descanso longo).
- Dissonância: só quando o jogador muda o humor real que foi imposto (por manipulação ou pelo mestre). A máscara não conta como quebra.
- Agressão súbita: vale quando atacante e alvo estão os dois na Sala Social; uma vez por agressor até a sala ser esvaziada; criaturas do Livro dos Monstros não são humanas.
- O rebote e a manipulação bem-sucedida tiram a máscara do alvo (a reação aparece para todos).
- **Resolvido (autor):** rebote de Impressionar → Enojado, Interrogatório → Desconfiado, Tortura → Confiante, Etiqueta → Confiante (iguais para A, B e C). O rebote nunca é obrigatório ("Não reagir").

## Itens: o que os jogadores veem
- Jogadores veem Mundano, Comum e Incomum. Acima disso só com o mestre liberando: todos de uma vez (Loja → "Jogadores veem todos os itens") ou item a item (botão "Liberar"). O servidor também não deixa comprar item escondido.

## Respostas do autor (15/10, fim do dia)
- **Instintos**: guiam o mestre quando o personagem perde o controle (inconsciente), sem regra mecânica. O app traz uma descrição para Sobrevivente, Protetor, Altruísta e Dominador.
- **Cadência**: como no livro — cadência 2 (Rifle de Assalto) gasta 2 balas por ataque e dá 2 danos (cada um desconta o IP; crítico, localizado e bônus entram no primeiro). Coluna opcional "App: cadência" nos itens.
- **Humanidade 51**: limite mínimo só na criação; durante o jogo pode cair abaixo.
- ~~Lembrar o autor: rebote de Impressionar, Interrogatório, Tortura e Etiqueta~~ — respondido (ver Sala Social).

## Condições (marcadores)
- A lista vem do livro (necessidades, fadiga, dano, mobilidade, mental, estado mental, vício, marcadores). Os números entram sozinhos na ficha: atributos (ex.: Fome CONS −1), % de todos os testes (Cansado −10%), % por atributo (Alerta PER +20 / INT −20) e % de perícias (Trauma momentâneo −30% em Briga, Arma Branca e Armas de Fogo). As que acumulam (Fome, Sede, Sono, Doença, Dor, marcadores) contam cada marcação.
- PV máximo não muda com a CONS reduzida por condição (provisório).
- Trauma profundo: −20% nos testes (planilha de regras gerais; o livro só diz "volta o ônus do trauma").

