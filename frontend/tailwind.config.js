/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#6366F1', light: '#818CF8', dark: '#4338CA' },
        success:  { DEFAULT: '#10B981', light: '#34D399', dark: '#059669' },
        warning:  { DEFAULT: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
        danger:   { DEFAULT: '#EF4444', light: '#FCA5A5', dark: '#DC2626' },
        navy:     { DEFAULT: '#0F172A', soft: '#1E293B' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.06)',
        'card-md': '0 4px 12px 0 rgba(0,0,0,.10)',
      },
    }
  },
  plugins: []
}
