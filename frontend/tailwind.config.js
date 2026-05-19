/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1422',
        wax: '#c8924a',
        cream: '#fdf9f0'
      },
      fontFamily: {
        display: ['Fraunces', 'Frank Ruhl Libre', 'serif'],
        displayHe: ['Frank Ruhl Libre', 'Fraunces', 'serif'],
        body: ['Manrope', 'Heebo', 'system-ui', 'sans-serif'],
        bodyHe: ['Heebo', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
}