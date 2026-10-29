/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        paper: '#F7F8F5',
        ink: {
          DEFAULT: '#18211B',
          950: '#090D0A',
          900: '#0C120E',
          850: '#101711',
          800: '#152018',
          700: '#1B2A20',
          600: '#26382B',
        },
        muted: '#657168',
        line: {
          DEFAULT: '#E4E7E1',
          dark: '#1F2E23',
        },
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#059669',
          600: '#047857',
          700: '#065F46',
          800: '#064E3B',
          900: '#022C22',
        },
        clay: '#D97706',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(24, 33, 27, 0.04), 0 8px 24px -12px rgba(24, 33, 27, 0.12)',
        lift: '0 12px 40px -16px rgba(5, 150, 105, 0.35)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease both',
      },
    },
  },
  plugins: [],
};
