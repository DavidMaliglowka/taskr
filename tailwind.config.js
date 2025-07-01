/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./webview-ui/**/*.{js,jsx,ts,tsx,html}"
  ],
  theme: {
    extend: {
      colors: {
        'vscode-foreground': 'var(--vscode-foreground)',
        'vscode-background': 'var(--vscode-editor-background)',
        'vscode-border': 'var(--vscode-panel-border)',
        'vscode-button': 'var(--vscode-button-background)',
        'vscode-button-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-input': 'var(--vscode-input-background)',
      }
    },
  },
  plugins: [],
} 