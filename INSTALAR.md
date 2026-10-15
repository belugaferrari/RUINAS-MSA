# Como instalar e testar no PC

Leva uns 10 minutos na primeira vez. Depois é só dar dois cliques.

## 1. Instale o Node.js (só uma vez)
1. Entre em https://nodejs.org e baixe a versão **LTS** (o botão verde).
2. Abra o instalador e vá clicando em **Next** até o fim. Pode deixar tudo como está.

## 2. Baixe o app
1. Entre no GitHub (https://github.com/belugaferrari/ruinas-msa) com a sua conta.
2. Clique no botão verde **Code** e depois em **Download ZIP**.
3. Na pasta Downloads, clique com o botão direito no arquivo `.zip` e escolha **Extrair tudo…**.
   Deixe a pasta extraída num lugar fácil, por exemplo `Documentos\Ilhas das Ruinas`.

## 3. Inicie
- **Windows:** dentro da pasta, dê dois cliques em **`iniciar-windows.bat`**.
  - Se aparecer "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**.
  - Na primeira vez ele instala o que precisa (1 a 2 minutos, com internet).
  - Se o Firewall do Windows perguntar, clique em **Permitir** (é o que deixa os celulares da mesma Wi‑Fi entrarem).

O navegador abre sozinho em `http://localhost:3000`. **Enquanto a janela preta estiver aberta, o app está ligado.** Para desligar, feche essa janela.

## 4. Testar como Mestre e como Jogador
1. Crie uma conta (nome + senha) e entre na **Área do Mestre**. Crie uma campanha — escolha **MSS** para ver o combate e a Roda do Humor automáticos — e marque **Aberta**.
2. Para ser também um jogador, abra **outra janela anônima** do navegador (Ctrl+Shift+N), entre em `http://localhost:3000`, crie outra conta e vá na **Área do Jogador**.
3. Celulares na mesma Wi‑Fi: use o endereço que aparece na janela preta em "Na mesma Wi‑Fi" (algo como `http://192.168.0.10:3000`).

## Atualizações: automáticas
Depois desta instalação **não precisa mais baixar o ZIP**. Toda vez que você abre o `iniciar-windows.bat`, ele:
1. confere no GitHub se há versão nova;
2. se houver, baixa e troca só os arquivos do app — **a pasta `data` (contas, campanhas, fichas, imagens) nunca é apagada**;
3. abre o app normalmente.

Sem internet, ele só abre a versão que já está no PC. A janela preta mostra "Procurando atualizações…" e depois "O app já está na versão mais nova" ou "Atualizado!".

> Se você já tinha uma pasta de uma versão antiga: baixe o ZIP **uma última vez**, extraia **por cima da pasta antiga** (assim a `data` continua lá) e abra o `iniciar-windows.bat`. A partir daí é automático.
> Se o app já estiver aberto quando sair uma versão nova, feche a janela preta e abra de novo.

**Faça backup da pasta `data` de vez em quando** (copie para um pen drive ou para a nuvem).

## Problemas comuns
- **"O Node.js não está instalado"** — instale (passo 1) e abra o `iniciar-windows.bat` de novo. Se já instalou, reinicie o PC.
- **"EADDRINUSE" / porta em uso** — o app já está aberto em outra janela preta. Feche as duas e abra de novo.
- **Celular não abre** — confirme que está na mesma Wi‑Fi e que o Firewall permitiu o Node.js (Painel de Controle → Firewall → Permitir um aplicativo → marque "Node.js").
