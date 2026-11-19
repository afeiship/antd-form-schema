import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import sdf from '@jswork/simple-date-format';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@jswork\/antd-form-schema$/,
        replacement: resolve(__dirname, '../lib/src/index.tsx'),
      },
      {
        find: /^@jswork\/antd-form-schema\/style\.css$/,
        replacement: resolve(__dirname, '../lib/src/style.css'),
      },
    ],
  },
  define: {
    BUILD_TIME: JSON.stringify(sdf('datetime')),
  },
});
