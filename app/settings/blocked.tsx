import { useRouter, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '../../hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const auth = getAuth();

export default function BlockedUsersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userPresent, setUserPresent] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setUserPresent(false);
      setAlertMessage('Session expired. Please log in again.');
      setAlertVisible(true);
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const loadBlocked = async () => {
      const user = auth.currentUser;
      if (!user) {
        setAlertMessage('Session expired. Please log in again.');
        setAlertVisible(true);
        return;
      }

      try {
        const blockedRef = collection(db, 'profiles', user.uid, 'blocked');
        const snap = await getDocs(blockedRef);

        const blockedList = [];

        for (const blockedDoc of snap.docs) {
          const blockedUserId = blockedDoc.id;

          try {
            const profileSnap = await getDoc(doc(db, 'profiles', blockedUserId));

            if (profileSnap.exists()) {
              const data = profileSnap.data();
              blockedList.push({
                id: blockedUserId,
                name: typeof data.name === 'string' ? data.name : 'Unknown User',
                imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
              });
            } else {
              blockedList.push({
                id: blockedUserId,
                name: 'Unknown User',
                imageUrl: null,
              });
            }
          } catch (error: any) {
            if (error?.message?.toLowerCase().includes('network')) {
              setAlertMessage('Network interrupted while loading blocked users.');
              setAlertVisible(true);
            }
            blockedList.push({
              id: blockedUserId,
              name: 'Unknown User',
              imageUrl: null,
            });
          }
        }

        setBlockedUsers(blockedList);
      } catch (error: any) {
        if (error?.code === 'permission-denied') {
          setAlertMessage('Permission denied while loading blocked users.');
        } else if (error?.code === 'unauthenticated') {
          setAlertMessage('Session expired. Please log in again.');
        } else if (error?.message?.toLowerCase().includes('network')) {
          setAlertMessage('Network error while loading blocked users.');
        } else {
          setAlertMessage('Failed to load blocked users.');
        }
        setAlertVisible(true);
      }
    };

    loadBlocked();
  }, []);

  const unblockUser = async (userId: string) => {
    if (unblockingId) return;

    const user = auth.currentUser;

    if (!user) {
      setAlertMessage('Session expired. Please log in again.');
      setAlertVisible(true);
      return;
    }

    setUnblockingId(userId);

    try {
      await deleteDoc(doc(db, 'profiles', user.uid, 'blocked', userId));
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        setAlertMessage('Permission denied while unblocking user.');
      } else if (error?.code === 'unauthenticated') {
        setAlertMessage('Session expired. Please log in again.');
      } else if (error?.message?.toLowerCase().includes('network')) {
        setAlertMessage('Network error while unblocking user.');
      } else {
        setAlertMessage('Failed to unblock user.');
      }
      setAlertVisible(true);
    } finally {
      setUnblockingId(null);
    }
  };

  const styles = StyleSheet.create({
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68' },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 16 },
    avatar: { width: 40, height: 40, borderRadius: 20, },
    backArrow: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    empty: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888', textAlign: 'center', marginTop: 50, fontSize: 16 },
    headerRow: { paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 28, fontWeight: '700', marginLeft: 20 },
    inner: { padding: 20 },
    label: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18 },
    listRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    unblockText: { color: colorScheme === 'dark' ? '#60A5FA' : '#1E88E5', fontWeight: '600' },
    userName: { marginLeft: 12, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18 },
  });

  if (!authChecked) return null;

  return (
    <View style={styles.screenBackground}>
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity
              onPress={() => setAlertVisible(false)}
              style={styles.alertButton}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Stack.Screen options={{ headerShown: false }} />

      {!userPresent && null}

      {/* Custom header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={styles.backArrow.color} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.inner}>
          {blockedUsers.length === 0 ? (
            <Text style={styles.empty}>No blocked users</Text>
          ) : (
            blockedUsers.map(user => (
              <View key={user.id} style={styles.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Image
                    source={user.imageUrl ? { uri: user.imageUrl } : require('@/assets/images/icon.png')}
                    style={styles.avatar}
                    onError={() => {
                      setAlertMessage('Failed to load profile image.');
                      setAlertVisible(true);
                    }}
                  />
                  <Text style={[styles.label, { marginLeft: 12 }]}>{user.name}</Text>
                </View>
                <TouchableOpacity onPress={() => unblockUser(user.id)} disabled={unblockingId === user.id}>
                  <Text style={styles.unblockText}>
                    {unblockingId === user.id ? 'Unblocking...' : 'Unblock'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}