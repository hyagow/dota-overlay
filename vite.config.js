import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // SOLUÇÃO: Define a base como vazia para garantir que os caminhos dos assets sejam relativos.
  base: '',

  server: {
    // Garante que o servidor Vite rode na porta 5173 para o Electron conectar
    port: 5173, 
    strictPort: true,
  },
});