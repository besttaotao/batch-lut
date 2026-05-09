module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary-accent': '#42b883',
        'primary-accent-hover': '#339c6d',
        'primary-accent-glow': 'rgba(66, 184, 131, 0.4)',
        'bg-app': '#0a0c0b',
        'bg-sidebar': '#111412',
        'bg-panel': '#151816',
        'bg-surface': '#1b1f1c',
        'bg-surface-hover': '#222724',
        'border-dim': '#232825',
        'border-light': '#323835',
        'text-main': '#e0e0e0',
        'text-muted': '#8a948e',
        'text-dim': '#5c6660'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        panel: '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glow-sm': '0 0 15px -3px rgba(66, 184, 131, 0.2)',
        'glow-md': '0 0 25px -5px rgba(66, 184, 131, 0.3)'
      }
    }
  },
  plugins: []
}
