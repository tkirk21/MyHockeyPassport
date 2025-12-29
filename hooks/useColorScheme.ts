// hooks/useColorScheme.ts
import { Appearance } from 'react-native';
import { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useColorScheme() {
  const [scheme, setScheme] = useState(Appearance.getColorScheme() ?? 'light');

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme ?? 'light');
    });
    return () => listener.remove();
  }, []);

  // Force refresh when screen comes into focus (fixes Android Expo Go bug)
  useFocusEffect(() => {
    setScheme(Appearance.getColorScheme() ?? 'light');
  });

  return scheme;
}