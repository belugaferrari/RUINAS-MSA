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
- **Mac:** botão direito em **`iniciar-mac.command`** → **Abrir** (só na primeira vez; depois, dois cliques).

O navegador abre sozinho em `http://localhost:3000`. **Enquanto a janela preta estiver aberta, o app está ligado.** Para desligar, feche essa janela.

## 4. Testar como Mestre e como Jogador
1. Crie uma conta (nome + senha) e entre na **Área do Mestre**. Crie uma campanha — escolha **MSS** para ver o combate e a Roda do Humor automáticos — e marque **Aberta**.
2. Para ser também um jogador, abra **outra janela anônima** do navegador (Ctrl+Shift+N), entre em `http://localhost:3000`, crie outra conta e vá na **Área do Jogador**.
3. Celulares na mesma Wi‑Fi: use o endereço que aparece na janela preta em "Na mesma Wi‑Fi" (algo como `http://192.168.0.10:3000`).

## Atualizar para a versão mais nova
Baixe o ZIP de novo e extraia por cima da pasta antiga (ou numa pasta nova).
**Os dados ficam na pasta `data`** (contas, campanhas, fichas, imagens): se usar uma pasta nova, copie a `data` da antiga para ela.

## Problemas comuns
- **"O Node.js não está instalado"** — instale (passo 1) e abra o `iniciar-windows.bat` de novo. Se já instalou, reinicie o PC.
- **"EADDRINUSE" / porta em uso** — o app já está aberto em outra janela preta. Feche as duas e abra de novo.
- **Celular não abre** — confirme que está na mesma Wi‑Fi e que o Firewall permitiu o Node.js (Painel de Controle → Firewall → Permitir um aplicativo → marque "Node.js").
