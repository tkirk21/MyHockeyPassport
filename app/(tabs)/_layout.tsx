//version 1 - 10am friday 1st of august
// app/(tabs)/_layout.tsx
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabs() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#0A2940', paddingBottom: insets.bottom }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0A2940',
            borderTopColor: '#D1D5DB',
            height: 70,
            paddingBottom: 10,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#657B8D',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Ionicons name="person" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="checkin"
          options={{
            title: 'Check-In',
            tabBarIcon: ({ color }) => <Ionicons name="location" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Map',
            tabBarIcon: ({ color }) => <Ionicons name="map" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <CustomTabs />
    </SafeAreaProvider>
  );
}




