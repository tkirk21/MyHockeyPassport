//version 1 - 10am friday 1st of august
//useColorScheme.ts
import { ColorSchemeName, useColorScheme as useSystemColorScheme } from 'react-native';
import { useEffect, useState } from 'react';

export function useColorScheme(): NonNullable<ColorSchemeName> {
  const systemColorScheme = useSystemColorScheme();
  const [colorScheme, setColorScheme] = useState<NonNullable<ColorSchemeName>>('light');

  useEffect(() => {
    if (systemColorScheme) {
      setColorScheme(systemColorScheme);
    }
  }, [systemColorScheme]);

  return colorScheme ?? 'light';
}