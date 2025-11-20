//version 1 - 1154am friday 1st of august
//userprofile\_layout.tsx
import { Stack } from 'expo-router';

export default function UserProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerStyle: { backgroundColor: '#ECECEC' },
        headerTintColor: '#0D2C42',
        headerTitleAlign: 'center',
      }}
    />
  );
}