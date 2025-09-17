import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { leagueLogos } from '@/assets/images/leagueLogos';
import leagues from '@/assets/data/leagues.json';
import arenas from '@/assets/data/arenas.json';
import MapView, { Marker, UrlTile } from 'react-native-maps';

export default function LeagueDetails() {
  const { leagueName } = useLocalSearchParams();
  const league = leagues.find(
    (l: any) => (l.league || '').toUpperCase() === String(leagueName || '').toUpperCase()
  );

  const leagueCode = (league?.league || '').toUpperCase();

  // Filter arenas for this league
  const leagueArenas = (arenas as any[]).filter(
    (a) => (a.league || '').toUpperCase() === leagueCode
  );
  if (!league) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>League not found</Text>
      </View>
    );
  }

  return (
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
        <MapView
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
      ) : (
        <Text style={styles.info}>No arenas found for this league.</Text>
      )}
      <Text style={styles.title}>{league.leagueName}</Text>
      <Text style={styles.description}>{league.description}</Text>
      <Text style={styles.info}>Teams: {league.numberOfTeams}</Text>
      <Text style={styles.info}>Founded: {league.foundedYear}</Text>
      <Text style={styles.info}>Country: {league.country}</Text>
      <Text style={styles.info}>Most Titles: {league.mostTitles}</Text>
      <Text style={styles.info}>Most Recent Champion: {league.mostRecentTitles}</Text>

      {league.website && (
        <TouchableOpacity onPress={() => Linking.openURL(`https://${league.website}`)}>
          <Text style={styles.link}>Visit Website</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
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
  map: { width: '100%', height: 300, borderRadius: 12, marginBottom: 16 },
});