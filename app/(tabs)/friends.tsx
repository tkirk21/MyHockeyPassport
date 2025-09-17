//version 1 - 10am friday 1st of august
// app/(tabs)/friends.tsx
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, Image, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, limit, orderBy, query, setDoc, getFirestore, } from 'firebase/firestore';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export default function FriendsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<string[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchUsersAndFriends = async () => {
      if (!currentUser) return;
      try {
        // 1. Load this user's friends
        const friendsRef = collection(db, 'profiles', currentUser.uid, 'friends');
        const friendsSnap = await getDocs(friendsRef);
        const friendIds = friendsSnap.docs.map((d) => d.id);
        setFriends(friendIds);

        // 2. Load all users
        const snapshot = await getDocs(collection(db, 'profiles'));
        const users = snapshot.docs
          .filter((doc) => doc.id !== currentUser.uid)
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        setAllUsers(users);

        // 3. Load recent check-ins from friends
        let activities: any[] = [];
        for (let friendId of friendIds) {
          const checkinsRef = collection(db, 'profiles', friendId, 'checkins');
          const checkinSnap = await getDocs(
            query(checkinsRef, orderBy('timestamp', 'desc'), limit(3))
          );
          checkinSnap.docs.forEach((doc) => {
            activities.push({
              id: doc.id,
              friendId,
              ...doc.data(),
            });
          });
        }

        activities.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
        setFeed(activities.slice(0, 10));
      } catch (error) {
        console.error('Error fetching users or feed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndFriends();
  }, []);

  const handleSendRequest = async (userId: string) => {
    if (!sentRequests.includes(userId)) {
      try {
        const friendRef = doc(db, 'profiles', currentUser.uid, 'friends', userId);
        await setDoc(friendRef, { addedAt: new Date() });
        setSentRequests([...sentRequests, userId]);
        setFriends([...friends, userId]);
      } catch (err) {
        console.error('Error adding friend:', err);
      }
    }
  };

  const handleAcceptRequest = async (userId: string) => {
    try {
      const friendRef = doc(db, 'profiles', currentUser.uid, 'friends', userId);
      await setDoc(friendRef, { addedAt: new Date() });
      setFriends([...friends, userId]);
      setReceivedRequests(receivedRequests.filter((id) => id !== userId));
    } catch (err) {
      console.error('Error accepting friend:', err);
    }
  };

  const filteredUsers = allUsers.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !friends.includes(user.id) &&
      !sentRequests.includes(user.id) &&
      !receivedRequests.includes(user.id)
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Friends</Text>

        {/* Search Bar card */}
        <View style={styles.card}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {searchQuery.length > 0 && filteredUsers.length > 0 && (
            <>
              <Text style={styles.subheading}>Search Results</Text>
              {filteredUsers.map((item) => (
                <View key={item.id} style={styles.searchRow}>
                  <Text style={styles.itemText}>{item.name}</Text>
                  <TouchableOpacity onPress={() => handleSendRequest(item.id)}>
                    <Text style={styles.button}>Add Friend</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Friend Requests */}
        {receivedRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Friend Requests</Text>
            {allUsers.filter(u => receivedRequests.includes(u.id)).map((item) => (
              <View key={item.id} style={styles.listRow}>
                <Text style={styles.itemText}>{item.name} sent you a request</Text>
                <TouchableOpacity onPress={() => handleAcceptRequest(item.id)}>
                  <Text style={styles.button}>Accept</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Your Friends */}
        {friends.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Your Friends</Text>
            {allUsers.filter(u => friends.includes(u.id)).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.listRow}
                onPress={() =>
                  router.push({ pathname: '/userprofile/[userId]', params: { userId: item.id } })
                }
              >
                <Image
                  source={item.imageUrl ? { uri: item.imageUrl } : require('@/assets/images/icon.png')}
                  style={styles.avatar}
                />
                <Text style={styles.itemText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Friends Activity */}
        {feed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Friends Activity</Text>
            {feed.map((item, index) => {
              const friend = allUsers.find(u => u.id === item.friendId);
              return (
                <View key={index} style={styles.listRow}>
                  <Image
                    source={
                      friend?.imageUrl ? { uri: friend.imageUrl } : require('@/assets/images/icon.png')
                    }
                    style={styles.avatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>
                      <Text style={{ fontWeight: 'bold' }}>{friend?.name}</Text> checked in at{' '}
                      {item.arenaName} ({item.league})
                    </Text>
                    <Text style={styles.timestamp}>
                      {item.timestamp?.seconds
                        ? new Date(item.timestamp.seconds * 1000).toLocaleString()
                        : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
        fontWeight: 'bold',
        color: '#0D2C42',
        marginTop: 30,
        marginBottom: 15,
        textAlign: 'center',
        textShadowColor: '#ffffff',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
  },
  subheading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E3A8A',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  itemText: {
    fontSize: 16,
    color: '#0A2940',
  },
  button: {
    color: '#1E3A8A',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  searchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#1E3A8A',
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',   // ✅ avatar + name side by side
    marginBottom: 12,
  },
});
