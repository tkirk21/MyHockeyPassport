//[arenaId.tsx]
import { format } from 'date-fns';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, onSnapshot, query, where, } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Linking, Modal, StyleSheet, ScrollView, Text, TouchableOpacity, View, } from 'react-native';
import { useColorScheme } from '../../hooks/useColorScheme';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingPuck from '@/components/loadingPuck';
import arenaData from '@/assets/data/arenas.json';
import arenaHistoryData from '@/assets/data/arenaHistory.json';
import nhlSchedule2025 from "@/assets/data/nhlSchedule2025.json";
import khlSchedule from "@/assets/data/khlSchedule.json";
import ahlSchedule2025 from "@/assets/data/ahlSchedule2025.json";
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';
import ohlSchedule2025 from '@/assets/data/ohlSchedule2025.json';
import qmjhlSchedule2025 from '@/assets/data/qmjhlSchedule2025.json';
import sphlSchedule2025 from '@/assets/data/sphlSchedule2025.json';
import fphlSchedule from '@/assets/data/fphlSchedule.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import nahlSchedule from '@/assets/data/nahlSchedule.json';
import na3hlSchedule2025 from '@/assets/data/na3hlSchedule2025.json';
import ncaaD1Schedule from '@/assets/data/ncaaD1Schedule.json';
import ncaaD2Schedule from '@/assets/data/ncaaD2Schedule.json';
import pwhlSchedule from '@/assets/data/pwhlSchedule.json';
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';

export default function ArenaScreen() {
  const { arenaId } = useLocalSearchParams();
  const router = useRouter();
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'miles' | 'km'>('miles');
  const [visitCount, setVisitCount] = useState(0);
  const [lastVisitDate, setLastVisitDate] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
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

        // Get all past names for this arena
        const historyEntry = arenaHistoryData.find(
          h => h.currentArena === arena.arena
        );
        const oldNames = historyEntry
          ? historyEntry.history.map(h => h.name)
          : [];

        // Build query that matches current name OR any old name
        const q = query(
          collection(db, 'profiles', user.uid, 'checkins'),
          where('arenaName', 'in', [arena.arena, ...oldNames])
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setVisitCount(0);
          setLastVisitDate(null);
          return;
        }

        setVisitCount(snapshot.size);

        const gameDates = snapshot.docs
          .map(doc => {
            const gameDateStr = doc.data().gameDate;
            if (!gameDateStr) return null;
            const date = new Date(gameDateStr);
            return isNaN(date.getTime()) ? null : date;
          })
          .filter(date => date !== null);

        const sorted = gameDates.sort((a, b) => b.getTime() - a.getTime());
        setLastVisitDate(sorted[0] || null);
      } catch (err) {
        console.log('Firestore error:', err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [arena, auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsub = onSnapshot(doc(db, 'profiles', auth.currentUser.uid), snap => {
      if (snap.exists()) {
        setDistanceUnit(snap.data().distanceUnit === 'km' ? 'km' : 'miles');
      }
    });

    return () => unsub();
  }, []);

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
    ...khlSchedule.map((game) => ({
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
...fphlSchedule.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...nahlSchedule.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...na3hlSchedule2025.map((game) => ({
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
    ...qmjhlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...ncaaD1Schedule.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...ncaaD2Schedule.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.arena,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
    ...pwhlSchedule.map((game) => ({
      id: game.id,
      league: game.league,
      date: game.date,
      arena: game.arena,
      homeTeam: teamCodeMap[`${game.league}_${game.team}`] || game.team,
      awayTeam: teamCodeMap[`${game.league}_${game.opponent}`] || game.opponent,
    })),
    ...aihlSchedule2025.map((game) => ({
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

  const lightColor = `${arena.colorCode}66`;
  const borderColor =
    colorScheme === 'dark'
      ? '#FFFFFF'
      : (arena.colorCode2 || arena.colorCode);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = distanceUnit === 'km' ? 6371 : 3958.8; // Earth radius in km or miles
    const toRad = n => n * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckingIn(false);
        setAlertMessage('Location permission is required to check in.');
        setAlertVisible(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        maximumAge: 15000,
      });

      const distance = getDistance(
        location.coords.latitude,
        location.coords.longitude,
        arena.latitude,
        arena.longitude
      );

      const threshold = distanceUnit === 'km' ? 0.45 : 0.28;
      const unit = distanceUnit === 'km' ? 'km' : 'miles';

      if (distance > threshold) {
        setCheckingIn(false);
        setAlertMessage(
          `You're ${distance.toFixed(2)} ${unit} from ${arena.arena}.\nGet closer to check in!`
        );
        setAlertVisible(true);
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

    } catch {
      setCheckingIn(false);
      setAlertMessage('Could not get your location. Try again.');
      setAlertVisible(true);
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

      const totalSeconds = Math.floor(diff / 1000);

      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;

      let display = '';

      if (days > 0) {
        display = `${days}d ${hours}${hours !== 1 ? 'h' : 'h'} ${minutes}${minutes !== 1 ? 'm' : 'm'}`;
      } else if (hours > 0) {
        display = `${hours}${hours !== 1 ? 'h' : 'h'} ${minutes}${minutes !== 1 ? 'm' : 'm'}`;
      } else if (minutes > 0) {
        display = `${minutes}${minutes !== 1 ? 'm' : 'm'} ${seconds}${seconds !== 1 ? 's' : 's'}`;
      } else {
        display = `${seconds}${seconds !== 1 ? 's' : 's'}`;
      }

      setTimeLeft(display);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [upcomingGames]);

  const styles = StyleSheet.create({
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937', fontWeight: '700', fontSize: 16 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    arenaName: { fontSize: 28, top: 10, fontWeight: 'bold', color: '#fff', textAlign: 'center', },
    backButton: { position: 'absolute', left: 10, zIndex: 10, borderRadius: 20, padding: 8, },
    button: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF' , marginHorizontal: 90, paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginTop: 10, borderWidth: 2, borderColor: '#2F4F68', },
    buttonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FA', },
    container: { paddingBottom: 80, backgroundColor: 'transparent', },
    countdownBox: { backgroundColor: '#0A2940', alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 0, borderRadius: 14, marginBottom: 16, minWidth: 150, minHeight: 75, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 12, borderWidth: 1, },
    countdownLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', marginTop: -10, opacity: 0.9, },
    countdownNumber: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 46, },
    errorText: { fontSize: 18, color: 'red', },
    gameCard: { marginBottom: 12, },
    gameText: { fontSize: 14, color: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937', textAlign: 'center' },
    gameTextBold: { fontSize: 16, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center' },
    header: { padding: 34, alignItems: 'center', fontWeight: 'bold', color: '#0D2C42', marginBottom: 15, textAlign: 'center', },
    infoBox: { backgroundColor: 'rgba(255,255,255,0.95)', margin: 4, padding: 16, marginHorizontal: 20, borderRadius: 12, borderWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, alignItems: 'center', },
    label: { fontSize: 14, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: 'bold', marginTop: 12 },
    lastVisitText: { marginTop: 0, fontSize: 12, color: colorScheme === 'dark' ? '#FFFFFF' : '#475569' },
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999, justifyContent: 'center', alignItems: 'center', },
    section: { marginTop: 30, marginHorizontal: 20, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginBottom: 12, textAlign: 'center' },
    statCard: { marginHorizontal: 20, marginTop: 8, marginBottom: 8, paddingVertical: 20, borderRadius: 60, alignItems: 'center', width: 120, alignSelf: 'center', borderWidth: 4, borderColor: colorScheme === 'dark' ? lightColor : (arena.colorCode || '#0D2C42') },
    statLabel: { marginTop: 4, fontSize: 12, color: colorScheme === 'dark' ? '#FFFFFF' : '#334155', letterSpacing: 0.3 },
    statNumber: { fontSize: 28, fontWeight: '800', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', lineHeight: 24 },
    value: { fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937', textAlign: 'center' },
  });

  return (
    <ImageBackground
      source={colorScheme === 'dark' ? require('@/assets/images/background_inside_arena_dark.jpg') : require('@/assets/images/background_inside_arena.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* CUSTOM THEMED ALERT MODAL */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>Not Close Enough</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
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

      {checkingIn && (
        <View style={styles.loadingOverlay}>
          <LoadingPuck size={140} />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container}>
        {/* ← BACK BUTTON GOES RIGHT HERE */}
        <TouchableOpacity
          style={[
            styles.backButton,
            { top: insets.top + 10 }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={[styles.header, { backgroundColor: arena.colorCode || '#0A2940' }]}>
          <Text style={styles.arenaName}>{arena.arena}</Text>
        </View>

        <View style={[styles.statCard, { height: 120 }]}>
        {/* Solid background */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colorScheme === 'dark' ? (arena.colorCode || '#0D2C42') : '#FFFFFF',
            borderRadius: 60,
          }} />
        {/* White border layer in dark mode */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'transparent',
            borderRadius: 60,
            height: 120,
            width: 120,
            marginTop: -4,
            marginLeft: -4,
            borderWidth: colorScheme === 'dark' ? 4 : 0.1,
            borderColor: '#FFFFFF',
          }} />
        {/* Light tint overlay on top */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: lightColor,
            opacity: colorScheme === 'dark' ? 0 : 0.3,  // dark mode doesn't need tint here
            borderRadius: 60,
          }} />
          {loading ? (
            <View style={{ justifyContent: "center", alignItems: "center", flex: 1 }}>
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

        <View style={[styles.infoBox, { borderColor }]}>

        {/* Solid background */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colorScheme === 'dark' ? (arena.colorCode || '#0D2C42') : '#FFFFFF',
            borderRadius: 12,
          }} />
          {/* White border layer in dark mode */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'transparent',
            borderRadius: 12,
            borderWidth: colorScheme === 'dark' ? 1 : 0,
            borderColor: '#FFFFFF',
          }} />
          {/* Light tint overlay on top */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: lightColor,
            borderRadius: 8,
          }} />
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{arena.address}</Text>

          <Text style={styles.label}>Teams</Text>
          {arenaData
            .filter(a => a.arena.trim().toLowerCase() === arena.arena.trim().toLowerCase())
            .map((a, index) => (
              <Text key={index} style={styles.value}>
                {a.teamName}
              </Text>
            ))}

          <Text style={styles.label}>Leagues</Text>
          {arenaData
            .filter(a => a.arena.trim().toLowerCase() === arena.arena.trim().toLowerCase())
            .map((a, index) => (
              <Text key={index} style={styles.value}>
                {a.league}
              </Text>
            ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleDirections}>
          <Text style={styles.buttonText}>Get Directions</Text>
        </TouchableOpacity>

        {upcomingGames.length === 0 && (
          <View style={[styles.section, { borderColor }]}>
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: colorScheme === 'dark' ? (arena.colorCode || '#0D2C42') : '#FFFFFF',
              borderRadius: 12,
            }} />
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: lightColor,
              opacity: 0.9,
              borderRadius: 12,
            }} />
            <Text style={styles.sectionTitle}>Upcoming Games</Text>
            <Text style={styles.value}>No Upcoming Games</Text>
          </View>
        )}

        {upcomingGames.length > 0 && (
          <View style={[styles.section, { borderColor }]}>
          {/* Solid background */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: colorScheme === 'dark' ? (arena.colorCode || '#0D2C42') : '#FFFFFF',
              borderRadius: 12,
            }} />

            {/* White border layer in dark mode */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'transparent',
              borderRadius: 12,
              borderWidth: colorScheme === 'dark' ? 1 : 0,
              borderColor: '#FFFFFF',
            }} />

            {/* Light tint overlay on top */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: lightColor,
              opacity: colorScheme === 'dark' ? 0 : 0.9,
              borderRadius: 8,
            }} />
            <Text style={styles.sectionTitle}>Upcoming Games</Text>

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

        <TouchableOpacity
          style={styles.button}
          onPress={handleCheckIn}
          disabled={checkingIn}
        >
          <Text style={styles.buttonText}>
            {checkingIn ? 'Checking in...' : 'Check-in to live game'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ImageBackground>
  );
}