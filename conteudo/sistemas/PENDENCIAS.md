# Pendências dos livros (MSA rev. 14/10/2026 15:29 · MSS rev. 14/10/2026 20:26)

## Livro MSA

Pontos em que o app precisou escolher um caminho. Confira e me diga se a escolha está certa para o **MSA**.

## Inconsistências no texto
| # | Onde | O que o livro diz | O que o app faz |
|---|---|---|---|
| 1 | PV — Passo 0 × Passo 6 | Passo 0: `5 + 5×nível + (FOR+CONS)/2`. Passo 6: `FOR + CONS + 1` | Usa a do Passo 0 |
| 2 | Tabela da Dormet (Passo 1) | CAR 13 → Bônus pericial 14 e MOD 3 | Pela fórmula do texto dá Bônus 16 e MOD 2 (+1 racial). O app segue a fórmula; o resto da tabela bate |
| 3 | Profissão Protetor | Bônus em "Defesa Desarmada" | Essa subperícia só existe no livro MSS. No MSA o bônus fica sem efeito até definir |
| 4 | Profissão Protetor | "Salvaguarda" | Entendido como Briga › Salvaguardar |
| 5 | Nomes nas profissões | "Encontrar armadilhas", "Engenharia Mecânica", "Manutenção de Computadores", "Identificação de objetos" | Armadilhas › Encontrar, Engenharia › Mecânica, Computação › Manutenção, Avaliação de Objetos › Identificação |
| 6 | Humanidade (Passo 6) | "HUM = 50 + 2×CAR + 2×PER, mas você pode escolher valores melhores que esse até o limite de 51 no primeiro nível" | O app usa a fórmula (máx. 100). Não ficou claro o que é o "limite de 51" |
| 7 | Grafia texto × tabelas de classe | Gerigonça/Geringonça, Artificie/Artífice, Ultimo/Último, Autopsia/Autópsia | O app usa a grafia das tabelas |

## Regras que ainda não existem no livro
- **Custo de cada vantagem**: o app considera 1 ponto por vantagem.
- **Custo em XP** da evolução: lançado à mão no Evoluir. Os pontos por nível já seguem a Tabela de Progressão (confirmado: vale para MSA e MSS).
- **Vantagem Extra das classes × +1 vantagem nos níveis pares da Tabela de Progressão**: o app conta só os +1 dos níveis pares como pontos de vantagem e mostra a "Vantagem Extra" da classe como ganho de classe. Confirme se são a mesma coisa ou se somam.
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
- **R.MNP** = CAR + 50 + outros modificadores (humor e o campo "Mod. R.MNP" que o mestre ajusta no cartão).
- **IP** subtrai do dano recebido. Vem dos itens equipados (campo "defesa") e de habilidades (campo "IP de habilidades" que o mestre ajusta no cartão).
- **Vantagem / Desvantagem**: rola 2d100 e fica com o maior / menor; uma anula a outra.

**Ainda provisório — conferir**
- **Defesa contra armas de fogo (sem ser em área)**: nenhuma defesa ativa vale; sobra "Sem defesa" (base 50, +30 com cobertura).
- **Defesa armada** (subperícia da arma branca empunhada; Toque e Chicote não servem) continua valendo contra corpo a corpo, como no livro.
- **"CAR + 50"**: o app usa CAR% (CAR × 4), como nas outras ações passivas de atributo.
- **Valor da defesa** = subperícia escolhida + 50 (a defesa não rola dado; o atacante rola contra esse valor).
- **Evasão bem-sucedida** contra ataque em área: metade do dano (texto do livro).
- **Dano mínimo 1** depois do IP.
- **Efeito de dano**: marcador quando o ataque acerta e o DS ≤ "efeitoDano" da arma (sem o campo, 3). Corte = Sangramento, Perfuração = Ferida aberta, Concussão/Elétrico = Aturdido, Calor/Frio/Ácido = Queimadura, desarmado = Dor. Sangramento, Ferida aberta e Dor ainda são descontados à mão.
- **Vantagem automática**: surpresa, terreno elevado, alvo caído (corpo a corpo), alvo Aturdido/Imobilizado, atacante Enojado. **Desvantagem**: atacante caído ou aturdido, atacante Amedrontado.
- **Crítico**: +1 dado igual ao primeiro dado da arma. Erro crítico sempre erra.
- **PV**: 0 ou menos → Desmaiado; dano com PV já negativo → Morto (exceto não letal). Sobrevida: −1 PV no turno de quem está abaixo de 0 (sem "Estabilizado"); morre ao chegar a −CONS.
- **Sacrifício (MSS)**: +10% no acerto; o D6 de vida atual vai para o dano e o atacante perde esses PV.
- **Manipulação**: subperícia + Amigável/Indisposto de quem manipula e do alvo (±10) + bônus geral do humor. Sucesso troca o humor do alvo; falha libera o humor de falha do livro (Liderança → Desmotivado, Intimidação → Corajoso, Interrogatório/Lábia → Desconfiado) para o dono do alvo escolher.
- **Bônus geral do humor** (Apático −5, Desmotivado −5, Confiante +5, Desconfiado −5) entra sozinho nos testes D-MIL do rolador da sala e no ataque. Motivado e as desvantagens por tipo de teste ainda são aplicados à mão.
- **Itens de exemplo** ganharam `pericia`, `tipoDano`, `efeitoDano` e `alcance` até a tabela de itens real chegar.

**Aguardando o texto**
- **Humores Raivoso e Sereno**: já aparecem na Roda do Humor, sem efeito, até chegar a descrição.
