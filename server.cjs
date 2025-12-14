// --- CONFIGURAÇÃO E DEPENDÊNCIAS DO SERVIDOR GSI ---
const http = require("http");
const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const crypto = require("crypto");
// Não é necessário o 'body-parser', usaremos os middlewares built-in do Express.

// --- CONFIGURAÇÃO DE PORTAS ---
const GSI_PORT = 8000; // Porta onde o GSI do Dota 2 envia dados (configurado no gamestate_integration_tactical.cfg)
const WS_OVERLAY_PORT = 3001; // Porta WS para o Overlay Tático (DotaTacticalOverlayGSI.jsx)
const WS_CONTROL_PORT = 3002; // Porta WS para o Painel de Controle/Debug (DotaGSIDebugPanel.jsx)

// --- CONSTANTES DO JOGO (Para Simulação Manual) ---
const ROSHAN_RESPAWN_MIN = 480; // 8 minutos (480 segundos)
const ROSHAN_RESPAWN_MAX = 660; // 11 minutos (660 segundos)

// --- ESTADO GLOBAL DO APLICATIVO ---
let appState = {
  // Dados do último GSI e timers gerenciados pelo servidor
  latestGsiData: {
    map: { game_time: 0, clock_time: 0, daystate: "day" },
    roshan: { alive: true, respawn_min: 0, respawn_max: 0, kill_time: 0 },
    // 'previously' é usado para rastrear o estado de Roshan entre ticks do GSI
    previously: { roshan: { alive: true } }
  },

  // Modo de operação do servidor: 'REAL' (usa GSI) ou 'DUMMY' (simulação de tempo)
  mode: 'REAL',
  dummyTimeOffset: 0,
};

// Objeto para rastrear os clientes WebSocket conectados
const wsClients = {
  overlay: new Set(),
  control: new Set(),
};

// --- SERVIDORES WEBSOCKET (Rodam em portas independentes) ---

// 1. Servidor para o Overlay Tático (3001)
const wssOverlay = new WebSocket.Server({ port: WS_OVERLAY_PORT });
wssOverlay.on("connection", (ws) => {
  wsClients.overlay.add(ws);
  console.log(`[WS 3001] Cliente Overlay conectado. Total: ${wsClients.overlay.size}`);

  // Envia os dados atuais do GSI imediatamente
  ws.send(JSON.stringify(appState.latestGsiData));

  ws.on("close", () => {
    wsClients.overlay.delete(ws);
    console.log(`[WS 3001] Cliente Overlay desconectado. Total: ${wsClients.overlay.size}`);
  });
});

// 2. Servidor para o Painel de Controle (3002)
const wssControl = new WebSocket.Server({ port: WS_CONTROL_PORT });
wssControl.on("connection", (ws) => {
  ws.id = crypto.randomUUID();
  wsClients.control.add(ws);
  console.log(`[WS 3002] Cliente Controle (${ws.id}) conectado. Total: ${wsClients.control.size}`);

  // Envia o estado inicial completo (incluindo o 'mode')
  ws.send(JSON.stringify(appState));

  ws.on("message", (message) => {
    try {
      // Converte a mensagem em JSON para comandos
      const command = JSON.parse(message.toString());
      handleControlCommand(command, ws.id);
    } catch (e) {
      console.error(`[WS 3002] Erro ao analisar comando do cliente ${ws.id}:`, e);
    }
  });

  ws.on("close", () => {
    wsClients.control.delete(ws);
    console.log(`[WS 3002] Cliente Controle (${ws.id}) desconectado. Total: ${wsClients.control.size}`);
  });
});


// --- LÓGICA DE CONTROLE (Comandos do Painel de Debug/3002) ---
const handleControlCommand = (command, clientId) => {
  // console.log(`[CONTROL] Comando recebido de ${clientId}:`, command.type);

  switch (command.type) {
    case 'KILL_ROSHAN':
      // Verifica se Roshan não está em um estado de respawn calculado (para evitar override acidental)
      if (appState.latestGsiData.roshan.alive || appState.latestGsiData.roshan.respawn_max === 0) {
        const killTime = appState.latestGsiData.map.game_time;
        appState.latestGsiData.roshan.alive = false;
        appState.latestGsiData.roshan.kill_time = killTime;
        appState.latestGsiData.roshan.respawn_min = killTime + ROSHAN_RESPAWN_MIN;
        appState.latestGsiData.roshan.respawn_max = killTime + ROSHAN_RESPAWN_MAX;
        console.log(`[ROSHAN] Morte simulada em T=${killTime}. Respawn Min/Max: ${appState.latestGsiData.roshan.respawn_min}/${appState.latestGsiData.roshan.respawn_max}`);
      }
      break;
    case 'TOGGLE_MODE':
      appState.mode = command.payload === 'DUMMY' ? 'DUMMY' : 'REAL';
      console.log(`[MODE] Modo de operação alterado para: ${appState.mode}`);
      if (appState.mode === 'REAL') {
        appState.dummyTimeOffset = 0;
      }
      break;
    default:
      console.warn(`[CONTROL] Tipo de comando desconhecido: ${command.type}`);
  }

  // Notifica ambos os clientes após mudança de estado manual
  broadcastGsiToOverlay(appState.latestGsiData);
  broadcastStateUpdate(appState);
};


// --- FUNÇÕES DE BROADCAST ---

// Envia a última atualização de estado para os clientes de controle (Porta 3002 - Estado Completo)
const broadcastStateUpdate = (state) => {
  const data = JSON.stringify(state);
  wsClients.control.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

// Envia a atualização do GSI para o Overlay (Porta 3001 - Apenas dados de jogo)
const broadcastGsiToOverlay = (gsiData) => {
  const data = JSON.stringify(gsiData);
  wsClients.overlay.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};


// --- GSI LISTENER E LÓGICA DE TEMPO ---

const app = express();
app.use(cors());

// Middleware robusto para lidar com diferentes Content-Types do GSI (JSON ou Texto)
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: '*/*', limit: '5mb' }));


// Endpoint GSI - Recebe o estado do jogo do Dota 2
// CORREÇÃO CRÍTICA: Rota alterada para "/game_state"
app.post("/game_state", (req, res) => {
  let gsiData;

  try {
    // Tenta usar o corpo já parseado pelo express.json()
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
      gsiData = req.body;
    }
    // Se for string (parsed by express.text()), tenta parsear manualmente
    else if (typeof req.body === 'string' && req.body.length > 0) {
      gsiData = JSON.parse(req.body);
    } else {
      // Pacote inválido ou vazio
      return res.status(400).send("GSI data format is invalid or empty.");
    }

  } catch (error) {
    console.error('[GSI ERROR] Falha ao analisar JSON do corpo:', error.message);
    return res.status(400).send('Erro de processamento de dados');
  }

  // 1. Validação mínima de dados
  if (!gsiData.map || !gsiData.roshan) {
    return res.status(200).send("GSI data received, but missing map/roshan info.");
  }

  // 2. DETECÇÃO DE MORTE DE ROSHAN via GSI
  const roshanWasAlive = appState.latestGsiData.roshan.alive;
  const roshanIsDead = gsiData.roshan.alive === false;

  if (roshanWasAlive && roshanIsDead) {
    const killTime = gsiData.map.game_time;
    // Atualiza os timers APENAS se o tempo de morte atual for maior que o registrado (evita spam de GSI)
    if (killTime > appState.latestGsiData.roshan.kill_time) {
      appState.latestGsiData.roshan.kill_time = killTime;
      appState.latestGsiData.roshan.respawn_min = killTime + ROSHAN_RESPAWN_MIN;
      appState.latestGsiData.roshan.respawn_max = killTime + ROSHAN_RESPAWN_MAX;
      console.log(`[GSI] Roshan morto em T=${killTime}. Respawn Min/Max: ${appState.latestGsiData.roshan.respawn_min}/${appState.latestGsiData.roshan.respawn_max}`);
    }
  }

  // 3. Atualiza o estado global com os dados GSI mais recentes
  appState.latestGsiData = {
    ...appState.latestGsiData,
    map: { ...gsiData.map },
    // Preserva os timers calculados pelo servidor, mas atualiza o 'alive' do GSI
    roshan: {
      ...gsiData.roshan,
      respawn_min: appState.latestGsiData.roshan.respawn_min,
      respawn_max: appState.latestGsiData.roshan.respawn_max,
      kill_time: appState.latestGsiData.roshan.kill_time,
    },
    // Mantenha o estado 'alive' para a detecção de morte no próximo tick
    previously: { roshan: { alive: gsiData.roshan.alive } }
  };

  // 4. Envia o estado atual para o overlay e o painel
  broadcastGsiToOverlay(appState.latestGsiData);
  broadcastStateUpdate(appState);

  res.status(200).send("OK");
});


// --- LÓGICA DE DUMMY/SIMULAÇÃO DE TEMPO ---

// Inicia um timer para simular o tempo de jogo quando o modo é DUMMY
setInterval(() => {
  if (appState.mode === 'DUMMY') {
    const newTime = appState.latestGsiData.map.game_time + 1;
    appState.latestGsiData.map.game_time = newTime;

    // Lógica de respawn garantido para Roshan
    if (appState.latestGsiData.roshan.respawn_max > 0 && newTime >= appState.latestGsiData.roshan.respawn_max) {
      appState.latestGsiData.roshan.alive = true;
      appState.latestGsiData.roshan.respawn_min = 0;
      appState.latestGsiData.roshan.respawn_max = 0;
      appState.latestGsiData.roshan.kill_time = 0;
      console.log("[DUMMY] Roshan Respawn Garantido.");
    }

    // Atualiza os clientes
    broadcastGsiToOverlay(appState.latestGsiData);
    broadcastStateUpdate(appState);
  }
}, 1000);


// --- INICIALIZAÇÃO HTTP LISTENER ---
// O servidor HTTP escuta APENAS a porta GSI (8000) e hospeda o Express.
const gsiHttpServer = http.createServer(app);
gsiHttpServer.listen(GSI_PORT, () => {
  console.log(`[HTTP] Servidor GSI escutando na porta ${GSI_PORT}`);
  console.log(`[WS] Overlay WebSocket (3001) e Controle WebSocket (3002) prontos.`);
});