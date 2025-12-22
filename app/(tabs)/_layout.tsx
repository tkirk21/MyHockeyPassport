// app/(tabs)/_layout.tsx
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, query, serverTimestamp, setDoc, where, } from 'firebase/firestore';
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

// ==================== FRIENDS REPLY COUNT (FINAL CLEAN VERSION) ====================
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
        const friendsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'friends'));
        const friendIds = friendsSnap.docs.map(d => d.id);
        const owners = friendIds;

        for (const ownerId of owners) {
          const checkinsSnap = await getDocs(collection(db, 'profiles', ownerId, 'checkins'));

          for (const checkinDoc of checkinsSnap.docs) {
            // Check if you have chirped
            const yourChirpQuery = query(
              collection(db, 'profiles', ownerId, 'checkins', checkinDoc.id, 'chirps'),
              where('userId', '==', currentUser.uid),
              limit(1)
            );
            const yourChirpSnap = await getDocs(yourChirpQuery);
            if (yourChirpSnap.empty) continue;

            // Count new replies from others
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

    // Only recalc when a chirp is added anywhere in friends' or your check-ins
    const unsubs = [];

    const setup = async () => {
      const friendsSnap = await getDocs(collection(db, 'profiles', currentUser.uid, 'friends'));
      const friendIds = friendsSnap.docs.map(d => d.id);
      const owners = friendIds;

      for (const ownerId of owners) {
        const checkinsSnap = await getDocs(collection(db, 'profiles', ownerId, 'checkins'));
        checkinsSnap.docs.forEach(checkinDoc => {
          const unsub = onSnapshot(collection(db, 'profiles', ownerId, 'checkins', checkinDoc.id, 'chirps'), calc);
          unsubs.push(unsub);
        });
      }
    };

    setup();

    return () => unsubs.forEach(u => u());
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
              ).catch(() => {});
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