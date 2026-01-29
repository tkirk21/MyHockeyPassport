import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@app_theme_preference';

export type ThemePreference = 'light' | 'dark';

export const saveThemePreference = async (preference: ThemePreference) => {
  try {
    await AsyncStorage.setItem(THEME_KEY, preference);
  } catch (e) {
    console.error('Failed to save theme preference', e);
  }
};

export const getThemePreference = async (): Promise<ThemePreference> => {
  try {
    const value = await AsyncStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
    return 'system'; // default
  } catch (e) {
    return 'system';
  }
};