/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { version } from './package.json';

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  build: { target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});