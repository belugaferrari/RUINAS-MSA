# Pendências dos livros (MSA rev. 14/10/2026 15:29 · MSS rev. 14/10/2026 20:26)

> **LEMBRETE PARA A FINALIZAÇÃO (autor, 28/10):** quando o app estiver para ser finalizado, lembrar o autor de pedir para
> **dobrar todos os efeitos de dano e de cura** (não fazer antes: ainda falta entrar muita informação).

> **Ações por turno (autor, 29/10):** todo ataque (arma, desarmado, habilidade) gasta a ação principal; repetir uma ação
> já gasta no turno (ou a reação na rodada) agora é recusado, e nada da ação fica pela metade.


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
- **Mutação temporária** (falha nos marcadores genéticos): sorteada na tabela de mutações (d100) — ver 26/10.

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
- Criaturas podem ter habilidades únicas (coluna "Única" na aba Habilidades: não podem ser copiadas por Mutante/Transmorfo nem reveladas por Zoologia) e até duas afinidades elementares (autor, 21/10).
- **Afinidade elementar (autor, 22/10):** o monstro recebe metade do dano do seu elemento principal (a 1ª afinidade); os ataques podem ou não causar dano elemental (é o "Tipo de dano" de cada ataque); não existe elemento oposto. Elementos: Elétrico, Calor, Frio, Energia (Mágico), Radiação. "Frio" entrou na lista de tipos de dano (o livro o cita como elemental).
- Provisório: a 2ª afinidade não reduz dano (só a principal); resistência e elemento principal juntos não somam (metade uma vez só).

## Sala Social e testes (autor, 22/10)
- Humor aparente: padrão Neutro; pode ser igual ao real (assim a mudança do real não aparece). A troca do humor real só vai para o registro do dono e do mestre.
- Intuir humor: sem rebote; quem testa recebe "Você percebe que X está …" — falhou → o aparente, passou → o real, sempre com a mesma frase.
- Testes ocultos da Sala Social: o jogador não vê número nem resultado, só a arte "Teste feito".
- Afinidades: só mudam antes do 1º teste do personagem na Sala Social (o mestre sempre pode); liberam ao sair da sala ou quando o mestre a esvazia.
- Avisos ficam 15 s ou até fechar no ✕.
- Vantagem/desvantagem: o DS também rola duas vezes (maior na vantagem, menor na desvantagem).
- Reparar item (cap. 5): teste de manutenção; sucesso +1 de durabilidade (1 por desgaste); erro crítico ou 3 falhas seguidas → sucata.

**Provisório — conferir**
- Humor nos testes: Atraído → Percepção (PER e perícias de PER) em desvantagem; Amedrontado → Percepção em vantagem; Enojado → testes mentais = INT, PER, CAR e WILL (confirmado pelo autor, 22/10) em desvantagem; Corajoso → Inteligência em desvantagem.
- Ainda não automáticos: "vantagem contra Medo" (Desmotivado, Corajoso) e Motivado (+5% ligados à motivação / −5% nos demais) — o mestre aplica como modificador.
- **Reparo (autor, 22/10):** ND 60 + 10 × pontos de durabilidade perdidos (está no livro). Provisório: perícia sugerida pelo tipo do item (Mecânica, Militar, Elétrica, Computação); sem kit no inventário o app só avisa.
- Testes comuns nos Rápidos: Cozinhar (Arte › Culinária), Acampar (Sobrevivência básica), Esfolar, Rastrear, Navegar, Pescar, Cultivar, Primeiros socorros, Costurar (Arte › Costura).

## Combate: economia do turno, efeitos e ataques especiais (autor, 22/10)
- Sangramento: perde 1 PV já no 1º turno do personagem afetado; depois, 1 PV a cada 1d4 turnos, até 6 PV.
- Só o mestre cancela efeitos ou muda os turnos que faltam (clicando no ícone do efeito).
- Economia do turno (livro): 1 ação principal, 1 de movimento, 1 bônus (com habilidade/item), ações livres; ação completa = principal + movimento; reação 1 por rodada, fora do turno. O app marca o que foi gasto (o ataque gasta a principal; atacar fora do turno gasta a reação; habilidade de ativar gasta a ação dela) e AVISA quando passa do limite, sem bloquear.
- Tempo de cada habilidade: lido do texto do livro (104 das 418 citam a ação); nas outras aparece "ação ?" e o mestre define no lápis ("ação: bônus").
- Ataques especiais e ações de habilidades (todas as classes) entram nas opções de ataque, com "Usar" (anota e gasta a ação) e os dados citados no texto.

**Provisório — conferir**
- Habilidade que cita mais de uma ação (ex.: Despertar: bônus; livre se for atacado) mostra a primeira; as outras aparecem ao passar o mouse.
- Ataques especiais com regra automática (dano, alvo, efeito) ainda são poucos: os outros anotam o uso e rolam os dados; o mestre aplica o resto.
- **Reações e ações livres (autor, 22/10):** viram um "ataque especial momentâneo" para o personagem atacado: ao ser atacado, cada habilidade dele de reação ou ação livre aparece como oferta (Usar/Dispensar) até o próximo turno. Provisório: o gatilho é lido do texto ("falhar … ataque" só quando o ataque errou; "corpo-a-corpo" só contra corpo a corpo); a reação é 1 por rodada; reação de ataque ataca quem atacou com a primeira arma equipada.
- Tamanhos: a planilha do autor usa também Miúdo e Imenso (aceitos; ordem provisória: Diminuto, Miúdo, Pequeno, Médio, Grande, Enorme, Imenso, Colossal).
- **Aguardando o autor:** a planilha de monstros do Drive usa afinidades além dos elementos (Água, Fogo, Tóxico, Neutro, Vampiro, Submundo, Místico, Ordem, Caos, Terra, Psíquico, Metal, Areia, Planta, Pedra, Ar). Falta definir a lista oficial e a qual tipo de dano cada uma corresponde para a regra da metade do dano.
- **Livro dos Monstros do autor (22/10):** os 75 monstros da planilha "Monstros-app" (Google Drive) viraram o livro padrão do app (conteudo/sistemas/monstros.json); os 2 exemplos inventados foram tirados. Duas subperícias com a perícia errada foram corrigidas pelo nome (Esportes › Esquiva → Briga › Esquiva; Armas de Fogo › Chicote → Arma Branca › Chicote).
- **Afinidades elementais (autor, 22/10):** todas as da planilha valem (Água, Ar, Areia, Caos, Elétrico, Fogo, Frio, Gelo, Metal, Místico, Neutro, Ordem, Pedra, Planta, Psíquico, Submundo, Terra, Tóxico, Vampiro; mais Calor, Energia, Radiação). Relação com os tipos de dano (base.json "afinidadesElementais"): Fogo/Calor → Calor; Frio/Gelo → Frio; Elétrico → Elétrico; Tóxico → Venenoso; Psíquico → Psíquico; Energia → Energia; Radiação → Radiação. **Aguardando o autor:** Água, Ar, Areia, Caos, Metal, Místico, Neutro, Ordem, Pedra, Planta, Submundo, Terra, Vampiro (por enquanto não reduzem dano).

## 24/10 — a confirmar com o autor
- Duas armas: o segundo ataque (outra mão) gasta a ação bônus (autor, 26/10).
- Duração das habilidades: depende da descrição (autor, 26/10). O app lê "por/durante/dura N turnos/rodadas/minutos" (1 minuto = 10 turnos); sem duração no texto (ex.: Despertar), fica até o fim do combate (o mestre pode encerrar antes no ícone).
- Arma natural: Ataque Desarmado Treinado (ADT) também soma nela (usa a perícia do desarmado). Confirmar.
- Garras/presas: dano de perfuração para as duas (autor, 24/10).

## 24/10 — Monstros: estágios e deslocamentos
- A planilha antiga tinha os estágios só no texto. O app criou estágios apenas onde o deslocamento citava um estágio
  ("Voo (Estágio 2) 12 m"). O resto (PV, poderes de cada estágio) o autor preenche na aba Estágios.
- Ficha "Base" = a linha da aba Monstros. Ataque/habilidade com a coluna Estágios preenchida só aparece nesses estágios.

## 25/10 — LEMBRETES DO AUTOR (Livro dos Monstros)
- [x] (25/10) Perícias de todos os seres refeitas pelo Claude: base + subperícia ≤ 5 + 5 × nível, por estágio; principais no limite,
      secundárias ~75%, menores ~50% (ataques, defesa pela AGI, deslocamentos, sentidos, caça/furtividade, e as escolhas do autor).
- [ ] **Conferir as perícias refeitas** (o autor revisa se faz sentido para cada ser) (monstros e animais). O valor da planilha é o investido (como na ficha);
      o limite é base + subperícia ≤ 5 + 5 × nível da criatura (ou do estágio). O app marca "revisar" no Livro
      (só o mestre vê) e avisa ao puxar a planilha. Hoje passam do limite: Abutre, Morcego, Coelho, Coruja, Bode,
      Macaco, Pomba, Sapo Venenoso, Aranha Venenosa, Corvo, Escorpião, Rato, Raposa, Gato, Piranha (todos nível 1).
      Contando os estágios são 23: estágios de nível baixo (filhote nível 1) herdam as perícias do adulto — preencher as
      perícias de cada estágio na aba Estágios (colunas novas Perícias / Subperícias).
      Bombô: "Braçada de Gorila" usa Ataque desarmado sem pontos em Briga. 98 criaturas sem subperícia de defesa.
- [ ] **Rever os NDs** (Dificuldade), inclusive valores menores que 1 (0,5 = 1/2; 0,25 = 1/4) para animais fracos
      (rato, pomba, coelho…). Hoje o menor ND da planilha é 1.

## 25/10 — Encontro por ND (com IA opcional)
- Escolhas provisórias: o encontro gerado só aparece para o mestre; "Ler para a mesa" põe o cenário no registro;
  "Quantos" + "mesma criatura" (bando) ou criaturas diferentes dentro da faixa.
- Ataques em área no mapa (círculo/cone/linha): o autor vai pensar mais antes de fazer.

## 25/10 — Objetos do mapa (parte A)
- Árvore = cobertura total (autor). Cobertura automática só no ataque a distância (livro); o mestre pode ignorar.
- Habilidades que mudam a cobertura já ligadas: Tiro preciso (ignora parcial com armas de fogo), Combate de Trincheira
  (parcial vira total contra atiradores a mais de 9 m). Outras: avisar quais.
- Ainda não: a área (cone/linha) parar no obstáculo; terreno difícil custar o dobro no deslocamento (hoje só aparece no mapa);
  (parte B feita em 26/10: Mapa > "Ler o mapa com IA", com revisão do mestre.)

## 26/10 — respostas do autor
- **IP perfurante dos monstros:** base 5 + ½ ND (do estágio, se houver), somado ao "IP por tipo" de Perfuração da planilha.
  Provisório: meio ND arredondado para baixo; vale para todas as criaturas do Livro (monstros e animais).
- **Afinidades → tipo de dano** (metade do dano): Água → Calor; Ar → Concussão e Queda; Areia → Corte; Caos → Psíquico;
  Metal → Corte; Místico → Energia; Neutro → Concussão; Ordem → Frio; Pedra → Concussão; Planta → Venenoso;
  Submundo → Radiação; Terra → Psíquico; Vampiro → Radiação. "Queda" entrou na lista de tipos de dano.
- **Mira e cobertura** só no ataque a distância. **Evasão** gasta a ação bônus de quem se defende (livro), marcada sozinha.
- **Área de ameaça e passo** (livro, Categorias de Tamanho): Enorme e Imenso 2 quadrados; Colossal 3. O ataque corpo a corpo
  fora da área de ameaça (ou do alcance da arma) só avisa. O passo ainda não é usado (o app não tem passo de 1 quadrado).
- **Marcador de vulnerabilidade:** o livro só traz o teste de quem já está Doente (CONS% ND 70 + 10 × marcadores no descanso
  longo). Para quem não está doente o livro não diz → **aguardando o autor** (hoje: ND 40 + 10 × marcadores, provisório).
- **IP por tipo com nome de afinidade** na planilha (ex.: "Água 2", "Pedra 1"): hoje não casa com nenhum dano. **Perguntar ao autor**
  se vale contra os danos da afinidade (Água 2 = IP 2 contra Calor).
- **Imagens:** links do Drive (estágios) funcionam (compartilhados "qualquer pessoa com o link"). Links de página
  (ArtStation, Pinterest, Vecteezy…) não mostram imagem: precisa do link do arquivo da imagem ou subir no Drive.

## 26/10 — Relatório de habilidades (2ª parte: Encantado e Inventor, 42 respostas)
Feito (regras em `habilidades-regras.json`; efeitos próprios em `server/actions.js`, ESPECIAIS):
- **Ataques especiais sociais** (quadro Habilidades > Ativar, com alvo, perícia e humor): Titereiro (contra WILL%), Foco de Atenção e
  Terror Psicológico (contra R.MNP). Passou: o humor do alvo muda e fica preso (1d4 / 1d4+1 turnos; só o mestre muda). Foco: WILL%
  Muito Difícil ou o alvo só ataca o Galante; o Galante soma o CAR na defesa contra ele. Terror: Amedrontado, −30% no ataque (1d4 turnos)
  e 1d6 de Sanidade temporária.
- Arte que Cura (aliados: (MOD CAR)d6 PV temporários; 1×/descanso longo), Inspiração motivacional (vantagem na perícia escolhida
  por 2d4 turnos; 1×/descanso curto ou longo), Inspiração (+1d20 no próximo teste fora do combate; MOD CAR + 1 por descanso longo),
  Olhar Penetrante (+10% contra o alvo até o fim da cena), Imunidade Diplomática (ligar "em cidade": vantagem, CAR nas defesas,
  atacantes em desvantagem), Ataque inesperado, Mestre das imitações, Conhecimento acumulado (+1 MOD INT por vez).
- Inventor: Armadura improvisada (+1 IP por uso, até +2 geral ou +4 de um tipo), Gambiarras profissionais / Gambiarra rápida (item quebrado
  funciona 2d4 / 10 turnos), Reparo de Roda (+1d4 de durabilidade até o fim do combate), Engenharia Reversa, Destruidor de itens,
  Bugigangas de Bolso (CONS% Normal ou Aturdido na área; −15%), Invenção protetora e Invenção! Protetora (reações oferecidas
  sozinhas), Manuseio profissional (+10% e sem desgaste), Aferição Perfeita (vantagem com kit), Restaurador (+10%, repara 2),
  Reparo improvisado, Padrão de ataque (+10% de defesa depois do 3º turno do inimigo), Gerador Elétrico Portátil (contador).
- **Ataque localizado com local**: cabeça, braços, tronco, pernas ou um item equipado do alvo (o golpe vai no item).
- **Trocar itens** entre personagens (botão "Dar" no inventário).
- Marcas temporárias aparecem como ícones no personagem (o mestre tira clicando).
- Corrigido: o nível 6 do Diplomata ("Inspiração" na tabela) é Inspiração motivacional.

**Provisório — conferir**
- Foco de Atenção e Terror Psicológico: o livro não diz contra o quê testar → R.MNP do alvo (como a manipulação). Titereiro: WILL% (livro).
- Arte que Cura: "um total D6 igual ao MOD CAR" → rola (MOD CAR)d6 uma vez e cada aliado recebe esse total (não inclui quem cantou).
- Inspiração (+1d20): soma no resultado do d100 do próximo teste do inspirado (não vale em ataques).
- Bugigangas: a área sai de quem joga (sem escolher o ponto); quem joga não é afetado.
- Olhar Penetrante: "até o fim da cena" = até o próximo descanso (ou o mestre tira).
- Teste que falha (Arte que Cura, Inspiração motivacional…) gasta o uso do descanso.

**Perguntas ao autor**
- Imunidade Diplomática: "+20% em diplomacia" — o app não tem perícia Diplomacia. Qual é (Manipulação › Etiqueta? Institucional › Política?)
- Insultar: o −10% em Manipulação do alvo dura quanto e como se usa (ação? teste?)
- Lavagem cerebral: SAN e HUM "persistentes" do alvo e −5 HUM permanente de quem usa — automatizar?
- Não há item "Sucata" no catálogo: as habilidades que consomem sucata aceitam item com nome "Sucata…" ou item que virou sucata.

**LEMBRETES (fase 2, depende de regras do autor)**
- Aprimoramentos de itens (lista e regras): Mestre da Forja (+4 nas armas forjadas), Modificação momentânea (só os de combate, 10 turnos),
  Ciência excêntrica (tipo de dano + arma personalizada −10% para outros), Segredo (−25% para outros), Manuseio profissional (aprimorado +1),
  Caça Tesouros (item achado aprimorado).
- Criação de armas/itens (Mestre da Forja) e regra de **encontro de itens** (Caça Tesouros).
- **Dano focado em itens** (livro: "Desenvolver"): hoje o golpe no item só é anotado (o mestre aplica); Engenharia Reversa tira 1 de durabilidade.
- **Invenção!** (tabela de criação, 2 pontos por nível; Invenção móvel / mortal / faz-tudo +2 pontos em características específicas):
  item E companheiro. Piloto Neural (controle simultâneo, 300 m), Zangões de metal (5 drones no controle), Sobrecarga de Servomotor
  (+3 m e vantagem por 1+2d4 turnos, depois perde 1 de durabilidade e trava), Gerador Elétrico Portátil como item (taser 1d4).
- Geringonça elemental: acoplar à arma branca (+1d4 do elemento, −10%, dois efeitos de dano; explodir 2d6+1 1×/descanso longo).
- **Gambiarra rápida e Gambiarras profissionais são quase iguais: o autor vai mudar uma das duas.**

## 26/10 — Tabela de mutações (planilha do autor mutacao_mss.xlsx)
- As 100 mutações estão em `conteudo/sistemas/mutacoes.json` e valem no MSA e no MSS.
- Ficha > **Mutações**: o mestre põe uma mutação (escolhida ou sorteada no d100), troca o tipo e tira. O **Mutante** (nível 3+)
  escolhe as dele: 1 controlada e 1 descontrolada (Genes mutantes); para trocar, pede ao mestre.
- Falhou no teste dos marcadores genéticos (descanso longo): o app **sorteia a mutação temporária** e conta as mutações temporárias
  sofridas (na 5ª avisa das Marcas do Destino).
- Mutação descontrolada: DS 10 em qualquer teste (ou ataque) → o próximo turno tem desvantagem em tudo (fora do combate, o próximo teste).
- As mutações entram como habilidades automáticas: o app aplica os números de cada uma; o resto do texto é lembrete.

**Provisório — conferir**
- A planilha não separa benefício e ônus: o Claude separou à mão o que o app aplica ("beneficio" / "onus" no mutacoes.json).
  Controlada = só o benefício; descontrolada e temporária = os dois. 43 mutações têm números; as outras são só lembrete
  (deslocamento, arma natural, dano recebido a mais, testes condicionais…).
- Mutação temporária dura até o mestre tirar (o livro não diz quanto dura).
- "IP cinético" (Barriga inflável) = IP contra Concussão.

**Aguardando o autor**
- Abas "Mutação animal" (Foco Animal, para o Aberrante — Evolução Animal) e "Regras mutação" vieram vazias.
- Cabeça de Animal (12): "sorteie o animal" — falta a tabela de animais.
- Aprimoramentos da Mutação evolutiva (nível 7 e a cada 4) e Mutação aprimorada.
- Corrigido no livro do app: as vantagens "Encanto fatal" e "Lavagem cerebral" estavam coladas no texto de "Ataque inesperado",
  e "Impressionante" no de "Investigador Nato" (Encantado). Agora são vantagens separadas.

## 27/10 — Fichas de teste com itens e descanso com os dados
- Fichas de teste sem arma equipada recebem o kit sozinhas ao atualizar o app (uma vez). O kit agora aceita catálogo com raridade
  em minúscula/sem acento e itens sem preço (contam como 0); se nada passar no filtro, usa o catálogo todo.
  Fichas de teste: marcadas na criação (fichaTeste) ou com nome começando por "Teste".
- Descanso: cada personagem tem a sua entrada no registro com os dados (PV: "3d4 [4, 2, 3] = 9"; Sanidade: "1d6 [5]") e os testes
  dos marcadores (d100 + CONS% contra o ND). O jogador dono vê o resultado numa janela quando o mestre faz o descanso.

## 28/10 — Palco do combate
- Abaixo da faixa de turnos, todos veem: de quem é a vez; o ataque em curso (quem ataca → arma → alvo, "aguardando a defesa");
  o resultado (ACERTO! / CRÍTICO! / DEFENDEU / ERROU) com o dano bruto e o número subindo sobre o alvo; ou o teste feito no campo.
- Som de cada tipo de arma (fogo, projétil, lâmina, machado/martelo, desarmado; bloqueio = tinido metálico), gerado no navegador.
  Cada aparelho liga/desliga no botão do alto-falante. Com os dados na tela, o resultado espera os dados pararem (~1,4 s).

## 28/10 — Fichas de teste refeitas e itens
- Fichas de teste: uma por especialização de cada classe (31: o Perito tem 4), com atributos pelo tema da classe e pelo texto
  da especialização, perícias citadas na especialização, profissão que combina (variando), vantagens e defeito próprios, armas
  sorteadas entre as melhores, nome sem "Teste" e o avatar da especialização. Recriar apaga as anteriores; ao atualizar, o app
  troca as antigas ("Teste · …") pelas novas.
- Bônus de item com "%" ("Percepção -30%") = porcentagem nos testes do atributo e das perícias dele (antes virava −30 no atributo).
  Sem "%" ("FOR +2", "Percepção -5") continua sendo ponto de atributo. **Conferir na planilha** (coluna "App: bônus").
- IP do item por tipo ("App: IP": "geral 2; Físico 4"); a tela mostra "IP 4 Físico" no lugar de "Def".
- Maestria (mãos) na tabela e no cartão do item; o desenho da arma (mão, lista) segue o tipo: lâmina, machado, martelo, fogo, projétil.
- Planilha de itens: "Baixar planilha atual" sai com as colunas "App: …" preenchidas com o que o app usa e uma aba "Leia-me";
  pode ser ligada ao Google Planilhas (o app puxa ao abrir e a cada 30 minutos), como o Livro dos Monstros.
- (28/10) Botão "Atacar com 2 armas" (com uma arma de uma mão em cada mão): faz os dois ataques seguidos — mão hábil −20%,
  inábil −40% (Ambidestria: só o segundo −20%); o segundo gasta a ação bônus.
- (28/10) Defesa não tem teto no app (Esquiva + 50 pode passar de 100). O que tem limite é o ponto investido por perícia
  (base + subperícia ≤ 5 + 5 × nível, livro).
- (28/10) Planilha de itens exportada: todas as colunas originais como vieram (inclusive "A definir"), na ordem do "num ctrl".
  O catálogo do app foi conferido com as duas planilhas do autor ("itens" e "revisão parcial 1", a revisão vale): 1449 itens,
  nenhum faltando. Repetidos na planilha original (mesmo "num ctrl"): 10 no "itens" e 15 no "revisão" — fica a última linha.

## 29/10 — Mapa no turno
- Na vez de um personagem no Campo de Batalha, o jogador dono dele (ou do companheiro) move o peão livremente no Mapa
  (arrastar ou clicar no quadrado). Fora da vez, só o mestre e o Suporte mexem.
- Contador no Mapa: quanto o personagem da vez andou desde o começo do turno (diagonal = 1 quadrado), em quadrados e metros,
  comparado com o deslocamento dele (vermelho se passar — só avisa). Pegadas marcam o quadrado de onde saiu.
- Links: botão "Mapa" no Campo de Batalha e "Campo de Batalha" no Mapa.
- Provisório: o contador mede a distância em linha reta (do início até onde está), não o caminho percorrido.

## 29/10 — Relatório de habilidades (3ª parte: Mutante e Perito, 33 respostas)
Feito no app (vale para MSA e MSS):
- **Ataques especiais com arma própria** (aparecem na lista de armas do Campo de Batalha, com usos): Muco radioativo (2d6 radioativo, 9 m, Armas de Fogo › Projéteis, +1d6 contra quem tem mutação, CONS% do alvo em desvantagem até o fim do combate, 3 por descanso longo), Digestão extracorpórea (cone de 4,5 m, 2d6 ácido, 1 por descanso; o botão Ativar devora quem foi acertado e caiu: +1d4 PV), Sobrecarga Neural (2d8 elétrico que ignora IP, só contra drone/autômato/máquina/ciborgue, 15 m).
- **Resistências e imunidades**: Evolução humana (resistência a Corte, imune a crítico), Corpo Adaptado 2 (o jogador escolhe a resistência; só troca depois de um descanso longo).
- **Escolhas que ficam na ficha**: Mutação monstruosa (tipo do +1d4), Melhor do mundo (+5% numa perícia base no 6º nível e a cada 3; não aceita as de combate).
- **Marcas com contador de turnos**: Mutação precisa (vantagem + CONS→FOR por 10 turnos), Pragas, Analista de risco (bônus ligado ao alvo analisado), Esporos gasosos (até o fim do combate), Cibermédico (membro travado 1d4 turnos).
- **Ofertas depois de acertar um toque/Briga**: Toque contagioso (ação livre) e Cibermédico (ação de movimento, fechando a ação completa).
- **Reações automáticas**: Morte Epidêmica, Epidemia (o contágio continua em cadeia), O Grande Truque, Tóxico, Vetor.
- **Moral** (Mãos da criação e Dançarino): contador na ficha e botão "Usar" (+1d20 no próximo teste). Dança aparece como defesa no lugar da Esquiva.
- **Item Travado** (Bug na rede): continua equipado, não pode ser usado; destrava no fim do combate (o mestre pode destravar antes).
- **Companheiros por habilidade**: Controle Remoto (10 turnos, age logo depois do Hacker), Programador (o item vira companheiro, até 3), Alucinação maligna da Névoa Alucinógena (10 turnos, só ataca quem a vê, dano na Sanidade).
- **Descanso**: O Show Tem Que Continuar (curto: +1d4 SAN e Motivado no próximo combate), Fitoterapia (cria o remédio, que dura 24 h e tem botão Usar), Regeneração degenerativa (volta 1 de CONS por descanso), Roubar Característica (entra no descanso longo, −3 PV persistentes).
- Livro do app: "Corpo Adaptado 2" e "O Show Tem Que Continuar" estavam grudados no texto de outra habilidade e viraram itens próprios; Cibermédico ganhou a frase nova ("1 vez em cada personagem por combate").

Respostas do autor (29/10, mesma noite):
- **Digestão extracorpórea**: o jato usa Armas de Fogo › **Jato** (feito).
- **Pragas**: os marcadores genéticos **estouram e somem** (feito); gasta a ação principal.
- **Regra geral**: habilidade sem a ação descrita no livro gasta a **ação principal** (feito: vale para todas as de ativar).
- **Artefato Corrosivo**: melhora os Frascos Instáveis, onde está o limite: 1 frasco por descanso + 1 do Artefato = 2 por descanso (feito; o frasco extra do teste de Engenharia › Química o mestre soma até os frascos entrarem no app).
- **LEMBRETE (não pedir agora)**: fichas das bestas citadas por habilidades (ex.: **Besta-Cavalo** da Névoa Alucinógena). Até lá a alucinação nasce em branco e o mestre preenche.

Ainda em aberto (o autor vai reler):
1. **Radiação incontida (superaquecer)**: quanto de dano de Calor entra nos ataques físicos? Os 2 marcadores de vulnerabilidade vão para quem está na explosão ou para o próprio Mutante? (Dano de Calor: o mestre aplica; marcadores: em quem está na explosão.)
2. **Bug na rede**: o item fica travado por quanto tempo? (Até o fim do combate.)
3. **Mutação precisa** e **Mãos da criação**: agora gastam a ação principal pela regra geral.
4. **Controle Remoto**: hackear pede algum teste? (Nenhum.)
5. **Sobrecarga Neural**: "Defesa Passiva" do autômato = a mesma defesa contra tiro (50 + 5 × nível)? (Sim.)
6. **Tóxico** (+25% contra veneno) e **Vetor** (+10% contra doença): em qual teste exatamente? (O mestre aplica, até existir o teste de veneno/doença.)

## 29/10 — Combate (pedidos do autor)
- **Capacete** (slot Cabeça / Capacete): o IP dele só vale contra golpe **localizado na cabeça**. Fora disso não entra no IP do personagem (no Campo de Batalha aparece à parte: "Capacete: IP N (só na cabeça)").
- **MOD FOR**: confirmado — soma no dano corpo a corpo (MOD = (FOR − 10) ÷ 2, arredondado para baixo; ex.: FOR 13 → +1). O "−1" visto no teste era o IP do capacete do alvo, descontado de todo golpe (corrigido acima).
- **Mestre atacando**: o painel fica no personagem que atacou (antes ia para o alvo, que esperava a defesa).
- **Itens no Campo de Batalha**: lista de todos os itens do personagem (equipados com o lugar, e os da mochila), com dano/IP, durabilidade, munição, travado/quebrado.

## 29/10 — Planilhas por frente (autor: "uma planilha separada para cada frente")
- **Habilidades** (feito): Livro > Classes > "Habilidades, classes e vantagens (planilha)". Abas Habilidades, Classes, Especializações e Progressão.
  O texto do livro e as colunas de regra do app (Modo, Ação, Efeitos, Especial, Dano, Tipo de dano, Perícia, Alcance, Usos, Recarga, Duração, Escolhas)
  ficam lado a lado. Mudar o dano = mudar a coluna "Dano". Ligada ao Google, o app puxa sozinho a cada 30 minutos.
- Próximas frentes, nesta ordem: **Mutações** → **Profissões** → **Armadilhas** → **Aprimoramentos de itens** → **Cibernéticos**.
- **Cibernéticos**: ainda pouco desenvolvidos; algumas regras estão implícitas na classe **Ciborgue** (o app vai partir delas e listar o que falta).
