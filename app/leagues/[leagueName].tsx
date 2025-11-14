import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { leagueLogos } from '@/assets/images/leagueLogos';
import leagues from '@/assets/data/leagues.json';
import arenas from '@/assets/data/arenas.json';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import LoadingPuck from '@/components/loadingPuck';

export default function LeagueDetails() {
  const [loading, setLoading] = React.useState(true);
  const { leagueName } = useLocalSearchParams();
  const league = leagues.find((l: any) => (l.league || '').toUpperCase() === String(leagueName || '').toUpperCase());
  const leagueCode = (league?.league || '').toUpperCase();
  const leagueArenas = useMemo(() => {
    return (arenas as any[]).filter((a) => (a.league || '').toUpperCase() === leagueCode);}, [leagueCode]);
  const [selectedArena, setSelectedArena] = useState(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [leagueName]);

  useEffect(() => {
    if (selectedArena && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedArena.latitude,
          longitude: selectedArena.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
  }, [selectedArena]);

  if (!league) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>League not found</Text>
      </View>
    );
  }

  return loading ? (
    <View style={styles.loadingContainer}>
      <LoadingPuck size={320} />
    </View>
  ) : (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={
          league.logoFileName && leagueLogos[league.logoFileName]
            ? leagueLogos[league.logoFileName]
            : leagueLogos['placeholder.png']
        }
        style={styles.logo}
        resizeMode="contain"
      />
      {leagueArenas.length > 0 ? (
        <>
          <View style={styles.mapWrapper}>
            <MapView
              ref={mapRef}
              style={styles.map}
              mapType="none"
              initialRegion={{
                latitude: leagueArenas[0].latitude,
                longitude: leagueArenas[0].longitude,
                latitudeDelta: 12,
                longitudeDelta: 12,
              }}
            >
              <UrlTile
                urlTemplate="https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
                maximumZ={19}
                zIndex={0}
              />
              {leagueArenas.map((a, idx) => (
                <Marker
                  key={`${a.league}-${a.arena}-${idx}`}
                  coordinate={{ latitude: a.latitude, longitude: a.longitude }}
                  title={a.arena}
                  description={a.city || ''}
                  onPress={() => setSelectedArena(a)}
                  // iOS: callout is tappable
                  // Android: make callout tappable
                  calloutEnabled={true}
                  onCalloutPress={() => {
                    const arenaId = `${a.latitude.toFixed(6)}_${a.longitude.toFixed(6)}`;
                    router.push(`/arenas/${arenaId}`);
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <Image
                      source={require('../../assets/images/pin_template.png')}
                      style={{ width: 40, height: 40, tintColor: a.colorCode || 'red' }}
                      resizeMode="contain"
                    />
                    <Text
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 10,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 8,
                        textAlign: 'center',
                      }}
                    >
                      {a.teamCode || ''}
                    </Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
        </>
      ) : (
        <Text style={styles.info}>No arenas found for this league.</Text>
      )}
      <View style={styles.infoBox}>
        <Text style={styles.title}>{league.leagueName}</Text>
        <Text style={styles.description}>{league.description}</Text>
        <Text style={styles.info}>Teams: {league.numberOfTeams}</Text>
        {league.conferenceNames && (
          <Text style={styles.info}>Conferences: {league.conferenceNames}</Text>
        )}
        {league.divisionNames && (
          <Text style={styles.info}>Divisions: {league.divisionNames}</Text>
        )}
        <Text style={styles.info}>Founded: {league.foundedYear}</Text>
        <Text style={styles.info}>Country: {league.country}</Text>
        <Text style={styles.info}>Most Titles: {league.mostTitles}</Text>
        <Text style={styles.info}>Most Recent Champion: {league.mostRecentTitles}</Text>

        {league.website && (
          <TouchableOpacity
            onPress={() => {
              const rawUrl = league.website;
              console.log('Raw website:', rawUrl);

              const url = rawUrl.startsWith('http')
                ? rawUrl
                : `https://${rawUrl}`;

              console.log('Opening URL:', url);

              Linking.openURL(url)
                .then(() => console.log('URL opened successfully'))
                .catch(err => {
                  console.log('Failed to open URL:', err.message);
                  const fallback = `http://${rawUrl}`;
                  console.log('Trying fallback:', fallback);
                  Linking.openURL(fallback).catch(fallbackErr =>
                    console.log('Fallback failed too:', fallbackErr.message)
                  );
                });
            }}
          >
            <Text style={styles.link}>Visit Website</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 80,  // ← ADD THIS
    alignItems: 'center',
    backgroundColor: '#E6E8EA',
    flexGrow: 1,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    marginBottom: 8,
  },
  link: {
    fontSize: 16,
    color: 'blue',
    marginTop: 12,
  },
  map: {
    width: 310,
    height: 300,
    borderColor: '#0D2C42',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#0D2C42',
    width: '100%',
    alignItems: 'center',
  },
  mapWrapper: {
    borderWidth: 4,
    borderColor: '#0D2C42',
    borderRadius: 12,
    overflow: 'hidden',  // ← IMPORTANT: clips rounded corners
    marginBottom: 16,
  },
});