/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        sidebar: 'var(--bg-sidebar)',
        panel: 'var(--bg-panel)',
        elevated: 'var(--bg-elevated)',
        input: 'var(--bg-input)',
        hover: 'var(--bg-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        primary: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          fg: 'var(--accent-fg)'
        },
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        txt: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        method: {
          get: '#36B37E',
          post: '#E6AD50',
          put: '#6C8CFF',
          patch: '#9B7BFF',
          delete: '#E45B63'
        }
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      spacing: {
        18: '4.5rem'
      },
      transitionDuration: {
        DEFAULT: '120ms'
      }
    }
  },
  plugins: []
}
