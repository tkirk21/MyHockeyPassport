// app/userprofile/[userId].tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View,  } from 'react-native';
import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc, startAfter } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import {  Stack, useLocalSearchParams, useRouter } from 'expo-router';
import arenasData from '@/assets/data/arenas.json';
import { logCheer } from "@/utils/activityLogger";
import CheerButton from '@/components/friends/cheerButton';
import ChirpBox from '@/components/friends/chirpBox';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const handleCheer = async (checkinId: string, ownerId: string) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    let userName = "Anonymous";
    try {
      const profileSnap = await getDoc(doc(db, "profiles", user.uid));
      if (profileSnap.exists() && profileSnap.data().name) {
        userName = profileSnap.data().name;
      } else if (user.displayName) {
        userName = user.displayName;
      }
    } catch (err) {
      console.warn("Could not fetch user name:", err);
    }

    await logCheer(checkinId, ownerId);
    alert(`${userName} cheered this 🎉`);
  } catch (err) {
    console.error("Error cheering check-in:", err);
  }
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState<any | null>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mostVisitedArena, setMostVisitedArena] = useState<any | null>(null);
  const [allCheckins, setAllCheckins] = useState<any[]>([]);

  const arenasVisited = new Set(allCheckins.map(c => c.arenaName || c.arena)).size;
  const teamsWatched = new Set(allCheckins.flatMap(c => [c.teamName, c.opponent].filter(Boolean))).size;

  const currentUser = auth.currentUser;
  const router = useRouter();

  useEffect(() => {
    const loadProfileAndCheckins = async () => {
      try {
        if (!userId || !currentUser) {
          setLoading(false);
          return;
        }

        // Check blocked
        const blockedRef = doc(db, 'profiles', userId as string, 'blocked', currentUser.uid);
        const blockedSnap = await getDoc(blockedRef);
        if (blockedSnap.exists()) {
          setBlocked(true);
          setLoading(false);
          return;
        }

        // Load profile
        const profileRef = doc(db, 'profiles', userId as string);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        }

        // Load ALL check-ins for stats
        const allQuery = query(
          collection(db, 'profiles', userId as string, 'checkins'),
          orderBy('gameDate', 'desc')
        );
        const allSnap = await getDocs(allQuery);
        const allData = allSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllCheckins(allData);

        // Load only first 5 for display
        const displayQuery = query(
          collection(db, 'profiles', userId as string, 'checkins'),
          orderBy('gameDate', 'desc'),
          limit(5)
        );
        const displaySnap = await getDocs(displayQuery);
        const displayData = displaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCheckins(displayData);

        // Most visited arena from ALL check-ins
        const arenaCounts: Record<string, number> = {};
        allData.forEach(c => {
          const name = c.arenaName || c.arena;
          if (name) arenaCounts[name] = (arenaCounts[name] || 0) + 1;
        });
        const sorted = Object.entries(arenaCounts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          setMostVisitedArena({ arena: sorted[0][0], count: sorted[0][1] });
        }

      } catch (error: any) {
        console.error('Error:', error);
        setErrorMsg('Failed to load profile');
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ImageBackground
            source={require('@/assets/images/background.jpg')}
            style={styles.background}
            resizeMode="cover"
          >
            <ScrollView
              contentContainerStyle={styles.container}>
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
              {allCheckins.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Most Watched Teams</Text>
                  {Object.entries(
                    allCheckins
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
                {checkins.map((item) => {
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
                          params: { checkinId: item.id, userId: String(userId) },
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
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 6,
                        }}
                      >
                        <Text style={styles.dateText}>
                          {item.gameDate
                            ? new Date(item.gameDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : 'No date'}
                        </Text>

                        <CheerButton friendId={String(userId)} checkinId={item.id} />
                      </View>

                      <ChirpBox friendId={String(userId)} checkinId={item.id} />
                    </TouchableOpacity>
                  );
                })}

                {/* Load more */}
                {checkins.length > 0 && checkins.length % 5 === 0 && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={async () => {
                      try {
                        const lastDoc = checkins[checkins.length - 1];
                        if (!lastDoc?.gameDate) return;

                        const q = query(
                          collection(db, 'profiles', userId as string, 'checkins'),
                          orderBy('gameDate', 'desc'),
                          startAfter(lastDoc.gameDate),
                          limit(5)
                        );

                        const snapshot = await getDocs(q);

                        if (snapshot.empty) {
                          console.log("No more check-ins to load");
                          return;
                        }

                        const moreCheckins = snapshot.docs.map(doc => ({
                          id: doc.id,
                          ...doc.data()
                        }));

                        setCheckins(prev => [...prev, ...moreCheckins]);
                      } catch (err) {
                        console.error("Load more failed:", err);
                      }
                    }}
                  >
                    <Text style={styles.loadMoreText}>Load more</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </ImageBackground>
        </KeyboardAvoidingView>
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
    marginTop: 30,
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
    borderWidth: 4,
    borderColor: '#0D2C42',
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
    borderWidth: 4,
    borderColor: '#0D2C42',
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 4,
    borderColor: '#0D2C42',
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
  loadMoreButton: {
      alignSelf: 'center',
      marginTop: 15,
      marginBottom: 10,
      backgroundColor: '#0D2C42',
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 30,
      borderWidth: 3,
      borderColor: '#2F4F68',
    },
    loadMoreText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 18,
    },
});