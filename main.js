// O Processo Principal do Electron: Cria e configura a janela do overlay.
import { fileURLToPath } from 'url';
import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Porta que o seu aplicativo React está rodando no modo de desenvolvimento (Vite default: 5173)
const REACT_DEV_URL = 'http://localhost:5173';

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // --- DIMENSÕES E POSICIONAMENTO DO OVERLAY ---
  const OVERLAY_WIDTH = 320;
  const OVERLAY_HEIGHT = 800;

  const mainWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,

    // Cria como invisível inicialmente (Mostra só após o carregamento total)
    show: false,

    // Posicionamento no canto superior direito
    x: width - OVERLAY_WIDTH - 20,
    y: 20,

    // --- CONFIGURAÇÕES DO OVERLAY FINAL ---
    frame: false,
    transparent: true, // CHAVE: Torna o fundo transparente
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000', // Fundo transparente

    // Configurações de Segurança e Integração
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  // Define o nível "screen-saver" para garantir que esteja acima de jogos em tela cheia
  mainWindow.setAlwaysOnTop(true, "screen-saver");

  // --- HABILITA CLICK-THROUGH ---
  // CHAVE: Ignora todos os cliques do mouse, permitindo que você interaja com o jogo por baixo.
  mainWindow.setIgnoreMouseEvents(true);

  // --- LÓGICA DE EXIBIÇÃO ESTÁVEL ---
  // A janela só será exibida DEPOIS que o conteúdo for carregado (ready-to-show)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // --- CARREGAMENTO DO FRONTEND (DEV vs. PROD) ---
  if (isDev) {
    // Modo de Desenvolvimento (Carrega o Vite)
    mainWindow.loadURL(REACT_DEV_URL);
  } else {
    // Modo de Produção (Carrega a pasta dist)
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// O ouvinte IPC não é mais necessário, mas mantém o código limpo
ipcMain.on('open-devtools', () => {
  // Opcional: Para debugging rápido, use: BrowserWindow.getAllWindows()[0].webContents.openDevTools({ mode: 'detach' });
});


// Quando o Electron está pronto
app.whenReady().then(createWindow);

// Gerenciamento de janelas padrão
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});