// Este componente serve como um painel de controle e debug para o GSI Server (server.js).
// Ele permite enviar comandos e visualizar o estado interno do servidor.
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
    Anchor, 
    Zap, 
    Activity, 
    ToggleLeft, 
    ToggleRight,
    Loader,
    Wifi
} from "lucide-react";

// URL do WebSocket para o Painel de Controle (porta 3002)
const WS_CONTROL_URL = "ws://127.0.0.1:3002";

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

const App = () => {
    // Estado interno que reflete o estado global do 'server.js'
    const [serverState, setServerState] = useState({
        latestGsiData: { map: { game_time: 0 }, roshan: { alive: true, respawn_min: 0, respawn_max: 0 } },
        mode: 'REAL',
    });
    const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");

    const wsRef = React.useRef(null);

    // --- FUNÇÕES DE COMANDO (ENVIA VIA WEBSOCKET) ---

    // Envia um comando para o servidor
    const sendCommand = useCallback((type, payload = {}) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const command = { type, payload };
            wsRef.current.send(JSON.stringify(command));
            console.log(`[DEBUG] Comando enviado: ${type}`);
        } else {
            console.error("[DEBUG] WebSocket não está conectado.");
        }
    }, []);

    const handleKillRoshan = () => {
        sendCommand('KILL_ROSHAN');
    };

    const handleToggleMode = () => {
        const newMode = serverState.mode === 'REAL' ? 'DUMMY' : 'REAL';
        sendCommand('TOGGLE_MODE', newMode);
    };

    // --- CONEXÃO WEBSOCKET PARA CONTROLE ---

    const connectWebSocket = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        wsRef.current = new WebSocket(WS_CONTROL_URL);
        setConnectionStatus("CONNECTING");

        wsRef.current.onopen = () => {
            console.log("[WS 3002] Conexão Controle estabelecida.");
            setConnectionStatus("CONNECTED");
        };

        wsRef.current.onmessage = (event) => {
            try {
                const newState = JSON.parse(event.data);
                setServerState(newState);
            } catch (e) {
                console.error("[WS ERROR] Falha ao analisar JSON:", e);
            }
        };

        wsRef.current.onclose = () => {
            console.log("[WS 3002] Conexão Controle perdida. Tentando reconectar em 3s...");
            setConnectionStatus("DISCONNECTED");
            setTimeout(connectWebSocket, 3000);
        };

        wsRef.current.onerror = (error) => {
            console.error("[WS ERROR] Erro fatal:", error);
            wsRef.current.close();
        };
    }, []);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connectWebSocket]);

    // --- EXIBIÇÃO DE DADOS CALCULADOS ---

    const { roshan } = serverState.latestGsiData;
    const gameTime = serverState.latestGsiData.map?.game_time || 0;

    const roshanInfo = useMemo(() => {
        if (roshan.alive) {
            return {
                status: "Vivo/GSI Desconhecido",
                color: "text-green-500",
                minTimeLeft: null,
                maxTimeLeft: null,
                action: "Aguardando morte do Roshan (via GSI ou manual)."
            };
        } else if (roshan.respawn_max > 0) {
            const minTimeLeft = roshan.respawn_min - gameTime;
            const maxTimeLeft = roshan.respawn_max - gameTime;
            
            let status = "Morto";
            let color = "text-yellow-500";
            let action = "Roshan está morto. Foco em objetivos de lane.";
            
            if (minTimeLeft <= 0) {
                status = "Janela de Respawn ATIVA";
                color = "text-red-500";
                action = `Roshan PODE estar vivo. Máximo em ${formatTime(maxTimeLeft)}.`;
            } else if (minTimeLeft <= 120) {
                status = "Respawn Iminente";
                color = "text-orange-500";
                action = `Alerta! Prepare-se para contestar em T=${formatTime(roshan.respawn_min)}.`;
            }

            return {
                status,
                color,
                minTimeLeft: formatTime(minTimeLeft),
                maxTimeLeft: formatTime(maxTimeLeft),
                action,
                roshanKillTime: formatTime(roshan.kill_time)
            };

        } else {
            return {
                status: "GSI Não Iniciado/Roshan Vivo",
                color: "text-gray-500",
                minTimeLeft: null,
                maxTimeLeft: null,
                action: "Aguardando o estado inicial do jogo."
            };
        }
    }, [roshan, gameTime]);

    // --- UI PRINCIPAL ---
    
    return (
        <div className="p-6 bg-gray-900 min-h-screen text-white font-sans antialiased">
            <header className="flex justify-between items-center pb-4 border-b border-gray-700 mb-6">
                <h1 className="text-2xl font-extrabold text-purple-400 flex items-center space-x-2">
                    <Activity className="w-6 h-6" />
                    <span>Painel de Controle GSI Tático</span>
                </h1>
                <div className="flex items-center space-x-2">
                    <Wifi 
                        className={`w-5 h-5 transition-colors duration-500 ${
                            connectionStatus === "CONNECTED" 
                            ? "text-green-500" 
                            : connectionStatus === "CONNECTING" 
                            ? "text-yellow-500 animate-spin" 
                            : "text-red-500"
                        }`} 
                        title={`WS Status: ${connectionStatus}`}
                    />
                    <span className="text-xs uppercase text-gray-400">{connectionStatus}</span>
                </div>
            </header>

            {/* 1. SEÇÃO DE CONTROLE */}
            <section className="mb-8 p-4 bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-xl font-bold mb-3 border-b border-gray-700 pb-2 flex items-center space-x-2 text-cyan-400">
                    <Zap className="w-5 h-5" />
                    <span>Controles Táticos (Para Teste)</span>
                </h2>

                <div className="flex space-x-4 mb-4">
                    {/* Botão de Simulação de Morte de Roshan */}
                    <button
                        onClick={handleKillRoshan}
                        disabled={!roshan.alive || connectionStatus !== "CONNECTED"}
                        className={`flex items-center justify-center px-4 py-2 rounded-lg font-semibold transition-colors duration-200 shadow-md ${
                            roshan.alive
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-gray-600 cursor-not-allowed text-gray-400"
                        }`}
                        title={roshan.alive ? "Simula que o Roshan acaba de ser morto AGORA" : "Roshan já está morto ou o timer está ativo."}
                    >
                        <Anchor className="w-5 h-5 mr-2" />
                        Simular Morte de Roshan
                    </button>

                    {/* Botão de Toggle de Modo */}
                    <button
                        onClick={handleToggleMode}
                        className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors duration-200 shadow-md w-full max-w-xs ${
                            serverState.mode === 'REAL'
                                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                                : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                    >
                        {serverState.mode === 'REAL' ? (
                            <ToggleRight className="w-5 h-5 mr-2" />
                        ) : (
                            <ToggleLeft className="w-5 h-5 mr-2" />
                        )}
                        Modo: {serverState.mode} (Clique para Alternar)
                    </button>
                </div>
                
                <p className="text-sm italic text-gray-400 mt-2">
                    Modo REAL: Depende do Dota 2. Modo DUMMY: Simulação interna de tempo para testes.
                </p>
            </section>

            {/* 2. SEÇÃO DE INFORMAÇÕES DO SERVIDOR */}
            <section className="mb-8 p-4 bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-xl font-bold mb-3 border-b border-gray-700 pb-2 flex items-center space-x-2 text-purple-400">
                    <Loader className="w-5 h-5" />
                    <span>Estado do Servidor (server.js)</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700 p-3 rounded-md">
                        <p className="text-sm font-semibold text-gray-300">Tempo de Jogo (GSI)</p>
                        <p className="text-2xl font-mono font-black text-white">{formatTime(gameTime)}</p>
                    </div>
                    <div className="bg-gray-700 p-3 rounded-md">
                        <p className="text-sm font-semibold text-gray-300">Modo de Operação</p>
                        <p className={`text-2xl font-mono font-black ${serverState.mode === 'REAL' ? 'text-green-400' : 'text-yellow-400'}`}>
                            {serverState.mode}
                        </p>
                    </div>
                    
                    {/* Informações de Roshan */}
                    <div className="bg-gray-700 p-3 rounded-md col-span-2">
                        <p className="text-sm font-semibold text-gray-300 mb-1">Status de Roshan (Controlado pelo Servidor)</p>
                        <p className={`text-xl font-bold ${roshanInfo.color}`}>{roshanInfo.status}</p>
                        
                        <div className="flex justify-between text-sm mt-2">
                            <span className="text-gray-400">Tempo Mínimo (Min):</span>
                            <span className="font-mono text-white">{roshanInfo.minTimeLeft || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Tempo Máximo (Max):</span>
                            <span className="font-mono text-white">{roshanInfo.maxTimeLeft || 'N/A'}</span>
                        </div>
                         <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Morto em (GSI):</span>
                            <span className="font-mono text-white">{roshanInfo.roshanKillTime || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. SEÇÃO DE DADOS BRUTOS (Para Debug Avançado) */}
            <section className="p-4 bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-xl font-bold mb-3 border-b border-gray-700 pb-2 flex items-center space-x-2 text-red-400">
                    <Anchor className="w-5 h-5" />
                    <span>Dados GSI Brutos</span>
                </h2>
                <pre className="text-xs text-gray-200 bg-gray-900 p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(serverState.latestGsiData, null, 2)}
                </pre>
            </section>

        </div>
    );
};

export default App;