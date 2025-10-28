//version 2 - 1154am friday 1st of august
//app\_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';


export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#0A2940');
  }, []);

  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="login">
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="checkin" options={{ headerShown: false }} />
        <Stack.Screen name="userprofile" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="arenas/[arenaId]" options={{ headerShown: false }} />
        <Stack.Screen name="leagues/[leagueName]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" backgroundColor="#0A2940" />
    </ThemeProvider>
  );
}
