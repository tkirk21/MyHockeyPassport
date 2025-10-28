// app/userprofile/[userId].tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ImageBackground, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View,  } from 'react-native';
import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc,  } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import {  Stack, useLocalSearchParams, useRouter } from 'expo-router';
import arenasData from '@/assets/data/arenas.json';
import { logCheer } from "@/utils/activityLogger";

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

function CheerButton({
  ownerId,              // profile owner (whose check-in it is)
  checkinId,
}: {
  ownerId: string;
  checkinId: string;
}) {
  const [cheerCount, setCheerCount] = useState(0);
  const [cheerNames, setCheerNames] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadCheers = async () => {
      try {
        const cheersRef = collection(db, "profiles", ownerId, "checkins", checkinId, "cheers");
        const docsSnap = await getDocs(cheersRef);
        setCheerCount(docsSnap.size);
        setCheerNames(
          docsSnap.docs
            .map((d) => d.data().name as string)
            .filter((n) => !!n && n.trim().length > 0)
        );
      } catch (err) {
        console.error("Error loading cheers:", err);
      }
    };
    loadCheers();
  }, [ownerId, checkinId]);

  const handleCheerPress = async (e?: any) => {
    try {
      e?.stopPropagation?.();
      const user = auth.currentUser;
      if (!user) return;

      // pull display name from profile first
      let userName = "Anonymous";
      try {
        const prof = await getDoc(doc(db, "profiles", user.uid));
        if (prof.exists() && prof.data().name) userName = prof.data().name as string;
        else if (user.displayName) userName = user.displayName;
      } catch {}

      const cheerRef = doc(db, "profiles", ownerId, "checkins", checkinId, "cheers", user.uid);
      const existing = await getDoc(cheerRef);

      if (existing.exists()) {
        // remove cheer
        await deleteDoc(cheerRef);
        setCheerCount((c) => Math.max(0, c - 1));
        setCheerNames((names) => names.filter((n) => n !== userName));
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setVisible(false)
        );
      } else {
        // add cheer
        await setDoc(cheerRef, { userId: user.uid, name: userName, timestamp: new Date() });
        // log to activity feed
        await logCheer(checkinId, ownerId);

        setCheerCount((c) => c + 1);
        setCheerNames((names) => [...names, userName]);
        setVisible(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

        // auto-hide after 3s
        setTimeout(() => {
          Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(
            () => setVisible(false)
          );
        }, 3000);
      }
    } catch (err) {
      console.error("Error toggling cheer:", err);
    }
  };

  return (
    <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleCheerPress}
        style={{
          marginTop: 4,
          alignSelf: "flex-start",
          backgroundColor: "#1E3A8A",
          paddingVertical: 2,
          paddingHorizontal: 2,
          borderRadius: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>Cheer 🎉</Text>

        {cheerCount > 0 && (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              backgroundColor: "#0A2940",
              borderRadius: 8,
              paddingHorizontal: 4,
              paddingVertical: 1,
              minWidth: 16,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#ffffff",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>{cheerCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {visible && cheerNames.length > 0 && (
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
              },
            ],
            backgroundColor: "rgba(13,44,66,0.95)",
            padding: 6,
            borderRadius: 8,
            marginTop: 4,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          {cheerNames.map((name, i) => (
            <Text key={i} style={{ color: "#fff", fontSize: 12, marginBottom: 2 }}>
              {name}
            </Text>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function ChirpsSection({ ownerId, checkinId }: { ownerId: string; checkinId: string }) {
  const [chirps, setChirps] = useState<any[]>([]);
  const [text, setText] = useState("");
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const loadChirps = async () => {
      try {
        const chirpRef = collection(db, "profiles", ownerId, "checkins", checkinId, "chirps");
        const q = query(chirpRef, orderBy("timestamp", "asc"));
        const snap = await getDocs(q);
        setChirps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error loading chirps:", e);
      }
    };
    loadChirps();
  }, [ownerId, checkinId]);

  const sendChirp = async () => {
    const user = auth.currentUser;
    if (!user || !text.trim()) return;

    let userName = "Anonymous";
    let imageUrl: string | null = null;

    try {
      const prof = await getDoc(doc(db, "profiles", user.uid));
      if (prof.exists()) {
        const data = prof.data();
        if (data.name) userName = data.name;
        if (data.imageUrl) imageUrl = data.imageUrl; // ✅ pull real profile photo
      } else if (user.displayName) {
        userName = user.displayName;
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }

    try {
      await addDoc(collection(db, "profiles", ownerId, "checkins", checkinId, "chirps"), {
        userId: user.uid,
        userName,
        userImage: imageUrl,
        text: text.trim(),
        timestamp: new Date(),
      });

      setText("");
      setChirps(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          userName,
          userImage: imageUrl, // ✅ include actual Firestore image
          text: text.trim(),
        },
      ]);
    } catch (e) {
      console.error("Error sending chirp:", e);
    }
  };

  return (
    <View style={{ marginTop: 8 }}>
      {chirps.map(c => (
        <View
          key={c.id || c.timestamp}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <Image
            source={
              c.userImage
                ? { uri: c.userImage }
                : require("@/assets/images/icon.png") // placeholder if no image
            }
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              marginRight: 8,
            }}
          />
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontWeight: "700", color: "#0A2940" }}>
              {c.userName || "Someone"}
            </Text>
            <Text style={{ color: "#0A2940", flexShrink: 1 }}>
              {c.text || c.message}
            </Text>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a chirp..."
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderRadius: 6,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: "#ccc",
            fontSize: 13,
          }}
        />
        <TouchableOpacity
          onPress={sendChirp}
          style={{
            marginLeft: 6,
            backgroundColor: "#1E3A8A",
            borderRadius: 6,
            paddingHorizontal: 10,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Chirp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <Text style={styles.dateText}>
                      {item.timestamp?.seconds
                        ? new Date(item.timestamp.seconds * 1000).toLocaleDateString()
                        : ""}
                    </Text>

                    <CheerButton ownerId={String(userId)} checkinId={item.id} />
                  </View>

                  <ChirpsSection ownerId={String(userId)} checkinId={item.id} />
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
  cheerButton: {
      marginTop: 4,
      alignSelf: "flex-start",
      backgroundColor: "#1E3A8A",
      paddingVertical: 2,
      paddingHorizontal: 2,
      borderRadius: 10,
    },
    cheerButtonText: {
      color: "#fff",
      fontWeight: "bold",
    },
    cheerInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 6,
    },
    cheerCountText: {
      fontSize: 14,
      color: "#0A2940",
      fontWeight: "600",
    },
    cheerNames: {
      fontSize: 12,
      color: "#6B7280",
      flexShrink: 1,
    },
});

