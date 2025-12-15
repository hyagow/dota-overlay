// O Processo de Pré-carregamento: Ponte entre o ambiente do navegador (React) e o ambiente Node (Electron).

// Usamos 'require' em vez de 'import' no preload script para evitar o erro "Cannot use import statement outside a module"
const { contextBridge, ipcRenderer } = require('electron');

// Expor um objeto seguro para o React/Frontend (janela global)
contextBridge.exposeInMainWorld('electronAPI', {
    // Adicione funções futuras aqui para comunicação com GSI, etc.
});

// Ações a serem executadas quando o DOM estiver completamente carregado (ideal para debug)
window.addEventListener('DOMContentLoaded', () => {
    // Envia a mensagem para o Processo Principal abrir o DevTools
    ipcRenderer.send('open-devtools');
    console.log("Mensagem 'open-devtools' enviada para o Processo Principal.");
});