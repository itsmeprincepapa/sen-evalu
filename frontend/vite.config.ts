import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
// Plugin Tailwind : il génère les styles à partir des classes écrites dans le code
import tailwindcss from '@tailwindcss/vite' // <-- LIGNE À AJOUTER en haut

export default defineConfig({
  // On garde le plugin React déjà présent et on ajoute celui de Tailwind
  plugins: [react(), tailwindcss()], // <-- ajoutez tailwindcss() dans la liste
})
