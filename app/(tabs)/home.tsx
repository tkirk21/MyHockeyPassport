//(tabs)/home.tsx
import { format } from 'date-fns';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, ImageBackground, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';

import { useColorScheme } from '../../hooks/useColorScheme';
import LoadingPuck from '@/components/loadingPuck';
import arenaData from '@/assets/data/arenas.json';
import leaguesData from '@/assets/data/leagues.json';
import nhlSchedule2025 from '@/assets/data/nhlSchedule2025.json';
import ahlSchedule2025 from '@/assets/data/ahlSchedule2025.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';
import ohlSchedule2025 from '@/assets/data/ohlSchedule2025.json';
import sphlSchedule2025 from '@/assets/data/sphlSchedule2025.json';
import na3hlSchedule2025 from '@/assets/data/na3hlSchedule2025.json';
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';

const auth = getAuth();

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const backgroundSource = colorScheme === 'dark' ? require('../../assets/images/background_dark.jpg') : require('../../assets/images/background.jpg');
  const [location, setLocation] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('All Groups');
  const [exploreFilterMode, setExploreFilterMode] = useState('all');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [nextPuckDrop, setNextPuckDrop] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'miles' | 'km'>('miles');
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>([]);
  const today = new Date().toDateString();

  //Calculates distance between two coordinates in miles or km based on distanceUnit
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = distanceUnit === 'km' ? 6371 : 3958.8; // Earth radius
    const toRad = n => n * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  //Combines all league schedules into one array for today's games filtering
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
  const liveBufferMs = 3 * 60 * 60 * 1000;

  //Filters today's games from combinedSchedule by mode (all/favorites/league) and sorts by date
  const filteredGames = useMemo(() => {
    const games = combinedSchedule
      .filter(game => {
        const gameTime = new Date(game.date).getTime();
        return new Date(game.date).toDateString() === today && gameTime >= (now - liveBufferMs);
      });

    if (filterMode === 'favorites') {
      return games.filter(game => favoriteLeagues.includes(game.league)).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    if (filterMode === 'league' && selectedLeague) {
      return games.filter(game => game.league === selectedLeague).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    return games.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [today, selectedLeague, filterMode, favoriteLeagues, combinedSchedule, now, liveBufferMs]);

  //Groups leagues for Explore Leagues picker and grid
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
        { name: 'NCAA DIV I', logo: require('@/assets/images/puck_logo_ncaadiv1.png') },
        { name: 'NCAA DIV II', logo: require('@/assets/images/puck_logo_ncaadiv2.png') },
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

  // Memoized list of leagues to display in Explore Leagues grid (favorites or all/group)
  const leaguesToShow = useMemo(() => {
    if (exploreFilterMode === 'favorites') {
      return leagueGroups
        .flatMap(g => g.leagues)
        .filter(league => favoriteLeagues.includes(league.name));
    }

    return selectedGroup === 'All Groups'
      ? leagueGroups.flatMap(g => g.leagues)
      : leagueGroups.find(g => g.title === selectedGroup)?.leagues || [];
  }, [exploreFilterMode, selectedGroup, favoriteLeagues]);

  // Opens Google Maps directions to the arena (with accent-insensitive matching)
  const handleDirections = (arenaName) => {
    if (!arenaName) return;

    const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const normalizedInput = normalize(arenaName);

    const arenaInfo = arenaData.find(a => {
      const normalizedDB = normalize(a.arena);
      return normalizedDB === normalizedInput ||
             normalizedDB.includes(normalizedInput) ||
             normalizedInput.includes(normalizedDB.split(' (')[0]);
    });

    if (!arenaInfo) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${arenaInfo.latitude},${arenaInfo.longitude}`;
    Linking.openURL(url).catch(err => console.log('Linking error:', err));
  };

  // Navigates to live check-in screen with game details
  const handleCheckIn = (game) => {
    router.push({
      pathname: '/checkin/live',
      params: {
        league: game.league,
        arenaName: game.arena,
        homeTeam: game.homeTeam || game.team,
        opponent: game.opponent || game.awayTeam,
        gameDate: game.date,
      },
    });
  };

  //Redirects to user's saved startup tab on app resume
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    getDoc(doc(db, 'profiles', auth.currentUser.uid)).then(snap => {
      if (!snap.exists()) return;
      const saved = snap.data()?.startupTab;
      if (!saved || saved === 'home') return;
      const target = { profile: 'profile', checkin: 'checkin', map: 'map', friends: 'friends' }[saved];
      if (target) router.replace(`/${target}`);
    }).catch(e => console.log('Startup tab redirect failed:', e));
  }, []);

  //Pulsing fade animation for "Detecting location..." placeholder
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  //Requests location permission and gets current position on mount
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') Location.getCurrentPositionAsync({}).then(loc => setLocation(loc.coords));
    });
  }, []);

  //Loads saved Today's Games filter (All/Favorites/league) from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('gameFilterMode').then(savedMode => savedMode && setFilterMode(savedMode));
    AsyncStorage.getItem('selectedLeague').then(savedLeague => savedLeague && setSelectedLeague(savedLeague));
  }, []);

  //Saves Today's Games filter to AsyncStorage when filterMode or selectedLeague changes
  useEffect(() => {
    if (filterMode === 'all') {
      AsyncStorage.multiRemove(['gameFilterMode', 'selectedLeague']);
    } else if (filterMode === 'favorites') {
      AsyncStorage.setItem('gameFilterMode', 'favorites');
      AsyncStorage.removeItem('selectedLeague');
    } else if (filterMode === 'league') {
      AsyncStorage.multiSet([['gameFilterMode', 'league'], ['selectedLeague', selectedLeague || '']]);
    }
  }, [filterMode, selectedLeague]);

  //Updates "next puck drop" countdown every second based on combinedSchedule
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const upcoming = combinedSchedule
        .filter(g => new Date(g.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

      if (!upcoming) return setNextPuckDrop('No games scheduled');

      const diff = new Date(upcoming.date) - now;

      if (diff > 5 * 60 * 1000) {
        const hours = Math.floor(diff / (3600000));
        const minutes = Math.floor((diff % 3600000) / 60000);
        setNextPuckDrop(`${hours}h ${minutes}m until next puck drop!`);
      } else {
        const totalSeconds = Math.floor(diff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        setNextPuckDrop(`Next puck drop in: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [combinedSchedule]);

  // Loads saved selected league from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('selectedLeague').then(saved => saved && setSelectedLeague(saved));
  }, []);

  // Saves selected league to AsyncStorage when it changes
  useEffect(() => {
    selectedLeague === null
      ? AsyncStorage.removeItem('selectedLeague')
      : AsyncStorage.setItem('selectedLeague', selectedLeague);
  }, [selectedLeague]);

  // Listens for distance unit (miles/km) changes in user profile and updates state
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsub = onSnapshot(doc(db, 'profiles', auth.currentUser.uid), snap => {
      if (snap.exists()) {
        setDistanceUnit(snap.data().distanceUnit === 'km' ? 'km' : 'miles');
      }
    });

    return () => unsub();
  }, []);

  // Loads favorite leagues on mount and listens for real-time updates from Firestore
  useEffect(() => {
    if (!auth.currentUser) return;

    const profileRef = doc(db, 'profiles', auth.currentUser.uid);

    // Initial load
    getDoc(profileRef).then(snap => {
      if (snap.exists() && Array.isArray(snap.data()?.favoriteLeagues)) {
        setFavoriteLeagues(snap.data().favoriteLeagues);
      }
    });

    // Real-time listener
    const unsub = onSnapshot(profileRef, snap => {
      if (snap.exists() && Array.isArray(snap.data()?.favoriteLeagues)) {
        setFavoriteLeagues(snap.data().favoriteLeagues);
      }
    });

    return () => unsub();
  }, []);

  //Loads saved Explore Leagues filter (favorites or group) from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('exploreFilterMode').then(savedMode => {
      if (savedMode === 'favorites') {
        setExploreFilterMode('favorites');
      } else {
        setExploreFilterMode('all');
        AsyncStorage.getItem('exploreSelectedGroup').then(savedGroup => savedGroup && setSelectedGroup(savedGroup));
      }
    });
  }, []);

  //Saves Explore Leagues filter (favorites or selected group) to AsyncStorage when changed
  useEffect(() => {
    if (exploreFilterMode === 'favorites') {
      AsyncStorage.setItem('exploreFilterMode', 'favorites');
      AsyncStorage.removeItem('exploreSelectedGroup');
    } else {
      AsyncStorage.removeItem('exploreFilterMode');
      AsyncStorage.setItem('exploreSelectedGroup', selectedGroup);
    }
  }, [exploreFilterMode, selectedGroup]);

  //Loads distance unit (miles/km) from user profile on mount
  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'profiles', auth.currentUser.uid)).then(snap => {
      if (snap.exists()) setDistanceUnit(snap.data().distanceUnit === 'km' ? 'km' : 'miles');
    });
  }, []);

  const styles = StyleSheet.create({
    arenaCard: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#E0E7FF', padding: 12, borderRadius: 12, marginBottom: 12, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 6, },
    background: { flex: 1, width: '100%', height: '100%', },
    buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, },
    cardText: { fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', },
    cardTextBold: { fontSize: 16, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    countdownMini: { fontSize: 14, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 10, opacity: 0.9, },
    countdownLive: { fontSize: 24, fontWeight: '900', color: '#D32F2F', letterSpacing: 2, fontVariant: ['tabular-nums'], },
    distanceText: { fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', },
    header: { fontSize: 34, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginTop: -20, marginBottom: 15, textAlign: 'center', textShadowColor: colorScheme === 'dark' ? '#000000' : '#ffffff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, },
    hiddenPicker: { width: '100%', height: 56, opacity: 0 },
    filterChip: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#E0E7FF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, },
    filterChipActive: { backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    filterChipText: { fontSize: 14, color: colorScheme === 'dark' ? '#FFFFFF' : '#1E3A8A', },
    filterChipTextActive: { color: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', fontWeight: '700', },
    gameCard: { flexDirection: 'column', backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#F0F4F8', padding: 12, borderRadius: 10, marginBottom: 10, width: '100%', },
    innerContainer: { paddingTop: Constants.statusBarHeight + 40, paddingHorizontal: 20, minHeight: Dimensions.get('window') },
    leagueFilter: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 10, },
    leagueGrid: { paddingHorizontal: 8, rowGap: 16, columnGap: 8, },
    leagueGridItem: { flex: 1, maxWidth: '33.33%', minWidth: 80, alignItems: 'center', paddingHorizontal: 4, },
    leagueGridItemPressed: { transform: [{ scale: 0.95 }], shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, },
    leagueLogo: { width: 60, height: 60, marginBottom: 6, },
    leagueName: { fontSize: 12, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', },
    loadingOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 999, },
    picker: { width: '100%', height: 56, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#000', backgroundColor: colorScheme === 'dark' ? '#0A2940' : 'white', paddingHorizontal: 0, textAlign: 'center', dropdownIconColor: colorScheme === 'dark' ? '#FFFFFF' : '#000', },
    pickerContainer: { height: 40, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#ccc', borderRadius: 12, overflow: 'hidden', marginBottom: 12, justifyContent: 'center', alignItems: 'center', },
    pickerContainerActive: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#E0E7FF', borderColor: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', },
    pickerOverlayTextContainer: { position: 'absolute', left: 12, right: 40, top: 0, bottom: 0, justifyContent: 'center' },
    pickerOverlayArrowContainer: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' },
    pickerSelectedText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16 },
    pickerArrow: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    placeholder: { fontSize: 16, color: colorScheme === 'dark' ? '#BBBBBB' : '#374151', textAlign: 'center', },
    scrollContainer: { flexGrow: 1, },
    section: { marginBottom: 30, backgroundColor: colorScheme === 'dark' ? 'rgba(10,41,64,0.9)' : 'rgba(255,255,255,0.85)', borderRadius: 12, padding: 12, borderWidth: 4, borderColor: '#0D2C42', },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#1E3A8A', marginBottom: 10, textAlign: 'center', },
    smallButton: { backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', flex: 1, marginHorizontal: 4, alignItems: 'center', },
    smallButtonText: { color: colorScheme === 'dark' ? '#0A2940' : '#fff', fontSize: 12, fontWeight: '600', },
  });

  return (
    <ImageBackground source={backgroundSource} style={styles.background} resizeMode="cover">

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
              {location ? arenaData
                .map(arena => ({ ...arena, distance: getDistance(location.latitude, location.longitude, arena.latitude, arena.longitude) }))
                .filter(arena => favoriteLeagues.length === 0 || favoriteLeagues.includes(arena.league))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 3)
                .map((arena, index) => (
                  <TouchableOpacity key={index} style={styles.arenaCard} onPress={() => router.push({ pathname: '/arenas/[arenaId]', params: { arenaId: `${arena.latitude.toFixed(6)}_${arena.longitude.toFixed(6)}` } })}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.cardText, { flex: 1 }]}>{arena.arena} – {arena.city}</Text>
                      <Text style={styles.distanceText}>
                        {Math.round(arena.distance) === arena.distance ? Math.round(arena.distance) : arena.distance.toFixed(1)} {distanceUnit === 'km' ? 'km' : 'mi'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )) : <Animated.Text style={[styles.placeholder, { opacity: fadeAnim }]}>Detecting location...</Animated.Text>}
            </View>

            {/* Today's Games */}
            <View key="todays-games" style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Games</Text>
              <Text style={[styles.countdownMini, nextPuckDrop.includes(':') && styles.countdownLive]}>
                {nextPuckDrop || 'Loading...'}
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueFilter}>
                <TouchableOpacity onPress={() => { setSelectedLeague(null); setFilterMode('all'); }} style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setFilterMode('favorites'); setSelectedLeague(null); }} style={[styles.filterChip, filterMode === 'favorites' && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, filterMode === 'favorites' && styles.filterChipTextActive]}>Favorites</Text>
                </TouchableOpacity>

                {leagueGroups.flatMap(group => group.leagues).map(league => (
                  <TouchableOpacity key={league.name} onPress={() => { setSelectedLeague(league.name); setFilterMode('league'); }} style={[styles.filterChip, selectedLeague === league.name && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, selectedLeague === league.name && styles.filterChipTextActive]}>{league.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredGames.length === 0 ? (
                <Text style={styles.placeholder}>No games scheduled for today.</Text>
              ) : filteredGames.map(game => (
                <View key={game.id} style={styles.gameCard}>
                  <View>
                    <Text style={styles.cardText}>{(game.homeTeam || game.team)} vs {game.opponent || game.awayTeam}</Text>
                    <Text style={styles.cardText}>{game.arena}</Text>
                    <Text style={styles.cardText}>{format(new Date(game.date), "h:mm a")}</Text>
                  </View>

                  <View style={styles.buttonsRow}>
                    <TouchableOpacity style={styles.smallButton} onPress={() => handleDirections(game.arena)}>
                      <Text style={styles.smallButtonText}>Get Directions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.smallButton} onPress={async () => {
                      setCheckingIn(true);
                      try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status !== 'granted') return setCheckingIn(false), Alert.alert('Permission denied', 'Location is required to check in.');
                        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest, maximumAge: 10000, timeout: 5000 });
                        const arena = arenaData.find(a => (a.arena === game.arena || a.arena === game.location) && a.league === game.league);
                        if (!arena) return setCheckingIn(false), Alert.alert('Error', 'Arena not found for this game.');
                        const distance = getDistance(location.coords.latitude, location.coords.longitude, arena.latitude, arena.longitude);
                        if (distance > (distanceUnit === 'km' ? 0.45 : 0.28)) return setCheckingIn(false), Alert.alert('Cannot check in yet', 'Not close enough to the arena. You need to be at the arena.');
                        setCheckingIn(false);
                        handleCheckIn(game);
                      } catch {
                        setCheckingIn(false);
                        Alert.alert('Location failed', 'Could not get your location. Try again.');
                      }
                    }}>
                      <Text style={styles.smallButtonText}>Check-in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Explore Leagues */}
            <View key="explore-leagues" style={styles.section}>
              <Text style={styles.sectionTitle}>Explore Leagues</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={exploreFilterMode === 'favorites' ? 'Favorites' : selectedGroup} onValueChange={itemValue => itemValue === 'Favorites' ? setExploreFilterMode('favorites') : (setExploreFilterMode('all'), setSelectedGroup(itemValue))} mode="dropdown" style={styles.hiddenPicker}>
                  <Picker.Item label="All Groups" value="All Groups" />
                  <Picker.Item label="Favorites" value="Favorites" />
                  {leagueGroups.map(group => <Picker.Item key={group.title} label={group.title} value={group.title} />)}
                </Picker>
                <View style={styles.pickerOverlayTextContainer}>
                  <Text style={styles.pickerSelectedText}>{exploreFilterMode === 'favorites' ? 'Favorites' : selectedGroup}</Text>
                </View>
                <View style={styles.pickerOverlayArrowContainer}>
                  <Ionicons name="chevron-down" size={24} style={styles.pickerArrow} />
                </View>
              </View>

              <FlatList data={leaguesToShow} keyExtractor={item => item.name} numColumns={3} showsVerticalScrollIndicator={false} scrollEnabled={false} contentContainerStyle={styles.leagueGrid} renderItem={({ item }) => (
                <Pressable style={({ pressed }) => [styles.leagueGridItem, pressed && styles.leagueGridItemPressed]} onPress={() => router.push(`/leagues/${item.name}`)}>
                  <Image source={item.logo} style={styles.leagueLogo} resizeMode="contain" />
                  <Text style={styles.leagueName}>{item.name}</Text>
                </Pressable>
              )} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}