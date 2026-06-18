/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Color de marca: verde petróleo / teal sobrio (token se sigue llamando "verde")
        verde: {
          50:  '#eef5f4',
          100: '#d3e6e3',
          200: '#a7cdc8',
          500: '#1a8f86',
          600: '#137a72',
          700: '#0f5d57',
          800: '#0c4843',
          900: '#08302d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
