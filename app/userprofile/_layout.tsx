//version 1 - 1154am friday 1st of august
//userprofile\_layout.tsx
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import LoadingPuck from "@/components/loadingPuck";
import { View } from 'react-native';

export default function UserprofileLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTitle: '',
        loading: () => (
          <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
            <LoadingPuck size={240} />
          </View>
        ),
      }}
    />
  );
}