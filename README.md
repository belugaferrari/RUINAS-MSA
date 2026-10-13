# Ilhas das Ruínas MSA — aplicativo de mesa

Aplicativo de apoio ao RPG **Ilhas das Ruínas MSA**: o Mestre e até 9 jogadores acessam ao mesmo tempo, pelo navegador, na mesma Wi‑Fi ou pela internet. Tudo atualiza em tempo real (fichas, salas, rolagens, imagens).

> **Fase atual: esqueleto visual funcional.** As telas e o fluxo estão prontos; as regras do MSA ainda são **exemplos provisórios** em `conteudo/sistema.json` e `conteudo/livros/*.md`, que serão trocados pelo conteúdo real.

## Como rodar (no PC do Mestre)

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

## Onde ficam as regras

| Arquivo | O que tem |
|---|---|
| `conteudo/sistema.json` | Atributos, perícias, vantagens, classes (e escolhas de classe), itens, slots de equipamento, monstros, valores iniciais, tipos de relação, dado de teste. O app relê o arquivo sozinho quando ele muda. |
| `conteudo/livros/regras.md` | Livro de Regras (Markdown; os títulos `#`/`##`/`###` viram o índice). |
| `conteudo/livros/mestre.md` | Livro do Mestre. |
| `shared/regras.js` | As **fórmulas** (pontos gastos, bônus de itens, slots, testes, encontros). É aqui que a matemática do MSA entra. |

## Estrutura

```
server/      servidor (Express + Socket.IO), contas, ações da campanha, Excel
shared/      regras usadas pelo servidor e pelo navegador
public/      interface (HTML/CSS/JS sem etapa de build)
conteudo/    regras e livros editáveis
modelos/     planilha modelo de NPCs
test/        testes (npm test)
```
