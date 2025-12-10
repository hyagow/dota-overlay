/** @type {import('tailwindcss').Config} */
export default {
  // Lista de arquivos onde o Tailwind deve procurar suas classes.
  // Isso garante que apenas as classes usadas sejam incluídas no build final.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Aqui você pode estender o tema padrão do Tailwind com cores, fontes personalizadas, etc.
      // Por exemplo, podemos definir a fonte 'Inter' como padrão, que é uma boa prática moderna:
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  // Plugins adicionais, se necessário.
  plugins: [],
}