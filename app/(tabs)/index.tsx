import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, ImageBackground, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View, LayoutAnimation, } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // install this package
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import arenaData from '@/assets/data/arenas.json';
import nhlSchedule2025 from '@/assets/data/nhlSchedule2025.json';
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';
import ahlSchedule2025 from '@/assets/data/ahlSchedule2025.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';


export default function HomeScreen() {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('All Groups');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
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
    ...aihlSchedule2025.map(game => ({
      id: `${game.homeTeam}_${game.awayTeam}_${game.date}`,
      league: game.league,
      team: game.homeTeam,
      opponent: game.awayTeam,
      arena: game.location,
      city: '',
      date: game.date,
    })),
  ];

  const filteredGames = combinedSchedule
    .filter(game => new Date(game.date).toDateString() === today)
    .filter(game => !selectedLeague || game.league === selectedLeague);

  const leagueGroups = [
    {
      title: 'Major Professinal',
      leagues: [
        { name: 'NHL', logo: require('@/assets/images/puck_logo_nhl.png') },
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
      ],
    },
    {
      title: 'Oceania Hockey',
      leagues: [
        { name: 'AIHL', logo: require('@/assets/images/puck_logo_aihl.png') },
      ],
    },
  ];

  // Prepare leagues to display based on selectedGroup
  const leaguesToShow =
    selectedGroup === 'All Groups'
      ? leagueGroups.flatMap(g => g.leagues)
      : leagueGroups.find(g => g.title === selectedGroup)?.leagues || [];

  const handleDirections = (arenaName) => {
    const arenaInfo = arenaData.find(a => a.arena === arenaName);
    if (!arenaInfo) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${arenaInfo.latitude},${arenaInfo.longitude}`;
    Linking.openURL(url);
  };

  const handleCheckIn = (game) => {
    router.push({
      pathname: '/checkin/live',
      params: {
        arenaId: `${arenaData.find(a => a.arena === game.arena)?.latitude.toFixed(6)}_${arenaData.find(a => a.arena === game.arena)?.longitude.toFixed(6)}`,
        arena: game.arena,
        latitude: arenaData.find(a => a.arena === game.arena)?.latitude,
        longitude: arenaData.find(a => a.arena === game.arena)?.longitude,
        league: game.league,
      },
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.innerContainer}>
            <Text style={styles.header}>My Hockey Passport</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Closest Arenas</Text>
              {!location ? (
                <Text style={styles.placeholder}>Detecting location...</Text>
              ) : (
                arenaData
                  .map((arena) => ({
                    ...arena,
                    distance: getDistanceFromLatLonInKm(
                      location.latitude,
                      location.longitude,
                      arena.latitude,
                      arena.longitude
                    ),
                  }))
                  .sort((a, b) => a.distance - b.distance)
                  .slice(0, 5)
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
                      <Text style={styles.cardText}>
                        {arena.arena} – {arena.city} ({arena.distance.toFixed(1)} km)
                      </Text>
                    </TouchableOpacity>
                  ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Games</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueFilter}>
                <TouchableOpacity onPress={() => setSelectedLeague(null)} style={styles.filterChip}>
                  <Text style={styles.filterChipText}>All</Text>
                </TouchableOpacity>
                {leagueGroups.flatMap(group => group.leagues).map((league) => (
                  <TouchableOpacity key={league.name} onPress={() => setSelectedLeague(league.name)} style={styles.filterChip}>
                    <Text style={styles.filterChipText}>{league.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredGames.length === 0 ? (
                <Text style={styles.placeholder}>No games scheduled for today.</Text>
              ) : (
                filteredGames.map((game) => (
                  <TouchableOpacity key={game.id} style={styles.gameCard}>
                    <Text style={styles.cardText}>{game.team} vs {game.opponent}</Text>
                    <Text style={styles.cardText}>{game.arena}</Text>
                    <Text style={styles.cardText}>{format(new Date(game.date), "h:mm a")}</Text>

                    <View style={styles.buttonsRow}>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => handleDirections(game.arena)}
                      >
                        <Text style={styles.smallButtonText}>Get Directions</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => handleCheckIn(game)}
                      >
                        <Text style={styles.smallButtonText}>Check In</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Dropdown to select league group */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Explore Leagues</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedGroup}
                  onValueChange={(itemValue) => setSelectedGroup(itemValue)}
                  mode="dropdown"
                >
                  <Picker.Item label="All Groups" value="All Groups" />
                  {leagueGroups.map(group => (
                    <Picker.Item key={group.title} label={group.title} value={group.title} />
                  ))}
                </Picker>
              </View>

              {/* Show leagues for selected group in grid */}
              <FlatList
                data={leaguesToShow}
                keyExtractor={(item) => item.name}
                numColumns={3}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}     // 👈 ADD THIS
                contentContainerStyle={styles.leagueGrid}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.leagueGridItem}
                    onPress={() => router.push(`/leagues/${item.name}`)}
                  >
                    <Image source={item.logo} style={styles.leagueLogo} resizeMode="contain" />
                    <Text style={styles.leagueName}>{item.name}</Text>
                  </TouchableOpacity>
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
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
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
  leagueList: {
    gap: 16,
    paddingHorizontal: 10,
  },
  leagueItem: {
    alignItems: 'center',
    marginRight: 16,
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
  logoPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: '#ddd',
    borderRadius: 20,
    marginRight: 12,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },

  leagueGrid: {
    paddingHorizontal: 5,
    gap: 16,
  },

  leagueGridItem: {
    flex: 1,
    maxWidth: '33%',
    alignItems: 'center',
    marginVertical: 10,
  },
});




