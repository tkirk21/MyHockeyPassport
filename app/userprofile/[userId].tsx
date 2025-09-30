// app/userprofile/[userId].tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import arenasData from '@/assets/data/arenas.json';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState<any | null>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mostVisitedArena, setMostVisitedArena] = useState<any | null>(null);

  const arenasVisited = new Set(
    checkins.map((c) => c.arenaName || c.arena)
  ).size;
  const teamsWatched = new Set(
    checkins.flatMap((c) => [c.teamName, c.opponent].filter(Boolean))
  ).size;

  const currentUser = auth.currentUser;
  const router = useRouter();

  useEffect(() => {
    const loadProfileAndCheckins = async () => {
      try {
        if (!userId || !currentUser) {
          setLoading(false);
          return;
        }

        // ✅ Check if THEY blocked ME
        const blockedRef = doc(
          db,
          'profiles',
          userId as string,
          'blocked',
          currentUser.uid
        );
        const blockedSnap = await getDoc(blockedRef);
        if (blockedSnap.exists()) {
          setBlocked(true);
          setLoading(false);
          return;
        }

        // 🔓 Load profile
        const profileRef = doc(db, 'profiles', userId as string);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        }

        // ✅ Load check-ins
        const checkinQuery = query(
          collection(db, 'profiles', userId as string, 'checkins'),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const checkinSnap = await getDocs(checkinQuery);
        const recent = checkinSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCheckins(recent);

        // 🔥 Count most visited arena
        const arenaCounts: Record<string, number> = {};
        recent.forEach((c) => {
          const arenaName = c.arenaName || c.arena;
          if (arenaName) {
            arenaCounts[arenaName] = (arenaCounts[arenaName] || 0) + 1;
          }
        });
        const sorted = Object.entries(arenaCounts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          setMostVisitedArena({ arena: sorted[0][0], count: sorted[0][1] });
        }
      } catch (error: any) {
        console.error('❌ Error loading user profile:', error);
        if (error.code === 'permission-denied') {
          setErrorMsg('You don’t have permission to view this profile.');
        } else {
          setErrorMsg(
            'Something went wrong loading this profile. Please try again.'
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfileAndCheckins();
  }, [userId, currentUser]);

  if (loading) {
    return (
      <ActivityIndicator
        style={{ marginTop: 50 }}
        size="large"
        color="#0D2C42"
      />
    );
  }

  if (blocked) {
    return (
      <View style={styles.container}>
        <Text style={styles.blockedMessage}>
          This profile is not available.
        </Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{errorMsg}</Text>
      </View>
    );
  }

  if (!profile) {
    return <Text style={styles.error}>Profile not found.</Text>;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/background.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{profile.name}</Text>

          <Image
            source={
              profile.imageUrl
                ? { uri: profile.imageUrl }
                : require('@/assets/images/icon.png')
            }
            style={styles.profileImage}
          />

          {/* Location + Favorite Team in one box */}
          <View style={styles.section}>
            <Text style={styles.cardText}>
              Location: {profile.location || 'Not set'}
            </Text>
            <Text style={styles.cardText}>
              Favorite Team: {profile.favouriteTeam || 'Not set'}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statSection}>
              <Text style={styles.sectionTitle}>Arenas Visited</Text>
              <Text style={styles.cardTextBold}>{arenasVisited}</Text>
            </View>
            <View style={styles.statSection}>
              <Text style={styles.sectionTitle}>Teams Watched</Text>
              <Text style={styles.cardTextBold}>{teamsWatched}</Text>
            </View>
          </View>

          {/* Most Watched Teams */}
          {checkins.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Most Watched Teams</Text>
              {Object.entries(
                checkins
                  .flatMap((c) => [c.teamName, c.opponent].filter(Boolean))
                  .reduce((acc: any, team: string) => {
                    acc[team] = (acc[team] || 0) + 1;
                    return acc;
                  }, {})
              )
                .sort((a: any, b: any) => b[1] - a[1])
                .slice(0, 3)
                .map(([team, count]: any) => (
                  <Text key={team} style={styles.cardText}>
                    {team}: {count} {count === 1 ? 'time' : 'times'}
                  </Text>
                ))}
            </View>
          )}

          {/* Most Visited Arena */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Most Visited Arena</Text>
            {mostVisitedArena ? (
              <Text style={styles.cardText}>
                {mostVisitedArena.arena}: {mostVisitedArena.count}{' '}
                {mostVisitedArena.count === 1 ? 'visit' : 'visits'}
              </Text>
            ) : (
              <Text style={styles.placeholder}>No arenas yet.</Text>
            )}
          </View>

          {/* Recent Check-ins */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check-ins</Text>
            {checkins.slice(0, 5).map((item) => {
              const arena = (arenasData as any[]).find(
                (a) => a.arena === item.arenaName || a.arena === item.arena
              );
              const bgColor = arena?.colorCode ? arena.colorCode + '22' : '#ffffff';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.checkinCard,
                    {
                      borderLeftColor: arena?.colorCode || '#6B7280',
                      backgroundColor: bgColor,
                    },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/checkin/[checkinId]',
                      params: { checkinId: item.id, userId: String(userId) }, // ✅ use profile’s userId
                    })
                  }
                >
                  <View
                    style={[
                      styles.leagueBadge,
                      { borderColor: arena?.colorCode || '#0A2940' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.leagueBadgeText,
                        { color: arena?.colorCode || '#0A2940' },
                      ]}
                    >
                      {item.league}
                    </Text>
                  </View>

                  <Text style={styles.arenaText}>
                    {item.arenaName || item.arena}
                  </Text>
                  <Text style={styles.teamsText}>
                    {item.teamName} vs {item.opponent}
                  </Text>
                  <Text style={styles.dateText}>
                    {item.timestamp?.seconds
                      ? new Date(item.timestamp.seconds * 1000).toLocaleDateString()
                      : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  background: { flex: 1, width: '100%', height: '100%' },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0D2C42',
    marginBottom: 16,
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statSection: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholder: { fontSize: 16, color: '#374151', textAlign: 'center' },
  cardText: { fontSize: 16, color: '#0A2940', textAlign: 'center' },
  cardTextBold: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0A2940',
    textAlign: 'center',
  },
  checkinCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  arenaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D2C42',
    marginBottom: 4,
  },
  teamsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2F4F68',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  leagueBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  leagueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    marginTop: 50,
    textAlign: 'center',
    fontSize: 18,
    color: 'red',
  },
  blockedMessage: {
    marginTop: 50,
    textAlign: 'center',
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
  },
});

