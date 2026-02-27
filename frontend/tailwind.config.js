/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1E40AF', light: '#3B82F6', dark: '#1E3A8A' },
        success: { DEFAULT: '#059669', light: '#34D399' },
        warning: { DEFAULT: '#D97706', light: '#FBBF24' },
        danger: { DEFAULT: '#DC2626', light: '#F87171' },
      }
    }
  },
  plugins: []
}
