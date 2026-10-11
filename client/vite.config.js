import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o Vite repassa a API e o Socket.io para o servidor Node.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
