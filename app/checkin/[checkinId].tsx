//app/checkin/[checkinId].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, ImageBackground, } from "react-native";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseApp from "@/firebaseConfig";
import arenasData from "@/assets/data/arenas.json"; // ✅ import arenas.json
import { TouchableOpacity } from "react-native";
import { logCheer } from "@/utils/activityLogger";

const handleCheer = () => {
  if (!checkin) return;
  try {
    logCheer(String(checkinId), String(userId));
    alert("You cheered this 🎉");
  } catch (err) {
    console.error("Error cheering check-in:", err);
  }
};

const db = getFirestore(firebaseApp);

export default function CheckinDetailsScreen() {
  const { checkinId, userId } = useLocalSearchParams();
  const [checkin, setCheckin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCheckin = async () => {
      if (!checkinId || !userId) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "profiles", String(userId), "checkins", String(checkinId));
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCheckin(snap.data());
        } else {
          setCheckin(null);
        }
      } catch (err) {
        console.error("❌ Error loading check-in:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCheckin();
  }, [checkinId, userId]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#0D2C42" />;
  }

  if (!checkin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Check-in not found.</Text>
      </View>
    );
  }

  // ✅ Find arena in arenas.json
  const arenaMatch = arenasData.find(
    (a: any) => a.arena === checkin.arenaName && a.league === checkin.league
  );
  const teamColor = arenaMatch?.colorCode || arenaMatch?.color || "#0A2940";
  const overlayColor = `${teamColor}DD`; // semi-transparent overlay

  return (
    <>
      <Stack.Screen options={{ headerTitle: "Check-in Details" }} />
      <ImageBackground
        source={require("@/assets/images/background.jpg")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.overlay, { backgroundColor: overlayColor }]} />

        <ScrollView contentContainerStyle={styles.container}>
          {/* Arena + Game Info */}
          <View style={[styles.card, { backgroundColor: teamColor }]}>
            <Text style={styles.title}>{checkin.arenaName}</Text>
            <Text style={styles.sub}>{checkin.league}</Text>
            <Text style={styles.sub}>
              {checkin.teamName} vs {checkin.opponent}
            </Text>
            <Text style={styles.sub}>
              {checkin.timestamp?.seconds
                ? new Date(checkin.timestamp.seconds * 1000).toLocaleString()
                : ""}
            </Text>
          </View>

          {/* Photo */}
          {checkin.photos && checkin.photos.length > 0 && (
            <View style={[styles.card, { backgroundColor: teamColor }]}>
              <Image
                source={{ uri: checkin.photos[0] }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Extra Details */}
          {(checkin.favoritePlayer || checkin.seatInfo || checkin.companions || checkin.notes) && (
            <View style={[styles.card, { backgroundColor: teamColor }]}>
              {checkin.favoritePlayer && (
                <Text style={styles.detail}>Favorite Player: {checkin.favoritePlayer}</Text>
              )}
              {checkin.seatInfo && <Text style={styles.detail}>Seat: {checkin.seatInfo}</Text>}
              {checkin.companions && <Text style={styles.detail}>With: {checkin.companions}</Text>}
              {checkin.notes && <Text style={styles.detail}>Notes: {checkin.notes}</Text>}
            </View>
          )}

          {/* Merch Bought */}
          {checkin.merchBought &&
            Object.keys(checkin.merchBought).some(
              (cat) => checkin.merchBought[cat].length > 0
            ) && (
              <View style={[styles.card, { backgroundColor: teamColor }]}>
                <Text style={styles.sectionTitle}>Merch Bought</Text>
                {Object.entries(checkin.merchBought).map(([category, items]: any) =>
                  items.length > 0 ? (
                    <View key={category} style={styles.section}>
                      <Text style={styles.category}>{category}</Text>
                      {items.map((item: string) => (
                        <Text key={item} style={styles.listItem}>
                          {item}
                        </Text>
                      ))}
                    </View>
                  ) : null
                )}
              </View>
            )}

          {/* Concessions Bought */}
          {checkin.concessionsBought &&
            Object.keys(checkin.concessionsBought).some(
              (cat) => checkin.concessionsBought[cat].length > 0
            ) && (
              <View style={[styles.card, { backgroundColor: teamColor }]}>
                <Text style={styles.sectionTitle}>Concessions Bought</Text>
                {Object.entries(checkin.concessionsBought).map(([category, items]: any) =>
                  items.length > 0 ? (
                    <View key={category} style={styles.section}>
                      <Text style={styles.category}>{category}</Text>
                      {items.map((item: string) => (
                        <Text key={item} style={styles.listItem}>
                          {item}
                        </Text>
                      ))}
                    </View>
                  ) : null
                )}
              </View>
            )}
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff", // text white over team colors
    marginBottom: 6,
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    color: "#fff",
    textAlign: "center",
    marginBottom: 2,
  },
  detail: {
    fontSize: 15,
    color: "#fff",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 10,
  },
  section: {
    marginBottom: 10,
  },
  category: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  listItem: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 10,
    marginBottom: 2,
  },
  error: {
    fontSize: 18,
    color: "red",
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 10,
  },
});






