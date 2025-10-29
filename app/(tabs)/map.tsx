//working map type 8/27
// app/(tabs)/map.tsx
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Image, Text } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';
import arenasData from '@/assets/data/arenas.json';
import LoadingPuck from "../../components/loadingPuck";

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export default function MapScreen() {
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLeague, setSelectedLeague] = useState<'All' | string>('All');
  const [leagueOptions, setLeagueOptions] = useState<string[]>(['All']);

  useEffect(() => {
    const fetchCheckIns = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const q = query(collection(db, 'profiles', user.uid, 'checkins'));
        const snapshot = await getDocs(q);

        const seenArenas = new Set();
        const markers: any[] = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          const key = `${data.league}-${data.arenaName}`;
          if (seenArenas.has(key)) return;
          seenArenas.add(key);

          let lat = data.latitude;
          let lng = data.longitude;
          let colorCode = 'red';

          const match = (arenasData as any[]).find(
            (arena: any) => arena.league === data.league && arena.arena === data.arenaName
          );

          if (match) {
            lat = match.latitude;
            lng = match.longitude;
            colorCode = match.colorCode || 'red';
          }

          if (lat != null && lng != null) {
            markers.push({
              id: doc.id,
              title: data.arenaName || 'Arena',
              latitude: lat,
              longitude: lng,
              colorCode,
              teamCode: match?.teamCode || '',
              league: data.league,
            });
          }
        });

        setPins(markers);
        const leaguesSet = new Set<string>(markers.map(m => String(m.league || '').toUpperCase()).filter(Boolean));
        setLeagueOptions(['All', ...Array.from(leaguesSet)]);
      } catch (error) {
        console.error('Error loading check-ins for map:', error);
        Alert.alert('Error', 'Could not load check-ins for map.');
      } finally {
        setLoading(false);
      }
    };

    fetchCheckIns();
  }, []);

  if (loading) return <LoadingPuck />;

  const visiblePins = selectedLeague === 'All'
    ? pins
    : pins.filter(p => String(p.league || '').toUpperCase() === selectedLeague.toUpperCase());

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={selectedLeague}
          onValueChange={(val) => setSelectedLeague(val)}
          mode="dropdown"
          style={styles.picker}
        >
          {leagueOptions.map(opt => (
            <Picker.Item key={opt} label={opt} value={opt} />
          ))}
        </Picker>
      </View>

      <MapView
        style={styles.map}
        mapType="none"
        initialRegion={{
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 30,
          longitudeDelta: 30,
        }}
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maximumZ={19}
          zIndex={0}
        />

        {visiblePins.map(pin => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.title}
          >
            <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <Image
                source={require('../../assets/images/pin_template.png')}
                style={{ width: 40, height: 40, tintColor: pin.colorCode || 'black' }}
                resizeMode="contain"
              />
              <Text style={{ position: 'absolute', top: 6, left: 10, color: 'white', fontWeight: 'bold', fontSize: 8, textAlign: 'center' }}>
                {pin.teamCode}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
const styles = StyleSheet.create({
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dropdownContainer: {
    position: 'absolute',
    top: 44,
    alignSelf: 'center',
    width: '70%',
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  picker: {
    height: 44,
    width: '100%',
  },
});