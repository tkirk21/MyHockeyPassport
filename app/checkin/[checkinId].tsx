//app/checkin/[checkinId].tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import firebaseApp from "@/firebaseConfig";
import { getAuth } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Alert, Dimensions, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { useColorScheme } from '../../hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import LoadingPuck from "@/components/loadingPuck";
import arenasData from "@/assets/data/arenas.json";
import historicalArenasData from '../../assets/data/historicalArenas.json';

const db = getFirestore(firebaseApp);
const formatGameDate = (checkin: any) => {
  if (!checkin.gameDate) return "";
  return new Intl.DateTimeFormat(undefined, {dateStyle: "medium",timeStyle: checkin.checkinType === "live" ? "short" : undefined,}).format(new Date(checkin.gameDate));
};

const HeaderRightWithSafeArea = ({ checkinId, userId, handleDelete, handleShare }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flexDirection: "row", gap: 24, paddingRight: 16, justifyContent: "center", height: "100%", }}>
      <TouchableOpacity onPress={handleShare}>
        <Ionicons name="share-social-outline" size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          router.push(`/checkin/edit/${checkinId}?userId=${userId}`);
        }}
      >
        <Ionicons name="create-outline" size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={handleDelete}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default function CheckinDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const params = useLocalSearchParams();
  const checkinId = params.checkinId as string;
  const userId = params.userId as string;
  const [checkin, setCheckin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isOwner = currentUser && String(currentUser.uid) === String(userId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [friendsMap, setFriendsMap] = useState<{ [name: string]: string }>({});
  const [friendsLoading, setFriendsLoading] = useState(true);
  const viewShotRef = useRef(null);

  const fetchCheckin = async () => {
    checkin?.photos?.forEach((uri, i) => {
    });
    if (!checkinId || !userId) {
      setError("Invalid check-in reference.");
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const ref = doc(db, "profiles", String(userId), "checkins", String(checkinId));
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setError("This check-in does not exist or was deleted.");
        return;
      }

      setCheckin({
        id: checkinId,
        ...snap.data(),
      });


      if (currentUser) {
        await setDoc(
          doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriendsTab'),
          { timestamp: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }
    } catch (err: any) {
      console.error("❌ Firestore error:", err);

      if (err.code === "permission-denied") {
        setError("You do not have permission to view this check-in.");
      } else if (err.code === "unavailable") {
        setError("Network error. Please check your connection.");
      } else {
        setError("An unexpected error occurred loading this check-in.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setAlertMessage('');
    setAlertVisible(true);
  };

  const handleShare = async () => {
    try {
      await new Promise(r => setTimeout(r, 500)); // delay to let view render

      const uri = await viewShotRef.current?.capture();
      if (!uri) {
        Alert.alert('Error', 'Could not capture the screen');
        return;
      }

      const fileUri = FileSystem.cacheDirectory + `checkin_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      const shareText = `Check out this check-in on my Hockey Passport! 🏒\nTrack every arena you visit.\nhttps://mysportspassport.com`;

      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Share your check-in',
        mimeType: 'image/png',
        message: shareText,
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Something went wrong');
    }
  };

  useEffect(() => {
    fetchCheckin();
  }, [checkinId, userId]);

  useEffect(() => {
    const loadFriends = async () => {
      if (!userId) return;

      const friendsRef = collection(db, 'profiles', userId, 'friends');
      const snap = await getDocs(friendsRef);
      const friendIds = snap.docs.map(d => d.id);

      const map = {};

      await Promise.all(
        friendIds.map(async (id) => {
          const profSnap = await getDoc(doc(db, 'profiles', id));
          const name = profSnap.data()?.name?.trim().toLowerCase();
          if (name) map[name] = id;
        })
      );

      setFriendsMap(map);
    };

    loadFriends();
  }, [userId]);

  if (loading) {
    return <LoadingPuck />;
  }

  if (deleting) {
    return <LoadingPuck />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>

        <TouchableOpacity
          onPress={fetchCheckin}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!checkin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Check-in not found.</Text>
      </View>
    );
  }

  let arenaMatch = arenasData.find(
    (a: any) =>
      a.arena === checkin.arenaName &&
      a.league === checkin.league
  );

  if (!arenaMatch) {
    arenaMatch = arenasData.find(
      (a: any) =>
        a.teamName === checkin.teamName &&
        a.league === checkin.league
    );
  }

  const teamColor = arenaMatch?.colorCode || arenaMatch?.color || "#0A2940";
  const overlayColor = `${teamColor}DD`;
  const borderColor = arenaMatch?.colorCode2 || teamColor;


  const styles = StyleSheet.create({
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 16 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16, },alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    arenaCard: { padding: 16, borderRadius: 12, marginBottom: 16, marginTop: -10, marginHorizontal: 10, },
    background: { flex: 1, width: "100%", height: "100%", },
    category: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 4, },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", },
    detail: { fontSize: 16, color: "#fff", marginBottom: 6, },
    detailsCard: { padding: 16, borderRadius: 12,  marginBottom: 16, marginHorizontal: 20, borderWidth: 4, borderColor, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
    error: { fontSize: 18, color: "red", },
    gameDate: { fontSize: 16, fontWeight: "500", color: "#FFFFFF", marginTop: 4, textAlign: "center", },
    headerLeftContainerStyle: { paddingTop: insets.top, },
    label: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", },
    listItem: { fontSize: 15, color: "#fff", marginLeft: 20, },
    merchCard: { padding: 16, borderRadius: 12, marginBottom: 30, marginHorizontal: 20, borderWidth: 4, borderColor, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
    overlay: { ...StyleSheet.absoluteFillObject, },
    photo: { width: "100%", height: 220, borderRadius: 10, },
    photoCard: { padding: 16, borderRadius: 12, marginBottom: 24, marginHorizontal: 20, borderWidth: 4, borderColor, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoThumbnail: { width: 100, height: 100, borderRadius: 8 },
    retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#0A2940", borderRadius: 8, },
    retryText: { color: "#fff", fontWeight: "600", },
    scoreCard: { padding: 16, borderRadius: 12, marginBottom: 16, marginTop: -10, marginHorizontal: 20, borderWidth: 4, borderColor, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
    score: { fontSize: 32, fontWeight: "600", color: "#fff", textAlign: "center", marginBottom: 2,  },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: "#fff", },
    sub: { fontSize: 16, fontWeight: "600", color: "#fff", textAlign: "center", marginBottom: 2, },
    title: { fontSize: 34, fontWeight: "bold", color: "#fff", marginTop: -8, textAlign: "center", textShadowColor: '#ffffff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, },
    value: { fontSize: 15, fontWeight: "400", marginLeft: 20, color: "#FFFFFF", marginBottom: 6, },
  });

  return (
    <>
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>Delete Check-In</Text>
            <Text style={styles.alertMessage}>
              Are you sure you want to delete this check-in? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.alertButton, { backgroundColor: '#EF4444' }]}
                onPress={async () => {
                  setAlertVisible(false);
                  setDeleting(true);

                  try {
                    const ref = doc(
                      db,
                      "profiles",
                      String(userId),
                      "checkins",
                      String(checkinId)
                    );
                    await deleteDoc(ref);
                    router.back();
                  } catch (err) {
                    console.error("Delete failed:", err);
                    setDeleting(false);
                    setAlertMessage("Could not delete check-in.");
                    setAlertVisible(true);
                  }
                }}
              >
                <Text style={styles.alertButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => setAlertVisible(false)}
              >
                <Text style={styles.alertButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerStyle: {
            backgroundColor: teamColor,
          },
          headerTintColor: "#fff",
          headerShadowVisible: false,
          headerLeft: () => (
            <View style={{ paddingLeft: 16, justifyContent: "center", height: "100%", }}>
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
          headerRight: () =>
            isOwner ? (
              <HeaderRightWithSafeArea
                checkinId={checkinId}
                userId={userId}
                handleDelete={handleDelete}
                handleShare={handleShare}
              />
            ) : null,
        }}
      />

      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ flex: 1 }}>
        <ImageBackground
          source={require("@/assets/images/background.jpg")}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={[styles.overlay, { backgroundColor: overlayColor }]} />

          <ScrollView
            contentContainerStyle={{ paddingBottom: 20 }}
            style={{ flex: 1 }}
          >
            <View style={[styles.arenaCard, { backgroundColor: teamColor }]}>
              <TouchableOpacity
                onPress={() => {
                  const a = arenasData.find(x => x.arena === checkin.arenaName);
                  if (!a) return console.warn("Arena not found in arenas.json");
                  router.push(`/arenas/${a.latitude.toFixed(6)}_${a.longitude.toFixed(6)}`);
                }}
              >
                <Text style={styles.title}>{checkin.arenaName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={{ paddingVertical: 4 }}
                onPress={() => router.push({ pathname: "/leagues/[leagueName]", params: { leagueName: checkin.league } })}
              >
                <Text style={[styles.sub, { textDecorationLine: "underline", textDecorationColor: "#FFF", fontWeight: "600" }]}>
                  {checkin.league}
                </Text>
              </TouchableOpacity>
              <Text style={styles.sub}>
                {checkin.teamName} VS {checkin.opponent}
              </Text>
              <Text style={[styles.sub, styles.gameDate]}>
                {formatGameDate(checkin)}
              </Text>
            </View>

            {(checkin.homeScore !== undefined || checkin.awayScore !== undefined) && (
              <View style={[styles.scoreCard, { backgroundColor: teamColor, marginTop: 8 }]}>
                <Text style={styles.title}>Final Score</Text>
                <Text style={styles.score}>
                  {checkin.homeScore ?? '?'}
                  {'  -  '}
                  {checkin.awayScore ?? '?'}
                </Text>
              </View>
            )}

            {checkin.photos && checkin.photos.length > 0 && (
              <View style={[styles.photoCard, { backgroundColor: teamColor, minHeight: 240 }]}>

                {photosLoading && <LoadingPuck size={120} />}

                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToAlignment="center"
                  snapToInterval={Dimensions.get('window').width - 32}
                  decelerationRate="fast"
                  style={{ opacity: photosLoading ? 0 : 1 }}
                >
                  {checkin.photos.slice(0, 3).map((uri, index) => (
                    <View
                      key={index}
                      style={{
                        width: Dimensions.get('window').width - 32,
                        alignItems: 'center',
                      }}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: '100%', height: 220, borderRadius: 10 }}
                        resizeMode="cover"
                        onLoadEnd={() => setPhotosLoading(false)}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {(checkin.favoritePlayer || checkin.seatInfo || checkin.companions || checkin.notes) && (
              <View style={[styles.detailsCard, { backgroundColor: teamColor }]}>
                {checkin.seatInfo && (() => {
                  const s = checkin.seatInfo;
                  const parts = [];
                  if (s.section) parts.push(`Section: ${s.section}`);
                  if (s.row) parts.push(`Row: ${s.row}`);
                  if (s.seat) parts.push(`Seat: ${s.seat}`);
                  return parts.length ? (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.label}>Seat Info</Text>
                      <Text style={styles.value}>{parts.join("   ")}</Text>
                    </View>
                  ) : null;
                })()}

                {checkin.companions && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.label}>Attended with</Text>
                    {checkin.companions
                      .split(/(,\s*|&\s*|\+\s*|and\s*|or\s*)/i)
                      .filter(part => part.trim() !== '' && !/^(,\s*|&\s*|\+\s*|and\s*|or\s*)$/i.test(part.trim()))
                      .map((part, index) => {
                        const trimmed = part.trim();
                        if (trimmed.startsWith('@')) {
                          const cleanName = trimmed.slice(1).toLowerCase().trim();
                          const uid = friendsMap[cleanName];
                          const displayName = trimmed.slice(1);
                          return (
                            <View key={index} style={{ marginVertical: 4 }}>
                              {uid ? (
                                <Text
                                  style={{ color: '#FFFFFF', textDecorationLine: 'underline' }}
                                  onPress={() => router.push(`/userprofile/${uid}`)}
                                >
                                  {displayName}
                                </Text>
                              ) : (
                                <Text style={{ color: '#FFFFFF' }}>
                                  {displayName}
                                </Text>
                              )}
                            </View>
                          );
                        }
                        return (
                          <View key={index} style={{ marginVertical: 4 }}>
                            <Text style={{ color: '#FFFFFF' }}>
                              {trimmed}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                )}

                {checkin.favoritePlayer && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.label}>Favorite Player</Text>
                    <Text style={styles.value}>{checkin.favoritePlayer}</Text>
                  </View>
                )}

                {checkin.notes && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.label}>Notes</Text>
                    <Text style={styles.value}>{checkin.notes}</Text>
                  </View>
                )}
              </View>
            )}

            {checkin.merchBought &&
              Object.values(checkin.merchBought).flat().length > 0 && (
                <View style={[styles.merchCard, { backgroundColor: teamColor }]}>
                  <Text style={styles.sectionTitle}>Merch Bought</Text>
                  {Object.values(checkin.merchBought).flat().map((item: string) => (
                    <Text key={item} style={styles.listItem}>
                      {item}
                    </Text>
                  ))}
                </View>
              )}

            {checkin.concessionsBought &&
              Object.values(checkin.concessionsBought).flat().length > 0 && (
                <View style={[styles.merchCard, { backgroundColor: teamColor }]}>
                  <Text style={styles.sectionTitle}>Concessions Bought</Text>
                  {Object.values(checkin.concessionsBought).flat().map((item: string) => (
                    <Text key={item} style={styles.listItem}>
                      {item}
                    </Text>
                  ))}
                </View>
              )}

            { (checkin.highlights || checkin.parkingAndTravel) && (
              <View style={[styles.merchCard, { backgroundColor: teamColor }]}>
                {checkin.highlights && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Highlights</Text>
                    <Text style={styles.value}>{checkin.highlights}</Text>
                  </View>
                )}

                {checkin.ParkingAndTravel && (
                  <View>
                    <Text style={styles.label}>Parking & Travel Tips</Text>
                    <Text style={styles.value}>{checkin.ParkingAndTravel}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </ImageBackground>
      </ViewShot>
    </>
  );
}