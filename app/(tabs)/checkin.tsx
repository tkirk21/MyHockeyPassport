// app/(tabs)/checkin.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, Dimensions, Image, Modal, ImageBackground, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '../../hooks/useColorScheme';
import { usePremium } from '@/context/PremiumContext';

import LoadingPuck from '@/components/loadingPuck';
import arenaData from '@/assets/data/arenas.json';
import nhlSchedule2025 from '@/assets/data/nhlSchedule2025.json';
import ahlSchedule2025 from '@/assets/data/ahlSchedule2025.json';
import ushlSchedule2025 from '@/assets/data/ushlSchedule2025.json';
import echlSchedule2025 from '@/assets/data/echlSchedule2025.json';
import whlSchedule2025 from '@/assets/data/whlSchedule2025.json';
import qmjhlSchedule2025 from '@/assets/data/qmjhlSchedule2025.json';
import ohlSchedule2025 from '@/assets/data/ohlSchedule2025.json';
import sphlSchedule2025 from '@/assets/data/sphlSchedule2025.json';
import fphlSchedule from '@/assets/data/fphlSchedule.json';
import na3hlSchedule2025 from '@/assets/data/na3hlSchedule2025.json';
import nahlSchedule from '@/assets/data/nahlSchedule.json';
import ncaaD1Schedule from '@/assets/data/ncaaD1Schedule.json';
import ncaaD2Schedule from '@/assets/data/ncaaD2Schedule.json';
import aihlSchedule2025 from '@/assets/data/aihlSchedule2025.json';
import pwhlSchedule from '@/assets/data/pwhlSchedule.json';

const auth = getAuth();

export default function CheckInScreen() {
  const router = useRouter();
  const { isPremium } = usePremium();
  const [lastPast, setLastPast] = useState<Date | null>(null);
  const [canAddPast, setCanAddPast] = useState(true);
  const colorScheme = useColorScheme();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [upgradeAlertVisible, setUpgradeAlertVisible] = useState(false);
  const [upgradeAlertTitle, setUpgradeAlertTitle] = useState('');
  const [upgradeAlertMessage, setUpgradeAlertMessage] = useState('');

  const showUpgradePrompt = (title: string, message: string) => {
    setUpgradeAlertTitle(title);
    setUpgradeAlertMessage(message);
    setUpgradeAlertVisible(true);
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const profileRef = doc(db, 'profiles', user.uid);

    const unsub = onSnapshot(profileRef, (snap) => {
      if (!snap.exists()) {
        setLastPast(null);
        setCanAddPast(true);
        return;
      }

      const data = snap.data();
      const last = data.lastPastCheckIn?.toDate?.() || null;
      setLastPast(last);

      if (last) {
        const daysSince = (new Date().getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        setCanAddPast(daysSince >= 7);
      } else {
        setCanAddPast(true);
      }
    });

    return () => unsub();
  }, []);

  const handleLiveCheckIn = async () => {
    setCheckingIn(true);  // ← SHOW LOADING PUCK

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckingIn(false);
        setAlertMessage('Location permission is needed to check in to a live game.');
        setAlertVisible(true);
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
        ...fphlSchedule,
        ...ohlSchedule2025,
        ...whlSchedule2025,
        ...qmjhlSchedule2025,
        ...ushlSchedule2025,
        ...nahlSchedule,
        ...na3hlSchedule2025,
        ...ncaaD1Schedule,
        ...ncaaD2Schedule,
        ...pwhlSchedule,
        ...aihlSchedule2025.map(g => ({ ...g, league: 'AIHL' })),
      ].filter(g => new Date(g.date).toDateString() === today);

      if (allGamesToday.length === 0) {
        setCheckingIn(false);
        setAlertMessage('There are no games scheduled in any league today.');
        setAlertVisible(true);
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
        setAlertMessage('You must be closer to the arena to check-in.');
        setAlertVisible(true);
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
      setAlertMessage('Unable to get GPS location. Try again.');
      setAlertVisible(true);
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
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#fff' : '#0A2940', fontWeight: '700', fontSize: 16 },
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
    <View style={{ flex: 1 }}>
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
          {isPremium ? (
            <TouchableOpacity style={styles.buttonPrimary} onPress={handleLiveCheckIn}>
              <Text style={styles.buttonText}>Check In to a Live Game</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={() => showUpgradePrompt(
                "Premium Feature",
                "Subscribe to check in to live games. A year subscription is cheaper than tonight's game ticket."
              )}
            >
              <Text style={styles.buttonText}>Check In to a Live Game (Premium)</Text>
            </TouchableOpacity>
          )}

          {isPremium || canAddPast ? (
            <TouchableOpacity style={styles.buttonSecondary} onPress={async () => {
              const user = auth.currentUser;
              if (!user) return;

              // If non-premium, update lastPastCheckIn to now
              if (!isPremium) {
                const profileRef = doc(db, 'profiles', user.uid);
                await setDoc(profileRef, {
                  lastPastCheckIn: serverTimestamp(),
                }, { merge: true });
              }

              router.push('/checkin/manual');
            }}>
              <Text style={styles.buttonText}>Add a Past Game</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={() => showUpgradePrompt(
                "Weekly Limit Reached",
                "You've used your free weekly past check-in. Subscribe for unlimited. A year subscription is way cheaper than what you just spent at your last game."
              )}
            >
              <Text style={styles.buttonText}>Add a Past Game (Premium)</Text>
            </TouchableOpacity>
          )}
        </View>
      </ImageBackground>

      {/* CUSTOM THEMED ALERT MODAL — now inside the root View */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>Not Close Enough</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity onPress={() => setAlertVisible(false)} style={styles.alertButton}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={upgradeAlertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>{upgradeAlertTitle}</Text>
            <Text style={styles.alertMessage}>{upgradeAlertMessage}</Text>
            <TouchableOpacity onPress={() => setUpgradeAlertVisible(false)} style={styles.alertButton}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}