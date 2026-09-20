import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// create-torrent (and its deps) expect Node-style globals (Buffer, process)
// that don't exist in the browser by default. Vite 5 dropped the automatic
// Node polyfills that older bundlers provided, so we define/alias them here.
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
