// app/(tabs)/_layout.tsx
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import React, { createContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const db = getFirestore(firebaseApp);

export const ProfileAlertContext = createContext<{
  profileAlertCount: number;
  setProfileAlertCount: (n: number) => void;
}>({
  profileAlertCount: 0,
  setProfileAlertCount: () => {},
});

function CustomTabs() {
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState(0);
  const [friendsReplyCount, setFriendsReplyCount] = useState(0);
  const [profileUnreadCount, setProfileUnreadCount] = useState(0);
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser;

  // ==================== PROFILE TAB BADGE (UNCHANGED) ====================
  useEffect(() => {
    if (!currentUser?.uid) {
      setProfileUnreadCount(0);
      return;
    }

    const calc = async () => {
      try {
        const lastViewedSnap = await getDoc(
          doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedProfileTab')
        );
        const lastViewed = lastViewedSnap.exists() ? lastViewedSnap.data().timestamp?.toDate() : null;

        if (!lastViewed) {
          setProfileUnreadCount(0);
          return;
        }

        let count = 0;
        const checkinsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'checkins'));

        for (const checkin of checkinsSnap.docs) {
          const cheersQuery = query(collection(checkin.ref, 'cheers'), where('timestamp', '>', lastViewed));
          const cheersSnap = await getDocs(cheersQuery);
          count += cheersSnap.size;

          const chirpsQuery = query(collection(checkin.ref, 'chirps'), where('timestamp', '>', lastViewed));
          const chirpsSnap = await getDocs(chirpsQuery);

          for (const chirp of chirpsSnap.docs) {
            if (chirp.data().userId !== currentUser.uid) count++;
          }
        }

        setProfileUnreadCount(count);
      } catch (e) {
        setProfileUnreadCount(0);
      }
    };

    calc();

    const allUnsubs: (() => void)[] = [];

    const checkinsQuery = collection(db, 'profiles', currentUser.uid, 'checkins');
    const unsubCheckins = onSnapshot(checkinsQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          allUnsubs.push(onSnapshot(collection(change.doc.ref, 'cheers'), calc));
          allUnsubs.push(onSnapshot(collection(change.doc.ref, 'chirps'), calc));
        }
      });
      calc();
    });
    allUnsubs.push(unsubCheckins);

    getDocs(checkinsQuery).then((initialSnap) => {
      initialSnap.docs.forEach((checkinDoc) => {
        allUnsubs.push(onSnapshot(collection(checkinDoc.ref, 'cheers'), calc));
        allUnsubs.push(onSnapshot(collection(checkinDoc.ref, 'chirps'), calc));
      });
    });

    return () => allUnsubs.forEach((u) => u());
  }, [currentUser?.uid]);

  // ==================== FRIEND REQUESTS BADGE (UNCHANGED) ====================
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, 'profiles', currentUser.uid, 'friendRequests'),
      (snap) => setPendingCount(snap.size)
    );
    return () => unsub();
  }, [currentUser]);

  // ==================== FRIENDS REPLY COUNT (UNCHANGED) ====================
  useEffect(() => {
    if (!currentUser?.uid) {
      setFriendsReplyCount(0);
      return;
    }

    const calc = async () => {
      try {
        const lastViewedSnap = await getDoc(
          doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriendsTab')
        );
        const lastViewed = lastViewedSnap.exists() ? lastViewedSnap.data().timestamp?.toDate() : null;

        if (!lastViewed) {
          setFriendsReplyCount(0);
          return;
        }

        let count = 0;
        const friendsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'friends'));
        const friendIds = friendsSnap.docs.map((d) => d.id);

        for (const ownerId of friendIds) {
          const checkinsSnap = await getDocs(collection(db, 'profiles', ownerId, 'checkins'));
          for (const checkinDoc of checkinsSnap.docs) {
            const yourChirpQuery = query(
              collection(db, 'profiles', ownerId, 'checkins', checkinDoc.id, 'chirps'),
              where('userId', '==', currentUser.uid),
              limit(1)
            );
            const yourChirpSnap = await getDocs(yourChirpQuery);
            if (yourChirpSnap.empty) continue;

            const repliesQuery = query(
              collection(db, 'profiles', ownerId, 'checkins', checkinDoc.id, 'chirps'),
              where('timestamp', '>', lastViewed),
              where('userId', '!=', currentUser.uid)
            );
            const repliesSnap = await getDocs(repliesQuery);
            count += repliesSnap.size;
          }
        }

        setFriendsReplyCount(count);
      } catch (e) {
        setFriendsReplyCount(0);
      }
    };

    calc();

    const unsubs: (() => void)[] = [];
    const setup = async () => {
      const friendsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'friends'));
      const friendIds = friendsSnap.docs.map((d) => d.id);
      for (const ownerId of friendIds) {
        const checkinsSnap = await getDocs(collection(db, 'profiles', ownerId, 'checkins'));
        checkinsSnap.docs.forEach((checkinDoc) => {
          unsubs.push(onSnapshot(collection(db, 'profiles', ownerId, 'checkins', checkinDoc.id, 'chirps'), calc));
        });
      }
    };

    setup();

    return () => unsubs.forEach((u) => u());
  }, [currentUser?.uid]);

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
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={28} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={28} color={color} />, tabBarBadge: profileUnreadCount > 0 ? profileUnreadCount : undefined, tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontWeight: 'bold' }, }}
          listeners={{ focus: () => {
              if (!currentUser?.uid) return;
              setProfileUnreadCount(0);
              setDoc(doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedProfileTab'), { timestamp: serverTimestamp() }, { merge: true } ).catch(() => {});
            },
          }}
        />
        <Tabs.Screen name="checkin" options={{ title: 'Check-In', tabBarIcon: ({ color }) => <Ionicons name="location" size={28} color={color} />, }} />
        <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <Ionicons name="map" size={28} color={color} />, }} />
        <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />, tabBarBadge: (pendingCount + friendsReplyCount) > 0 ? pendingCount + friendsReplyCount : undefined, tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontWeight: 'bold' }, }}
          listeners={{ focus: () => {
              if (currentUser?.uid) {
                setFriendsReplyCount(0);
                setDoc(
                  doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriendsTab'), { timestamp: serverTimestamp() }, { merge: true } ).catch(() => {});
              }
            },
          }}
        />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  const [profileAlertCount, setProfileAlertCount] = useState(0);

  return (
    <ProfileAlertContext.Provider value={{ profileAlertCount, setProfileAlertCount }}>
      <CustomTabs />
    </ProfileAlertContext.Provider>
  );
}