/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'brand-red': '#cc0000',
        'brand-red-hover': '#b30000',
        'brand-red-faint': '#fff5f5',
        ink: {
          DEFAULT: '#1a1a1a',
          primary: '#1a1a1a',
          secondary: '#4a4a4a',
          tertiary: '#888888',
        },
        surface: {
          DEFAULT: '#ffffff',
          primary: '#ffffff',
          secondary: '#faf9f7',
          tertiary: '#f4f3f0',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'token-sm': '4px',
        'token-md': '8px',
        'token-lg': '12px',
        'token-xl': '16px',
      },
      boxShadow: {
        'token-sm': '0 1px 2px 0 rgba(0,0,0,0.04)',
        'token-md': '0 4px 12px -2px rgba(0,0,0,0.08)',
        'token-lg': '0 12px 32px -4px rgba(0,0,0,0.12)',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
};
