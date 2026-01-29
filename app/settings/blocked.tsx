import { useRouter, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '../../hooks/useColorScheme';

const auth = getAuth();

export default function BlockedUsersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  useEffect(() => {
    const loadBlocked = async () => {
      if (!auth.currentUser) return;

      const blockedRef = collection(db, 'profiles', auth.currentUser.uid, 'blocked');
      const snap = await getDocs(blockedRef);

      const blockedList = [];
      for (const blockedDoc of snap.docs) {
        const blockedUserId = blockedDoc.id;

        // Fetch the blocked user's profile to get name and image
        const profileSnap = await getDoc(doc(db, 'profiles', blockedUserId));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          blockedList.push({
            id: blockedUserId,
            name: data.name || 'Unknown User',
            imageUrl: data.imageUrl || null,
          });
        } else {
          blockedList.push({
            id: blockedUserId,
            name: 'Unknown User',
            imageUrl: null,
          });
        }
      }
      setBlockedUsers(blockedList);
    };
    loadBlocked();
  }, []);

  const unblockUser = async (userId: string) => {
    Alert.alert('Unblock User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'profiles', auth.currentUser!.uid, 'blocked', userId));
          setBlockedUsers(prev => prev.filter(u => u.id !== userId));
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    avatar: { width: 40, height: 40, borderRadius: 20, },
    backArrow: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    empty: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888', textAlign: 'center', marginTop: 50, fontSize: 16 },
    headerRow: { paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 28, fontWeight: '700', marginLeft: 20 },
    inner: { padding: 20 },
    label: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18 },
    listRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    unblockText: { color: colorScheme === 'dark' ? '#60A5FA' : '#1E88E5', fontWeight: '600' },
    userName: { marginLeft: 12, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18 },
  });

  return (
    <View style={styles.screenBackground}>
      <Stack.Screen options={{ headerShown: false }} />

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
                  />
                  <Text style={[styles.label, { marginLeft: 12 }]}>{user.name}</Text>
                </View>
                <TouchableOpacity onPress={() => unblockUser(user.id)}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}