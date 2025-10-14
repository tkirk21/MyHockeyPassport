import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Image, ImageBackground, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { doc, collection, getCountFromServer, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, setDoc, } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import arenasData from '@/assets/data/arenas.json';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp, 'gs://myhockeypassport.firebasestorage.app');

function norm(s: any) {
  return (s ?? '').toString().trim().toLowerCase();
}

function lightenColor(hex: string, amount: number) {
  let useHex = (hex || '').replace('#', '');
  if (!useHex) return `rgb(240,244,248)`;
  if (useHex.length === 3) {
    useHex = useHex[0] + useHex[0] + useHex[1] + useHex[1] + useHex[2] + useHex[2];
  }
  const num = parseInt(useHex, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `rgb(${r},${g},${b})`;
}

async function getCheerCount(userId: string, checkinId: string) {
  try {
    const cheersRef = collection(
      getFirestore(firebaseApp),
      "profiles",
      userId,
      "checkins",
      checkinId,
      "cheers"
    );

    // ✅ use getDocs instead of getCountFromServer (works everywhere)
    const snap = await getDocs(cheersRef);
    const cheerCount = snap.docs.length;
    const cheerNames = snap.docs.map(d => (d.data() as any).name || "").filter(Boolean);

    return { cheerCount, cheerNames };
  } catch (err) {
    console.error("Error fetching cheer count:", err);
    return { cheerCount: 0, cheerNames: [] };
  }
}

export default function ProfileScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [favouriteTeam, setFavouriteTeam] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [arenasVisited, setArenasVisited] = useState(0);
  const [teamsWatched, setTeamsWatched] = useState(0);
  const [mostWatchedTeams, setMostWatchedTeams] = useState<{ team: string; count: number }[]>([]);
  const [mostVisitedArena, setMostVisitedArena] = useState<{ arena: string; count: number } | null>(
    null
  );

  // Collapsible data: Leagues -> Teams with counts
  const [teamsByLeague, setTeamsByLeague] = useState<Record<string, Record<string, number>>>({});
  const [leaguesExpanded, setLeaguesExpanded] = useState(false);
  const [expandedLeagues, setExpandedLeagues] = useState<{ [league: string]: boolean }>({});

  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'You must grant access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const saveProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'No user is logged in');
      return;
    }
    setLoading(true);
    try {
      let imageUrl: string | null = null;
      if (image) {
        const response = await fetch(image);
        const blob = await response.blob();
        const imageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(imageRef, blob);
        imageUrl = await getDownloadURL(imageRef);
      }
      await setDoc(doc(db, 'profiles', user.uid), {
        name,
        location,
        favouriteTeam,
        imageUrl,
        createdAt: new Date(),
      });
      Alert.alert('Success', 'Profile saved!');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const docRef = doc(db, 'profiles', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setName(data.name || '');
        setLocation(data.location || '');
        setFavouriteTeam(data.favouriteTeam || '');
        setImage(data.imageUrl || null);
      }
    };

    const fetchRecentCheckIns = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const checkInsRef = collection(db, "profiles", user.uid, "checkins");
        const q = query(checkInsRef, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);

        const checkIns = await Promise.all(
          snapshot.docs.map(async (d) => {
            const data = d.data();
            const { cheerCount, cheerNames } = await getCheerCount(user.uid, d.id);
            return { id: d.id, ...data, cheerCount, cheerNames };
          })
        );

        // ✅ now restore this line
        setRecentCheckIns(checkIns);

        // Unique arenas visited (by league+arenaName)
        const arenaKeys = new Set(
          checkIns.map((ci: any) => `${norm(ci.league)}|${norm(ci.arenaName)}`)
        );
        setArenasVisited(arenaKeys.size);

        // Unique teams watched (both sides)
        const teamSet = new Set<string>();
        checkIns.forEach((ci: any) => {
          if (ci.teamName) teamSet.add(norm(ci.teamName));
          if (ci.opponent) teamSet.add(norm(ci.opponent));
        });
        setTeamsWatched(teamSet.size);

        // Top 3 most watched teams (overall)
        const teamCounts: Record<string, number> = {};
        checkIns.forEach((ci: any) => {
          if (ci.teamName) teamCounts[ci.teamName] = (teamCounts[ci.teamName] || 0) + 1;
          if (ci.opponent) teamCounts[ci.opponent] = (teamCounts[ci.opponent] || 0) + 1;
        });
        const topTeams = Object.keys(teamCounts)
          .map(k => ({ team: k, count: teamCounts[k] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        setMostWatchedTeams(topTeams);

        // Most visited arena (single)
        const rinkCounts: Record<string, number> = {};
        checkIns.forEach((ci: any) => {
          if (ci.arenaName) rinkCounts[ci.arenaName] = (rinkCounts[ci.arenaName] || 0) + 1;
        });
        const topArena = Object.keys(rinkCounts)
          .map(k => ({ arena: k, count: rinkCounts[k] }))
          .sort((a, b) => b.count - a.count)[0];
        setMostVisitedArena(topArena || null);

        // Build Teams by League structure for collapsible
        const perLeague: Record<string, Record<string, number>> = {};
        checkIns.forEach((ci: any) => {
          const league = (ci.league || 'Unknown League').toString();
          if (!perLeague[league]) perLeague[league] = {};
          const bump = (teamName: any) => {
            const pretty = (teamName ?? '').toString().trim();
            if (!pretty) return;
            perLeague[league][pretty] = (perLeague[league][pretty] || 0) + 1;
          };
          bump(ci.teamName || ci.teamCode);
          bump(ci.opponent || ci.opponentCode);
        });
        setTeamsByLeague(perLeague);
      } catch (error) {
        console.error('Error fetching check-ins:', error);
      }
    };

    fetchProfile();
    fetchRecentCheckIns();
  }, []);

  const toggleLeague = (league: string) => {
    setExpandedLeagues(prev => ({ ...prev, [league]: !prev[league] }));
  };

  const cheerCount = 0;
  const cheerNames: string[] = [];

  const [visibleCheerList, setVisibleCheerList] = useState<string | null>(null);
  const toggleCheerList = (id: string) => {
    setVisibleCheerList(prev => (prev === id ? null : id));
  };



  return (
    <ImageBackground
      source={require('../../assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.innerContainer}>
            <Text style={styles.header}>Your Profile</Text>

            {/* Profile Info */}
            <View style={styles.section}>
              <Image
                source={image ? { uri: image } : require('@/assets/images/icon.png')}
                style={styles.profileImage}
              />
              <TouchableOpacity style={styles.smallButton} onPress={pickImage}>
                <Text style={styles.smallButtonText}>Upload Profile Picture</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Your Name"
                placeholderTextColor="#374151"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                placeholderTextColor="#374151"
                value={location}
                onChangeText={setLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="Favourite Team"
                placeholderTextColor="#374151"
                value={favouriteTeam}
                onChangeText={setFavouriteTeam}
              />

              {loading ? (
                <ActivityIndicator size="large" color="#0D2C42" />
              ) : (
                <TouchableOpacity style={styles.smallButton} onPress={saveProfile}>
                  <Text style={styles.smallButtonText}>Save Profile</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Arenas Visited + Teams Watched side-by-side (separate boxes) */}
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Most Watched Teams</Text>
              {mostWatchedTeams.length === 0 ? (
                <Text style={styles.placeholder}>No teams yet.</Text>
              ) : (
                mostWatchedTeams.map((item, index) => (
                  <Text key={`${item.team}-${index}`} style={styles.cardText}>
                    {item.team}: {item.count} {item.count === 1 ? 'time' : 'times'}
                  </Text>
                ))
              )}
            </View>

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

            {/* Collapsible: Leagues -> Teams Seen (hidden until expanded) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teams Seen</Text>

              {/* Root: "Leagues" row */}
              <TouchableOpacity
                onPress={() => setLeaguesExpanded(!leaguesExpanded)}
                style={styles.collapseHeader}
              >
                <Text style={styles.collapseHeaderText}>
                  {leaguesExpanded ? '▼' : '▶'} Leagues
                </Text>
              </TouchableOpacity>

              {/* Level 1: leagues list (only when root expanded) */}
              {leaguesExpanded && (
                <View style={{ marginTop: 8 }}>
                  {Object.keys(teamsByLeague)
                    .sort()
                    .map(league => {
                      const isOpen = !!expandedLeagues[league];
                      const teamCount = Object.keys(teamsByLeague[league] || {}).length;
                      return (
                        <View key={league} style={styles.leagueBlock}>
                          <TouchableOpacity
                            onPress={() => toggleLeague(league)}
                            style={styles.leagueRow}
                          >
                            <Text style={styles.leagueRowText}>
                              {isOpen ? '▼' : '▶'} {league} ({teamCount})
                            </Text>
                          </TouchableOpacity>

                          {/* Level 2: teams list (only when league expanded) */}
                          {isOpen && (
                            <View style={styles.teamList}>
                              {Object.entries(teamsByLeague[league])
                                .sort((a, b) => b[1] - a[1]) // sort by count desc
                                .map(([team, count]) => (
                                  <Text key={`${league}-${team}`} style={styles.teamRowText}>
                                    {team}: {count} {count === 1 ? 'time' : 'times'}
                                  </Text>
                                ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                </View>
              )}
            </View>

            {/* Check-ins */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Check-ins</Text>
              {recentCheckIns.length === 0 ? (
                <Text style={styles.placeholder}>No check-ins yet.</Text>
              ) : (
                recentCheckIns.map((checkIn) => {
                  const arena = (arenasData as any[]).find(
                    (a: any) => a.arena === checkIn.arenaName || a.arena === checkIn.arena
                  );
                  const bgColor = arena?.colorCode ? arena.colorCode + '22' : '#ffffff';

                  return (
                    <TouchableOpacity
                      key={checkIn.id}
                      style={[
                        styles.checkinCard,
                        {
                          borderLeftColor: arena?.colorCode || '#6B7280',
                          backgroundColor: bgColor, // faded arena color
                        },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: '/checkin/[checkinId]',
                          params: { checkinId: checkIn.id, userId: auth.currentUser?.uid },
                        })
                      }
                    >
                      {/* League Badge */}
                      <View
                        style={[
                          styles.leagueBadge,
                          { borderColor: arena?.colorCode || '#0A2940' },
                        ]}
                      >
                        <Text style={[
                            styles.leagueBadgeText,
                            { color: arena?.colorCode || '#0A2940' },
                          ]}
                        >
                          {checkIn.league}
                        </Text>
                      </View>

                      <Text style={styles.arenaText}>
                        {checkIn.arenaName || checkIn.arena}
                      </Text>
                      <Text style={styles.teamsText}>
                        {checkIn.teamName} vs {checkIn.opponent}
                      </Text>
                      <Text style={styles.dateText}>
                        {checkIn.timestamp?.seconds
                          ? new Date(checkIn.timestamp.seconds * 1000).toLocaleDateString()
                          : ''}
                      </Text>
                      {checkIn.cheerCount > 0 && (
                        <View style={{ alignSelf: "flex-start", marginTop: 6, marginBottom: 2 }}>
                          <TouchableOpacity
                            onPress={() => toggleCheerList(checkIn.id)}
                            activeOpacity={0.7}
                          >
                            <View style={{ position: "relative", width: 26, height: 26 }}>
                              <Text style={{ fontSize: 22 }}>🎉</Text>
                              <View
                                style={{
                                  position: "absolute",
                                  top: -6,
                                  right: -8,
                                  backgroundColor: "#0A2940",
                                  borderRadius: 10,
                                  paddingHorizontal: 4,
                                  paddingVertical: 1,
                                  minWidth: 16,
                                  alignItems: "center",
                                }}
                              >
                                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                                  {checkIn.cheerCount}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>

                          {visibleCheerList === checkIn.id && checkIn.cheerNames?.length > 0 && (
                            <View
                              style={{
                                backgroundColor: "rgba(13,44,66,0.9)",
                                padding: 6,
                                borderRadius: 6,
                                marginTop: 4,
                              }}
                            >
                              {checkIn.cheerNames.map((name: string, i: number) => (
                                <Text key={i} style={{ color: "#fff", fontSize: 12, marginBottom: 2 }}>
                                  {name}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  background: { flex: 1, width: '100%', height: '100%' },
  scrollContainer: { flexGrow: 1 },
  header: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#0D2C42',
    marginTop: -20,
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',    // bold titles
    color: '#1E3A8A',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholder: { fontSize: 16, color: '#374151', textAlign: 'center' },
  cardText: { fontSize: 16, color: '#0A2940', textAlign: 'center' },
  cardTextBold: {
    fontSize: 26,          // bigger number
    fontWeight: 'bold',
    color: '#0A2940',
    textAlign: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 12,
    borderColor: '#2F4F68',
    borderWidth: 2,
  },
  input: {
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    color: '#0D2C42',
  },
  smallButton: {
    backgroundColor: '#0A2940',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  smallButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // side-by-side stat cards
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statSection: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingVertical: 20,   // more vertical padding
    justifyContent: 'center',
    alignItems: 'center',
  },

  // collapsible styles
  collapseHeader: {
    backgroundColor: '#E0E7FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  collapseHeaderText: {
    color: '#1E3A8A',
    fontSize: 16,
    fontWeight: '600',
  },
  leagueBlock: {
    marginTop: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    overflow: 'hidden',
  },
  leagueRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  leagueRowText: {
    color: '#0A2940',
    fontSize: 16,
    fontWeight: '600',
  },
  teamList: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  teamRowText: {
    color: '#2F4F68',
    fontSize: 14,
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
    borderWidth: 1.5, // outlined instead of filled
    backgroundColor: 'transparent',
  },
  leagueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});