// app/(tabs)/checkin.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
import { useColorScheme } from '../../hooks/useColorScheme';

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

export default function CheckInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [checkingIn, setCheckingIn] = useState(false);

  const handleLiveCheckIn = async () => {
    setCheckingIn(true);  // ← SHOW LOADING PUCK

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckingIn(false);
        Alert.alert('Permission required', 'Location permission is needed to check in to a live game.');
        return;
      }

      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        maximumAge: 10000,
        timeout: 5000,
      });

      const today = new Date().toDateString();
      const allGamesToday = [
        ...nhlSchedule2025,
        ...ahlSchedule2025,
        ...echlSchedule2025,
        ...sphlSchedule2025,
        ...ohlSchedule2025,
        ...whlSchedule2025,
        ...ushlSchedule2025,
        ...na3hlSchedule2025,
        ...aihlSchedule2025.map(g => ({ ...g, league: 'AIHL' })),
      ].filter(g => new Date(g.date).toDateString() === today);

      if (allGamesToday.length === 0) {
        setCheckingIn(false);
        Alert.alert('No games today', 'There are no games scheduled in any league today.');
        return;
      }

      let closestGame = null;
      let closestDistanceMiles = Infinity;

      for (const game of allGamesToday) {
        const arena = arenaData.find(a =>
          (a.arena === game.arena || a.arena === game.location) &&
          a.league === game.league
        );

        if (!arena) continue;

        const distanceMiles = getDistanceMiles(
          coords.latitude,
          coords.longitude,
          arena.latitude,
          arena.longitude
        );

        if (distanceMiles < closestDistanceMiles) {
          closestDistanceMiles = distanceMiles;
          closestGame = { ...game, arena };
        }
      }

      if (!closestGame || closestDistanceMiles > 0.28) {
        setCheckingIn(false);
        Alert.alert(
          'Not close enough',
          'You must be within 1500 feet of the arena to check-in.'
        );
        return;
      }

      setCheckingIn(false);
      router.push({
        pathname: '/checkin/live',
        params: {
          league: closestGame.league,
          arenaName: closestGame.arena.arena,
          homeTeam: closestGame.homeTeam || closestGame.team || '',
          opponent: closestGame.opponent || closestGame.awayTeam || '',
          gameDate: closestGame.date,
        },
      });

    } catch (err) {
      setCheckingIn(false);
      console.log('Location error:', err);
      Alert.alert('Location failed', 'Unable to get GPS location. Try again.');
    }
  };

  // Distance in miles
  const getDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  const styles = StyleSheet.create({
    buttons: { position: "absolute", bottom: 139, left: 24, right: 24, gap: 40, left: 70, right: 70, },
    buttonPrimary: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', paddingVertical: 16, borderRadius: 30, },
    buttonSecondary: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 16, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', borderRadius: 30, },
    buttonText: { fontSize: 16, color: colorScheme === 'dark' ? '#fff' : '#0A2940', fontWeight: "600", textAlign: "center", },
    container: { flex: 1, },
    heroImage: { position: "absolute", top: 130, width: Dimensions.get("window").width * 0.6, height: 160, alignSelf: "center", },
    header: { position: "absolute", top: 50, left: 0, right: 0, fontSize: 34, fontWeight: "bold", color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', textAlign: "center", textShadowColor: colorScheme === 'dark' ? '#000000' : '#ffffff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, },
    loadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 999, alignItems: "center", justifyContent: "center", },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(30, 30, 30, 0.1)", },
    subHeader: { position: "absolute", top: 100, left: 0, right: 0, fontSize: 16, color: colorScheme === 'dark' ? '#CCCCCC' : '#0A2940', textAlign: "center", },
  });

  return (
    <ImageBackground
      source={colorScheme === 'dark' ? require('../../assets/images/background_dark.jpg') : require('../../assets/images/background.jpg')}
      style={styles.container}
      resizeMode="cover"
    >

      {checkingIn && (
        <View style={styles.loadingOverlay}>
          <LoadingPuck />
        </View>
      )}

      <View style={styles.overlay} />

      <Text style={styles.header}>Check In</Text>
      <Text style={styles.subHeader}>Log your game experience</Text>
      <Image source={require('@/assets/images/checkin_icon.png')} style={styles.heroImage} resizeMode="contain" />

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.buttonPrimary} onPress={handleLiveCheckIn}>
          <Text style={styles.buttonText}>Check In to a Live Game</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.push('/checkin/manual')}>
          <Text style={styles.buttonText}>Add a Past Game</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}