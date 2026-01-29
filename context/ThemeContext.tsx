import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { getThemePreference, saveThemePreference, type ThemePreference } from '../utils/themePersistence';

type ThemeContextType = {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  effectiveScheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() ?? 'light'
  );

  // Load saved preference on mount
  useEffect(() => {
    getThemePreference().then((saved) => {
      setThemePreference(saved);
    });

    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'light');
    });
    return () => listener.remove();
  }, []);

  const setThemePreferenceWithSave = async (pref: ThemePreference) => {
    setThemePreference(pref);
    await saveThemePreference(pref);
  };

  const effectiveScheme = themePreference === 'system' ? systemScheme : themePreference;

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        setThemePreference: setThemePreferenceWithSave,
        effectiveScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}