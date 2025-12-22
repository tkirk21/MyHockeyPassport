//app/leagues/[leagueName].tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { leagueLogos } from '@/assets/images/leagueLogos';
import leagues from '@/assets/data/leagues.json';
import arenas from '@/assets/data/arenas.json';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import LoadingPuck from '@/components/loadingPuck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LeagueDetails() {
  const [loading, setLoading] = React.useState(true);
  const { leagueName } = useLocalSearchParams();
  const league = leagues.find((l: any) => (l.league || '').toUpperCase() === String(leagueName || '').toUpperCase());
  const leagueCode = (league?.league || '').toUpperCase();
  const leagueArenas = useMemo(() => {
    return (arenas as any[]).filter((a) => (a.league || '').toUpperCase() === leagueCode);}, [leagueCode]);
  const [selectedArena, setSelectedArena] = useState(null);
  const mapRef = useRef<MapView>(null);
  const leagueColor = league.colorCode || '#0A2940';

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.fullContainer}>
        <View style={[styles.blueStrip, { backgroundColor: league.colorCode || '#0A2940' }]} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={36} color="#E6E8EA" />
        </TouchableOpacity>
        {/* ← CIRCULAR LOGO WITH BORDER AROUND PUCK */}
        <View style={styles.logoContainer}>
          <View style={styles.logoInnerCircle}>
            <Image
              source={
                league.logoFileName && leagueLogos[league.logoFileName]
                  ? leagueLogos[league.logoFileName]
                  : leagueLogos['placeholder.png']
              }
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
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
                  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                  Linking.openURL(url).catch(err => {
                    const fallback = `http://${rawUrl}`;
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 80, alignItems: 'center', backgroundColor: '#E6E8EA', flexGrow: 1, },
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
  backButton: {
    position: 'absolute',
    top: 35,        // 90px strip / 2 - 36px arrow / 2 = centered
    left: -10,
    zIndex: 10,     // above blue strip
    padding: 12,
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 130,   // ← was 80, now 100 — this fixes bottom cutoff on all phones
    alignItems: 'center',
  },
  blueStrip: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    height: 120,               // ← covers status bar + header area
    zIndex: 5,
  },

  logoContainer: {
    top: 10,
    left: -10,
    alignSelf: 'center',
    width: 136,           // 120 + 8 + 8 (logo + borders)
    height: 136,
    zIndex: 20,
  },

  logoInnerCircle: {
    width: 168,               // 120 + 8 (inner white border)
    height: 148,
    borderWidth: 16,
    borderColor: '#EDEEF0',   // ← WHITE INNER
    borderRadius: 84,         // 128 / 2
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  logoImage: {
    width: 170,               // slightly smaller to fit
    height: 170,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#EDEEF0', // same as your background
  },
});