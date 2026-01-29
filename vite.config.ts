import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "pdf-worker": ["pdfjs-dist"],
        },
      },
    },
  },
});
