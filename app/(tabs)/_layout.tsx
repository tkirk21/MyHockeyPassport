// app/(tabs)/_layout.tsx
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import React, { createContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

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
  const [friendsReplyCount, setFriendsReplyCount] = useState(0);
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser;

  useEffect(() => {
      if (!currentUser) return;

      const calc = async () => {
        try {
          const lastSnap = await getDoc(
            doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriends')
          );
          const lastViewed = lastSnap.exists() ? lastSnap.data()?.timestamp?.toDate() : null;

          let count = 0;
          const checkinsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'checkins'));

          for (const checkin of checkinsSnap.docs) {
            const chirpsSnap = await getDocs(collection(checkin.ref, 'chirps'));

            for (const chirp of chirpsSnap.docs) {
              const data = chirp.data();
              const ts = data.timestamp?.toDate();

              const myChirp = chirpsSnap.docs.find(d => d.data().userId === currentUser.uid && d.id !== chirp.id);
              if (myChirp && (!lastViewed || (ts && ts > lastViewed))) count++;
            }
          }

          setFriendsReplyCount(count);
        } catch (e) {
          console.error('Friends reply count error:', e);
        }
      };

      calc();
      const unsub = onSnapshot(collection(db, 'profiles', currentUser.uid, 'checkins'), () => calc());
      return () => unsub();
    }, [currentUser]);

  // Friend requests badge
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, 'profiles', currentUser.uid, 'friendRequests'),
      snap => setPendingCount(snap.size)
    );
    return () => unsub();
  }, [currentUser]);

// ←←← CLEAR RED BLIMP WHEN FRIENDS TAB IS OPENED ←←←
  useFocusEffect(
    React.useCallback(() => {
      if (!currentUser) return;

      setDoc(
        doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriendsTab'),
        { timestamp: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }, [currentUser])
  );

  // RED DOT — fixed "odd number of segments" error
  useEffect(() => {
    if (!currentUser) return;

    const calc = async () => {
      try {
        let count = 0;
        const checkinsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'checkins'));

        for (const checkin of checkinsSnap.docs) {
          const chirpsSnap = await getDocs(collection(checkin.ref, 'chirps'));
          for (const chirp of chirpsSnap.docs) {
            if (chirp.data().userId !== currentUser.uid) {
              count++; // every reply from someone else = +1
            }
          }
        }
        setFriendsReplyCount(count);
      } catch (e) {
        console.error('Friends reply count error:', e);
        setFriendsReplyCount(0);
      }
    };

    calc();
    const unsub = onSnapshot(collection(db, 'profiles', currentUser.uid, 'checkins'), () => calc());
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
            tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />,
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
            tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontWeight: 'bold' },
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