//app/checkin/[checkinId].tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import firebaseApp from "@/firebaseConfig";
import { getAuth } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { deleteDoc, doc, getDoc, getFirestore } from "firebase/firestore";

import LoadingPuck from "@/components/loadingPuck";
import arenasData from "@/assets/data/arenas.json";
import historicalArenasData from '../../assets/data/historicalArenas.json';

const db = getFirestore(firebaseApp);
const router = useRouter();
const formatGameDate = (checkin: any) => {
  if (!checkin.gameDate) return "";
  return new Intl.DateTimeFormat(undefined, {dateStyle: "medium",timeStyle: checkin.checkinType === "live" ? "short" : undefined,}).format(new Date(checkin.gameDate));
};

export default function CheckinDetailsScreen() {
  const params = useLocalSearchParams();
  const checkinId = params.checkinId as string;
  const userId = params.userId as string;
  const [checkin, setCheckin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isOwner = currentUser && String(currentUser.uid) === String(userId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchCheckin = async () => {
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

          setCheckin(snap.data());

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
    Alert.alert(
      "Delete Check-In",
      "Are you sure you want to delete this check-in? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
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
              Alert.alert("Error", "Could not delete check-in.");
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchCheckin();
  }, [checkinId, userId]);

  if (loading) {
    return <LoadingPuck />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>

        <TouchableOpacity
          onPress={fetchCheckin}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: "#0A2940",
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
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

  // STEP 1 — Try to match by current arena name
  let arenaMatch = arenasData.find(
    (a: any) =>
      a.arena === checkin.arenaName &&
      a.league === checkin.league
  );

  // STEP 2 — If no match (e.g., Pepsi Center), fallback to matching by team + league
  if (!arenaMatch) {
    arenaMatch = arenasData.find(
      (a: any) =>
        a.teamName === checkin.teamName &&
        a.league === checkin.league
    );
  }

  // STEP 3 — Color resolution
  const teamColor = arenaMatch?.colorCode || arenaMatch?.color || "#0A2940";
  const overlayColor = `${teamColor}DD`;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerStyle: {
            backgroundColor: teamColor,
          },
          headerRight: () =>
            isOwner ? (
              <View style={{ flexDirection: "row", gap: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    console.log("EDIT BUTTON CLICKED!");  // ← ADD THIS LINE
                    router.push(`/checkin/edit/${checkinId}?userId=${userId}`);
                  }}
                >
                  <Ionicons name="create-outline" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null,
        }}
      />
      <ImageBackground
        source={require("@/assets/images/background.jpg")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.overlay, { backgroundColor: overlayColor }]} />

        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          style={{ flex: 1 }}
        >
          {/* Arena + Game Info */}
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

          {/* Photo */}
          {checkin.photos && checkin.photos.length > 0 && checkin.photos[0] && (
            <View style={[styles.photoCard, { backgroundColor: teamColor }]}>
              {!imageError ? (
                <Image
                  source={{ uri: checkin.photos[0] }}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Image
                  source={require("@/assets/images/placeholder.png")}
                  style={styles.photo}
                  resizeMode="cover"
                />
              )}
            </View>
          )}

          {/* Extra Details */}
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
                  <Text style={styles.value}>{checkin.companions}</Text>
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

          {/* Merch Bought */}
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

          {/* Concessions Bought */}
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
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%", },
  arenaCard: { padding: 16, borderRadius: 12, marginBottom: 16, marginTop: -10, marginHorizontal: 10, },
  detailsCard: { padding: 16, borderRadius: 12,  marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: "#ffffff44", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
  merchCard: { padding: 16, borderRadius: 12, marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: "#ffffff44", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
  photoCard: { padding: 16, borderRadius: 12, marginBottom: 24, marginHorizontal: 20, borderWidth: 1, borderColor: "#ffffff44", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, },
  category: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 4, },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", },
  detail: { fontSize: 16, color: "#fff", marginBottom: 6, },
  error: { fontSize: 18, color: "red", },
  gameDate: { fontSize: 16, fontWeight: "500", color: "#FFFFFF", marginTop: 4, textAlign: "center", },
  label: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", },
  listItem: { fontSize: 15, color: "#fff", marginLeft: 20, },
  overlay: { ...StyleSheet.absoluteFillObject, },
  photo: { width: "100%", height: 220, borderRadius: 10, },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#fff", },
  sub: { fontSize: 16, fontWeight: "600", color: "#fff", textAlign: "center", marginBottom: 2, },
  title: { fontSize: 34, fontWeight: "bold", color: "#fff", marginTop: -8, textAlign: "center", textShadowColor: '#ffffff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, },
  value: { fontSize: 15, fontWeight: "400", marginLeft: 20, color: "#FFFFFF", marginBottom: 6, },
});