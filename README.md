# **Dota 2 Tactical Overlay (GSI)**

O **Dota 2 Tactical Overlay** é uma ferramenta de sobreposição em tempo real desenvolvida para fornecer informações estratégicas durante partidas de Dota 2. A aplicação utiliza a interface oficial **Game State Integration (GSI)** da Valve para capturar dados do jogo e exibir timers e alertas táticos com alta precisão.

Construído com **React**, **Tailwind CSS** e **Electron**, o sistema oferece uma interface leve, responsiva e não intrusiva.

---

## 🚀 **Funcionalidades**

### **Relógio de Partida (Modo Expert)**

Sincronização direta com o tempo oficial da partida, garantindo precisão absoluta para decisões estratégicas.

### **Timers de Objetivos**

* Runas de Poder (Power Runes)
* Runas de Recompensa (Bounty Runes)
* Lótus (Lotus Pools)
* Runas de Sabedoria (Wisdom Runes)

Todos com contagem regressiva em tempo real.

### **Controle de Roshan**

Monitoramento inteligente da janela de respawn (tempo mínimo e máximo), baseado em eventos reais capturados via GSI.

### **Fases do Jogo**

Alertas visuais automáticos para:

* Early Game
* Mid Game
* Late Game

### **Interface Transparente**

Overlay com design minimalista e suporte a transparência e *click-through*, evitando interferência na visão do jogador.
*(Funcionalidade em evolução)*

### **Dicas Dinâmicas**

Sugestões táticas contextuais baseadas no tempo de jogo e na proximidade de objetivos críticos.

---

## 🛠️ **Stack Tecnológica**

**Frontend**

* React.js
* Tailwind CSS
* Lucide Icons

**Backend (Bridge de Dados)**

* Node.js
* WebSocket (`ws`)

**Desktop Runtime**

* Electron (suporte a transparência e sobreposição de janela)

**Integração**

* Dota 2 Game State Integration (GSI)

---

## 📦 **Instalação e Configuração**

### **1. Configuração do GSI no Dota 2**

Para habilitar o envio de dados do jogo:

1. Navegue até o diretório de configuração:

```
C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
```

> Caso a pasta `gamestate_integration` não exista, crie-a manualmente.

2. Crie o arquivo:

```
gamestate_integration_overlay.cfg
```

3. Insira o seguinte conteúdo:

```cfg
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

---

### **2. Instalação de Dependências**

No diretório raiz do projeto:

```bash
npm install
```

---

### **3. Execução da Aplicação**

Inicie os serviços necessários:

```bash
# Servidor de dados (bridge GSI)
node server.js

# Em outro terminal, iniciar o overlay
npm start
```

---

## ⚠️ **Notas Importantes**

### **Modo de Exibição**

O Dota 2 deve estar configurado como **"Janela Sem Bordas" (Borderless Window)** para permitir que o overlay seja exibido corretamente.

### **Transparência**

Gerenciada por:

* Configurações do Electron (`main.js`)
* Estilos `bg-transparent` no React

### **Segurança**

O uso do GSI é **oficial e seguro (VAC Safe)**, pois apenas consome dados disponibilizados pelo cliente do jogo, sem qualquer modificação ou interferência no mesmo.

---

## 📝 **Licença**

Projeto desenvolvido para uso pessoal e tático por **Hyago**.
Sinta-se livre para modificar, adaptar e evoluir a ferramenta conforme suas necessidades.

---
