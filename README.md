# Dota 2 Tactical Overlay (GSI)

Este é um overlay tático em tempo real para Dota 2, construído com React, Tailwind CSS e Electron. O sistema utiliza a interface GSI (GameState Integration) oficial da Valve para extrair dados do jogo e exibir timers precisos de objetivos.

# 🚀 Funcionalidades

- Relógio Mestre: Sincronizado diretamente com o tempo real da partida.

- Timers de Runas: Contagem decrescente para Runas de Poder, Recompensa (Bounty), Lótus e Sabedoria.

- Controlo de Roshan: Monitorização da janela de respawn (Mínima/Máxima) baseada em eventos reais.

- Fases do Jogo: Alertas visuais para Early, Mid e Late Game.

- Interface Transparente: Design minimalista que não obstrui a visão do jogador. (ainda em desenvolvimento)

- Dicas Dinâmicas: Sugestões táticas baseadas no tempo de jogo e objetivos iminentes.

# 🛠️ Tecnologias Utilizadas

- Frontend: React.js, Tailwind CSS, Lucide Icons.

- Backend (Bridge): Node.js com WebSockets (ws).

- Desktop Shell: Electron (para suporte a janelas transparentes e click-through).

- Integração: Dota 2 GameState Integration (GSI).

# 📦 Instalação e Configuração

### 1. Configurar o Dota 2 (GSI)

Para que o jogo envie dados para o overlay, precisas de criar um ficheiro de configuração:

Navega até a pasta de configuração do Dota 2:
```C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\```
(Se a pasta ```gamestate_integration``` não existir, cria-a).

Cria um ficheiro chamado ```gamestate_integration_overlay.cfg``` e cola o seguinte conteúdo:
```bash
"Dota 2 Integration Configuration"
{
    "uri"           "http://localhost:3001/"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.1"
    "heartbeat"     "30.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "1"
        "items"         "1"
    }
}
```

### 2. Instalação de Dependências

No terminal da raiz do projeto, executa:
```bash
npm install
```

### 3. Execução

Precisas de iniciar o servidor de bridge (que recebe os dados do Dota) e o cliente Electron:
```bash
# Iniciar o servidor de dados
node server.js

# Em outro terminal, iniciar o overlay
npm start
```

# ⚠️ Notas Importantes

Modo de Janela: O Dota 2 deve estar em modo "Janela Sem Bordas" (Borderless Window) para que o overlay do Electron consiga aparecer por cima do jogo.

Transparência: A transparência é gerida pelo ficheiro main.js do Electron e pelas classes bg-transparent no React.

Segurança: O GSI é uma ferramenta oficial da Valve e não resulta em banimentos (VAC Safe), pois apenas lê dados autorizados fornecidos pelo próprio cliente de jogo.

# 📝 Licença

Este projeto foi desenvolvido para uso pessoal e tático por Hyago. Sinta-se à vontade para modificar e adaptar às suas necessidades de jogo.