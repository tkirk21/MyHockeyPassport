//VERSION 2 - 8am 9TH AUGUST
//[arenaId.tsx]
import { format } from 'date-fns';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where, } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, ScrollView, Text, TouchableOpacity, View, } from 'react-native';

import LoadingPuck from '@/components/loadingPuck';
import arenaData from '@/assets/data/arenas.json';
import nhlSchedule2025 from "@/assets/data/nhlSchedule2025.json";
import ahlSchedule2025 from "@/assets/data/ahlSchedule2025.json";
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';
import ohlSchedule2025 from '@/assets/data/ohlSchedule2025.json';
import sphlSchedule2025 from '@/assets/data/sphlSchedule2025.json';

export default function ArenaScreen() {
  const { arenaId } = useLocalSearchParams();
  const router = useRouter();
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [lastVisitDate, setLastVisitDate] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const arena = arenaData.find((a) =>
      `${a.latitude.toFixed(6)}_${a.longitude.toFixed(6)}` === arenaId
    );

    if (!arena) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Arena not found.</Text>
        </View>
      );
    }

  useEffect(() => {
      const run = async () => {
        const user = auth.currentUser;
        if (!user || !arena) return;
        try {
          setLoading(true);
          const q = query(
            collection(db, 'profiles', user.uid, 'checkins'),
            where('arenaName', '==', arena.arena)
          );
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            setVisitCount(0);
            setLastVisitDate(null);
            return;
          }

          const dates = snapshot.docs
            .map(doc => doc.data().timestamp?.toDate())
            .filter(date => date instanceof Date);
          const sorted = dates.sort((a, b) => b.getTime() - a.getTime());
          setVisitCount(snapshot.size);
          setLastVisitDate(sorted[0]);
        } catch (err) {
          console.log('Firestore error:', err);
        } finally {
          setLoading(false);
        }
      };
      run();
    }, [arena, auth.currentUser]);

  const teamCodeMap = useMemo(() => (
    Object.fromEntries(
      arenaData.map((a) => [`${a.league}_${a.teamCode}`, a.teamName])
    )
  ), []);

  const handleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${arena.latitude},${arena.longitude}`;
    Linking.openURL(url);
  };

  // Combine known schedules
  const combinedSchedule = [
    ...nhlSchedule2025.map((game) => ({
      id: game.id,
      league: game.league,
      date: game.date,
      arena: game.arena,
      homeTeam: teamCodeMap[`${game.league}_${game.team}`] || game.team,
      awayTeam: teamCodeMap[`${game.league}_${game.opponent}`] || game.opponent,
    })),
    ...ahlSchedule2025.map((game) => ({
      id: game.id,
      league: game.league,
      date: game.date,
      arena: game.arena,
      homeTeam: teamCodeMap[`${game.league}_${game.team}`] || game.team,
      awayTeam: teamCodeMap[`${game.league}_${game.opponent}`] || game.opponent,
    })),
    ...echlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...sphlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...ushlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...whlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...ohlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
  ];

  // Filter & sort upcoming games at this arena
  let upcomingGames = combinedSchedule
    .filter((game) => game.arena === arena.arena && new Date(game.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  // ✅ Fallback: if no upcoming games, default to next preseason
  if (upcomingGames.length === 0) {
    upcomingGames = [{
      id: 'default-next-season',
      league: arena.league,
      date: '2026-09-1T19:00:00Z', // adjust each year
      arena: arena.arena,
      homeTeam: arena.teamName,
      awayTeam: 'TBD',
    }];
  }

  const lightColor = `${arena.colorCode}22`; // light transparent tint

  const getDistanceMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8;
    const toRad = (n) => (n * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckingIn(false);
        Alert.alert('Permission denied', 'Location is required to check in.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        maximumAge: 15000,
      });

      const distanceMiles = getDistanceMiles(
        location.coords.latitude,
        location.coords.longitude,
        arena.latitude,
        arena.longitude
      );

      if (distanceMiles > 0.28) {
        setCheckingIn(false);
        Alert.alert(
          'Not close enough',
          'You must be at the arena to check-in.'
        );
        return;
      }

      // *** This is the required delay ***
      setTimeout(() => {
        router.push({
          pathname: '/checkin/live',
          params: {
            arenaId,
            arena: arena.arena,
            latitude: arena.latitude,
            longitude: arena.longitude,
            league: arena.league,
          },
        });
      }, 250);

    } catch (err) {
      setCheckingIn(false);
      Alert.alert('Location failed', 'Could not get your location. Try again.');
    }
  };

  useEffect(() => {
    if (upcomingGames.length === 0) {
      setTimeLeft('');
      return;
    }

    const nextGameTime = new Date(upcomingGames[0].date).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = nextGameTime - now;

      if (diff <= 0) {
        setTimeLeft('PUCK DROP!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [upcomingGames]);

  return (
    <View style={{ flex: 1 }}>
      {checkingIn && (
        <View style={styles.loadingOverlay}>
          <LoadingPuck size={140} />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container}>
        {/* ← BACK BUTTON GOES RIGHT HERE */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={[styles.header, { backgroundColor: arena.colorCode || '#0A2940' }]}>
          <Text style={styles.arenaName}>{arena.arena}</Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: lightColor, borderColor: arena.colorCode || "#0A2940", height: 120 }, // lock consistent height
          ]}
        >
          {loading ? (
            <View
              style={{
                justifyContent: "center",
                alignItems: "center",
                flex: 1,
              }}
            >
              <LoadingPuck size={120} />
            </View>
          ) : (
            <>
              <Text style={styles.statNumber}>{visitCount}</Text>
              <Text style={styles.statLabel}>Times Visited</Text>
              {lastVisitDate && (
                <Text style={styles.lastVisitText}>
                  Last: {format(lastVisitDate, "MMM d, yyyy")}
                </Text>
              )}
            </>
          )}
        </View>

        <View style={[styles.infoBox, { backgroundColor: lightColor, borderColor: arena.colorCode || "#0A2940" }]}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{arena.address}</Text>

          <Text style={styles.label}>Team</Text>
          <Text style={styles.value}>{arena.teamName}</Text>

          <Text style={styles.label}>League</Text>
          <Text style={styles.value}>{arena.league}</Text>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: arena.colorCode || "#0A2940" }]} onPress={handleDirections}>
          <Text style={styles.buttonText}>Get Directions</Text>
        </TouchableOpacity>

        {upcomingGames.length === 0 && (
                <View style={[styles.section, { backgroundColor: lightColor }]}>
                  <Text style={styles.sectionTitle}>Upcoming Games</Text>
                  <Text style={styles.value}>No Upcoming Games</Text>
                </View>
              )}

        {upcomingGames.length > 0 && (
          <View style={[styles.section, { backgroundColor: lightColor, borderColor: arena.colorCode || "#0A2940" }]}>
            <Text style={styles.sectionTitle}>Upcoming Games</Text>

            {/* ONE LINE: 70:54:16 */}
                <View style={[styles.countdownBox, { backgroundColor: arena.colorCode || "#0A2940" }]}>
                  <Text style={styles.countdownNumber}>{timeLeft}</Text>
                  <Text style={styles.countdownLabel}>until next puck drop</Text>
                </View>

            {upcomingGames.map((game) => (
              <View key={game.id} style={styles.gameCard}>
                <Text style={styles.gameTextBold}>
                  {game.homeTeam} vs {game.awayTeam}
                </Text>
                <Text style={styles.gameText}>
                  {format(new Date(game.date), 'EEE, MMM d – h:mm a')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[styles.button, { backgroundColor: arena.colorCode || "#0A2940" }]} onPress={handleCheckIn}>
          <Text style={styles.buttonText}>Check-in to live game</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    backgroundColor: '#F4F7FA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F7FA',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
  },
  header: {
    padding: 34,
    alignItems: 'center',
    fontWeight: 'bold',
    color: '#0D2C42',
    marginBottom: 15,
    textAlign: 'center',
  },
  arenaName: {
    fontSize: 28,
    top: 10,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    margin: 4,
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#0A2940',
    fontWeight: 'bold',
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    color: '#1F2937',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#0A2940',
    marginHorizontal: 90,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 30,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2940',
    marginBottom: 12,
    textAlign: 'center',
  },
  gameCard: {
    marginBottom: 12,
  },
  gameTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A2940',
    textAlign: 'center',
  },
  gameText: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
  },
  checkinButton: {
    backgroundColor: '#0A2940',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  statCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 20,
    borderRadius: 60,
    alignItems: 'center',
    width: 120,
    alignSelf: 'center',
    borderWidth: 4,
    backgroundColor: '#FFFFFF',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0A2940',
    lineHeight: 24,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#334155',
    letterSpacing: 0.3,
  },
  lastVisitText: {
    marginTop: 0,
    fontSize: 12,
    color: '#475569',
  },
  backButton: {
    position: 'absolute',
    top: 32,
    left: -5,
    zIndex: 10,
    borderRadius: 20,
    padding: 8,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '700',
    color: arenaData.colorCode,
    textAlign: 'center',
    marginBottom: 8,
  },
  countdownBox: {
    backgroundColor: '#0A2940',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 0,
    borderRadius: 14,
    marginBottom: 16,
    minWidth: 150,
    minHeight: 75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
    borderWidth: 4,
  },
  countdownNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 46,
  },
  countdownTime: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    marginTop: -6,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: -10,
    opacity: 0.9,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
});