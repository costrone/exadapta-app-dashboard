import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    if (saved === 'dark') return true
    if (saved === 'light') return false
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const theme: Theme = isDarkMode ? 'dark' : 'light'
    localStorage.setItem('theme', theme)
    document.body.setAttribute('data-theme', theme)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) metaThemeColor.setAttribute('content', isDarkMode ? '#0f1419' : '#ffffff')
  }, [isDarkMode])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) setIsDarkMode(e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    theme: isDarkMode ? 'dark' : 'light',
    isDarkMode,
    toggleTheme: () => setIsDarkMode(v => !v)
  }), [isDarkMode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}


