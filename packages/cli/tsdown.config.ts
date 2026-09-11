import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  format: ['esm'],
  dts: false,
  exports: false,
  clean: true,
})
