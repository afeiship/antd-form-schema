import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import sdf from '@jswork/simple-date-format';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  plugins: [react()],
  resolve: {
    alias: {
      '@jswork/antd-form-schema': resolve(__dirname, '../lib/src/index.tsx'),
    },
  },
  define: {
    BUILD_TIME: JSON.stringify(sdf('datetime')),
  },
});
