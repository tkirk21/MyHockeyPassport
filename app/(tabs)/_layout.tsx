// app/(tabs)/_layout.tsx
import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
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
  const [profileUnreadCount, setProfileUnreadCount] = useState(0);
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser;

// ==================== PROFILE TAB BADGE (INSTANT UPDATES - FIXED) ====================
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
        const lastViewed = lastViewedSnap.exists()
          ? lastViewedSnap.data().timestamp?.toDate()
          : null;

        if (!lastViewed) {
          setProfileUnreadCount(0);
          return;
        }

        let count = 0;
        const checkinsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'checkins'));

        for (const checkin of checkinsSnap.docs) {
          const cheersQuery = query(
            collection(checkin.ref, 'cheers'),
            where('timestamp', '>', lastViewed)
          );
          const cheersSnap = await getDocs(cheersQuery);
          count += cheersSnap.size;

          const chirpsQuery = query(
            collection(checkin.ref, 'chirps'),
            where('timestamp', '>', lastViewed)
          );
          const chirpsSnap = await getDocs(chirpsQuery);

          for (const chirp of chirpsSnap.docs) {
            if (chirp.data().userId !== currentUser.uid) {
              count++;
            }
          }
        }

        setProfileUnreadCount(count);
      } catch (e) {
        console.error('Profile unread count error:', e);
        setProfileUnreadCount(0);
      }
    };

    // Initial calculation
    calc();

    // Array to hold all unsub functions
    const allUnsubs: (() => void)[] = [];

    // Listen for changes to the checkins collection (new checkins added/deleted)
    const checkinsQuery = collection(db, 'profiles', currentUser.uid, 'checkins');
    const unsubCheckins = onSnapshot(checkinsQuery, (snap) => {
      // When a new checkin is added, start listening to its subcollections
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const cheersUnsub = onSnapshot(collection(change.doc.ref, 'cheers'), calc);
          allUnsubs.push(cheersUnsub);

          const chirpsUnsub = onSnapshot(collection(change.doc.ref, 'chirps'), calc);
          allUnsubs.push(chirpsUnsub);
        }
      });
      calc(); // recalc on any checkin change
    });
    allUnsubs.push(unsubCheckins);

    // Set up listeners for all EXISTING checkins' subcollections
    getDocs(checkinsQuery).then((initialSnap) => {
      initialSnap.docs.forEach((checkinDoc) => {
        const cheersUnsub = onSnapshot(collection(checkinDoc.ref, 'cheers'), calc);
        allUnsubs.push(cheersUnsub);

        const chirpsUnsub = onSnapshot(collection(checkinDoc.ref, 'chirps'), calc);
        allUnsubs.push(chirpsUnsub);
      });
    });

    // Cleanup all listeners
    return () => {
      allUnsubs.forEach((unsub) => unsub());
    };
  }, [currentUser?.uid]);

  // ==================== FRIEND REQUESTS BADGE ====================
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, 'profiles', currentUser.uid, 'friendRequests'),
      snap => setPendingCount(snap.size)
    );
    return () => unsub();
  }, [currentUser]);

  // ==================== FRIENDS TAB LAST VIEWED ====================
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

// ==================== FRIENDS REPLY COUNT (FASTER UPDATES + ONLY WHERE YOU CHIRPED) ====================
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
        const lastViewed = lastViewedSnap.exists()
          ? lastViewedSnap.data().timestamp?.toDate()
          : null;

        if (!lastViewed) {
          setFriendsReplyCount(0);
          return;
        }

        let count = 0;
        const checkinsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'checkins'));

        for (const checkin of checkinsSnap.docs) {
          // Check if you have ever chirped here (any time, not just since last viewed)
          const yourChirpsQuery = query(
            collection(checkin.ref, 'chirps'),
            where('userId', '==', currentUser.uid)
          );
          const yourChirpsSnap = await getDocs(yourChirpsQuery);
          if (yourChirpsSnap.empty) continue;

          // Count new replies from others since last viewed
          const newRepliesQuery = query(
            collection(checkin.ref, 'chirps'),
            where('timestamp', '>', lastViewed),
            where('userId', '!=', currentUser.uid)
          );
          const newRepliesSnap = await getDocs(newRepliesQuery);
          count += newRepliesSnap.size;
        }

        setFriendsReplyCount(count);
      } catch (e) {
        console.error('Friends reply count error:', e);
        setFriendsReplyCount(0);
      }
    };

    // Initial calc
    calc();

    const allUnsubs: (() => void)[] = [];

    const checkinsQuery = collection(db, 'profiles', currentUser.uid, 'checkins');

    // Listen to checkins collection for new check-ins
    const unsubCheckins = onSnapshot(checkinsQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const chirpsUnsub = onSnapshot(collection(change.doc.ref, 'chirps'), calc);
          allUnsubs.push(chirpsUnsub);
        }
      });
      calc();
    });
    allUnsubs.push(unsubCheckins);

    // Listen to chirps on all existing check-ins
    getDocs(checkinsQuery).then((snap) => {
      snap.docs.forEach((checkinDoc) => {
        const chirpsUnsub = onSnapshot(collection(checkinDoc.ref, 'chirps'), calc);
        allUnsubs.push(chirpsUnsub);
      });
    });

    return () => {
      allUnsubs.forEach(unsub => unsub());
    };
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
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />,
            tabBarBadge: profileUnreadCount > 0 ? profileUnreadCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontWeight: 'bold' },
          }}
          listeners={{
            focus: () => {
              if (!currentUser?.uid) return;

              // Instant clear
              setProfileUnreadCount(0);

              // Update last viewed timestamp
              setDoc(
                doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedProfileTab'),
                { timestamp: serverTimestamp() },
                { merge: true }
              ).catch(err => console.error('Failed to update lastViewedProfileTab:', err));
            },
          }}
        />
        <Tabs.Screen
          name="checkin"
          options={{ title: 'Check-In', tabBarIcon: ({ color }) => <Ionicons name="location" size={28} color={color} /> }}
        />
        <Tabs.Screen
          name="map"
          options={{ title: 'Map', tabBarIcon: ({ color }) => <Ionicons name="map" size={28} color={color} /> }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />,
            tabBarBadge: (pendingCount + friendsReplyCount) > 0 ? pendingCount + friendsReplyCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontWeight: 'bold' },
          }}
          listeners={{
            tabPress: (e) => {
              if (!currentUser) {
                e.preventDefault();
                router.push('/login');
              }
            },
            focus: () => {
              if (currentUser?.uid) {
                // Instant clear
                setFriendsReplyCount(0);

                // Write last viewed
                setDoc(
                  doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriendsTab'),
                  { timestamp: serverTimestamp() },
                  { merge: true }
                ).catch(() => {});
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
    <SafeAreaProvider>
      <ProfileAlertContext.Provider value={{ profileAlertCount, setProfileAlertCount }}>
        <CustomTabs profileAlertCount={profileAlertCount} setProfileAlertCount={setProfileAlertCount} />
      </ProfileAlertContext.Provider>
    </SafeAreaProvider>
  );
}