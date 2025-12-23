// O ÚNICO COMPONENTE REACT: Contém a conexão WebSocket, lógica de cálculo de timers e a interface completa (HTML/CSS com Tailwind) do overlay tático.
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock,
  Zap,
  Anchor,
  Coins,
  Trophy,
  Scroll,
  Heart,
  Sunrise,
  Sunset,
  Wind,
  MessageCircle,
  X,
  Wifi, // Novo ícone para indicar status da conexão
} from "lucide-react";

// URL do WebSocket onde o server.js está rodando (porta 3001)
const WS_URL = "ws://127.0.0.1:3001";

// --- CONFIGURAÇÃO E CONSTANTES DO JOGO (Em Segundos) ---

// TEMPOS DE TRANSIÇÃO DAS FASES DO JOGO
const GAME_PHASES = [
  {
    name: "Early Game (Laning)",
    end: 600,
    icon: Sunrise,
    color: "text-green-400",
    description:
      "Foco em Last Hits, Denies, e Lane Control. Contestar Runas de Recompensa/Lótus.",
  }, // 0:00 a 10:00
  {
    name: "Mid Game (Iniciação)",
    end: 1500,
    icon: Wind,
    color: "text-yellow-400",
    description:
      "Ganks, Push, e Luta por Objetivos (Roshan/Outpost). Prioridade em Teamfights.",
  }, // 10:00 a 25:00
  {
    name: "Late Game (Endgame)",
    end: Infinity,
    icon: Sunset,
    color: "text-red-400",
    description:
      "Buybacks, Combos de Alta Dano, e Push Final. Uma luta pode decidir o jogo.",
  }, // 25:00+
];

// OBJETIVOS CÍCLICOS E DE INTERVALO
const OBJECTIVE_CONFIG = {
  // Power Rune: A cada 2m (120s), começa em 0:00
  POWER_RUNE: {
    name: "Runa de Poder",
    icon: Zap,
    interval: 120,
    initial: 0,
    color: "text-cyan-400",
    urgencyThreshold: 30,
  },
  // Bounty Rune: A cada 3m (180s), começa em 3:00 (180s)
  BOUNTY_RUNE: {
    name: "Runa de Recompensa",
    icon: Coins,
    interval: 180,
    initial: 180,
    color: "text-yellow-400",
    urgencyThreshold: 30,
  },
  // Lotus Rune: A cada 3m (180s), começa em 3:00 (180s)
  LOTUS_RUNE: {
    name: "Runa de Lótus",
    icon: Heart,
    interval: 180,
    initial: 180,
    color: "text-pink-400",
    urgencyThreshold: 30,
  },
  // Wisdom Rune: A cada 7m (420s), começa em 7:00 (420s)
  WISDOM_RUNE: {
    name: "Runa de Sabedoria",
    icon: Scroll,
    interval: 420,
    initial: 420,
    color: "text-amber-400",
    urgencyThreshold: 60,
  },
  // Outpost: A cada 5m (300s), começa em 10:00 (600s)
  OUTPOST: {
    name: "Outpost",
    icon: Trophy,
    interval: 300,
    initial: 600,
    color: "text-indigo-400",
    urgencyThreshold: 45,
  },
};

// Formata segundos para MM:SS
const formatTime = (totalSeconds) => {
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = absSeconds % 60;
  const sign = totalSeconds < 0 ? "-" : "";
  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

// --- COMPONENTE DE TIMER ÚNICO (Minimalista) ---
const ObjectiveTimer = React.memo(
  ({ name, icon: Icon, timeLeft, color, state, action }) => {
    const isImminent = state === "IMINENTE" || state === "ROSHAN_JANELA_MIN";
    const isActive =
      state === "VIVO" || isImminent || state === "ROSHAN_JANELA_MAX";
    const isAlive = state === "VIVO";

    // Fundo levemente opaco (20%) para contraste dentro do bloco de timers
    let bgColorClass = "bg-gray-800/20";

    // Mantém o fundo colorido/opaco apenas para estados ativos ou iminentes
    if (isImminent)
      bgColorClass = "bg-red-700/80 ring-2 ring-red-500 animate-pulse";
    else if (isAlive) bgColorClass = "bg-green-700/80 ring-2 ring-green-500";

    return (
      <div
        className={`p-3 rounded-lg shadow-md transition-all duration-300 ${bgColorClass}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs font-bold uppercase text-white">
              {name}
            </span>
          </div>
          <span
            className={`text-xl font-mono font-black ${
              isImminent || isAlive ? "text-white" : "text-gray-200"
            }`}
          >
            {isAlive ? "VIVO" : formatTime(timeLeft)}
          </span>
        </div>
        {isActive && (
          <p className="text-xs mt-1 text-gray-300 font-semibold italic truncate">
            {action}
          </p>
        )}
      </div>
    );
  }
);

// --- COMPONENTE PRINCIPAL (DRIVEN POR GSI REAL VIA WEBSOCKET) ---
const App = () => {
  // Estado que receberá a informação real do GSI do server.js
  const [gsiState, setGsiState] = useState({
    map: { game_time: 0 },
    roshan: { respawn_min: 0, respawn_max: 0, alive: true },
  });
  // Estado para conexão e feedback visual
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const [activeHint, setActiveHint] = useState(null);

  // Variável para manter a instância do WebSocket fora dos re-renders
  const wsRef = React.useRef(null);

  // 1. CONEXÃO WEBSOCKET REAL (Substitui o setInterval)
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    wsRef.current = new WebSocket(WS_URL);
    setConnectionStatus("CONNECTING");

    wsRef.current.onopen = () => {
      console.log("[WS] Conexão WebSocket estabelecida.");
      setConnectionStatus("CONNECTED");
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Atualiza o estado com os dados reais do GSI
        setGsiState(data);
      } catch (e) {
        console.error("[WS ERROR] Falha ao analisar JSON:", e);
      }
    };

    wsRef.current.onclose = () => {
      console.log(
        "[WS] Conexão WebSocket perdida. Tentando reconectar em 3s..."
      );
      setConnectionStatus("DISCONNECTED");
      // Tenta reconectar após 3 segundos
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error("[WS ERROR] Erro fatal:", error);
      wsRef.current.close();
    };
  }, []);

  // Inicia a conexão ao montar o componente
  useEffect(() => {
    connectWebSocket();
    // Limpa a conexão ao desmontar
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Se o servidor estiver no modo GSI real, o game_time deve ser atualizado pelo servidor a cada segundo.
  const gameTime = gsiState.map.game_time;

  // 2. CÁLCULO DE TIMERS DE OBJETIVOS (Baseado no gameTime do GSI)
  const calculatedObjectives = useMemo(() => {
    const currentPhase = GAME_PHASES.find((p) => gameTime < p.end);
    let imminentObjectiveName = null;

    // a) Objetivos Cíclicos (Runas, Outpost)
    const timers = Object.keys(OBJECTIVE_CONFIG).map((key) => {
      const obj = OBJECTIVE_CONFIG[key];
      let timeLeft = 0;
      let nextSpawn = 0;

      // O tempo de jogo pode ser negativo durante a fase de pré-jogo (contagem regressiva)
      if (gameTime < obj.initial) {
        timeLeft = obj.initial - gameTime;
        nextSpawn = obj.initial;
      } else {
        // Calcula o próximo intervalo após o primeiro spawn
        const diff = gameTime - obj.initial;
        const numIntervals = Math.floor(diff / obj.interval);
        nextSpawn = obj.initial + (numIntervals + 1) * obj.interval;
        timeLeft = nextSpawn - gameTime;
      }

      let state = "AGUARDANDO";
      let action = "Nenhum Movimento Crítico Necessário.";

      if (timeLeft <= obj.urgencyThreshold && timeLeft > 0) {
        state = "IMINENTE";
        action = `Prepare-se para contestar/coletar! (${formatTime(timeLeft)})`;
        if (!imminentObjectiveName) imminentObjectiveName = obj.name;
      }

      return { ...obj, timeLeft, state, action };
    });

    // b) Roshan Timer (Baseado nos dados do GSI)
    let roshanMinTimeLeft = 0;
    let roshanMaxTimeLeft = 0;
    let roshanState = "MORTO/AGUARDANDO MORTE"; // Estado inicial

    const roshan = gsiState.roshan || {
      respawn_min: 0,
      respawn_max: 0,
      alive: true,
    };

    if (!roshan.alive && roshan.respawn_min > 0) {
      roshanMinTimeLeft = roshan.respawn_min - gameTime;
      roshanMaxTimeLeft = roshan.respawn_max - gameTime;

      if (roshanMinTimeLeft <= 0) {
        roshanState = "VIVO"; // Janela de Respawn Ativa
      } else if (roshanMinTimeLeft <= 120) {
        roshanState = "ROSHAN_JANELA_MIN"; // 2 minutos antes do mínimo
        if (!imminentObjectiveName) imminentObjectiveName = "Roshan (MÍNIMO)";
      } else {
        roshanState = "FORA DE TEMPO";
      }
    } else if (roshan.alive) {
      // Se a GSI diz que está vivo (e estamos rastreando o respawn_max anterior)
      roshanState = "VIVO";
    }

    // Adiciona o Roshan à lista de timers (apenas para exibição)
    const roshanTimerDisplay = {
      name: "Roshan",
      icon: Anchor,
      color: "text-red-500",
      timeLeft: roshanMinTimeLeft,
      state: roshanState,
      action:
        roshanState === "VIVO"
          ? `Janela de Respawn Ativa. Invadir com Cautela.`
          : roshanState === "ROSHAN_JANELA_MIN"
          ? `Roshan nascerá no MÍNIMO em ${formatTime(roshanMinTimeLeft)}`
          : "Foco na lane. Roshan morto, sem risco imediato.",
    };

    return {
      timers,
      roshanTimerDisplay,
      currentPhase: currentPhase,
      imminentObjectiveName,
      roshanMinTimeLeft,
      roshanMaxTimeLeft,
    };
  }, [gameTime, gsiState]); // Depende do GSI State

  // 3. LÓGICA DE POPUP/HINT (Mensagem Auto-explicativa)
  useEffect(() => {
    const {
      imminentObjectiveName,
      roshanTimerDisplay,
      roshanMinTimeLeft,
      roshanMaxTimeLeft,
      currentPhase,
    } = calculatedObjectives;
    let newHint = null;

    if (imminentObjectiveName && roshanTimerDisplay.state !== "VIVO") {
      newHint = {
        title: "PRIORIDADE DE OBJETIVO TÁTICO!",
        message: `${imminentObjectiveName} irá surgir em breve. Mova-se para o local para contestar ou garantir.`,
        color: "border-yellow-400 text-yellow-100",
      };
    } else if (roshanTimerDisplay.state === "ROSHAN_JANELA_MIN") {
      newHint = {
        title: "ALERTA ROSHAN MÍNIMO!",
        message: `Roshan nascerá no MÍNIMO em ${formatTime(
          roshanMinTimeLeft
        )}. Prepare Wards e verifique o Buyback.`,
        color: "border-red-500 text-red-100",
      };
    } else if (roshanTimerDisplay.state === "VIVO" && roshanMaxTimeLeft < 0) {
      newHint = {
        title: "ROSHAN VIVO (RISCO MÁXIMO)",
        message: `Roshan está definitivamente vivo. Concentre-se em Visão e Controle.`,
        color: "border-red-700 text-red-300",
      };
    } else {
      // Dica da Fase do Jogo
      newHint = {
        title: `FASE: ${currentPhase.name}`,
        message: currentPhase.description,
        color: "border-purple-400 text-purple-200",
      };
    }

    setActiveHint(newHint);
  }, [calculatedObjectives]);

  return (
    // MUDANÇA: Wrapper mais externo explicitamente transparente
    <div className="w-full h-full bg-transparent">
      {/* MUDANÇA: Container central explicitamente transparente */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 z-50 w-72 md:w-80 font-sans antialiased text-white bg-transparent">
        {/* 1. RELÓGIO MESTRE E ESTADO DO JOGO (DRIVEN PELO GSI) */}
        {/* MUDANÇA: Opacidade reduzida para 80% (bg-gray-900/80) */}
        <div className="p-4 bg-gray-900/80 border-b-4 border-purple-600 rounded-t-xl shadow-2xl">
          <div className="flex items-center justify-between">
            {/* Indicativo de Tempo */}
            <h1 className="text-4xl font-mono font-black tracking-tighter text-white">
              {formatTime(gameTime)}
            </h1>
            <div className="flex items-center space-x-2">
              {/* Status da Conexão WS */}
              <Wifi
                className={`w-5 h-5 transition-colors duration-500 ${
                  connectionStatus === "CONNECTED"
                    ? "text-green-500"
                    : connectionStatus === "CONNECTING"
                    ? "text-yellow-500 animate-pulse"
                    : "text-red-500"
                }`}
                title={connectionStatus}
              />
              <Clock className="w-6 h-6 text-purple-400" />
            </div>
          </div>

          {/* Indicativo de Game State */}
          <div className="flex items-center mt-2 space-x-2">
            <calculatedObjectives.currentPhase.icon
              className={`w-4 h-4 ${calculatedObjectives.currentPhase.color}`}
            />
            <span
              className={`text-sm font-extrabold uppercase ${calculatedObjectives.currentPhase.color}`}
            >
              {calculatedObjectives.currentPhase.name}
            </span>
          </div>
        </div>

        {/* 4. POP-UP HINT (Auto Explicativo / Alerta) */}
        {activeHint && (
          // Mantendo um fundo semi-transparente preto para garantir a legibilidade do texto de dica
          <div
            className={`p-3 mt-4 mb-4 rounded-lg shadow-xl border-l-4 ${activeHint.color} bg-black/70 transition-all duration-300`}
          >
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <p className="text-sm font-bold uppercase text-white">
                {activeHint.title}
              </p>
            </div>
            <p className="text-xs mt-1 text-gray-400">{activeHint.message}</p>
          </div>
        )}

        {/* 2. TIMERS DE OBJETIVOS CÍCLICOS */}
        {/* MUDANÇA: Opacidade reduzida para 80% (bg-gray-900/80) */}
        <div className="p-3 bg-gray-900/80 rounded-b-xl shadow-2xl space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 border-b border-gray-700 pb-1 mb-2 uppercase">
            Objetivos de Ciclo
          </h2>
          {calculatedObjectives.timers
            // Filtra os timers que ainda não nasceram no jogo
            .filter((obj) => gameTime >= obj.initial || obj.timeLeft > 0)
            .map((obj, index) => (
              <ObjectiveTimer
                key={index}
                name={obj.name}
                icon={obj.icon}
                timeLeft={obj.timeLeft}
                color={obj.color}
                state={obj.state}
                action={obj.action}
              />
            ))}

          {/* 3. TIMER ROSHAN (Baseado nos dados do GSI) */}
          <div className="pt-2">
            <h2 className="text-sm font-semibold text-gray-400 border-b border-gray-700 pb-1 mb-2 uppercase mt-4">
              Roshan (Controle de Janela)
            </h2>

            {/* Timer de Respawn Mínimo / Status */}
            <ObjectiveTimer
              name={calculatedObjectives.roshanTimerDisplay.name}
              icon={calculatedObjectives.roshanTimerDisplay.icon}
              timeLeft={calculatedObjectives.roshanMinTimeLeft}
              color={calculatedObjectives.roshanTimerDisplay.color}
              state={calculatedObjectives.roshanTimerDisplay.state}
              action={calculatedObjectives.roshanTimerDisplay.action}
            />

            {/* Janela Máxima (apenas se não estiver vivo e o timer max for conhecido) */}
            {calculatedObjectives.roshanTimerDisplay.state !== "VIVO" &&
              gsiState.roshan.respawn_max > 0 && (
                <div className="text-xs text-center p-1 mt-1 font-mono text-gray-500">
                  Garantido Vivo em:{" "}
                  {formatTime(calculatedObjectives.roshanMaxTimeLeft)}
                </div>
              )}

            {/* Indicador quando Roshan está morto */}
            {gsiState.roshan.alive === false &&
              gsiState.roshan.respawn_max > 0 &&
              calculatedObjectives.roshanMinTimeLeft > 0 && (
                <div className="text-xs text-center p-1 mt-1 font-mono text-green-500">
                  <X className="w-3 h-3 inline-block mr-1" /> ROSHAN MORTO
                  (Respawn Mínimo:{" "}
                  {formatTime(calculatedObjectives.roshanMinTimeLeft)})
                </div>
              )}
          </div>

          {/* 5. Robustez e GSI Simples (Nota Final) */}
          <div className="mt-4 pt-3 text-center border-t border-gray-800">
            <p
              className={`text-xs font-mono ${
                connectionStatus === "CONNECTED"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              Status da Conexão: {connectionStatus}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
