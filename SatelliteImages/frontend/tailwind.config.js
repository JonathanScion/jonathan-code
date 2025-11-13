/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2ea3f2',
          50: '#e8f6fd',
          100: '#d1edfb',
          200: '#a3dbf7',
          300: '#75c9f3',
          400: '#47b7ef',
          500: '#2ea3f2', // Main Jonathan Space blue
          600: '#1a8cd8',
          700: '#1570b0',
          800: '#105488',
          900: '#0b3860',
        },
        dark: {
          DEFAULT: '#333333',
          light: '#666666',
        },
        light: {
          DEFAULT: '#ffffff',
          gray: '#eeeeee',
          border: '#dddddd',
        }
      },
      fontFamily: {
        sans: ['Open Sans', 'sans-serif'],
      },
      boxShadow: {
        'eoi': '0 2px 5px rgba(0, 0, 0, 0.1)',
        'eoi-hover': '0 4px 8px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        'eoi': '3px',
      },
      transitionDuration: {
        'eoi': '300ms',
      }
    },
  },
  plugins: [],
}
