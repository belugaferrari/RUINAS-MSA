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
- **"Defesa +N"** (coluna Efeitos da planilha de itens) segue como IP por enquanto. O autor pediu para não considerar ainda: os itens estão em revisão (19/10).
- Na criação ficam de fora itens Raros, Lendários, Únicos e Ilegais (planilha de regras gerais: créditos iniciais não compram raros). Créditos iniciais: 300 (livro), não 400 (planilha).
- 23 armas ainda sem perícia reconhecida (ex.: "Ciências / Psiquismo", "Armadilhas / Explosivos"); usam o ataque desarmado até ganharem perícia.
- 3 danos não roláveis ("Variável", "Vício ND30") ficam só como texto.

**Regras gerais (planilha mais antiga que o livro)**
- Adotado (o livro não trazia o número): margem do efeito de dano por tipo — Corte 2, Perfuração 3, Concussão 1, Elétrico 2, Calor 4, Frio 2, Ácido 8 (DS ≤ margem aplica o efeito). Penetração N ignora N pontos de IP (também está no livro).
- Ignorado por conflito com o livro: PV = FOR + CONS; acerto crítico em 1–5 e erro em 96–100; morto em −10 PV; Amigável/Indisposto ±5%; Abalado < 20 / Instável < 12 / Surtado < 6; créditos iniciais 400.
- Já usado no app: carga (carregamento = 40 × 2^((FOR−10)/6), levantamento = 2×, sobrecarregado/supercarregado; o círculo do mapa lembra o deslocamento menor).
- **Já usado no app (19/10):** deslocamento (9 m = 6 quadrados; −3 m por membro inferior ferido, −4,5 m sobrecarregado, 1 passo supercarregado, 0 se preso); Esmagado (perde 1 PV por 20 kg acima do levantamento no fim do turno); lembrete do teste de FOR do Supercarregado (+5% por turno); Dureza dos itens (coluna "App: dureza" ou "Dureza N"); PV persistentes e permanentes (baixam o PV máximo; o mestre lança); capacidades com usos = MOD por descanso longo.
- Ainda não usado no app: arrastar (trenó), Dureza no dano automático (nenhum item da planilha tem Dureza ainda), regeneração de SAN da planilha (o livro manda: 1d6 no descanso longo).

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
- **Confirmado (autor, 19/10):** dano da dissonância e da agressão = 1d6 temporário.
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
- **Confirmado (autor, 19/10):** Imobilizado também não se move (círculo vermelho no mapa, deslocamento 0).
- A lista vem do livro (necessidades, fadiga, dano, mobilidade, mental, estado mental, vício, marcadores). Os números entram sozinhos na ficha: atributos (ex.: Fome CONS −1), % de todos os testes (Cansado −10%), % por atributo (Alerta PER +20 / INT −20) e % de perícias (Trauma momentâneo −30% em Briga, Arma Branca e Armas de Fogo). As que acumulam (Fome, Sede, Sono, Doença, Dor, marcadores) contam cada marcação.
- PV máximo não muda com a CONS reduzida por condição (provisório).
- Trauma profundo: −20% nos testes (planilha de regras gerais; o livro só diz "volta o ônus do trauma").


## Descanso (livro, "Descansos, regeneração e outras regras") — 19/10
- Curto: 1 PV. Longo: 1d4 PV por nível e 1d6 de Sanidade; sem Conforto (roupas), Abrigo ou Ergonomia: −1 PV por dado para cada critério que faltar (mínimo geral 1 PV); itens de proteção equipados tiram o Conforto. Testes dos marcadores no descanso longo e depois os marcadores são zerados. Dor e Trauma profundo NÃO terminam no descanso (correção: a versão anterior usava a planilha).
- Lembretes (não automáticos): Regeneração Lenta, Insônia, Metabolismo Acelerado, Soldado de Campanha, Habitat magnífico, Ligação natural; Primeiros Socorros (+1 PV nos próximos 3 descansos).

**Respostas do autor (19/10)**
- Descanso interrompido: botão próprio; 1d2 PV por nível e 1 de Sanidade (o Sono não some).
- Descanso longo pelo jogador: janela para confirmar Conforto, Abrigo e Ergonomia; com Conforto, a armadura e as armas equipadas são guardadas antes de dormir. O jogador faz 1 descanso longo e 2 curtos por dia do relógio; o mestre não tem limite.

**Provisório — conferir**
- **Marcador de vulnerabilidade sem estar doente**: CONS% ND 40 + 10 × marcadores (o autor vai confirmar a regra); falha → Doente. Já doente: ND 70 + 10 × marcadores (livro).
- **Mutação temporária** (falha nos marcadores genéticos): o app só avisa. **LEMBRAR O AUTOR: mandar a TABELA DE MUTAÇÕES (100 mutações)** para o app sortear.

## Durabilidade (livro, cap. 5) — 19/10
- Falha usando o item: se o DS for maior que a durabilidade atual, perde 1; sem os pré-requisitos, qualquer falha desgasta; em 0 quebra (arma quebrada não ataca). No combate MSS a arma do ataque que falhou desgasta sozinha; fora dele, o botão "falhou usando" pede o DS.
- Reparo (autor): +1, nunca acima da original e nunca dois seguidos — depois de um reparo, só depois de um novo desgaste (caiu 3, sobe só 1), salvo habilidades.
- "C" na planilha = Consumível (233 itens) e "AC" = Autoconsumível (1 item): ficam sem contagem (antes tinham virado durabilidade 1). 2 itens estão sem durabilidade na planilha: Ampola de Absorção de Chamas e Bateria de Lítio Reciclada.

## Relógio e clima (19/10)
- O mestre passa o tempo de 6 em 6 horas (botão "+6 h" no topo). Cada personagem-jogador conta horas sem comer, sem beber e sem descanso longo (livro, Necessidades): 24 h sem beber = Sede (+1 a cada 12 h; beber tira na hora); 24 h sem comer = CONS% ND 90 (+10 a cada 2 h) para não ficar com Fome (+1 a cada 24 h); 24 h sem descanso longo = Sono (+1 a cada 24 h; some com o descanso longo).
- Caos meteorológico (livro): 2d20 (dias de estabilidade e clima pela tabela); a cada novo dia do relógio, 1d6 — se der 1, relança; acabou a estabilidade, relança. Jogadores veem o dia, a hora e o clima.

**Confirmado pelo autor (19/10)**
- Comer (botão ou descanso curto) zera as horas sem comer e tira a Fome toda.
- O descanso longo não avança o relógio (o mestre passa o tempo).
- Durante o combate os efeitos das Necessidades (Fome, Sede, Sono, Doença, Friagem) ficam suspensos; no fim do combate, quem tinha algum faz CONS% difícil (ND 100) — falhou: Exausto + Marcador de Vulnerabilidade.
- Automáticos: Absorver Nutrientes (fome só com 36 h; descanso curto 2 PV), Metabolismo Acelerado (defeito: fome com 12 h; transmorfo: descanso curto 2 PV e +1 PV por dado), Apoteose Sintética (imune a Fome, Sede e Sono), Mutações Decrépitas (não acumula Fome, Sede e Sono), Raquítico (+25% contra a fome), Soldado de Campanha e Marcha (vantagem contra fadiga; Soldado também contra doença e sem ônus de Conforto/Ergonomia), Regeneração Lenta (metade nos descansos), Insônia (CAR% difícil no descanso longo; falhou: metade e Sono), Insônia pós-traumática (1d10 < 5: vale como descanso curto e Sono).
- Só lembrete (dependem da situação): Habitat magnífico, Ligação natural, Hibernação, Glutão, Pele de Jardim, Vigia, Guarda de posto.

## Empatia natural (regra do aplicativo, autor 20/10)
- Cada humano emite o humor APARENTE com influência = CAR% + 1d100 + bônus gerais de Manipulação (−20 se mascarado), contra o R.MNP de cada receptor (aliado/amigo −10, rival/inimigo +10, mesmo espectro −10, espectro inverso +10). Conta-se os sucessos por espectro: vence o seu → vai para o humor vencedor (mais sucessos; empate, maior influência); vence o oposto → Neutro; Neutro → humor vencedor. O jogador NÃO é avisado: não sabe se mudou por manipulação ou pela empatia natural (autor, 20/10). Texto no livro de regras (MSA e MSS), antes de Sanidade.

**Provisório — conferir**
- "Bônus gerais de Manipulação" = o que soma na perícia base Manipulação além dos pontos e do bônus de atributo (itens, habilidades ativas, condições) + o bônus geral do humor.
- Empate entre os espectros (mesmo número de sucessos) → o humor não muda.
- Neutro e Apático não emitem; Apático não é afetado; criaturas ficam de fora.
- A afinidade usada é a de como o RECEPTOR vê o emissor.
- O humor que muda pela empatia natural fica "imposto", igual ao de uma manipulação (mudar depois causa dissonância), para o jogador não distinguir as duas.

## Escolha do humor (autor, 20/10)
- O jogador escolhe o próprio humor só ANTES de entrar na Sala Social, entre Amigável, Neutro e Indisposto. Lá dentro só muda por manipulação, empatia natural ou mestre. Apático deixou de ser escolha livre.
- Habilidades: Irreverente (Galante, nível 15) libera qualquer humor a qualquer momento. Outras habilidades que mexam nisso ainda precisam ser listadas.
- **Confirmado (autor, 20/10):** a máscara (humor aparente) pode ser trocada dentro da sala.

## Habilidades com regra própria (planilha do autor, 20/10 — 1ª parte, 27 itens)
Regras em `conteudo/sistemas/habilidades-regras.json` (automática / ligar / ativar com custo, usos e duração). Progressão de dano do livro: D4 > D6 > D8 > D10 > D12 > 2D6 > 2D8 > 2D10 > 2D12 > 3D10 > 3D12 > 2D20 (dado fora da tabela usa o de média mais próxima).

**Provisório — conferir**
- Tipos de criatura: Humanoide, Animal, Besta, Monstro, Mutante, Drone, Autômato, Máquina (o mestre escolhe no NPC; PJ = Humanoide; NPC marcado como criatura = Monstro). **Autor (21/10): por agora está bom; ampliar quando as criaturas estiverem prontas.**
- **Confirmado (autor, 21/10):** Essência monstruosa iguala o atributo do personagem ao mais alto do monstro (rinoceronte com CONS 18 → CONS 18), mesmo que fique menor. O monstro precisa ter atributos na ficha.
- **Confirmado (autor, 21/10):** Quebra-Hordas usa o campo Raça da ficha (o mestre preenche no NPC). Provisório: vale contra Animal, Besta, Monstro e Mutante; sem peões no mapa, o app não confere a distância.
- Guerras diplomáticas devolve o adversário à situação dos **Civilizados** (Encantado, nível 12 — autor, 21/10): para atacar o Encantado ele precisa passar de novo em WILL% Difícil. Provisório: o teste de WILL é feito uma vez por combate para cada adversário (não a cada ataque); quem passa e ataca primeiro fica com −10% em todos os testes até o fim da batalha.
- Dano ao sistema: contra drone/autômato/máquina é Normal e o dano (− IP elétrico) vai no PV; contra item na mão de alguém é Difícil e o mestre aplica o dano no item.
- **LEMBRAR O AUTOR (21/10):** rever como dano afeta itens — itens não têm PV, têm durabilidade (Dano ao sistema e outros).
- Núcleo energético: o personagem começa com coração humano (1d6 de dano por carga); o mestre marca "coração artificial". **Aguardando o autor reler a classe.**
- Aceleração Sináptica: os 3 turnos contam no fim de cada turno do personagem (o turno em que ativou conta).
- Ataque afiado / Aperfeiçoamento do soldado: Afiada N = quantas vezes recebeu a habilidade; o app não avança o relógio pelas 2 h de treino.

**Ainda por fazer (sistemas novos pedidos na planilha)**
- Área de criaturas controladas (familiares, animais, implantes, autômatos): Malha neural, Autômatos de combate, Segunda formação, controle de implantes do ciborgue.
- Armadilhas: criar (componentes, regras do livro), guardar no inventário, colocar no mapa (visíveis), Armadilha móvel; Zona de Abate automática a até 6 m de armadilha sua.
- Melhorias de arma pelo mestre (próprias e passageiras), além das das habilidades.

## Livro dos Monstros por planilha (autor, 21/10)
- Tamanhos: Diminuto, Pequeno, Médio, Grande, Enorme, Colossal (confirmado).
- Monstros não têm Sanidade nem Humanidade (confirmado).
- Defesas dos monstros calculadas como as dos personagens (atributos + perícias/subperícias + 50), mais as vantagens/habilidades (confirmado).
- Coluna "Comportamento" para descrever como o monstro age (pedido do autor).
- Imagem: link do Google Drive/internet na planilha, ou arquivo enviado no app (Livro dos Monstros > Enviar imagem).

**Provisório — conferir**
- O acerto do ataque vem da subperícia escolhida (padrão: Briga › Ataque desarmado); "Acerto %" na planilha substitui. A FOR entra no dano corpo a corpo, como no personagem.
- PV em branco: calculado como no personagem (FOR + CONS + 5 por nível depois do 1º).
- Resistência = metade do dano; vulnerabilidade = dobro; imunidade a um tipo de dano = dano zero (e imunidade a efeito, ex.: Dor, impede o marcador).
- O livro enviado vale para todas as campanhas do PC (como o catálogo de itens).
