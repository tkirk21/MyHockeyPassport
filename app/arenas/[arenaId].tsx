//VERSION 2 - 8am 9TH AUGUST
//[arenaID.tsx]
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import arenaData from '@/assets/data/arenas.json';
import nhlSchedule2025 from "@/assets/data/nhlSchedule2025.json";
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where, } from 'firebase/firestore';
import firebaseApp from '@/firebaseConfig';

export default function ArenaScreen() {
  const { arenaId } = useLocalSearchParams();
  const router = useRouter();
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;
      if (!user || !arena) {
        return;
      }

      const arenaName = arena.arena;
      const league = arena.league;

      try {
        // A) Count all checkins for this user
        const qUser = query(
          collection(db, 'profiles', user.uid, 'checkins')
        );
        const sUser = await getDocs(qUser);

        // B) Checkins at this arena
        const qUserArena = query(
          collection(db, 'profiles', user.uid, 'checkins'),
          where('arenaName', '==', arenaName)
        );
        const sUserArena = await getDocs(qUserArena);

        // C) Checkins at this arena + league
        const qUserArenaLeague = query(
          collection(db, 'profiles', user.uid, 'checkins'),
          where('arenaName', '==', arenaName),
          where('league', '==', league)
        );
        const sUserArenaLeague = await getDocs(qUserArenaLeague);

        // Pick the most specific result
        if (sUserArenaLeague.size > 0) {
          setVisitCount(sUserArenaLeague.size);
        } else if (sUserArena.size > 0) {
          setVisitCount(sUserArena.size);
        } else {
          setVisitCount(0);
        }
      } catch (err) {
        console.log('❌ Firestore query error:', err);
      }
    };

    run();
  }, [arena?.arena, arena?.league]);


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

  const teamCodeMap = Object.fromEntries(
    arenaData.map((a) => [`${a.league}_${a.teamCode}`, a.teamName])
  );

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
    ...aihlSchedule2025.map((game) => ({
      id: `${game.team}_${game.opponent}_${game.date}`,
      league: game.league,
      arena: game.location,
      date: game.date,
      homeTeam: game.team,
      awayTeam: game.opponent,
    })),
  ];


  // Filter & sort upcoming games at this arena
  const upcomingGames = combinedSchedule
    .filter((game) => game.arena === arena.arena && new Date(game.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  const lightColor = `${arena.colorCode}22`; // light transparent tint

  const handleCheckIn = () => {
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
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.header, { backgroundColor: arena.colorCode || '#0A2940' }]}>
        <Text style={styles.arenaName}>{arena.arena}</Text>
      </View>

      <View style={[styles.infoBox, { backgroundColor: lightColor }]}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{arena.address}</Text>

        <Text style={styles.label}>Team</Text>
        <Text style={styles.value}>{arena.teamName}</Text>

        <Text style={styles.label}>League</Text>
        <Text style={styles.value}>{arena.league}</Text>
      </View>

      <View style={[styles.statCard, { backgroundColor: lightColor }]}>
        <Text style={styles.statNumber}>{visitCount}</Text>
        <Text style={styles.statLabel}>Times Visited</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleDirections}>
        <Text style={styles.buttonText}>Get Directions</Text>
      </TouchableOpacity>

      {upcomingGames.length > 0 && (
        <View style={[styles.section, { backgroundColor: lightColor }]}>
          <Text style={styles.sectionTitle}>Upcoming Games</Text>
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
      <TouchableOpacity style={styles.checkinButton} onPress={handleCheckIn}>
        <Text style={styles.buttonText}>Check In at This Arena</Text>
      </TouchableOpacity>
    </ScrollView>
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
    padding: 24,
    alignItems: 'center',
  },
  arenaName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.95)', // will be overridden by lightColor
    margin: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center', // ✅ center all text
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
  },
  button: {
    backgroundColor: '#0A2940',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
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
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: 100,
    alignSelf: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0A2940',
    lineHeight: 32,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#334155',
    letterSpacing: 0.3,
  },
});


