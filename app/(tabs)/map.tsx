// app/(tabs)/map.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import arenasData from '@/assets/data/arenas.json';
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
  const [travelCoords, setTravelCoords] = useState<{latitude: number, longitude: number}[]>([]);
  const router = useRouter();
  const [showTravelLines, setShowTravelLines] = useState(false);
  const [travelAnimValue, setTravelAnimValue] = useState(0);
  const showTravel = showTravelLines && travelCoords.length > 1;

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
      setTravelAnimValue(0);

      let start = Date.now();
      let duration = 60000;

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
      setTravelAnimValue(0);
    }
  }, [showTravelLines]);

  const norm = (s: string) => (s ?? '').toString().trim().toLowerCase();

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

  const groupedCheckIns = useMemo(() => {
    if (selectedArenaCheckIns.length === 0) return [];

    const groups = new Map<string, any[]>();

    selectedArenaCheckIns.forEach(ci => {
      const oldName = ci.arenaName || 'Unknown';

      // Group purely by the original name that was used in the check-in
      const groupKey = oldName;

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(ci);
    });

    // Sort each group's check-ins newest → oldest
    groups.forEach(list => {
      list.sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());
    });

    // Build the result array
    const result: { name: string; checkIns: any[] }[] = [];
    groups.forEach((checkIns, name) => {
      result.push({ name, checkIns });
    });

    // Sort the groups themselves by the newest check-in in each group (newest group on top)
    result.sort((a, b) => {
      const newestA = new Date(a.checkIns[0].gameDate).getTime(); // a.checkIns[0] is newest in its group
      const newestB = new Date(b.checkIns[0].gameDate).getTime();
      return newestB - newestA; // descending = newest group first
    });

    return result;
  }, [selectedArenaCheckIns]);

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

          if (!match && data.arenaName) {
            const historyEntry = arenaHistoryData.find((h: any) =>
              h.history.some((entry: any) => norm(entry.name) === norm(data.arenaName))
            );
            if (historyEntry) {
              match = (arenasData as any[]).find(
                (a: any) => a.arena === historyEntry.currentArena && a.league === data.league
              );
              displayName = historyEntry.currentArena;
            }
          }

          if (match) {
            lat = match.latitude;
            lng = match.longitude;
            colorCode = match.colorCode || 'red';
            teamCode = match.teamCode || '';
          } else if (data.latitude != null && data.longitude != null) {
            lat = data.latitude;
            lng = data.longitude;
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

        // Build travel coordinates - oldest to newest
        const sortedCheckIns = [...all].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());

        const coords = sortedCheckIns
          .map(ci => {
            const currentName = getCurrentArenaName(ci.arenaName);
            const match = (arenasData as any[]).find(
              (a: any) => a.league === ci.league && a.arena === currentName
            );

            let lat = match ? match.latitude : ci.latitude;
            let lng = match ? match.longitude : ci.longitude;

            if (lat != null && lng != null) {
              return { latitude: lat, longitude: lng };
            }
            return null;
          })
          .filter(Boolean) as { latitude: number; longitude: number }[];

        setTravelCoords(coords);

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
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No arenas visited yet
        </Text>
      </View>
    );
  }

  const visiblePins = selectedLeague === 'All'
    ? pins
    : pins.filter(p => String(p.league || '').toUpperCase() === selectedLeague.toUpperCase());

  const openCheckInModal = (checkIns: any[]) => {
    setSelectedArenaCheckIns(checkIns.sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()));
    setModalVisible(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <FlatList
              data={groupedCheckIns}
              keyExtractor={(group) => group.name}
              renderItem={({ item: group }) => (
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.groupTitle}>
                    {group.name}
                  </Text>
                  {group.checkIns.map((ci) => (
                    <TouchableOpacity
                      key={ci.id}
                      style={styles.checkInRow}
                      onPress={() => {
                        setModalVisible(false);
                        router.push(`/checkin/${ci.id}?userId=${auth.currentUser?.uid}`);
                      }}
                    >
                      <Text style={styles.checkInDate}>
                        {new Date(ci.gameDate).toLocaleDateString()}
                      </Text>
                      <Text style={styles.checkInMatchup}>
                        {ci.teamName} vs {ci.opponent}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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

        {showTravel && (
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
          const checkInsAtArena = allCheckIns.filter(ci =>
            norm(getCurrentArenaName(ci.arenaName || '')) === norm(pin.title || '')
          );

          const visitCount = checkInsAtArena.length;

          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              title={pin.title || 'Arena'}
              onPress={() => openCheckInModal(checkInsAtArena)}
            >
              <View style={styles.markerContainer}>
                {visitCount > 1 && (
                  <View style={styles.visitBadge}>
                    <Text style={styles.visitBadgeText}>{visitCount}x</Text>
                  </View>
                )}

                <View style={styles.pinContainer}>
                  <Image
                    source={require('../../assets/images/pin_template.png')}
                    style={[styles.pinImage, { tintColor: pin.colorCode || 'black' }]}
                    resizeMode="contain"
                  />
                  <Text
                    key="teamCode"
                    style={styles.teamCodeText}
                  >
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
  checkInRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', },
  checkInDate: { fontSize: 16, fontWeight: '600', },
  checkInMatchup: { fontSize: 14, color: '#555', },
  closeButton: { marginTop: 10, padding: 10, backgroundColor: '#0D2C42', borderRadius: 8, alignItems: 'center', },
  closeButtonText: { color: 'white', fontWeight: 'bold', },
  dropdownContainer: { position: 'absolute', top: 55, alignSelf: 'center', width: '92%', zIndex: 10, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, borderWidth: 3, borderColor: '#0D2C42', },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#0A2940', textAlign: 'center', },
  groupTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A2940', marginBottom: 8, textAlign: 'center', width: '100%', },
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', },
  map: { flex: 1 },
  markerContainer: { alignItems: 'center', },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', },
  modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 12, padding: 20, },
  pinContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', position: 'relative', },
  pinImage: { width: 40, height: 40, },
  picker: { height: 56, width: '100%', fontSize: 17, fontWeight: '600', color: '#0A2940', backgroundColor: '#FFFFFF', },
  teamCodeText: { position: 'absolute', top: 6, left: 10, color: 'white', fontWeight: 'bold', fontSize: 8, },
  travelLinesButton: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: "#0D2C42", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, zIndex: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, borderWidth: 3, borderColor: '#2F4F68', },
  travelLinesButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16, },
  visitBadge: { backgroundColor: '#D32F2F', width: 15, height: 15, borderRadius: 30, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 16, right: 26, zIndex: 2, borderWidth: 1, borderColor: 'white', },
  visitBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 6, },
});