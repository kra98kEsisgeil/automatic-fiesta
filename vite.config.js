import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  server: {
    host: true, // 同一ネットワーク内のスマホからアクセス可能にする
    port: 5173,
    https: true  // httpsを強制（センサー・カメラAPI利用に必須）
  }
});
