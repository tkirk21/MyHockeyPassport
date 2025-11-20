//app/(tabs)/profile.tsx
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useContext, useEffect, useState } from 'react';
import * as React from 'react';
import { Alert, ActivityIndicator, Image, ImageBackground, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View   } from 'react-native';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import {doc, collection, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, setDoc, } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileAlertContext } from './_layout';
import arenasData from '@/assets/data/arenas.json';
import leagues from '@/assets/data/leagues.json';
import { leagueLogos } from '@/assets/images/leagueLogos';

interface CheerIconProps { size?: number; color?: string; }
interface Arena { arena: string; colorCode?: string; }

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp, 'gs://myhockeypassport.firebasestorage.app');

function norm(s: any) { return (s ?? '').toString().trim().toLowerCase(); }

async function getCheerCount(userId: string, checkinId: string) {
  try {
    const cheersRef = collection(db, "profiles", userId, "checkins", checkinId, "cheers");
    const snap = await getDocs(cheersRef);
    const cheerCount = snap.size;
    const cheerNames = snap.docs.map(d => d.data().name).filter(Boolean);
    return { cheerCount, cheerNames };
  } catch {
    return { cheerCount: 0, cheerNames: [] };
  }
}

function ChirpsSection({ userId, checkinId }: { userId: string; checkinId: string }) {
  const [chirps, setChirps] = useState<any[]>([]);

  useEffect(() => {
    const chirpsRef = collection(db, 'profiles', userId, 'checkins', checkinId, 'chirps');
    const q = query(chirpsRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChirps(list);
    });
    return unsub;
  }, [userId, checkinId]);

  if (chirps.length === 0) return null;

  return (
    <View style={styles.chirpsSection}>
      {chirps.map((c) => (
        <View key={c.id} style={styles.chirpItem}>
          {c.userImage ? (
            <Image source={{ uri: c.userImage }} style={styles.chirpAvatar} />
          ) : (
            <View style={styles.chirpAvatarPlaceholder} />
          )}
          <View style={styles.chirpTextContainer}>
            <Text style={styles.chirpUsername}>{c.userName}</Text>
            <Text style={styles.chirpText}>{c.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { setProfileAlertCount } = useContext(ProfileAlertContext);

  useFocusEffect(
    useCallback(() => {
      setProfileAlertCount(0);
    }, [setProfileAlertCount])
  );

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [favouriteTeam, setFavouriteTeam] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [arenasVisited, setArenasVisited] = useState(0);
  const [teamsWatched, setTeamsWatched] = useState(0);
  const [mostWatchedTeams, setMostWatchedTeams] = useState<
    { team: string; count: number }[]
  >([]);
  const [mostVisitedArena, setMostVisitedArena] = useState<{ arena: string; count: number } | null>(null);
  const [teamsByLeague, setTeamsByLeague] = useState<
    Record<string, Record<string, number>>
  >({});
  const [leaguesExpanded, setLeaguesExpanded] = useState(false);
  const [expandedLeagues, setExpandedLeagues] = useState<{
    [league: string]: boolean;
  }>({});

  const [loading, setLoading] = useState(false);
  const [visibleCheerList, setVisibleCheerList] = useState<string | null>(null);

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
      let uploadedImageUrl: string | null = null;
      if (image) {
        const response = await fetch(image);
        const blob = await response.blob();
        const imageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(imageRef, blob);
        uploadedImageUrl = await getDownloadURL(imageRef);
      }
      await setDoc(
        doc(db, 'profiles', user.uid), { name, location, favouriteTeam, imageUrl: uploadedImageUrl, createdAt: new Date(), }, { merge: true });
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

      const docRef = doc(db, "profiles", user.uid);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as any;
        setName(data.name || "");
        setLocation(data.location || "");
        setFavouriteTeam(data.favouriteTeam || "");
        setImage(data.imageUrl || null);
        setImageUrl(data.imageUrl || null);
      }
    };

    fetchProfile();

    const user = auth.currentUser;
    if (!user) return;

    const checkInsRef = collection(db, "profiles", user.uid, "checkins");
    const q = query(checkInsRef, orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const checkIns = await Promise.all(
        snapshot.docs.map(async (d) => {
          const data = d.data();

          const { cheerCount, cheerNames } = await getCheerCount(user.uid, d.id);

          const chirpsRef = collection(
            db,
            "profiles",
            user.uid,
            "checkins",
            d.id,
            "chirps"
          );
          const chirpSnap = await getDocs(chirpsRef);
          const hasChirps = chirpSnap.size > 0;

          return {
            id: d.id,
            ...data,
            cheerCount,
            cheerNames,
            hasChirps,
            newChirpText: "",
          };
        })
      );

      // 🔥 Sort newest game to oldest game
      checkIns.sort((a, b) => {
        const da = a.gameDate ? new Date(a.gameDate).getTime() : 0;
        const db = b.gameDate ? new Date(b.gameDate).getTime() : 0;
        return db - da;
      });

      setRecentCheckIns(checkIns);
      recalcStats(checkIns);
    });

    return () => unsub();
  }, []);
  const toggleLeague = (league: string) => {
    setExpandedLeagues((prev) => ({ ...prev, [league]: !prev[league] }));
  };

  const toggleCheerList = (id: string) => {
    setVisibleCheerList((prev) => (prev === id ? null : id));
  };

  function recalcStats(checkIns: any[]) {
    const rinkCounts: Record<string, number> = {};
    checkIns.forEach(ci => {
      const key = norm(ci.arenaName);
      if (key) rinkCounts[key] = (rinkCounts[key] || 0) + 1;
    });

    let topArena = null;
    let maxCount = 0;
    checkIns.forEach(ci => {
      const key = norm(ci.arenaName);
      const count = rinkCounts[key] || 0;
      if (count > maxCount) {
        maxCount = count;
        topArena = { arena: ci.arenaName || ci.arena, count };
      }
    });
    setMostVisitedArena(topArena);

    const arenaKeys = new Set(
      checkIns.map(ci => `${norm(ci.league)}|${norm(ci.arenaName)}`)
    );
    setArenasVisited(arenaKeys.size);

    const teamSet = new Set<string>();
    checkIns.forEach(ci => {
      if (ci.teamName) teamSet.add(norm(ci.teamName));
      if (ci.opponent) teamSet.add(norm(ci.opponent));
    });
    setTeamsWatched(teamSet.size);

    const teamCounts: Record<string, number> = {};
    checkIns.forEach(ci => {
      if (ci.teamName) teamCounts[ci.teamName] = (teamCounts[ci.teamName] || 0) + 1;
      if (ci.opponent) teamCounts[ci.opponent] = (teamCounts[ci.opponent] || 0) + 1;
    });
    const topTeams = Object.keys(teamCounts)
      .map(k => ({ team: k, count: teamCounts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    setMostWatchedTeams(topTeams);

    const perLeague: Record<string, Record<string, number>> = {};
    checkIns.forEach(ci => {
      const league = (ci.league || "Unknown League").toString();
      if (!perLeague[league]) perLeague[league] = {};
      const bump = (teamName: any) => {
        const pretty = (teamName ?? "").toString().trim();
        if (!pretty) return;
        perLeague[league][pretty] =
          (perLeague[league][pretty] || 0) + 1;
      };
      bump(ci.teamName);
      bump(ci.opponent);
    });
    setTeamsByLeague(perLeague);
  }

  return (
    <ImageBackground
      source={require('../../assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.innerContainer}>
            <Text style={styles.header}>Your Profile</Text>

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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teams Seen</Text>
              <TouchableOpacity
                onPress={() => setLeaguesExpanded(!leaguesExpanded)}
                style={styles.collapseHeader}
              >
                <Text style={styles.collapseHeaderText}>
                  {leaguesExpanded ? '▼' : '▶'} Leagues
                </Text>
              </TouchableOpacity>

              {leaguesExpanded && (
                <View style={styles.leaguesList}>
                  {Object.keys(teamsByLeague)
                    .sort()
                    .map((league) => {
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

                          {isOpen && (
                            <View style={styles.teamList}>
                              {Object.entries(teamsByLeague[league])
                                .sort((a, b) => b[1] - a[1])
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Check-ins</Text>
              {recentCheckIns.length === 0 ? (
                <Text style={styles.placeholder}>No check-ins yet.</Text>
              ) : (
                recentCheckIns.map((checkIn) => {
                  const arena = arenasData.find(
                    (a) => a.arena === checkIn.arenaName || a.arena === checkIn.arena
                  );
                  const bgColor = arena?.colorCode ? arena.colorCode + '22' : '#ffffff';

                  return (
                    <TouchableOpacity
                      key={checkIn.id}
                      style={[
                        styles.checkinCard,
                        { borderLeftColor: arena?.colorCode || '#6B7280', backgroundColor: bgColor },
                      ]}
                      onPress={() =>
                        router.push(`/checkin/${checkIn.id}?userId=${auth.currentUser?.uid}`)
                      }
                    >
                      <View style={styles.arenaHeaderRow}>
                        <Image
                          source={
                            leagueLogos[
                              leagues.find(l =>
                                (l.league || '').toUpperCase() === (checkIn.league || '').toUpperCase()
                              )?.logoFileName || 'placeholder.png'
                            ]
                          }
                          style={styles.leaguePuck}
                          resizeMode="contain"
                        />
                        <Text style={styles.arenaTextInline}>{checkIn.arenaName || checkIn.arena}</Text>
                      </View>

                      {/* Matchup */}
                      {(checkIn.teamName || checkIn.opponent) && (
                        <Text style={styles.sub}>
                          {checkIn.teamName && checkIn.opponent
                            ? `${checkIn.teamName} VS ${checkIn.opponent}`
                            : checkIn.teamName || checkIn.opponent}
                        </Text>
                      )}

                      <View style={styles.dateAndCheerRow}>
                        {/* Date below matchup */}
                        <Text style={styles.dateText}>
                          {checkIn.gameDate
                            ? checkIn.checkinType === "manual"
                              ? new Date(checkIn.gameDate).toLocaleDateString()       // manual = date only
                              : new Date(checkIn.gameDate).toLocaleString()           // live = date + time
                            : ""}
                        </Text>

                        {/* Cheers */}
                        {checkIn.cheerCount > 0 && (
                          <View style={styles.cheerWrapper}>
                            <TouchableOpacity onPress={() => toggleCheerList(checkIn.id)} activeOpacity={0.7}>
                              <View style={styles.cheerBadgeContainer}>
                                <Text style={{ fontSize: 16 }}>🎉</Text>
                                <View style={styles.cheerCountBadge}>
                                  <Text style={styles.cheerCountText}>{checkIn.cheerCount}</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                            {visibleCheerList === checkIn.id && (
                              <Text style={styles.cheerNamesText}>{checkIn.cheerNames.join(', ')}</Text>
                            )}
                          </View>
                        )}
                      </View>

                      {checkIn.hasChirps && (
                        <View style={styles.chirpSectionWrapper}>
                          <ChirpsSection userId={auth.currentUser?.uid!} checkinId={checkIn.id} />

                          <View style={styles.chirpReplyRow}>
                            <TextInput
                              placeholder="Reply to this chirp..."
                              placeholderTextColor="#999"
                              style={styles.chirpInput}
                              value={checkIn.newChirpText || ''}
                              onChangeText={(t) =>
                                setRecentCheckIns((prev) =>
                                  prev.map((ci) =>
                                    ci.id === checkIn.id ? { ...ci, newChirpText: t } : ci
                                  )
                                )
                              }
                            />
                            <TouchableOpacity
                              onPress={async () => {
                                const text = checkIn.newChirpText?.trim();
                                if (!text) return;
                                const user = auth.currentUser;
                                const chirpsRef = collection(db, 'profiles', user.uid, 'checkins', checkIn.id, 'chirps');
                                await setDoc(doc(chirpsRef), {
                                  text,
                                  userName: name || 'Anonymous',
                                  userImage: imageUrl || null,
                                  timestamp: new Date(),
                                });
                                setRecentCheckIns((prev) =>
                                  prev.map((ci) =>
                                    ci.id === checkIn.id ? { ...ci, newChirpText: '' } : ci
                                  )
                                );
                              }}
                              style={styles.chirpSendButton}
                            >
                              <Text style={styles.chirpSendText}>Chirp</Text>
                            </TouchableOpacity>
                          </View>
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
  safeArea: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  innerContainer: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#0D2C42',
    marginTop: 10,
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
  placeholder: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  cardText: {
    fontSize: 16,
    color: '#0A2940',
    textAlign: 'center',
  },
  cardTextBold: {
    fontSize: 26,
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
  smallButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  leaguesList: {
    marginTop: 8,
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





  arenaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  arenaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D2C42',
    marginBottom: 4,
  },
  arenaTextInline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D2C42',
    flex: 1,
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
  chirpAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
  },
  chirpAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ccc',
    marginRight: 6,
  },
  cheerBadgeContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  cheerCountBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#0A2940',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
  },
  cheerCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  chirpInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#0A2940',
  },
  chirpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cheerNamesText: {
    fontSize: 12,
    color: '#2F4F68',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  chirpReplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  chirpsSection: {
    marginTop: 8,
    paddingHorizontal: 6,
  },
  chirpSectionWrapper: {
    marginTop: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#2F4F68',
    borderRadius: 12,
  },
  chirpSendButton: {
    marginLeft: 8,
    backgroundColor: '#0A2940',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chirpSendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  chirpText: {
    color: '#0A2940',
    flexShrink: 1,
  },
  chirpTextContainer: {
    flex: 1,
  },
  chirpUsername: {
    fontWeight: '700',
    color: '#0A2940',
  },
  cheerWrapper: {
    alignItems: 'flex-end',
  },
  dateAndCheerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  dateText: {
    fontSize: 14,
    color: '#2F4F68',
    textAlign: 'center',
    marginBottom: 6,
  },
  leaguePuck: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  teamRowText: {
    color: '#2F4F68',
    fontSize: 14,
  },
  teamsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2F4F68',
  },
});