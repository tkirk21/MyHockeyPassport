import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import { useLocalSearchParams, Stack } from 'expo-router';

const db = getFirestore(firebaseApp);

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfileAndCheckins = async () => {
      try {
        const profileRef = doc(db, 'profiles', userId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        }

        const checkinQuery = query(
          collection(db, 'profiles', userId, 'checkins'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        const checkinSnap = await getDocs(checkinQuery);
        const recent = checkinSnap.docs.map(doc => doc.data());
        setCheckins(recent);
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfileAndCheckins();
  }, [userId]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#0D2C42" />;
  }

  if (!profile) {
    return <Text style={styles.error}>Profile not found.</Text>;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>{profile.name}</Text>

        <Image
          source={profile.imageUrl ? { uri: profile.imageUrl } : require('@/assets/images/icon.png')}
          style={styles.profileImage}
        />

        <Text style={styles.text}>{profile.location}</Text>
        <Text style={styles.text}>Favourite Team: {profile.favouriteTeam}</Text>

        <View style={styles.countersContainer}>
          <View style={styles.counterBox}>
            <Text style={styles.counterLabel}>Arenas Visited:</Text>
            <Text style={styles.counterValue}>0</Text>
          </View>
          <View style={styles.counterBox}>
            <Text style={styles.counterLabel}>Teams Watched:</Text>
            <Text style={styles.counterValue}>0</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Check-ins</Text>
        <FlatList
          data={checkins}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.checkinCard}>
              <Text style={styles.checkinText}>{item.arena} - {item.homeTeam} vs {item.opponent}</Text>
              <Text style={styles.checkinSubtext}>{new Date(item.timestamp.seconds * 1000).toLocaleDateString()}</Text>
            </View>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECECEC',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0D2C42',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2F4F68',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#2F4F68',
    marginBottom: 4,
  },
  countersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  counterBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffffaa',
    marginHorizontal: 6,
    borderRadius: 10,
  },
  counterLabel: {
    fontSize: 14,
    color: '#2F4F68',
    marginBottom: 4,
  },
  counterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0D2C42',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0D2C42',
    marginBottom: 10,
    textAlign: 'center',
  },
  checkinCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  checkinText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0D2C42',
  },
  checkinSubtext: {
    fontSize: 14,
    color: '#2F4F68',
  },
  error: {
    marginTop: 50,
    textAlign: 'center',
    fontSize: 18,
    color: 'red',
  },
});
