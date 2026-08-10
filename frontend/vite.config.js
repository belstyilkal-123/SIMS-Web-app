import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'Smart Irrigation System',
        short_name: 'SmartIrrigate',
        description: 'Advanced Smart Irrigation Dashboard',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],

  resolve: {
    alias: {
      // jsPDF optionally imports canvg / html2canvas / dompurify for SVG and
      // HTML rendering features we never use. Redirect them to empty stubs so
      // Vite's import-analysis plugin doesn't fail in dev or production.
      'canvg':      path.resolve(__dirname, 'src/utils/pdfStubs/canvg.js'),
      'html2canvas': path.resolve(__dirname, 'src/utils/pdfStubs/html2canvas.js'),
      'dompurify':  path.resolve(__dirname, 'src/utils/pdfStubs/dompurify.js'),
    },
  },

  optimizeDeps: {
    // Force Vite to pre-bundle jsPDF so the dynamic imports inside it get
    // resolved against the aliases above at dep-optimisation time.
    include: ['jspdf', 'jspdf-autotable'],
  },
})
