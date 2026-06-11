import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    target: "chrome80",
  },
  plugins: [react()],
});
