/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'surface-subtle': 'var(--color-surface-subtle)',
        'border-subtle': 'var(--color-border-subtle)',
        'border-default': 'var(--color-border-default)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        brand: 'var(--color-brand)',
        'brand-hover': 'var(--color-brand-hover)',
        'brand-soft': 'var(--color-brand-soft)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        cloud: {
          // Compatibility aliases. New UI must use the semantic names above.
          blue: 'var(--color-brand)',
          'blue-hover': 'var(--color-brand-hover)',
          'blue-light': 'var(--color-brand-soft)',
          bg: 'var(--color-canvas)',
          'dark-bg': 'var(--color-canvas)',
          'dark-card': 'var(--color-surface)',
          sidebar: 'var(--color-surface-subtle)',
          'dark-sidebar': 'var(--color-surface-subtle)',
          border: 'var(--color-border-default)',
          'dark-border': 'var(--color-border-default)',
        }
      },
      borderRadius: {
        'ds-sm': 'var(--radius-sm)',
        'ds-md': 'var(--radius-md)',
        'ds-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        dropdown: 'var(--shadow-dropdown)',
        modal: 'var(--shadow-modal)',
        floating: 'var(--shadow-floating)',
      },
      maxWidth: {
        shell: 'var(--width-shell)',
        list: 'var(--width-list)',
        reading: 'var(--width-reading)',
        workspace: 'var(--width-workspace)',
      }
    },
  },
  plugins: [],
}
