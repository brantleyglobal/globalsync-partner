import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // CRUCIAL: Forces relative asset loading so Chromium can use file://
  base: './',  
  
  plugins: [
    react(),
    // CUSTOM HOOK: Forcefully copy tokens.js right after the build finishes
    {
      name: 'force-copy-tokens',
      closeBundle() {
        // List every file that Vite is skipping but your runtime code requires
        const filesToCopy = ['tokens.js', 'deployments.json'];
        
        filesToCopy.forEach((filename) => {
          const source = path.resolve(__dirname, 'src', filename);
          const destination = path.resolve(__dirname, 'src', 'dist', filename);
          
          if (fs.existsSync(source)) {
            fs.copyFileSync(source, destination);
            console.log(`Successfully forced ${filename} into src/dist/`);
          } else {
            console.warn(`Warning: Could not find source file at ${source}`);
          }
        });
      }
    }
  ],
  
  // 1. Point root to 'src' so Vite treats it as an isolated workspace
  root: path.resolve(__dirname, 'src'), 

  assetsInclude: [
    path.resolve(__dirname, 'src', 'tokens.js'),
    path.resolve(__dirname, 'src', 'deployments.json')
  ],
  
  server: {
    port: 5173,
    strictPort: true
  },
  
  build: {
    // 2. CRUCIAL FIX: Pull the production bundle UP and OUT into the real project root's /dist folder
    outDir: 'dist',  
    emptyOutDir: true, 
    reportCompressedSize: false, // Disabling this saves additional build time
    
    rollupOptions: {
      // 3. Because root is 'src', your entry point is simply index.html
      input: {
        main: path.resolve(__dirname, 'src', 'index.html'),
      },
      external: [
        'path', 
        'fs'
      ]
    }
  }
});