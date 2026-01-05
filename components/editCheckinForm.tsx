// components/editCheckinForm.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Image, TouchableOpacity } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import Checkbox from 'expo-checkbox';
import { Pressable } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import firebaseApp from "@/firebaseConfig"; // Adjust path if needed
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';

import arenasData from "@/assets/data/arenas.json";
import historicalTeamsData from '@/assets/data/historicalTeams.json';
import arenaHistoryData from "@/assets/data/arenaHistory.json";

const db = getFirestore(firebaseApp);

export default function editCheckinForm({ initialData }: { initialData: any }) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { userId } = useLocalSearchParams();
  const [gameDate, setGameDate] = useState(new Date(initialData.gameDate || Date.now()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [arenas, setArenas] = useState([]);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [arenaOpen, setArenaOpen] = useState(false);
  const [homeTeamOpen, setHomeTeamOpen] = useState(false);
  const [opponentTeamOpen, setOpponentTeamOpen] = useState(false);
  const [allArenas, setAllArenas] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(initialData.league || null);
  const [selectedArena, setSelectedArena] = useState(initialData.arenaName || null);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState(initialData.teamName || null);
  const [selectedOpponent, setSelectedOpponent] = useState(initialData.opponent || null);
  const [homeScore, setHomeScore] = useState(initialData.homeScore || '');
  const [awayScore, setAwayScore] = useState(initialData.awayScore || '');
  const [favoritePlayer, setFavoritePlayer] = useState(initialData.favoritePlayer || '');
  const [seatSection, setSeatSection] = useState(initialData.seatInfo?.section || '');
  const [seatRow, setSeatRow] = useState(initialData.seatInfo?.row || '');
  const [seatNumber, setSeatNumber] = useState(initialData.seatInfo?.seat || '');
  const [companions, setCompanions] = useState(initialData.companions || '');
  const [highlights, setHighlights] = useState(initialData.highlights || '');
  const [parkingAndTravel, setParkingAndTravel] = useState(initialData.ParkingAndTravel || '');
  const [images, setImages] = useState<string[]>(initialData.photos || []);
  const [didBuyMerch, setDidBuyMerch] = useState(Object.keys(initialData.merchBought || {}).some(cat => initialData.merchBought[cat].length > 0));
  const [expandedCategories, setExpandedCategories] = useState({});
  const [merchItems, setMerchItems] = useState(() => {
    const items = {};
    Object.values(initialData.merchBought || {}).flat().forEach(item => { items[item] = true; });
    return items;
  });
  const [didBuyConcessions, setDidBuyConcessions] = useState(Object.keys(initialData.concessionsBought || {}).some(cat => initialData.concessionsBought[cat].length > 0));
  const [concessionItems, setConcessionItems] = useState(() => {
    const items = {};
    Object.values(initialData.concessionsBought || {}).flat().forEach(item => { items[item] = true; });
    return items;
  });

  const merchCategories = {
    'Jerseys': ['Home Jersey', 'Away Jersey', 'Third Jersey', 'Retro Jersey', 'Custom Jersey', 'Special Occasion Jersey'],
    'Apparel & Headwear': [
      'T-shirt', 'Hoodie', 'Sweatshirt', 'Long sleeve shirt', 'Jacket', 'Windbreaker',
      'Beanie', 'Knit cap', 'Snapback hat', 'Dad hat', 'Baseball cap', 'Bucket hat',
      'Winter hat', 'Scarf', 'Gloves', 'Socks', 'Shorts', 'Pajama pants', 'Face mask',
      'Neck gaiter', 'Baby onesie', 'Toddler gear',
    ],
    'Equipment & Themed Items': ['Mini stick', 'Foam puck', 'Replica Puck', 'Foam finger', 'Souvenir helmet or goalie mask', 'Signed memorabilia (non-game-used)'],
    'Game-Used Items': ['Game-used puck', 'Game-used stick', 'Game-worn jersey', 'Game-used glove', 'Game-used helmet'],
    'Toys & Collectibles': ['Bobblehead', 'Plush mascot', 'LEGO-style players', 'Team figurines', 'Keychain', 'Pin / lapel pin', 'Trading cards', 'Souvenir coin / medallion', 'Zamboni toy'],
    'Printed & Media': ['Team program', 'Poster', 'Schedule magnet', 'Wall calendar', 'Sticker set', 'Decals'],
    'Home & Lifestyle': ['Coffee mug', 'Water bottle', 'Shot glass', 'Beer glass', 'Koozie', 'Blanket', 'Pillow', 'Towel', 'Christmas ornament', 'Wall flag', 'Mousepad', 'Air freshener', 'Magnets'],
    'Auto Accessories': ['Car flag', 'Window decal', 'Steering wheel cover', 'Seatbelt pad', 'Car magnet', 'Hitch cover', 'License plate frame'],
    'Bags & Utility': ['Drawstring bag', 'Backpack', 'Tote bag', 'Lanyard', 'Phone case', 'Wallet'],
  };

  const concessionCategories = {
    'Classic Arena Fare': ['Hot Dog', 'Corn Dog', 'Bratwurst', 'Sausage', 'Nachos', 'Soft Pretzel', 'French Fries', 'Cheese Curds', 'Popcorn', 'Pizza Slice'],
    'Hot Food': ['Chicken Tenders', 'Buffalo Wings', 'Pulled Pork Sandwich', 'Cheeseburger', 'Veggie Burger', 'Loaded Fries', 'Mac and Cheese'],
    'Cold Food & Snacks': ['Sandwich', 'Salad', 'Fruit Cup', 'Chips', 'Granola Bar', 'Trail Mix', 'Candy', 'Chocolate Bar'],
    'Desserts & Treats': ['Ice Cream', 'Funnel Cake', 'Mini Donuts', 'Cotton Candy', 'Cookies', 'Brownie', 'Churros'],
    'Non-Alcoholic Beverages': ['Soda', 'Bottled Water', 'Sports Drink', 'Lemonade', 'Iced Tea', 'Hot Chocolate', 'Coffee', 'Energy Drink'],
    'Alcoholic Beverages': ['Beer (Domestic)', 'Beer (Craft)', 'Cider', 'Hard Seltzer', 'Wine', 'Cocktail', 'Spiked Slushie']
  };

  const [leagueItems, setLeagueItems] = useState([]);
  const [arenaItems, setArenaItems] = useState([]);
  const [homeTeamItems, setHomeTeamItems] = useState([]);
  const [opponentItems, setOpponentItems] = useState([]);

  const handleSave = async () => {
    try {
      const getSelectedItems = (sourceObject, categories) => {
        const result = {};
        Object.keys(categories).forEach((category) => {
          result[category] = categories[category].filter(
            (item) => sourceObject[item]
          );
        });
        return result;
      };

      const match = arenasData.find(
        (arena: any) =>
          arena.league === selectedLeague && arena.arena === selectedArena
      );

      const docData = {
        league: selectedLeague,
        arenaId: match?.id ?? null,
        arenaName: selectedArena,
        teamName: selectedHomeTeam,
        opponent: selectedOpponent,
        homeScore,
        awayScore,
        favoritePlayer,
        seatInfo: {
        section: seatSection,
        row: seatRow,
        seat: seatNumber,
        },
        companions,
        highlights,
        parkingAndTravel,
        merchBought: getSelectedItems(merchItems, merchCategories),
        concessionsBought: getSelectedItems(concessionItems, concessionCategories),
        gameDate: gameDate.toISOString(),
        photos: images,
        latitude: match?.latitude ?? null,
        longitude: match?.longitude ?? null,
      };

      const ref = doc(db, 'profiles', userId as string, 'checkins', initialData.id);
      await updateDoc(ref, docData);
      Alert.alert('Success', 'Check-in updated!');
      router.back();
    } catch (error) {
      console.error('Error updating check-in:', error);
      Alert.alert('Failed to update check-in.');
    }
  };

  useEffect(() => {
    console.log('Initial opponent from initialData:', initialData.opponent);
    console.log('selectedOpponent on mount:', selectedOpponent);
  }, []);

  // APPLY ARENA NAME HISTORY BASED ON EXISTING CHECK-IN DATE
  useEffect(() => {
    const selectedDate = gameDate;

    const processed = arenasData.map(arena => {
      const history = arenaHistoryData.find(
        h =>
          h.teamName === arena.teamName &&
          h.league === arena.league
      );

      if (!history) {
        return { ...arena, arena: arena.arena };
      }

      const correct = history.history.find(h => {
        const from = new Date(h.from);
        const to = h.to ? new Date(h.to) : null;

        return (
          selectedDate >= from &&
          (to === null || selectedDate <= to)
        );
      });

      return {
        ...arena,
        arena: correct ? correct.name : arena.arena,

        // Keep the modern arena colors even when name changes
        color: arena.color,
        colorCode: arena.colorCode,
        SecondaryColor: arena.SecondaryColor,
      };
    });

    const allArenas = [...processed, ...historicalTeamsData];

    setArenas(allArenas);

    const leagues = [...new Set(allArenas.map(a => a.league))];
    setLeagueItems(leagues.map(l => ({ label: l, value: l })));
  }, [gameDate]);

  // League + Date → populate arenas & teams with correct historical names + date filter
  useEffect(() => {
    if (!selectedLeague) {
      setArenaItems([]);
      setHomeTeamItems([]);
      return;
    }

    const date = gameDate;

    // --- Arenas (with historical names) ---
    const arenaOptions: any[] = [];

    // Historical names
    for (const h of arenaHistoryData) {
      if (h.league !== selectedLeague) continue;
      const active = h.history.find(entry => {
        const from = new Date(entry.from);
        const to = entry.to ? new Date(entry.to) : null;
        return date >= from && (to === null || date <= to);
      });
      if (active) arenaOptions.push({ label: active.name, value: active.name });
    }

    // Current names (unless overridden)
    for (const a of arenasData) {
      if (a.league !== selectedLeague) continue;
      const overridden = arenaHistoryData.some(h => {
        if (h.league !== selectedLeague || h.currentArena !== a.arena) return false;
        return h.history.some(entry => {
          const from = new Date(entry.from);
          const to = entry.to ? new Date(entry.to) : null;
          return date >= from && (to === null || date <= to) && entry.name !== a.arena;
        });
      });
      if (!overridden) arenaOptions.push({ label: a.arena, value: a.arena });
    }

    const uniqueArenas = Array.from(new Map(arenaOptions.map(i => [i.value, i])).values())
      .sort((a, b) => a.label.localeCompare(b.label));
    setArenaItems(uniqueArenas);

    // --- Home Teams (filtered by startDate/endDate) ---
    const validTeams = arenas.filter(team => {
      if (team.league !== selectedLeague) return false;
      const start = team.startDate ? new Date(team.startDate) : new Date(0);
      const end = team.endDate ? new Date(team.endDate) : null;
      return date >= start && (!end || date <= end);
    });

    const uniqueTeams = Array.from(new Set(validTeams.map(a => a.teamName)))
      .sort();
    setHomeTeamItems(uniqueTeams.map(t => ({ label: t, value: t })));

  }, [selectedLeague, gameDate]);

  // Arena selected → set correct Home Team (works with historical names)
  useEffect(() => {
    if (!selectedArena || !selectedLeague) return;

    const historical = arenaHistoryData.find(h =>
      h.league === selectedLeague &&
      h.history.some(entry => entry.name === selectedArena)
    );

    let teamName = null;

    if (historical) {
      const current = arenasData.find(a => a.arena === historical.currentArena && a.league === selectedLeague);
      teamName = current?.teamName;
    } else {
      const current = arenasData.find(a => a.arena === selectedArena && a.league === selectedLeague);
      teamName = current?.teamName;
    }

    if (teamName) {
      setHomeTeamItems([{ label: teamName, value: teamName }]);
      setSelectedHomeTeam(teamName);
    } else {
      setHomeTeamItems([]);
      setSelectedHomeTeam(null);
    }
  }, [selectedArena, selectedLeague]);

  // Home Team selected → set correct Arena (with historical name)
  useEffect(() => {
    if (!selectedHomeTeam || !selectedLeague) return;

    const teamEntry = arenasData.find(a => a.teamName === selectedHomeTeam && a.league === selectedLeague);
    if (!teamEntry) return;

    const date = gameDate;

    const historical = arenaHistoryData.find(h =>
      h.currentArena === teamEntry.arena && h.league === selectedLeague
    );

    let correctName = teamEntry.arena;

    if (historical) {
      const active = historical.history.find(entry => {
        const from = new Date(entry.from);
        const to = entry.to ? new Date(entry.to) : null;
        return date >= from && (to === null || date <= to);
      });
      if (active) correctName = active.name;
    }

    setArenaItems([{ label: correctName, value: correctName }]);
    setSelectedArena(correctName);
  }, [selectedHomeTeam, selectedLeague, gameDate]);

  useEffect(() => {
    if (!selectedLeague || !selectedHomeTeam) {
      setOpponentItems([]);
      setSelectedOpponent(null);
      return;
    }

    const date = gameDate;

    // Use exact same filtering as homeTeamItems for consistency
    const validTeams = arenas.filter(team => {
      if (team.league !== selectedLeague) return false;

      const start = team.startDate ? new Date(team.startDate) : new Date(0);
      const end = team.endDate ? new Date(team.endDate) : null;

      return date >= start && (!end || date <= end);
    });

    let opponentOptions = validTeams
      .filter(team => team.teamName !== selectedHomeTeam)  // exclude home
      .map(team => ({ label: team.teamName, value: team.teamName }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Dedupe
    opponentOptions = Array.from(new Map(opponentOptions.map(i => [i.value, i])).values());

    // Preserve saved opponent in list + selected ONLY if original context
    const isOriginalContext = selectedLeague === initialData.league && selectedHomeTeam === initialData.teamName;

    if (isOriginalContext && initialData.opponent) {
      const savedInList = opponentOptions.some(o => o.value === initialData.opponent);
      if (!savedInList) {
        opponentOptions.push({ label: initialData.opponent, value: initialData.opponent });
        opponentOptions.sort((a, b) => a.label.localeCompare(b.label));
      }
      // Ensure selected stays (it already is from initial state)
    } else {
      // Not original – if current selected is invalid, clear it
      if (selectedOpponent && !opponentOptions.some(o => o.value === selectedOpponent)) {
        setSelectedOpponent(null);
      }
    }

    setOpponentItems(opponentOptions);

    // NO auto-select ever
  }, [selectedLeague, selectedHomeTeam, arenas, gameDate, initialData.league, initialData.teamName, initialData.opponent]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const selectedURI = result.assets[0].uri;
      setImages([selectedURI]);
    }
  };

  const styles = StyleSheet.create({
    buySectionLabel: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginBottom: 12 },
    container: { padding: 20, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, },
    categoryContainer: { marginBottom: 14 },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, backgroundColor: colorScheme === 'dark' ? '#334155' : '#E0E7FF', paddingHorizontal: 16, borderRadius: 8 },
    categoryTitle: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    checkboxLabel: { marginLeft: 12, fontSize: 15, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
    choiceButton: { borderWidth: 0, borderRadius: 30, paddingVertical: 8, paddingHorizontal: 16, marginRight: 10 },
    choiceButtonSelected: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#5E819F' : '#0D2C42' },
    choiceButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, fontWeight: '600' },
    choiceButtonTextSelected: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700' },
    companionsPlaceholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666' },
    dateDisplayText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    dropdown: { marginBottom: 14, borderColor: colorScheme === 'dark' ? '#334155' : '#0D2C42', borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' },
    dropDownContainer: { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', borderColor: colorScheme === 'dark' ? '#334155' : '#E2E8F0' },
    dropDownText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    dropDownListEmpty: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666' },
    dropdownPlaceholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666' },
    Placeholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666' },
    input: { borderWidth: 2, borderColor: colorScheme === 'dark' ? '#334155' : '#0D2C42', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' },
    label: { fontSize: 16, fontWeight: '600', marginTop: 18, marginBottom: 6, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    merchConcessionsContainer: { marginTop: 20, marginBottom: 20, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9', padding: 16, borderRadius: 12 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    scoreLabel: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    scoreInput: { width: 60, textAlign: 'center', marginBottom: 0 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    seatInfoTitle: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    seatInfoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
    seatLabel: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginRight: 6 },
    seatLabelRow: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginLeft: 12, marginRight: 6 },
    seatInput: { width: 50, textAlign: 'center', marginBottom: 0 },
    submitButton: { backgroundColor: '#0A2940', paddingVertical: 14, borderRadius: 10, marginBottom: 40, width: '50%', alignSelf: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2F4F68', },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '600', },
    uploadPhotoText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
  });

  return (
    <View style={styles.screenBackground}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Game Date:</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.input}
        >
          <Text style={styles.dateDisplayText}>{gameDate.toDateString()}</Text>
        </TouchableOpacity>

        <DropDownPicker
          open={leagueOpen}
          value={selectedLeague}
          items={leagueItems}
          setOpen={setLeagueOpen}
          setValue={setSelectedLeague}
          setItems={setLeagueItems}
          placeholder="Select League"
          placeholderStyle={styles.dropdownPlaceholder}
          style={styles.dropdown}
          zIndex={5000}
          listMode="SCROLLVIEW"
          dropDownContainerStyle={styles.dropDownContainer}
          textStyle={styles.dropDownText}
          listEmptyTextStyle={styles.dropDownListEmpty}
        />

        <DropDownPicker
          open={arenaOpen}
          value={selectedArena}
          items={arenaItems}
          setOpen={setArenaOpen}
          setValue={setSelectedArena}
          setItems={setArenaItems}
          placeholder="Select Arena"
          placeholderStyle={styles.dropdownPlaceholder}
          style={styles.dropdown}
          zIndex={4000}
          listMode="SCROLLVIEW"
          dropDownContainerStyle={styles.dropDownContainer}
          textStyle={styles.dropDownText}
          listEmptyTextStyle={styles.dropDownListEmpty}
        />

        <DropDownPicker
          open={homeTeamOpen}
          value={selectedHomeTeam}
          items={homeTeamItems}
          setOpen={setHomeTeamOpen}
          setValue={setSelectedHomeTeam}
          setItems={setHomeTeamItems}
          placeholder="Select Home Team"
          placeholderStyle={styles.dropdownPlaceholder}
          style={styles.dropdown}
          zIndex={3000}
          listMode="SCROLLVIEW"
          dropDownContainerStyle={styles.dropDownContainer}
          textStyle={styles.dropDownText}
          listEmptyTextStyle={styles.dropDownListEmpty}
        />

        <DropDownPicker
          open={opponentTeamOpen}
          value={selectedOpponent}
          items={opponentItems}
          setOpen={setOpponentTeamOpen}
          setValue={setSelectedOpponent}
          setItems={setOpponentItems}
          placeholder="Select Opponent"
          placeholderStyle={styles.dropdownPlaceholder}
          style={styles.dropdown}
          zIndex={2000}
          listMode="SCROLLVIEW"
          dropDownContainerStyle={styles.dropDownContainer}
          textStyle={styles.dropDownText}
          listEmptyTextStyle={styles.dropDownListEmpty}
        />

        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <Pressable
            style={[
              styles.choiceButton,
              styles.choiceButtonSelected,
            ]}
            onPress={() => {
              setSelectedLeague(null);
              setSelectedArena(null);
              setSelectedHomeTeam(null);
              setSelectedOpponent(null);
              setArenaItems([]);
              setHomeTeamItems([]);
              setOpponentItems([]);
            }}
          >
            <Text style={styles.choiceButtonTextSelected}>
              Reset League, Arena, Home Team, Opponent
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Final Score:</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>{ 'Home  '}</Text>
          <TextInput
            value={homeScore}
            onChangeText={setHomeScore}
            style={[styles.input, styles.scoreInput]}
            keyboardType="number-pad"
            placeholder="0"
          />
          <Text style={styles.scoreLabel}>{ '        Away  '}</Text>
          <TextInput
            value={awayScore}
            onChangeText={setAwayScore}
            style={[styles.input, styles.scoreInput]}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>

        <TextInput
          placeholder="Favorite Player"
          placeholderTextColor={styles.Placeholder.color}
          value={favoritePlayer}
          onChangeText={setFavoritePlayer}
          style={styles.input}
        />
        <Text style={styles.seatInfoTitle}>Seat Information</Text>
        <View style={styles.seatInfoRow}>
          <Text style={styles.seatLabel}>Section:</Text>
          <TextInput value={seatSection} onChangeText={setSeatSection} style={[styles.input, styles.seatInput]} />
          <Text style={styles.seatLabelRow}>Row:</Text>
          <TextInput value={seatRow} onChangeText={setSeatRow} style={[styles.input, styles.seatInput]} />
          <Text style={styles.seatLabelRow}>Seat:</Text>
          <TextInput value={seatNumber} onChangeText={setSeatNumber} style={[styles.input, styles.seatInput]} />
        </View>
        <TextInput
          placeholder="Who did you go with?"
          placeholderTextColor={styles.companionsPlaceholder.color}
          value={companions}
          onChangeText={setCompanions}
          style={styles.input}
        />

        <Text style={styles.label}>Upload Photo (1 only):</Text>
        <TouchableOpacity style={styles.input} onPress={pickImage}>
          <Text style={styles.uploadPhotoText}>{images.length > 0 ? 'Replace Photo' : 'Select Photo'}</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 10 }}>
          {images.map((uri, index) => (
            <Image
              key={index}
              source={{ uri }}
              style={{ width: '100%', height: 200, borderRadius: 8 }}
              resizeMode="cover"
            />
          ))}
        </View>

        <View style={styles.merchConcessionsContainer}>
          {/* Merch section */}
          <Text style={styles.buySectionLabel}>Did you buy any merch?</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <Pressable
              style={[
                styles.choiceButton,
                didBuyMerch === true && styles.choiceButtonSelected,
              ]}
              onPress={() => setDidBuyMerch(true)}
            >
              <Text style={[
                styles.choiceButtonText,
                didBuyMerch === true && styles.choiceButtonTextSelected
              ]}>
                Yes
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.choiceButton,
                didBuyMerch === false && styles.choiceButtonSelected,
              ]}
              onPress={() => setDidBuyMerch(false)}
            >
              <Text style={[
                styles.choiceButtonText,
                didBuyMerch === false && styles.choiceButtonTextSelected
              ]}>
                No
              </Text>
            </Pressable>
          </View>

          {didBuyMerch && (
            <>
              {Object.keys(merchCategories).map((category) => (
                <View key={category} style={styles.categoryContainer}>
                  <Pressable
                    onPress={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [category]: !prev[category],
                      }))
                    }
                    style={styles.categoryHeader}
                  >
                    <Text style={styles.categoryTitle}>{category}</Text>
                    <AntDesign
                      name={expandedCategories[category] ? 'up' : 'down'}
                      size={16}
                      color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
                    />
                  </Pressable>

                  {expandedCategories[category] &&
                    merchCategories[category].map((item) => (
                      <View key={item} style={styles.checkboxRow}>
                        <Checkbox
                          value={merchItems[item] || false}
                          onValueChange={(v) =>
                            setMerchItems((prev) => ({ ...prev, [item]: v }))
                          }
                        />
                        <Text style={styles.checkboxLabel}>{item}</Text>
                      </View>
                    ))}
                  </View>
              ))}
            </>
          )}

          {/* Concessions section */}
          <Text style={styles.buySectionLabel}>Did you buy any concessions?</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <Pressable
              style={[
                styles.choiceButton,
                didBuyConcessions === true && styles.choiceButtonSelected,
              ]}
              onPress={() => setDidBuyConcessions(true)}
            >
              <Text style={[
                styles.choiceButtonText,
                didBuyConcessions === true && styles.choiceButtonTextSelected
              ]}>
                Yes
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.choiceButton,
                didBuyConcessions === false && styles.choiceButtonSelected,
              ]}
              onPress={() => setDidBuyConcessions(false)}
            >
              <Text style={[
                styles.choiceButtonText,
                didBuyConcessions === false && styles.choiceButtonTextSelected
              ]}>
                No
              </Text>
            </Pressable>
          </View>

          {didBuyConcessions && (
            <>
              {Object.keys(concessionCategories).map((category) => (
                <View key={category} style={styles.categoryContainer}>
                  <Pressable
                    onPress={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [category]: !prev[category],
                      }))
                    }
                    style={styles.categoryHeader}
                  >
                    <Text style={styles.categoryTitle}>{category}</Text>
                    <AntDesign
                      name={expandedCategories[category] ? 'up' : 'down'}
                      size={16}
                      color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
                    />
                  </Pressable>

                  {expandedCategories[category] &&
                    concessionCategories[category].map((item) => (
                      <View key={item} style={styles.checkboxRow}>
                        <Checkbox
                          value={concessionItems[item] || false}
                          onValueChange={(v) =>
                            setConcessionItems((prev) => ({ ...prev, [item]: v }))
                          }
                        />
                        <Text style={styles.checkboxLabel}>{item}</Text>
                      </View>
                    ))}
                </View>
              ))}
            </>
          )}
        </View>

        <TextInput
          placeholder="Highlights"
          placeholderTextColor={styles.Placeholder.color}
          value={highlights}
          onChangeText={setHighlights}
          style={styles.input}
          multiline
        />

        <TextInput
          placeholder="Parking and Travel Tips"
          placeholderTextColor={styles.Placeholder.color}
          value={parkingAndTravel}
          onChangeText={setParkingAndTravel}
          style={styles.input}
          multiline
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleSave}>
          <Text style={styles.submitText}>Save Changes</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={gameDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setGameDate(selectedDate);
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}