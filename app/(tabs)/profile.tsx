//app/(tabs)/profile.tsx
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { Alert, ActivityIndicator, FlatList, Image, ImageBackground, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View   } from 'react-native';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, deleteDoc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getStorage, getDownloadURL, ref, uploadBytes, } from 'firebase/storage';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileAlertContext } from './_layout';
import { useColorScheme } from '../../hooks/useColorScheme';
import { usePremium } from '@/context/PremiumContext';

import arenasData from '@/assets/data/arenas.json';
import arenaHistoryData from '@/assets/data/arenaHistory.json';
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

export default function ProfileScreen() {
  const router = useRouter();
  const { isPremium } = usePremium();
  const { setProfileAlertCount } = useContext(ProfileAlertContext);
  const colorScheme = useColorScheme();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [profileAlertVisible, setProfileAlertVisible] = useState(false);
  const [profileAlertMessage, setProfileAlertMessage] = useState('');
  const [profileAlertTitle, setProfileAlertTitle] = useState('');

  const showUpgradePrompt = (title: string, message: string) => {
    setProfileAlertTitle(title);
    setProfileAlertMessage(message);
    setProfileAlertVisible(true);
  };

  useFocusEffect(
    useCallback(() => {
      setProfileAlertCount(0);

      const user = auth.currentUser;
      if (user) {
        setDoc(
          doc(db, 'profiles', user.uid, 'notifications', 'lastViewedProfile'),
          { timestamp: serverTimestamp() },
          { merge: true }
        );
      }
    }, [setProfileAlertCount])
  );

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [favouriteTeams, setFavouriteTeams] = useState<string[]>([]);
  const [teamSelectorVisible, setTeamSelectorVisible] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});
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

  const [loading, setLoading] = useState(false);
  const [visibleCheerList, setVisibleCheerList] = useState<string | null>(null);
  const [visibleCheckins, setVisibleCheckins] = useState(5);

  const filteredTeamsByLeague = useMemo(() => {
    let teams = arenasData;

    if (teamSearchQuery.trim()) {
      const q = teamSearchQuery.toLowerCase().trim();
      teams = arenasData.filter(team =>
        team.teamName.toLowerCase().includes(q) ||
        (team.city && team.city.toLowerCase().includes(q)) ||
        (team.teamCode && team.teamCode.toLowerCase().includes(q))
      );
    }

    // Group by league
    const grouped = teams.reduce((acc: Record<string, typeof arenasData>, team) => {
      const league = team.league || 'Unknown';
      if (!acc[league]) acc[league] = [];
      acc[league].push(team);
      return acc;
    }, {});

    // Sort leagues alphabetically, and teams inside each league alphabetically
    return Object.keys(grouped)
      .sort()
      .map(league => ({
        league,
        teams: grouped[league].sort((a, b) => a.teamName.localeCompare(b.teamName))
      }));
  }, [teamSearchQuery]);

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
      // Step 1: Check if the name is already taken by someone else
      const profilesRef = collection(db, 'profiles');
      const q = query(profilesRef, where('name', '==', name.trim()));
      const querySnapshot = await getDocs(q);

      let isTakenByOther = false;

      querySnapshot.forEach((docSnap) => {
        if (docSnap.id !== user.uid) {
          isTakenByOther = true;
        }
      });

      if (isTakenByOther) {
        setProfileAlertMessage(`"${name.trim()}" has already been taken. Please try another unique name.`);
        setProfileAlertVisible(true);
        setLoading(false);
        return;
      }

      // Name is free or it's the current user's own name → proceed
      let uploadedImageUrl: string | null = null;
      if (image && image !== imageUrl) { // only upload if changed
        const response = await fetch(image);
        const blob = await response.blob();
        const imageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(imageRef, blob);
        uploadedImageUrl = await getDownloadURL(imageRef);
      }

      await setDoc(
        doc(db, 'profiles', user.uid),
        {
          name: name.trim(),
          location,
          favouriteTeams,
          imageUrl: uploadedImageUrl || imageUrl,
          createdAt: new Date(),
        },
        { merge: true }
      );

      setAlertMessage('Profile saved!');
      setAlertVisible(true);
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      console.error('Save error:', error);
      setAlertMessage(error.message || 'Something went wrong.');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  const user = auth.currentUser;
  if (!user) {
    setRecentCheckIns([]);
    recalcStats([]);
    return;
  }

  const fetchProfile = async () => {
    const docRef = doc(db, "profiles", user.uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as any;
      setName(data.name || "");
      setLocation(data.location || "");
      let teams: string[] = [];

      if (data.favouriteTeams && Array.isArray(data.favouriteTeams)) {
        teams = data.favouriteTeams.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
      } else if (data.favouriteTeam && typeof data.favouriteTeam === 'string') {
        const oldTeam = data.favouriteTeam.trim();
        if (oldTeam) {
          teams = [oldTeam];
        }
      }

      setFavouriteTeams(teams);
      setImage(data.imageUrl || null);
      setImageUrl(data.imageUrl || null);
    }
  };

  fetchProfile();

  const checkInsRef = collection(db, "profiles", user.uid, "checkins");
  const q = query(checkInsRef, orderBy("timestamp", "desc"));

  const unsub = onSnapshot(q, async (snapshot) => {
    const checkIns = await Promise.all(
      snapshot.docs.map(async (d) => {
        const data = d.data();

        const { cheerCount, cheerNames } = await getCheerCount(user.uid, d.id);

        const chirpsRef = collection(db, "profiles", user.uid, "checkins", d.id, "chirps");
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

    checkIns.sort((a, b) => {
      const da = a.gameDate ? new Date(a.gameDate).getTime() : 0;
      const db = b.gameDate ? new Date(b.gameDate).getTime() : 0;
      return db - da;
    });

    setRecentCheckIns(checkIns);
    recalcStats(checkIns);
  });

  return () => unsub();
}, [auth.currentUser?.uid]);

  const toggleLeague = (league: string) => {
    setExpandedLeagues(prev => ({
      ...prev,
      [league]: !prev[league],  // toggle true/false, undefined becomes true on first click
    }));
  };

  const toggleCheerList = (id: string) => {
    setVisibleCheerList((prev) => (prev === id ? null : id));
  };

  function recalcStats(checkIns: any[]) {
    // Map old arena name to current name
    const getCurrentArenaName = (oldName: string) => {
      if (!oldName) return oldName;
      const lowerOld = oldName.toLowerCase().trim();
      for (const h of arenaHistoryData) {
        for (const entry of h.history) {
          if (entry.name.toLowerCase().trim() === lowerOld) {
            return h.currentArena;
          }
        }
      }
      return oldName;
    };

    // Arena counts using current names
    const arenaCounts: Record<string, number> = {};
    checkIns.forEach(ci => {
      const currentName = getCurrentArenaName(ci.arenaName || ci.arena || '');
      arenaCounts[currentName] = (arenaCounts[currentName] || 0) + 1;
    });

    // Most visited arena
    let topArena = null;
    let maxCount = 0;
    for (const [name, count] of Object.entries(arenaCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topArena = { arena: name, count };
      }
    }
    setMostVisitedArena(topArena);

    // Unique arenas visited
    setArenasVisited(Object.keys(arenaCounts).length);

    // Teams watched
    const teamSet = new Set<string>();
    checkIns.forEach(ci => {
      if (ci.teamName) teamSet.add(ci.teamName.toLowerCase().trim());
      if (ci.opponent) teamSet.add(ci.opponent.toLowerCase().trim());
    });
    setTeamsWatched(teamSet.size);

    // Most watched teams
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

    // Teams by league
    const perLeague: Record<string, Record<string, number>> = {};
    checkIns.forEach(ci => {
      const league = (ci.league || "Unknown League").toString();
      if (!perLeague[league]) perLeague[league] = {};
      const bump = (teamName: any) => {
        const pretty = (teamName ?? "").toString().trim();
        if (!pretty) return;
        perLeague[league][pretty] = (perLeague[league][pretty] || 0) + 1;
      };
      bump(ci.teamName);
      bump(ci.opponent);
    });
    setTeamsByLeague(perLeague);
  }

  function ChirpsSection({ userId, checkinId }: { userId: string; checkinId: string }) {
    const [chirps, setChirps] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const currentUser = auth.currentUser;
    const isCheckinOwner = currentUser?.uid === userId;

    const deleteChirp = async (chirpId: string) => {
      try {
        await deleteDoc(doc(db, 'profiles', userId, 'checkins', checkinId, 'chirps', chirpId));
        setChirps(prev => prev.filter(c => c.id !== chirpId));
      } catch (err) {
        console.error('Delete failed:', err);
      }
    };

    const saveEdit = async (chirpId: string) => {
      if (!editText.trim()) return;
      try {
        await updateDoc(doc(db, 'profiles', userId, 'checkins', checkinId, 'chirps', chirpId), {
          text: editText.trim(),
        });
        setChirps(prev => prev.map(c => c.id === chirpId ? { ...c, text: editText.trim() } : c));
      } catch (err) {
        console.error('Edit failed:', err);
      } finally {
        setEditingId(null);
        setEditText('');
      }
    };

    useEffect(() => {
      if (!currentUser) {
        setChirps([]);
        return;
      }

      const chirpsRef = collection(db, 'profiles', userId, 'checkins', checkinId, 'chirps');
      const q = query(chirpsRef, orderBy('timestamp', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setChirps(list);
      });
      return () => unsub();
    }, [userId, checkinId, currentUser?.uid]);

    if (chirps.length === 0) return null;

    return (
      <View style={styles.chirpsSection}>
        {chirps.map((c) => {
          const isOwnChirp = c.userId === currentUser?.uid;
          const isEditing = editingId === c.id;

          return (
            <View key={c.id} style={styles.chirpItem}>
              {c.userImage ? (
                <Image source={{ uri: c.userImage }} style={styles.chirpAvatar} />
              ) : (
                <View style={styles.chirpAvatarPlaceholder} />
              )}

              <View style={styles.chirpTextContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.chirpUsername}>{c.userName || 'Someone'}</Text>

                  {/* 3-dot menu – only show if you can edit or delete */}
                  {(isOwnChirp || isCheckinOwner) && (
                    <View style={{ position: 'relative' }}>
                      <TouchableOpacity
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        onPress={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                      >
                        <Text style={{ fontSize: 24, color: '#666' }}>⋮</Text>
                      </TouchableOpacity>

                      {menuOpenId === c.id && !isEditing && (
                        <View style={styles.dropdownMenu}>
                          {isOwnChirp && (
                            <TouchableOpacity
                              onPress={() => {
                                setEditingId(c.id);
                                setEditText(c.text);
                                setMenuOpenId(null);
                              }}
                              style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                            >
                              <Text style={{ color: '#1E3A8A', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                          )}
                          {(isOwnChirp || isCheckinOwner) && (
                            <TouchableOpacity
                              onPress={() => {
                                deleteChirp(c.id);
                                setMenuOpenId(null);
                              }}
                              style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                            >
                              <Text style={{ color: '#F44336', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Chirp text or edit input */}
                {isEditing ? (
                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      style={[styles.chirpText, { borderWidth: 1.5, borderColor: '#10B981', borderRadius: 8, padding: 8 }]}
                      value={editText}
                      onChangeText={setEditText}
                      autoFocus
                      multiline
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
                      <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); }}>
                        <Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => saveEdit(c.id)}>
                        <Text style={{ color: '#10B981', fontWeight: '600' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.chirpText}>{c.text}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  const styles = StyleSheet.create({
    addTeamButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', alignSelf: 'center', },
    addTeamButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 16, },
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', fontWeight: '700', fontSize: 16 },
    alertMessageText: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    arenaHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
    arenaTextInline: { fontSize: 16, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', flex: 1, },
    background: { flex: 1, width: '100%', height: '100%', },
    blurredSection: { opacity: 0.75, },
    cardText: { fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', },
    cardTextBold: { fontSize: 26, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', },
    checkinCard: { padding: 14, borderRadius: 10, marginBottom: 12, borderLeftWidth: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2, },
    cheerBadgeContainer: { position: 'relative', alignItems: 'center', },
    cheerCountBadge: { position: 'absolute', top: -6, right: -8, backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1, minWidth: 16, },
    cheerCountText: { color: colorScheme === 'dark' ? '#0A2940' : '#fff', fontSize: 10, fontWeight: '700', },
    cheerNamesText: { fontSize: 12, color: colorScheme === 'dark' ? '#CCCCCC' : '#2F4F68', fontWeight: '600', marginTop: 2, textAlign: 'center', },
    cheerWrapper: { alignItems: 'flex-end', },
    chirpAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 6, },
    chirpAvatarPlaceholder: { width: 22, height: 22, borderRadius: 11, backgroundColor: colorScheme === 'dark' ? '#444' : '#ccc', marginRight: 6, },
    chirpInput: { flex: 1, borderWidth: 1.5, borderColor: colorScheme === 'dark' ? '#666' : '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#fff', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    chirpItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
    chirpReplyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, },
    chirpsSection: { marginTop: 8, paddingHorizontal: 6, },
    chirpSectionWrapper: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, },
    chirpSendButton: { marginLeft: 8, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30, },
    chirpSendText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 14, },
    chirpText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', flexShrink: 1, fontSize: 14, marginTop: 4, lineHeight: 20, },
    chirpTextContainer: {  flex: 1, },
    chirpUsername: { fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    collapseHeader: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#E0E7FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', },
    collapseHeaderText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#1E3A8A', fontSize: 16, fontWeight: '600', },
    dateAndCheerRow: { flexDirection: "row", justifyContent: "flex-start", alignItems: "center", gap: 2, marginTop: 3, marginBottom: 6, },
    dateText: { fontSize: 14, color: colorScheme === 'dark' ? '#CCCCCC' : '#2F4F68', textAlign: 'center', marginBottom: 6, },
    dropdownMenu: { position: 'absolute', right: -8, top: 32, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#fff', borderRadius: 12, borderWidth: 1, borderColor: colorScheme === 'dark' ? '#D1D5DB' : '#666', paddingVertical: 4, minWidth: 110, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, zIndex: 999, },
    favouriteTeamsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center', },
    favouriteTeamsLabel: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginBottom: 8, },
    header: { fontSize: 34, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginTop: 10, marginBottom: 15, textAlign: 'center', textShadowColor: colorScheme === 'dark' ? '#000000' : '#ffffff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, },
    innerContainer: { paddingTop: 40, paddingHorizontal: 20, paddingBottom: 10, },
    input: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A2940' : "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colorScheme === 'dark' ? '#666' : "#ddd", fontSize: 14, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    leagueBlock: { marginTop: 8, backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#F0F4F8', borderRadius: 10, overflow: 'hidden', },
    leagueHeaderTouchable: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#F0F4F8', paddingHorizontal: 20, paddingVertical: 12, },
    leaguesList: { marginTop: 8, },
    leaguePuck: {  width: 28, height: 28, marginRight: 8,  },
    leagueRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colorScheme === 'dark' ? '#444' : '#e5e7eb', },
    leagueRowText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, fontWeight: '300', },
    leagueSectionHeader: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#F0F4F8', },
    noResultsText: { textAlign: 'center', color: colorScheme === 'dark' ? '#888888' : '#666666', padding: 40, fontSize: 16, },
    noTeamsText: { color: colorScheme === 'dark' ? '#888888' : '#666666', fontStyle: 'italic', fontSize: 14, },
    placeholder: { fontSize: 16, color: colorScheme === 'dark' ? '#BBBBBB' : '#374151', textAlign: 'center', },
    profileActionsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center',  marginTop: 12, gap: 30, },
    profileImage: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 12, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', borderWidth: 2, },
    safeArea: { flex: 1, },
    scrollContainer: { flexGrow: 1, },
    section: { marginBottom: 20, backgroundColor: colorScheme === 'dark' ? 'rgba(10,41,64,0.9)' : 'rgba(255,255,255,0.85)', borderRadius: 12, padding: 12, borderWidth: 4, borderColor: '#0D2C42', },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#1E3A8A', marginBottom: 8, textAlign: 'center', },
    settingsGearButton: { padding: 10, },
    smallButtonText: { color: colorScheme === 'dark' ? '#fff' : '#0A2940', fontSize: 18, fontWeight: '600', },
    smallLoadButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', alignItems: 'center', alignSelf: 'center', },
    smallSaveProfileButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', alignItems: 'center', alignSelf: 'center', },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, },
    statSection: { flex: 1, backgroundColor: colorScheme === 'dark' ? 'rgba(10,41,64,0.9)' : 'rgba(255,255,255,0.85)', borderRadius: 12, paddingVertical: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#0D2C42', },
    sub: { fontSize: 14, fontWeight: '600', color: colorScheme === 'dark' ? '#CCCCCC' : '#2F4F68', marginBottom: 6 },
    teamChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#E0E7FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, },
    teamChipText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '600', },
    teamChipRemove: { marginLeft: 8, },
    teamItem: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colorScheme === 'dark' ? '#2F4F68' : '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
    teamItemText: { fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', flex: 1, },
    teamItemAlreadyAdded: { color: colorScheme === 'dark' ? '#10B981' : '#059669', },
    teamList: { paddingVertical: 8, paddingHorizontal: 14, gap: 6, },
    teamRowText: { color: colorScheme === 'dark' ? '#CCCCCC' : '#2F4F68', fontSize: 14, },
    teamSelectorOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', },
    teamSelectorPopup: { width: '85%', maxHeight: '80%', backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 20, },
    teamSelectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colorScheme === 'dark' ? '#2F4F68' : '#E5E7EB', },
    teamSelectorTitle: { fontSize: 20, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    teamSearchInput: { height: 48, backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#F0F4F8', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', margin: 16, marginBottom: 8, },
    teamsText: { fontSize: 14, fontWeight: '500', color: colorScheme === 'dark' ? '#CCCCCC' : '#2F4F68', },
    uploadPhotoButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 30, borderWidth: 2, marginBottom: 12, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', alignItems: 'center', alignSelf: 'center', },
    upgradePrompt: { color: '#EF4444', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 12, paddingHorizontal: 16, },
    });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ImageBackground
        source={colorScheme === 'dark' ? require('../../assets/images/background_dark.jpg') : require('../../assets/images/background.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.innerContainer}>

            {/* CUSTOM THEMED ALERT MODAL */}
            <Modal visible={alertVisible} transparent animationType="fade">
              <View style={styles.alertOverlay}>
                <View style={styles.alertContainer}>
                  <Text style={styles.alertTitle}>
                    {alertMessage.includes('Error') ? 'Error' : 'Success'}
                  </Text>
                  <Text style={styles.alertMessage}>{alertMessage}</Text>
                  <TouchableOpacity onPress={() => setAlertVisible(false)} style={styles.alertButton}>
                    <Text style={styles.alertButtonText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Modal visible={profileAlertVisible} transparent animationType="fade">
              <View style={styles.alertOverlay}>
                <View style={styles.alertContainer}>
                  <Text style={styles.alertTitle}>{profileAlertTitle || 'Name Taken'}</Text>
                  <Text style={styles.alertMessageText}>{profileAlertMessage}</Text>
                  <TouchableOpacity
                    onPress={() => setProfileAlertVisible(false)}
                    style={styles.alertButton}
                  >
                    <Text style={styles.alertButtonText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Modal
              visible={teamSelectorVisible}
              animationType="fade"
              transparent={true}
              onRequestClose={() => {
                setTeamSelectorVisible(false);
                setTeamSearchQuery('');
              }}
            >
              <View style={styles.teamSelectorOverlay}>
                <View style={styles.teamSelectorPopup}>
                  <View style={styles.teamSelectorHeader}>
                    <Text style={styles.teamSelectorTitle}>Select Team</Text>
                    <TouchableOpacity onPress={() => {
                      setTeamSelectorVisible(false);
                      setTeamSearchQuery('');
                    }}>
                      <Ionicons name="close" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.teamSearchInput}
                    placeholder="Search team..."
                    placeholderTextColor={colorScheme === 'dark' ? '#888888' : '#999999'}
                    value={teamSearchQuery}
                    onChangeText={setTeamSearchQuery}
                    autoFocus
                  />

                  <FlatList
                    data={filteredTeamsByLeague}
                    keyExtractor={(item) => item.league}
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: '70%' }}
                    renderItem={({ item: { league, teams } }) => {
                      const isExpanded = !!expandedLeagues[league];

                      return (
                        <View>
                          <TouchableOpacity
                            onPress={() => toggleLeague(league)}
                            style={styles.leagueHeaderTouchable}
                          >
                            <Text style={styles.leagueSectionHeader}>
                              {isExpanded ? '▼ ' : '▶ '} {league} ({teams.length})
                            </Text>
                          </TouchableOpacity>

                          {isExpanded && teams.map(team => {
                            const isAdded = favouriteTeams.includes(team.teamName);
                            return (
                              <TouchableOpacity
                                key={team.teamName}
                                style={styles.teamItem}
                                onPress={() => {
                                  if (!isAdded) {
                                    setFavouriteTeams(prev => [...prev, team.teamName]);
                                  }
                                  setTeamSelectorVisible(false);
                                  setTeamSearchQuery('');
                                }}
                                disabled={isAdded}
                              >
                                <Text style={styles.teamItemText}>
                                  {team.teamName}
                                </Text>
                                {isAdded && (
                                  <Text style={styles.teamItemAlreadyAdded}>Added ✓</Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={styles.noResultsText}>
                        No teams match your search
                      </Text>
                    }
                  />
                </View>
              </View>
            </Modal>

            <Text style={styles.header}>Your Profile</Text>

            <View style={styles.section}>
              <Image
                source={image ? { uri: image } : require('@/assets/images/icon.png')}
                style={styles.profileImage}
              />
              <TouchableOpacity style={styles.uploadPhotoButton} onPress={pickImage}>
                <Text style={styles.smallButtonText}>Upload Photo</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Your Name"
                placeholderTextColor={colorScheme === 'dark' ? '#BBBBBB' : '#374151'}
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                placeholderTextColor={colorScheme === 'dark' ? '#BBBBBB' : '#374151'}
                value={location}
                onChangeText={setLocation}
              />

              <View style={{ marginBottom: 16 }}>
                <Text style={styles.favouriteTeamsLabel}>
                  Favourite Teams
                </Text>

                <TouchableOpacity
                  style={styles.addTeamButton}
                  onPress={() => setTeamSelectorVisible(true)}
                >
                  <Text style={styles.addTeamButtonText}>
                    + Add favourite team
                  </Text>
                </TouchableOpacity>

                <View style={styles.favouriteTeamsContainer}>
                  {favouriteTeams.length === 0 ? (
                    <Text style={styles.noTeamsText}>
                      No favourite teams added yet
                    </Text>
                  ) : (
                    favouriteTeams.map((team) => (
                      <View key={team} style={styles.teamChip}>
                        <Text style={styles.teamChipText}>
                          {team}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setFavouriteTeams(prev => prev.filter(t => t !== team))}
                          style={styles.teamChipRemove}
                        >
                          <Ionicons name="close" size={16} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>

              <View style={styles.profileActionsRow}>
                <TouchableOpacity style={styles.settingsGearButton} onPress={() => router.push('/settings')}>
                  <Ionicons name="settings-outline" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
                </TouchableOpacity>

                {loading ? (
                  <ActivityIndicator size="large" color="#0D2C42" />
                ) : (
                  <TouchableOpacity style={styles.smallSaveProfileButton} onPress={saveProfile}>
                    <Text style={styles.smallButtonText}>Save Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              {isPremium ? (
                <View style={styles.statSection}>
                  <Text style={styles.sectionTitle}>Arenas Visited</Text>
                  <Text style={styles.cardTextBold}>{arenasVisited}</Text>
                </View>
              ) : (
                <View style={[styles.statSection, styles.blurredSection]}>
                  <Text style={styles.sectionTitle}>Arenas Visited</Text>
                  <Text style={styles.upgradePrompt}>
                    Subscribe to see arenas visited.
                  </Text>
                </View>
              )}
              {isPremium ? (
                <View style={styles.statSection}>
                  <Text style={styles.sectionTitle}>Teams Watched</Text>
                  <Text style={styles.cardTextBold}>{teamsWatched}</Text>
                </View>
              ) : (
                <View style={[styles.statSection, styles.blurredSection]}>
                  <Text style={styles.sectionTitle}>Teams Watched</Text>
                  <Text style={styles.upgradePrompt}>
                    Monthly subscription costs less than a puck.
                  </Text>
                </View>
              )}
            </View>

            {isPremium ? (
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
            ) : (
              <View style={[styles.section, styles.blurredSection]}>
                <Text style={styles.sectionTitle}>Most Watched Teams</Text>
                <Text style={styles.upgradePrompt}>
                  6 month subscription is cheaper than arena parking.
                </Text>
              </View>
            )}

            {isPremium ? (
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
            ) : (
              <View style={[styles.section, styles.blurredSection]}>
                <Text style={styles.sectionTitle}>Most Visited Arena</Text>
                <Text style={styles.upgradePrompt}>
                  Subscribe to see most visited arena.
                </Text>
              </View>
            )}

            {isPremium ? (
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
            ) : (
              <View style={[styles.section, styles.blurredSection]}>
                <Text style={styles.sectionTitle}>Teams Seen</Text>
                <Text style={styles.upgradePrompt}>
                  Subscribe to see teams by league
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Check-ins</Text>
              {recentCheckIns.length === 0 ? (
                <Text style={styles.placeholder}>No check-ins yet.</Text>
              ) : isPremium ? (
                <>
                  {recentCheckIns.slice(0, visibleCheckins).map((checkIn) => {
                    const arenaName = checkIn.arenaName ?? "";
                    const arenaAlt  = checkIn.arena ?? "";
                    const teamName  = checkIn.teamName ?? "";
                    const league    = checkIn.league ?? "";

                    let arenaMatch = arenasData.find(
                      (a) => a.arena === arenaName || a.arena === arenaAlt
                    );

                    if (!arenaMatch && teamName && league) {
                      arenaMatch = arenasData.find(
                        (a) => a.teamName === teamName && a.league === league
                      );
                    }

                    const teamColor = arenaMatch?.colorCode || arenaMatch?.color || "#0A2940";
                    const bgColor = `${teamColor}22`;

                    return (
                      <TouchableOpacity
                        key={checkIn.id}
                        style={[
                          styles.checkinCard,
                          {
                            borderLeftColor: teamColor,
                            backgroundColor: bgColor,
                          },
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

                        {(checkIn.teamName || checkIn.opponent) && (
                          <Text style={styles.sub}>
                            {checkIn.teamName && checkIn.opponent
                              ? `${checkIn.teamName} VS ${checkIn.opponent}`
                              : checkIn.teamName || checkIn.opponent}
                          </Text>
                        )}

                        <View style={styles.dateAndCheerRow}>
                          <Text style={styles.dateText}>
                            {checkIn.gameDate
                              ? new Date(checkIn.gameDate).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : 'No date'}
                          </Text>

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
                              {visibleCheerList === checkIn.id && checkIn.cheerNames.map((name, index) => (
                                <Text key={index} style={styles.cheerNamesText}>{name}</Text>
                              ))}
                            </View>
                          )}
                        </View>

                        {checkIn.hasChirps && (
                          <View style={styles.chirpSectionWrapper}>
                            <ChirpsSection userId={auth.currentUser?.uid!} checkinId={checkIn.id} />
                            <View style={styles.chirpReplyRow}>
                              <TextInput
                                placeholder="Reply to this chirp..."
                                placeholderTextColor={colorScheme === 'dark' ? '#BBBBBB' : '#999'}
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
                                  await addDoc(chirpsRef, {
                                    text,
                                    userName: name || 'Anonymous',
                                    userImage: imageUrl || null,
                                    userId: auth.currentUser?.uid,
                                    timestamp: serverTimestamp(),
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
                  })}

                  {visibleCheckins < recentCheckIns.length && (
                    <TouchableOpacity
                      style={[styles.smallLoadButton, { marginTop: 20 }]}
                      onPress={() => setVisibleCheckins(prev => prev + 5)}
                    >
                      <Text style={styles.smallButtonText}>Load more</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  {recentCheckIns.slice(0, visibleCheckins).map((checkIn) => {
                    const arenaName = checkIn.arenaName ?? "";
                    const arenaAlt  = checkIn.arena ?? "";
                    const teamName  = checkIn.teamName ?? "";
                    const league    = checkIn.league ?? "";

                    let arenaMatch = arenasData.find(
                      (a) => a.arena === arenaName || a.arena === arenaAlt
                    );

                    if (!arenaMatch && teamName && league) {
                      arenaMatch = arenasData.find(
                        (a) => a.teamName === teamName && a.league === league
                      );
                    }

                    const teamColor = arenaMatch?.colorCode || arenaMatch?.color || "#0A2940";
                    const bgColor = `${teamColor}22`;

                    return (
                      <TouchableOpacity
                        key={checkIn.id}
                        style={[
                          styles.checkinCard,
                          {
                            borderLeftColor: teamColor,
                            backgroundColor: bgColor,
                          },
                        ]}
                        onPress={() => showUpgradePrompt(
                          "Premium Feature",
                          "Subscribe to view check-in details and to reply to chirps."
                        )}
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

                        {(checkIn.teamName || checkIn.opponent) && (
                          <Text style={styles.sub}>
                            {checkIn.teamName && checkIn.opponent
                              ? `${checkIn.teamName} VS ${checkIn.opponent}`
                              : checkIn.teamName || checkIn.opponent}
                          </Text>
                        )}

                        <View style={styles.dateAndCheerRow}>
                          <Text style={styles.dateText}>
                            {checkIn.gameDate
                              ? new Date(checkIn.gameDate).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : 'No date'}
                          </Text>

                          {checkIn.cheerCount > 0 && (
                            <View style={styles.cheerWrapper}>
                              <View style={styles.cheerBadgeContainer}>
                                <Text style={{ fontSize: 16 }}>🎉</Text>
                                <View style={styles.cheerCountBadge}>
                                  <Text style={styles.cheerCountText}>{checkIn.cheerCount}</Text>
                                </View>
                              </View>
                              {visibleCheerList === checkIn.id && checkIn.cheerNames.map((name, index) => (
                                <Text key={index} style={styles.cheerNamesText}>{name}</Text>
                              ))}
                            </View>
                          )}
                        </View>

                        {checkIn.hasChirps && (
                          <View style={styles.chirpSectionWrapper}>
                            <ChirpsSection userId={auth.currentUser?.uid!} checkinId={checkIn.id} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {visibleCheckins < recentCheckIns.length && (
                    <TouchableOpacity
                      style={[styles.smallLoadButton, { marginTop: 20 }]}
                      onPress={() => setVisibleCheckins(prev => prev + 5)}
                    >
                      <Text style={styles.smallButtonText}>Load more</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}