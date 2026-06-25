/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface steps. 900 is the near-black page bg (deepened slightly); 800+
        // are lifted so cards/panels separate clearly from the page on
        // low-contrast screens.
        ink: {
          900: '#0a0a0d',
          800: '#1c1c24',
          700: '#282832',
          600: '#353541',
          500: '#45454f',
        },
        // Brighten the muted grays for readability on low-contrast displays (used
        // almost exclusively as text). Other zinc shades fall through to
        // Tailwind's defaults.
        zinc: {
          400: '#c0c0c8',
          500: '#9a9aa3',
          600: '#7c7c86',
        },
        clay: {
          400: '#e8a87c',
          500: '#d97757',
          600: '#c2410c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
