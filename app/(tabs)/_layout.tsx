// app/(tabs)/_layout.tsx
import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import React, { createContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export const ProfileAlertContext = createContext<{
  profileAlertCount: number;
  setProfileAlertCount: (n: number) => void;
}>({
  profileAlertCount: 0,
  setProfileAlertCount: () => {},
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

  // Friend requests badge
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, 'profiles', currentUser.uid, 'friendRequests'),
      snap => setPendingCount(snap.size)
    );
    return () => unsub();
  }, [currentUser]);

  // RED DOT — fixed "odd number of segments" error
  useEffect(() => {
    if (!currentUser) return;

    const calc = async () => {
      try {
        const lastSnap = await getDoc(
          doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedProfile')
        );
        const lastViewed = lastSnap.exists() ? lastSnap.data()?.timestamp?.toDate() : null;

        let count = 0;

        // THIS LINE WAS WRONG BEFORE — fixed now
        const checkinsRef = collection(db, 'profiles', currentUser.uid, 'checkins');
        const checkinsSnap = await getDocs(checkinsRef);

        for (const checkinDoc of checkinsSnap.docs) {
          const cheersRef = collection(checkinDoc.ref, 'cheers');
          const chirpsRef = collection(checkinDoc.ref, 'chirps');

          const [cheersSnap, chirpsSnap] = await Promise.all([
            getDocs(cheersRef),
            getDocs(chirpsRef),
          ]);

          cheersSnap.forEach(d => {
            const ts = d.data()?.timestamp?.toDate();
            if (!lastViewed || (ts && ts > lastViewed)) count++;
          });
          chirpsSnap.forEach(d => {
            const ts = d.data()?.timestamp?.toDate();
            if (!lastViewed || (ts && ts > lastViewed)) count++;
          });
        }

        setProfileAlertCount(count);
      } catch (e) {
        console.error('Red dot error:', e);
      }
    };

    calc();
    const unsub = onSnapshot(
      collection(db, 'profiles', currentUser.uid, 'checkins'),
      () => calc()
    );
    return () => unsub();
  }, [currentUser]);

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
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} /> }} />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Ionicons name="person" size={28} color={color} />,
            tabBarBadge: profileAlertCount > 0 ? profileAlertCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontWeight: 'bold' },
          }}
        />
        <Tabs.Screen name="checkin" options={{ title: 'Check-In', tabBarIcon: ({ color }) => <Ionicons name="location" size={28} color={color} /> }} />
        <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <Ionicons name="map" size={28} color={color} /> }} />
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
        <CustomTabs profileAlertCount={profileAlertCount} setProfileAlertCount={setProfileAlertCount} />
      </ProfileAlertContext.Provider>
    </SafeAreaProvider>
  );
}