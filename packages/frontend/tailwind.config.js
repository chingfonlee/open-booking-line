/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#173820',
          800: '#1e482a',
          700: '#2a5937',
          600: '#397346',
          100: '#dcebd6',
          soft: '#f5faf2'
        },
        cream: {
          DEFAULT: '#f8f3e7',
          paper: '#fffdf7',
          screen: '#f3f0e8',
          card: '#faf8f3'
        },
        soil: {
          DEFAULT: '#c8ad86',
          soft: '#eee2cf',
          line: '#d8d1c3',
          border: '#e0d9cb',
          input: '#bfb8aa'
        },
        ink: {
          DEFAULT: '#20271f',
          muted: '#657061',
        },
        primary: {
          50: '#f5faf2',
          100: '#dcebd6',
          500: '#397346',
          600: '#2a5937',
          700: '#173820',
          800: '#122c19',
        }
      }
    },
  },
  plugins: [],
}
