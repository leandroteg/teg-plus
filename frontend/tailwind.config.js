/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#6366F1', light: '#818CF8', dark: '#4338CA' },
        success:  { DEFAULT: '#10B981', light: '#34D399', dark: '#059669' },
        warning:  { DEFAULT: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
        danger:   { DEFAULT: '#EF4444', light: '#FCA5A5', dark: '#DC2626' },
        navy:     { DEFAULT: '#0F172A', soft: '#1E293B' },
        teal:     { DEFAULT: '#14B8A6', light: '#2DD4BF', dark: '#0F766E' },
        cyan:     { DEFAULT: '#06B6D4', light: '#22D3EE', dark: '#0E7490' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card:          '0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.06)',
        'card-md':     '0 4px 12px 0 rgba(0,0,0,.10)',
        'glow-teal':   '0 0 24px rgba(20,184,166,0.45), 0 0 56px rgba(20,184,166,0.15)',
        'glow-cyan':   '0 0 24px rgba(6,182,212,0.45), 0 0 56px rgba(6,182,212,0.15)',
        'glow-sm':     '0 0 16px rgba(20,184,166,0.4)',
        'glow-card':   '0 8px 32px rgba(20,184,166,0.18), 0 0 0 1px rgba(20,184,166,0.25)',
        sidebar:       '4px 0 24px rgba(0,0,0,0.35)',
      },
      animation: {
        'fade-in-up':    'fadeInUp 0.55s ease-out both',
        'fade-in':       'fadeIn 0.45s ease-out both',
        'float':         'float 5s ease-in-out infinite',
        'pulse-glow':    'pulseGlow 3s ease-in-out infinite',
        'slide-in-left': 'slideInLeft 0.42s ease-out both',
        'scale-in':      'scaleIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
        'shimmer':       'shimmer 2.5s linear infinite',
        'slide-up':      'slideUp 0.3s ease-out both',
        'slide-down':    'slideDown 0.3s ease-out both',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 20px rgba(20,184,166,0.25), 0 0 40px rgba(20,184,166,0.08)' },
          '50%':     { boxShadow: '0 0 40px rgba(20,184,166,0.65), 0 0 80px rgba(20,184,166,0.25)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.84)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  safelist: (() => {
    const colors = ['teal', 'emerald', 'blue', 'orange', 'rose', 'indigo', 'violet']
    const patterns = []
    for (const color of colors) {
      patterns.push(
        `bg-${color}-50`, `bg-${color}-100`,
        `bg-${color}-500/15`, `bg-${color}-500/10`, `bg-${color}-400/10`,
        `text-${color}-300`, `text-${color}-400`, `text-${color}-500`,
        `text-${color}-600`, `text-${color}-700`,
        `text-${color}-500/60`, `text-${color}-400/70`,
        `border-${color}-200`, `border-${color}-300`,
        `border-${color}-500/25`, `border-${color}-500/40`,
        `hover:bg-${color}-100`, `hover:bg-${color}-500/18`,
        `hover:border-${color}-300`,
        `group-hover:text-${color}-400`, `group-hover:text-${color}-500`,
      )
    }
    return patterns
  })(),
  plugins: [],
}
