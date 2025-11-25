//app/(tabs)/_layout.tsx
import { getAuth } from 'firebase/auth';
import { collection, getDocs, getFirestore, onSnapshot } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import React, { createContext, useEffect, useState,  } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export const ProfileAlertContext = createContext({
  profileAlertCount: 0,
  setProfileAlertCount: (_: number) => {},
});

const db = getFirestore(firebaseApp);

function CustomTabs({
  profileAlertCount,
  setProfileAlertCount,
}: {
  profileAlertCount: number;
  setProfileAlertCount: (count: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState(0);
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser;

  // friend request listener
  useEffect(() => {
    if (!currentUser) return;
    const reqRef = collection(db, 'profiles', currentUser.uid, 'friendRequests');
    const unsub = onSnapshot(reqRef, snap => setPendingCount(snap.size));
    return () => unsub();
  }, [currentUser]);

  // cheers + chirps listener
  useEffect(() => {
    if (!currentUser) return;

    const cheersRoot = collection(db, 'profiles', currentUser.uid, 'checkins');
    const unsub = onSnapshot(cheersRoot, async snap => {
      let total = 0;

      for (const d of snap.docs) {
        const cheerRef = collection(db, 'profiles', currentUser.uid, 'checkins', d.id, 'cheers');
        const chirpRef = collection(db, 'profiles', currentUser.uid, 'checkins', d.id, 'chirps');

        const [cheersSnap, chirpsSnap] = await Promise.all([
          getDocs(cheerRef),
          getDocs(chirpRef),
        ]);

        total += cheersSnap.size + chirpsSnap.size;
      }

      setProfileAlertCount(total);
    });

    return () => unsub();
  }, [currentUser, setProfileAlertCount]);

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
            tabBarBadge: profileAlertCount > 0 ? profileAlertCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#EF4444',
              color: '#fff',
              fontWeight: 'bold',
            },
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
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          }}
        />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  const [profileAlertCount, setProfileAlertCount] = useState(0);

  return (
    <SafeAreaProvider>
      <ProfileAlertContext.Provider value={{ profileAlertCount, setProfileAlertCount }}>
        <CustomTabs
          profileAlertCount={profileAlertCount}
          setProfileAlertCount={setProfileAlertCount}
        />
      </ProfileAlertContext.Provider>
    </SafeAreaProvider>
  );
}