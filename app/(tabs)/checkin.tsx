// app/(tabs)/checkin.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';

import LoadingPuck from '@/components/loadingPuck';
import arenaData from '@/assets/data/arenas.json';
import nhlSchedule2025 from '@/assets/data/nhlSchedule2025.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import ahlSchedule2025 from '@/assets/data/ahlSchedule2025.json';
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';

export default function CheckInScreen() {
  const router = useRouter();
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
        ...ushlSchedule2025,
        ...ahlSchedule2025,
        ...echlSchedule2025,
        ...whlSchedule2025,
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

  return (
    <ImageBackground
      source={require("@/assets/images/background.jpg")}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 30, 30, 0.1)",
  },
  header: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    fontSize: 34,
    fontWeight: "bold",
    color: "#0D2C42",
    textAlign: "center",
    textShadowColor: "#ffffff",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subHeader: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    fontSize: 16,
    color: "#0A2940",
    textAlign: "center",
  },
  heroImage: {
    position: "absolute",
    top: 130,
    width: Dimensions.get("window").width * 0.6,
    height: 160,
    alignSelf: "center",
  },
  buttons: {
    position: "absolute",
    bottom: 139,
    left: 24,
    right: 24,
    gap: 40,
    left: 70,     // ← this is what made them shorter
    right: 70,    // ← this too
  },

  buttonPrimary: {
    backgroundColor: "#0D2C42",
    borderWidth: 2,
    borderColor: '#2F4F68',
    paddingVertical: 16,
    borderRadius: 30,
  },
  buttonSecondary: {
    backgroundColor: "#0D2C42",
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#2F4F68',
    borderRadius: 30,
  },
  buttonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});

