//(tabs)/index.tsx
import { format } from 'date-fns';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, ImageBackground, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebaseConfig';

import LoadingPuck from '@/components/loadingPuck';
import arenaData from '@/assets/data/arenas.json';
import nhlSchedule2025 from '@/assets/data/nhlSchedule2025.json';
import ahlSchedule2025 from '@/assets/data/ahlSchedule2025.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';
import ohlSchedule2025 from '@/assets/data/ohlSchedule2025.json';
import sphlSchedule2025 from '@/assets/data/sphlSchedule2025.json';
import na3hlSchedule2025 from '@/assets/data/na3hlSchedule2025.json';
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';
import leaguesData from '@/assets/data/leagues.json';

const auth = getAuth();

export default function HomeScreen() {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('All Groups');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [nextPuckDrop, setNextPuckDrop] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'miles' | 'km'>('miles');

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();

      // Look in ALL games (not just today)
      const upcoming = combinedSchedule
        .filter(g => new Date(g.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

      if (!upcoming) {
        setNextPuckDrop('No games scheduled');
        return;
      }

      const diff = new Date(upcoming.date) - now;

      if (diff > 5 * 60 * 1000) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setNextPuckDrop(`${hours}h ${minutes}m until next puck drop!`);
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setNextPuckDrop(`Next puck drop in: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // every second when <5 min

    return () => clearInterval(interval);
  }, [combinedSchedule]);

  useEffect(() => {
    // Load saved league on start
    const loadSavedLeague = async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedLeague');
        if (saved) setSelectedLeague(saved);
      } catch (e) {
      }
    };
    loadSavedLeague();
  }, []);

  useEffect(() => {
    const saveSelectedLeague = async () => {
      try {
        if (selectedLeague === null) {
          await AsyncStorage.removeItem('selectedLeague');
        } else {
          await AsyncStorage.setItem('selectedLeague', selectedLeague);
        }
      } catch (e) {
        console.log('Failed to save selected league:', e);
      }
    };

    saveSelectedLeague();
  }, [selectedLeague]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unitDoc = doc(db, 'profiles', auth.currentUser.uid);

    const unsub = onSnapshot(unitDoc, (snap) => {
      if (snap.exists()) {
        const unit = snap.data().distanceUnit;
        if (unit === 'km') {
          setDistanceUnit('km');
        } else {
          setDistanceUnit('miles');
        }
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const loadDistanceUnit = async () => {
      if (!auth.currentUser) return;
      const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      if (docSnap.exists()) {
        const unit = docSnap.data().distanceUnit;
        if (unit === 'km') {
          setDistanceUnit('km');
        } else {
          setDistanceUnit('miles');
        }
      }
    };
    loadDistanceUnit();
  }, []);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = distanceUnit === 'km' ? 6371 : 3958.8; // Earth radius in km or miles
    const toRad = (n) => (n * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const today = new Date().toDateString();

  const combinedSchedule = [
    ...nhlSchedule2025,
    ...ushlSchedule2025,
    ...ahlSchedule2025,
    ...echlSchedule2025,
    ...whlSchedule2025,
    ...ohlSchedule2025,
    ...sphlSchedule2025,
    ...na3hlSchedule2025,
    ...aihlSchedule2025.map(game => ({
      id: `${game.homeTeam}_${game.awayTeam}_${game.date}`,
      league: game.league,
      homeTeam: game.homeTeam,
      opponent: game.awayTeam,
      arena: game.location,
      city: '',
      date: game.date,
    })),
  ];

  const now = Date.now();
  const liveBufferMs = 3 * 60 * 60 * 1000; // 3 hours — adjust if you want shorter/longer

  const filteredGames = useMemo(() => {
    return combinedSchedule
      .filter(game => {
        const gameTime = new Date(game.date).getTime();
        const gameDay = new Date(game.date).toDateString();
        return gameDay === today && gameTime >= (now - liveBufferMs);
      })
      .filter(game => !selectedLeague || game.league === selectedLeague)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [today, selectedLeague]);

  const leagueGroups = [
    {
      title: 'Major Professional',
      leagues: [
        { name: 'NHL', logo: require('@/assets/images/puck_logo_nhl.png') },
        { name: 'KHL', logo: require('@/assets/images/puck_logo_khl.png') },
      ],
    },
    {
      title: 'Minor Professional',
      leagues: [
        { name: 'AHL', logo: require('@/assets/images/puck_logo_ahl.png') },
        { name: 'ECHL', logo: require('@/assets/images/puck_logo_echl.png') },
        { name: 'SPHL', logo: require('@/assets/images/puck_logo_sphl.png') },
        { name: 'FPHL', logo: require('@/assets/images/puck_logo_fphl.png') },
      ],
    },
    {
      title: 'Canadian Hockey League',
      leagues: [
        { name: 'OHL', logo: require('@/assets/images/puck_logo_ohl.png') },
        { name: 'QMJHL', logo: require('@/assets/images/puck_logo_qmjhl.png') },
        { name: 'WHL', logo: require('@/assets/images/puck_logo_whl.png') },
      ],
    },
    {
      title: 'USA Hockey Junior Leagues',
      leagues: [
        { name: 'USHL', logo: require('@/assets/images/puck_logo_ushl.png') },
        { name: 'NAHL', logo: require('@/assets/images/puck_logo_nahl.png') },
        { name: 'NA3HL', logo: require('@/assets/images/puck_logo_na3hl.png') },
      ],
    },
    {
      title: 'NCAA College Hockey',
      leagues: [
        { name: 'NCAA DIVISION I', logo: require('@/assets/images/puck_logo_ncaadiv1.png') },
        { name: 'NCAA DIVISION II', logo: require('@/assets/images/puck_logo_ncaadiv2.png') },
      ],
    },
    {
      title: 'European Hockey',
      leagues: [
        { name: 'SHL', logo: require('@/assets/images/puck_logo_shl.png') },
        { name: 'HockeyAllsvenskan', logo: require('@/assets/images/puck_logo_HockeyAllsvenskan.png') },
        { name: 'NL', logo: require('@/assets/images/puck_logo_nl.png') },
        { name: 'LIIGA', logo: require('@/assets/images/puck_logo_liiga.png') },
        { name: 'DEL', logo: require('@/assets/images/puck_logo_del.png') },
        { name: 'ELH', logo: require('@/assets/images/puck_logo_elh.png') },
        { name: 'ICEHL', logo: require('@/assets/images/puck_logo_icehl.png') },
        { name: 'Slovak Extraliga', logo: require('@/assets/images/puck_logo_Slovakextraliga.png') },
        { name: 'EHL', logo: require('@/assets/images/puck_logo_ehl.png') },
      ],
    },
    {
      title: 'Oceania Hockey',
      leagues: [
        { name: 'AIHL', logo: require('@/assets/images/puck_logo_aihl.png') },
      ],
    },
  ];

  const leaguesToShow = useMemo(() => {
      return selectedGroup === 'All Groups'
        ? leagueGroups.flatMap(g => g.leagues)
        : leagueGroups.find(g => g.title === selectedGroup)?.leagues || [];
    }, [selectedGroup]);

  const handleDirections = (arenaName) => {
    if (!arenaName) return;

    // Normalize both input and DB entries
    const normalize = (str) =>
      str.normalize('NFD')                    // Decompose accented chars
         .replace(/[\u0300-\u036f]/g, '')     // Remove accents
         .toLowerCase()
         .trim();

    const normalizedInput = normalize(arenaName);

    const arenaInfo = arenaData.find(a => {
      const normalizedDB = normalize(a.arena);
      return normalizedDB === normalizedInput ||
             normalizedDB.includes(normalizedInput) ||
             normalizedInput.includes(normalizedDB.split(' (')[0]);
    });

    if (!arenaInfo) {
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${arenaInfo.latitude},${arenaInfo.longitude}`;
    Linking.openURL(url).catch(err => console.log('Linking error:', err));
  };

  const handleCheckIn = (game) => {
    router.push({
      pathname: '/checkin/live',
      params: {
        league: game.league,
        arenaName: game.arena,
        homeTeam: game.homeTeam || game.team,   // supports both JSON formats
        opponent: game.opponent || game.awayTeam,
        gameDate: game.date,
      },
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >

      {/* 🔥 Loading overlay appears above the entire screen */}
      {checkingIn && (

        <View style={styles.loadingOverlay}>
          <LoadingPuck />
        </View>
      )}

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.innerContainer}>
            <Text style={styles.header}>My Hockey Passport</Text>

            {/* Closest Arenas */}
            <View key="closest-arenas" style={styles.section}>
              <Text style={styles.sectionTitle}>Closest Arenas</Text>
              {location ? (
                <>
                  {arenaData
                    .map((arena) => ({
                      ...arena,
                      distance: getDistance(
                        location.latitude,
                        location.longitude,
                        arena.latitude,
                        arena.longitude
                      ),
                    }))
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, 3)
                    .map((arena, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.arenaCard}
                        onPress={() =>
                          router.push({
                            pathname: '/arenas/[arenaId]',
                            params: {
                              arenaId: `${arena.latitude.toFixed(6)}_${arena.longitude.toFixed(6)}`,
                            },
                          })
                        }
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.cardText, { flex: 1 }]}>
                            {arena.arena} – {arena.city}
                          </Text>
                          <Text style={{ fontWeight: 'bold', color: '#0D2C42' }}>
                            {Math.round(arena.distance) === arena.distance
                              ? Math.round(arena.distance)
                              : arena.distance.toFixed(1)}{' '}
                            {distanceUnit === 'km' ? 'km' : 'mi'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </>
              ) : (
                <Animated.Text style={[styles.placeholder, { opacity: fadeAnim }]}>
                  Detecting location...
                </Animated.Text>
              )}
            </View>

            {/* Today's Games */}
            <View key="todays-games" style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Games</Text>

              <Text style={[styles.countdownMini, nextPuckDrop.includes(':') && styles.countdownLive]}>
                {nextPuckDrop || 'Loading...'}
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueFilter}>
                <TouchableOpacity onPress={() => setSelectedLeague(null)} style={[styles.filterChip, selectedLeague === null && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, selectedLeague === null && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>

                {leagueGroups.flatMap(group => group.leagues).map((league) => (
                  <TouchableOpacity key={league.name} onPress={() => setSelectedLeague(league.name)} style={[styles.filterChip, selectedLeague === league.name && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, selectedLeague === league.name && styles.filterChipTextActive]}>{league.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredGames.length === 0 ? (
                <Text style={styles.placeholder}>No games scheduled for today.</Text>
              ) : (
                filteredGames.map((game) => (
                  <View key={game.id} style={styles.gameCard}>
                    <View>
                      <Text style={styles.cardText}>{(game.homeTeam || game.team)} vs {game.opponent || game.awayTeam}</Text>
                      <Text style={styles.cardText}>{game.arena}</Text>
                      <Text style={styles.cardText}>{format(new Date(game.date), "h:mm a")}</Text>
                    </View>

                    <View style={styles.buttonsRow}>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => handleDirections(game.arena)}
                        accessibilityLabel={`Get directions to ${game.arena}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.smallButtonText}>Get Directions</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={async () => {
                          setCheckingIn(true);
                          try {
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            if (status !== 'granted') {
                              setCheckingIn(false);
                              Alert.alert('Permission denied', 'Location is required to check in.');
                              return;
                            }

                            const location = await Location.getCurrentPositionAsync({
                              accuracy: Location.Accuracy.Lowest, // FASTER
                              maximumAge: 10000,                  // Use cached if <10 sec old
                              timeout: 5000,                      // Cut stall time
                            });

                            const arena = arenaData.find(a =>
                              (a.arena === game.arena || a.arena === game.location) &&
                              a.league === game.league
                            );

                            if (!arena) {
                              setCheckingIn(false);
                              Alert.alert('Error', 'Arena not found for this game.');
                              return;
                            }

                            const distance = getDistance(
                              location.coords.latitude,
                              location.coords.longitude,
                              arena.latitude,
                              arena.longitude
                            );

                            const maxDistance = distanceUnit === 'km' ? 0.45 : 0.28; // 0.45 km ≈ 0.28 miles

                            if (distance > maxDistance) {
                              setCheckingIn(false);
                              Alert.alert(
                                'Cannot check in yet',
                                'Not close enough to the arena. You need to be at the arena.'
                              );
                              return;
                            }

                            setCheckingIn(false);
                            handleCheckIn(game);
                          } catch (error) {
                            setCheckingIn(false);
                            Alert.alert('Location failed', 'Could not get your location. Try again.');
                          }
                        }}
                      >
                        <Text style={styles.smallButtonText}>Check-in</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Explore Leagues */}
            <View key="explore-leagues" style={styles.section}>
              <Text style={styles.sectionTitle}>Explore Leagues</Text>
              <View style={[
                styles.pickerContainer,
                selectedGroup === 'All Groups' && styles.pickerContainerActive
              ]}>
                <Picker
                  selectedValue={selectedGroup}
                  onValueChange={(itemValue) => setSelectedGroup(itemValue)}
                  mode="dropdown"
                  style={styles.picker}
                >
                  <Picker.Item label="All Groups" value="All Groups" />
                  {leagueGroups.map(group => (
                    <Picker.Item key={group.title} label={group.title} value={group.title} />
                  ))}
                </Picker>
              </View>

              <FlatList
                data={leaguesToShow}
                keyExtractor={(item) => item.name}
                numColumns={3}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                contentContainerStyle={styles.leagueGrid}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.leagueGridItem,
                      pressed && styles.leagueGridItemPressed
                    ]}
                    onPress={() => router.push(`/leagues/${item.name}`)}
                  >
                    <Image source={item.logo} style={styles.leagueLogo} resizeMode="contain" />
                    <Text style={styles.leagueName}>{item.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    paddingTop: Constants.statusBarHeight + 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: Dimensions.get('window').height,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
  },
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
    marginBottom: 30,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 4,
    borderColor: '#0D2C42',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 10,
    textAlign: 'center',
  },
  placeholder: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  arenaCard: {
    backgroundColor: '#E0E7FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  cardText: {
    fontSize: 16,
    color: '#0A2940',
    textAlign: 'center',
  },
  cardTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A2940',
  },
  gameCard: {
    flexDirection: 'column',
    backgroundColor: '#F0F4F8',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  leagueFilter: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  filterChip: {
    backgroundColor: '#E0E7FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    color: '#1E3A8A',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  smallButton: {
    backgroundColor: '#0A2940',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#2F4F68',
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerContainer: {
    height: 40,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leagueGrid: {
    paddingHorizontal: 8,
    rowGap: 16,
    columnGap: 8,
  },
  leagueGridItem: {
    flex: 1,
    maxWidth: '33.33%',
    minWidth: 80,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  leagueGridItemPressed: {
    transform: [{ scale: 0.95 }],
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  leagueLogo: {
    width: 60,
    height: 60,
    marginBottom: 6,
  },
  leagueName: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  filterChipActive: {
    backgroundColor: '#0A2940',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countdownMini: { fontSize: 14, fontWeight: '600', color: '#0A2940', textAlign: 'center', marginBottom: 10, opacity: 0.9, },
  countdownLive: { fontSize: 24, fontWeight: '900', color: '#D32F2F', letterSpacing: 2, fontVariant: ['tabular-nums'], },
  picker: { width: '100%', height: 56, fontSize: 16, color: '#000', backgroundColor: 'white', paddingHorizontal: 0, textAlign: 'center', },
  pickerContainerActive: { backgroundColor: '#E0E7FF', borderColor: '#0D2C42', },
  loadingOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 999, },
});