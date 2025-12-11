// app/(tabs)/map.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import React, { useEffect, useState, useRef } from 'react';
import { Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import arenasData from '@/assets/data/arenas.json';
import historicalTeamsData from '@/assets/data/historicalTeams.json';
import arenaHistoryData from '@/assets/data/arenaHistory.json';
import LoadingPuck from "../../components/loadingPuck";

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export default function MapScreen() {
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<string>('All');
  const [leagueOptions, setLeagueOptions] = useState<string[]>(['All']);
  const mapRef = useRef<MapView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArenaCheckIns, setSelectedArenaCheckIns] = useState<any[]>([]);
  const [allCheckIns, setAllCheckIns] = useState<any[]>([]);
  const router = useRouter();
  const [showTravelLines, setShowTravelLines] = useState(false);
  const [travelAnimValue, setTravelAnimValue] = useState(0);

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem('mapSelectedLeague');
      if (saved) setSelectedLeague(saved);
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('mapSelectedLeague', selectedLeague);
  }, [selectedLeague]);

  // Travel line animation when toggling
    useEffect(() => {
      if (showTravelLines) {
        // Start fresh
        setTravelAnimValue(0);

        let start = Date.now();
        let duration = 60000; // 1 minute animation

        const tick = () => {
          let elapsed = Date.now() - start;
          let progress = Math.min(elapsed / duration, 1);
          setTravelAnimValue(progress);

          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        };

        requestAnimationFrame(tick);
      } else {
        // If hidden, reset value
        setTravelAnimValue(0);
      }
    }, [showTravelLines]);

  useEffect(() => {
    const loadEverything = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      let userLat = 39.8283;
      let userLng = -98.5795;
      let delta = 30;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          userLat = loc.coords.latitude;
          userLng = loc.coords.longitude;
          delta = 12;
        }
      } catch (e) {
        console.log('Location failed, using USA center');
      }

      try {
        const q = query(collection(db, 'profiles', user.uid, 'checkins'));
        const snapshot = await getDocs(q);

        const all: any[] = [];
        const seenArenas = new Set<string>();
        const markers: any[] = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          all.push({ id: doc.id, ...data });

          const norm = (s: any) => (s ?? '').toString().trim().toLowerCase();

          const getCurrentArenaName = (oldName: any) => {
            if (!oldName) return oldName;
            const lowerOld = norm(oldName);
            for (const h of arenaHistoryData) {
              if (h.history.some((e: any) => norm(e.name) === lowerOld)) {
                return h.currentArena;
              }
            }
            return oldName;
          };

          const currentArenaName = getCurrentArenaName(data.arenaName);
          const key = `${data.league}-${currentArenaName}`;

          if (seenArenas.has(key)) return;
          seenArenas.add(key);

          let displayName = data.arenaName || 'Arena';
          let lat = data.latitude;
          let lng = data.longitude;
          let colorCode = 'red';
          let teamCode = '';

          let match = (arenasData as any[]).find(
            (a: any) => a.league === data.league && a.arena === data.arenaName
          );

          // 2. If not found, try name-change fallback (Staples → Crypto.com, etc.)
          if (!match && data.arenaName) {
            const historyEntry = arenaHistoryData.find((h: any) =>
              h.history.some((e: any) => e.name === data.arenaName)
            );
            if (historyEntry) {
              match = (arenasData as any[]).find(
                (a: any) => a.arena === historyEntry.currentArena && a.league === data.league
              );
              displayName = historyEntry.currentArena;
            }
          }

          // 3. If still not found, try historical teams (Rexall, McNichols, etc.)
          if (!match) {
            match = historicalTeamsData.find(
              (a: any) => a.league === data.league && a.arena === data.arenaName
            );
          }

          // 4. Final fallback: use saved coordinates from check-in
          if (match) {
            lat = match.latitude;
            lng = match.longitude;
            colorCode = match.colorCode || 'gray';
            teamCode = match.teamCode || '';
          } else if (data.latitude != null && data.longitude != null) {
            lat = data.latitude;
            lng = data.longitude;
            colorCode = 'gray';
            teamCode = '';
          } else {
            return; // no location at all
          }

          if (lat != null && lng != null) {
            markers.push({
              id: doc.id,
              title: displayName,
              latitude: lat,
              longitude: lng,
              colorCode,
              teamCode,
              league: data.league,
            });
          }
        });

        setAllCheckIns(all);
        setPins(markers);
        const leaguesSet = new Set(markers.map(m => String(m.league || '').toUpperCase()).filter(Boolean));
        setLeagueOptions(['All', ...Array.from(leaguesSet)]);
      } catch (error: any) {
        console.error('Error loading check-ins:', error);
        if (error.code === 'permission-denied') {
          Alert.alert('Location Permission Denied', 'Please allow location access in Settings to use the map.');
        } else if (error.message?.includes('network') || error.code === 'unavailable') {
          Alert.alert('No Internet', 'Check your connection and try again.');
        } else {
          Alert.alert('Map Error', 'Something went wrong loading your check-ins. Pull down to retry.');
        }
      } finally {
        setLoading(false);
      }

      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: userLat,
          longitude: userLng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }, 1200);
      }, 800);
    };

    loadEverything();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingOverlay}>
        <LoadingPuck />
      </View>
    );
  }

  if (pins.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#0A2940', textAlign: 'center' }}>
          No arenas visited yet
        </Text>
      </View>
    );
  }

  const visiblePins = selectedLeague === 'All'
    ? pins
    : pins.filter(p => String(p.league || '').toUpperCase() === selectedLeague.toUpperCase());

  const openCheckInModal = (checkIns: any[]) => {
    setSelectedArenaCheckIns(checkIns);
    setModalVisible(true);
  };

  const norm = (s: string) => s.toString().trim().toLowerCase();

  const getCurrentArenaName = (oldName: string) => {
    if (!oldName) return oldName;
    const lowerOld = norm(oldName);
    for (const h of arenaHistoryData) {
      if (h.history.some((e: any) => norm(e.name) === lowerOld)) {
        return h.currentArena;
      }
    }
    return oldName;
  };

  // Build chronological travel path
  const travelCoords = visiblePins
    .map(pin => {
      const checkInsHere = allCheckIns.filter(ci => {
        if (!ci.arenaName || !pin.title) return false;
        return norm(getCurrentArenaName(ci.arenaName)) === norm(pin.title);
      });

      if (!checkInsHere.length) return null;

      const validDates = checkInsHere
        .map(ci => {
          const d = new Date(ci.gameDate);
          return isNaN(d.getTime()) ? null : { ...ci, dateVal: d.getTime() };
        })
        .filter(Boolean);

      if (!validDates.length) return null;

      const earliest = validDates.reduce((a, b) =>
        a.dateVal < b.dateVal ? a : b
      );

      return {
        latitude: pin.latitude,
        longitude: pin.longitude,
        sortKey: earliest.dateVal,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

  return (
    <View style={{ flex: 1 }}>
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedArenaCheckIns[0]?.arenaName || 'Check-ins'}
            </Text>
            <FlatList
              data={selectedArenaCheckIns}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.checkInRow}
                  onPress={() => {
                    setModalVisible(false);
                    router.push(`/checkin/${item.id}?userId=${auth.currentUser?.uid}`);
                  }}
                >
                  <Text style={styles.checkInDate}>
                    {new Date(item.gameDate).toLocaleDateString()}
                  </Text>
                  <Text style={styles.checkInMatchup}>
                    {item.teamName} vs {item.opponent}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={selectedLeague}
          onValueChange={(val) => setSelectedLeague(val as string)}
          mode="dropdown"
          style={styles.picker}
        >
          {leagueOptions.map(opt => (
            <Picker.Item key={opt} label={opt} value={opt} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity
        style={styles.travelLinesButton}
        onPress={() => setShowTravelLines(prev => !prev)}
      >
        <Text style={styles.travelLinesButtonText}>
          {showTravelLines ? 'Hide' : 'Show'} Travel Lines
        </Text>
      </TouchableOpacity>

      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        showsUserLocation={true}
        followsUserLocation={false}
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maximumZ={19}
          zIndex={0}
        />

        {showTravelLines && travelCoords.length > 1 && (
          <Polyline
            coordinates={travelCoords.slice(
              0,
              Math.max(2, Math.floor(travelAnimValue * travelCoords.length))
            )}
            strokeColor="#0D2C42"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            geodesic={true}
            lineDashPattern={[4, 12]}
            zIndex={1}
          />
        )}

        {visiblePins.map(pin => {
          const safeNorm = (s: any) => (s ?? '').toString().trim().toLowerCase();

          const checkInsAtArena = allCheckIns.filter(ci => {
            const ciName = ci.arenaName || '';
            const pinName = pin.title || '';
            return safeNorm(getCurrentArenaName(ciName)) === safeNorm(pinName);
          });

          const visitCount = checkInsAtArena.length;

          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              title={pin.title || 'Arena'}
              onPress={() => openCheckInModal(checkInsAtArena)}
            >
              <View style={{ alignItems: 'center' }}>
                {/* Visit Count Badge */}
                {visitCount > 1 && (
                  <View style={styles.visitBadge}>
                    <Text style={styles.visitBadgeText}>{visitCount}x</Text>
                  </View>
                )}

                {/* Pin */}
                <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  <Image
                    source={require('../../assets/images/pin_template.png')}
                    style={{ width: 40, height: 40, tintColor: pin.colorCode || 'black' }}
                    resizeMode="contain"
                  />
                  <Text style={{ position: 'absolute', top: 6, left: 10, color: 'white', fontWeight: 'bold', fontSize: 8 }}>
                    {pin.teamCode || ''}
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  checkInRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  checkInDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkInMatchup: {
    fontSize: 14,
    color: '#555',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#0D2C42',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 55,
    alignSelf: 'center',
    width: '92%',
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 3,
    borderColor: '#0D2C42',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  picker: {
    height: 56,
    width: '100%',
    fontSize: 17,
    fontWeight: '600',
    color: '#0A2940',
    backgroundColor: '#FFFFFF',
  },
  travelLinesButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: "#0D2C42",  // ← change this color anytime
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: '#2F4F68',
  },
  travelLinesButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  visitBadge: {
    backgroundColor: '#D32F2F',    // red
    width: 15,
    height: 15,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 16,
    right: 26,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'white',
  },
  visitBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 6,
  },
});