import { useTheme } from '@/context/ThemeContext';

export function useColorScheme(): 'light' | 'dark' {
  const { effectiveScheme } = useTheme();
  return effectiveScheme;
}