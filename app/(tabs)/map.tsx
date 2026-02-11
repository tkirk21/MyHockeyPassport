// app/(tabs)/map.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query } from 'firebase/firestore';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Alert, FlatList, Image, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { usePremium } from '@/context/PremiumContext';

import arenasData from '@/assets/data/arenas.json';
import arenaHistoryData from '@/assets/data/arenaHistory.json';
import historicalTeamsData from '@/assets/data/historicalTeams.json';
import LoadingPuck from "../../components/loadingPuck";

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export default function MapScreen() {
  const [pins, setPins] = useState<any[]>([]);
  const { isPremium } = usePremium();
  const colorScheme = useColorScheme();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<string>('All');
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>([]);
  const [leagueOptions, setLeagueOptions] = useState<string[]>(['All']);
  const mapRef = useRef<MapView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArenaCheckIns, setSelectedArenaCheckIns] = useState<any[]>([]);
  const [allCheckIns, setAllCheckIns] = useState<any[]>([]);
  const [travelCoords, setTravelCoords] = useState<{latitude: number, longitude: number}[]>([]);
  const router = useRouter();
  const [showTravelLines, setShowTravelLines] = useState(false);
  const [travelAnimValue, setTravelAnimValue] = useState(0);
  const showTravel = showTravelLines && travelCoords.length > 1;

  const handleShare = async () => {
    try {
      await new Promise(r => setTimeout(r, 500));

      const uri = await viewShotRef.current?.capture();
      if (!uri) throw new Error('Capture failed');

      // Move the image to a sharable location
      const fileUri = FileSystem.cacheDirectory + `map_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      const shareText =
        `Just added another arena to my Hockey Passport 🏒\n` +
        `Track every rink you visit.\n` +
        `https://play.google.com/store/apps/details?id=com.mysportspassport`;

      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Share your map',
        mimeType: 'image/png',
        UTI: 'public.png',
        // Android only
        message: shareText
      });

    } catch (e) {
      console.log(e);
      Alert.alert('Share failed', 'Could not share map');
    }
  };

  const isDateInRange = (checkDate: Date, start: string | undefined, end: string | undefined) => {
    if (!start) return false;
    const checkTime = checkDate.getTime();
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Infinity;
    return checkTime >= startTime && checkTime <= endTime;
  };

  const visiblePins = useMemo(() => {
    if (selectedLeague === 'Favorites') {
      return pins.filter(pin =>
        favoriteLeagues.includes(pin.league)
      );
    }
    return selectedLeague === 'All'
      ? pins
      : pins.filter(p => String(p.league || '').toUpperCase() === selectedLeague.toUpperCase());
  }, [pins, selectedLeague, favoriteLeagues]);

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

  useEffect(() => {
    if (!auth.currentUser) return;

    const loadFavoriteLeagues = async () => {
      const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      if (docSnap.exists()) {
        const saved = docSnap.data()?.favoriteLeagues;
        if (Array.isArray(saved)) {
          setFavoriteLeagues(saved);
        }
      }
    };

    loadFavoriteLeagues();

    const unsub = onSnapshot(doc(db, 'profiles', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const saved = snap.data()?.favoriteLeagues;
        if (Array.isArray(saved)) {
          setFavoriteLeagues(saved);
        }
      }
    });

    return () => unsub();
  }, []);

  // Travel line animation when toggling
  useEffect(() => {
    if (!showTravelLines) {
      setTravelAnimValue(0);
      return;
    }

    setTravelAnimValue(0);

    let start = Date.now();
    const duration = 60000;
    let animationId: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setTravelAnimValue(progress);

      if (progress < 1 && showTravelLines) {
        animationId = requestAnimationFrame(tick);
      }
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
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
          } else {
            // Try historical teams json for old/defunct teams
            let historicalMatch: any = null;

            // First priority: exact arena name match (catches one-offs like LoanDepot perfectly)
            historicalMatch = historicalTeamsData.find((h: any) =>
              h.teamName === data.teamName && h.arena === data.arenaName
            );

            if (!historicalMatch && data.teamName && data.gameDate) {
              const gameDateObj = new Date(data.gameDate);

              const candidates = historicalTeamsData
                .filter((h: any) => h.teamName === data.teamName)
                .sort((a: any, b: any) => {
                  const aIn = isDateInRange(gameDateObj, a.startDate, a.endDate) ? -1 : 1;
                  const bIn = isDateInRange(gameDateObj, b.startDate, b.endDate) ? -1 : 1;
                  if (aIn !== bIn) return aIn - bIn; // prefer ones that contain the date

                  // tiebreaker: closer start date
                  return Math.abs(gameDateObj.getTime() - new Date(a.startDate).getTime()) -
                         Math.abs(gameDateObj.getTime() - new Date(b.startDate).getTime());
                });

              historicalMatch = candidates[0] || null;
            }

            if (historicalMatch) {
              lat = historicalMatch.latitude;
              lng = historicalMatch.longitude;
              displayName = historicalMatch.arena || data.arenaName;
              colorCode = 'gray'; // or whatever you want for historical
              teamCode = historicalMatch.teamCode || '';
            } else if (data.latitude != null && data.longitude != null) {
              // Final fallback to check-in coords
              lat = data.latitude;
              lng = data.longitude;
            }
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
            let lat = ci.latitude;
            let lng = ci.longitude;

            const match = (arenasData as any[]).find(
              (a: any) => a.league === ci.league && a.arena === currentName
            );

            if (match) {
              lat = match.latitude;
              lng = match.longitude;
            } else {
              // Historical teams fallback
              let historicalMatch: any = null;

            // First priority: exact arena name match
            historicalMatch = historicalTeamsData.find((h: any) =>
              h.teamName === ci.teamName && h.arena === ci.arenaName
            );

            if (!historicalMatch && ci.teamName && ci.gameDate) {
              const gameDateObj = new Date(ci.gameDate);

              const candidates = historicalTeamsData
                .filter((h: any) => h.teamName === ci.teamName)
                .sort((a: any, b: any) => {
                  const aIn = isDateInRange(gameDateObj, a.startDate, a.endDate) ? -1 : 1;
                  const bIn = isDateInRange(gameDateObj, b.startDate, b.endDate) ? -1 : 1;
                  if (aIn !== bIn) return aIn - bIn;

                  return Math.abs(gameDateObj.getTime() - new Date(a.startDate).getTime()) -
                         Math.abs(gameDateObj.getTime() - new Date(b.startDate).getTime());
                });

              historicalMatch = candidates[0] || null;
            }
              if (historicalMatch) {
                lat = historicalMatch.latitude;
                lng = historicalMatch.longitude;
              }
            }

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

  const styles = StyleSheet.create({
    checkInRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: colorScheme === 'dark' ? '#2F4F68' : '#eee', },
    checkInDate: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    checkInMatchup: { fontSize: 14, color: colorScheme === 'dark' ? '#BBBBBB' : '#555', },
    closeButton: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 32, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', alignSelf: 'center', alignItems: 'center', },
    closeButtonText: {color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 12, fontWeight: '600', },
    dropdownContainer: { position: 'absolute', top: 55, alignSelf: 'center', width: '75%', zIndex: 10 },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderWidth: 3, borderRadius: 16, borderColor: '#2F4F68' },
    dropdownHeaderText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 17, fontWeight: '600', textAlign: 'center', flex: 1 },
    dropdownList: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderColor: '#2F4F68' },
    dropdownItem: { paddingVertical: 12, paddingHorizontal: 18 },
    dropdownItemText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 15, fontWeight: '500', textAlign: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
    emptyText: { fontSize: 18, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', },
    findLocationButton: { position: 'absolute', bottom: 30, right: 20, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', padding: 8, borderRadius: 24, borderWidth: 3, borderColor: '#2F4F68', zIndex: 10, elevation: 8 },
    groupTitle: { fontSize: 18, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginBottom: 8, textAlign: 'center', width: '100%', },
    loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    map: { flex: 1 },
    markerContainer: { alignItems: 'center', },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 12, },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', },
    pickerSelectedText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 17, fontWeight: '600' },
    pickerArrow: { position: 'absolute', right: 16 },
    pinContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', position: 'relative', },
    pinImage: { width: 40, height: 40, },
    shareButton: { position: 'absolute', bottom: 30, left: 20, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', padding: 8, borderRadius: 24, borderWidth: 3, borderColor: '#2F4F68', zIndex: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, },teamCodeText: { position: 'absolute', top: 6, left: 10, color: 'white', fontWeight: 'bold', fontSize: 8, },
    travelLinesButton: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, zIndex: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', },
    travelLinesButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' , fontWeight: 'bold', fontSize: 16 },
    visitBadge: { backgroundColor: '#D32F2F', width: 15, height: 15, borderRadius: 30, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 16, right: 26, zIndex: 2, borderWidth: 1, borderColor: 'white', },
    visitBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 6, },
  });

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

  const openCheckInModal = (checkIns: any[]) => {
    setSelectedArenaCheckIns(checkIns.sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()));
    setModalVisible(true);
  };

  const centerOnCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to center the map.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    } catch (e) {
      Alert.alert('Location failed', 'Could not get current location.');
    }
  };

  return (
    isPremium ? (
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
          <TouchableOpacity style={styles.dropdownHeader} onPress={() => setDropdownVisible(prev => !prev)}>
            <Text style={styles.dropdownHeaderText}>
              {selectedLeague === 'Favorites' ? 'Favorites' : selectedLeague}
            </Text>
            <Ionicons name={dropdownVisible ? 'chevron-up' : 'chevron-down'} size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
          </TouchableOpacity>

          {dropdownVisible && (
            <View style={styles.dropdownList}>
              {['All', 'Favorites', ...leagueOptions.filter(opt => opt !== 'All')].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedLeague(opt);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.travelLinesButton}
          onPress={() => setShowTravelLines(prev => !prev)}
        >
          <Text style={styles.travelLinesButtonText}>
            {showTravelLines ? 'Hide' : 'Show'} Travel Lines
          </Text>
        </TouchableOpacity>

        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.map}
            mapType="none"
            showsUserLocation={true}
            followsUserLocation={false}
            showsMyLocationButton={false}
          >
            <UrlTile
              urlTemplate={colorScheme === 'dark'
                ? "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
                : "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"}
              maximumZ={19}
              zIndex={0}
            />

            {showTravel && (
              <Polyline
                coordinates={travelCoords.slice(
                  0,
                  Math.max(2, Math.floor(travelAnimValue * travelCoords.length))
                )}
                strokeColor={colorScheme === 'dark' ? '#FFFFFF' : '#2F4F68'}
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
        </ViewShot>

        <TouchableOpacity style={styles.findLocationButton} onPress={centerOnCurrentLocation}>
          <Ionicons name="locate-outline" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
        </TouchableOpacity>
      </View>
    ) : (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 20 }}>
          Upgrade to Premium
        </Text>
        <Text style={{ fontSize: 18, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 }}>
          Unlock the full map, travel lines, sharing, and more! A monthly subscription is way cheaper than rink side parking.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#EF4444',
            paddingVertical: 16,
            paddingHorizontal: 32,
            borderRadius: 30,
          }}
          onPress={() => {
            // TODO: Your upgrade/subscribe route here
            Alert.alert("Upgrade", "Redirecting to subscription...");
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
            Subscribe Now
          </Text>
        </TouchableOpacity>
      </View>
    )
  );
}