import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme — currently ${theme === 'dark' ? 'Carbon' : 'Manila'}`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '◐' : '◑'}</span>
      <span className="hidden sm:inline">{theme === 'dark' ? 'Carbon' : 'Manila'}</span>
    </button>
  )
}
