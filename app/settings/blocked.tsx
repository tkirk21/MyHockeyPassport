import { useRouter, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const auth = getAuth();

export default function BlockedUsersScreen() {
  const router = useRouter();
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

  return (
    <View style={{ flex: 1, backgroundColor: '#0A2940' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <View style={{ paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginLeft: 20 }}>
          Blocked Users
        </Text>
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

const styles = StyleSheet.create({
  inner: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  label: { color: '#fff', fontSize: 18 },
  unblockText: { color: '#1E88E5', fontWeight: '600' },
  empty: { color: '#888', textAlign: 'center', marginTop: 50, fontSize: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, },
});