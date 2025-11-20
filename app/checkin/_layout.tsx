//app/checkin/_layout.tsx
import { Stack } from 'expo-router';

export default function CheckinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: "#fff",
        headerStyle: { backgroundColor: "#0A2940" },
      }}
    />
  );
}