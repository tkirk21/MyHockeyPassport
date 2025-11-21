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

import arenasData from "@/assets/data/arenas.json";
import historicalTeamsData from '@/assets/data/historicalTeams.json';
import arenaHistoryData from "@/assets/data/arenaHistory.json";

const db = getFirestore(firebaseApp);

export default function editCheckinForm({ initialData }: { initialData: any }) {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [gameDate, setGameDate] = useState(new Date(initialData.gameDate || Date.now()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [arenas, setArenas] = useState([]);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [arenaOpen, setArenaOpen] = useState(false);
  const [homeTeamOpen, setHomeTeamOpen] = useState(false);
  const [opponentTeamOpen, setOpponentTeamOpen] = useState(false);

  const [selectedLeague, setSelectedLeague] = useState(initialData.league || null);
  const [selectedArena, setSelectedArena] = useState(initialData.arenaName || null);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState(initialData.teamName || null);
  const [selectedOpponent, setSelectedOpponent] = useState(initialData.opponent || null);
  const [favoritePlayer, setFavoritePlayer] = useState(initialData.favoritePlayer || '');
  const [seatSection, setSeatSection] = useState(initialData.seatInfo?.section || '');
  const [seatRow, setSeatRow] = useState(initialData.seatInfo?.row || '');
  const [seatNumber, setSeatNumber] = useState(initialData.seatInfo?.seat || '');
  const [companions, setCompanions] = useState(initialData.companions || '');
  const [notes, setNotes] = useState(initialData.notes || '');
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
        favoritePlayer,
        seatInfo: {
          section: seatSection,
          row: seatRow,
          seat: seatNumber,
        },
        companions,
        notes,
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

  // League → set both arenas & teams
  useEffect(() => {
    if (selectedLeague) {
      const filtered = arenas.filter(a => a.league === selectedLeague);

      const uniqueArenas = Array.from(new Set(filtered.map(a => a.arena))).sort();
      setArenaItems(uniqueArenas.map(a => ({ label: a, value: a })));

      const uniqueTeams = Array.from(new Set(filtered.map(a => a.teamName))).sort();
      setHomeTeamItems(uniqueTeams.map(t => ({ label: t, value: t })));

      // No reset, since we're pre-populating
    }
  }, [selectedLeague]);

  // Arena → filter Home Teams
  useEffect(() => {
    if (selectedArena && selectedLeague && arenas.length > 0) {
      const teamsAtArena = arenas
        .filter(item => item.arena === selectedArena && item.league === selectedLeague)
        .map(item => ({ label: item.teamName, value: item.teamName }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setHomeTeamItems(teamsAtArena);
    }
  }, [selectedArena, selectedLeague, arenas]);

  // Home Team → filter Arenas
  useEffect(() => {
    if (selectedHomeTeam && selectedLeague && arenas.length > 0) {
      const arenasForTeam = arenas
        .filter(item => item.league === selectedLeague && item.teamName === selectedHomeTeam)
        .map(item => ({ label: item.arena, value: item.arena }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setArenaItems(arenasForTeam);
    }
  }, [selectedHomeTeam, selectedLeague, arenas]);

  // Home Team → Opponents
  useEffect(() => {
    if (selectedHomeTeam && selectedLeague && arenas.length > 0) {
      const opponentOptions = arenas
        .filter(item => item.league === selectedLeague && item.teamName !== selectedHomeTeam)
        .map(item => ({
          label: item.teamName,
          value: item.teamName,
        }));

      const uniqueOpponents = Array.from(
        new Map(opponentOptions.map(item => [item.value, item])).values()
      ).sort((a, b) => a.label.localeCompare(b.label));

      setOpponentItems(uniqueOpponents);
    }
  }, [selectedHomeTeam, selectedLeague, arenas]);

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Check-In</Text>

      <Text style={styles.label}>Game Date:</Text>
      <TouchableOpacity
        onPress={() => setShowDatePicker(true)}
        style={styles.input}
      >
        <Text>{gameDate.toDateString()}</Text>
      </TouchableOpacity>

      <DropDownPicker
        open={leagueOpen}
        value={selectedLeague}
        items={leagueItems}
        setOpen={setLeagueOpen}
        setValue={setSelectedLeague}
        setItems={setLeagueItems}
        placeholder="Select League"
        style={styles.dropdown}
        zIndex={5000}
        listMode="SCROLLVIEW"
      />

      <DropDownPicker
        open={arenaOpen}
        value={selectedArena}
        items={arenaItems}
        setOpen={setArenaOpen}
        setValue={setSelectedArena}
        setItems={setArenaItems}
        placeholder="Select Arena"
        style={styles.dropdown}
        zIndex={4000}
        listMode="SCROLLVIEW"
      />

      <DropDownPicker
        open={homeTeamOpen}
        value={selectedHomeTeam}
        items={homeTeamItems}
        setOpen={setHomeTeamOpen}
        setValue={setSelectedHomeTeam}
        setItems={setHomeTeamItems}
        placeholder="Select Home Team"
        style={styles.dropdown}
        zIndex={3000}
        listMode="SCROLLVIEW"
      />

      <DropDownPicker
        open={opponentTeamOpen}
        value={selectedOpponent}
        items={opponentItems}
        setOpen={setOpponentTeamOpen}
        setValue={setSelectedOpponent}
        setItems={setOpponentItems}
        placeholder="Select Opponent"
        style={styles.dropdown}
        zIndex={2000}
        listMode="SCROLLVIEW"
      />

      <TextInput
        placeholder="Favorite Player"
        value={favoritePlayer}
        onChangeText={setFavoritePlayer}
        style={styles.input}
      />
      <Text style={{ fontWeight: "500", marginRight: 6, color: "#0A2940" }}>Seat Information</Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <Text style={{ fontWeight: "500", marginRight: 6, color: "#0A2940" }}>Section:</Text>
        <TextInput value={seatSection} onChangeText={setSeatSection} style={[styles.input, { width: 50, textAlign: "center", marginBottom: 0 }]} />
        <Text style={{ fontWeight: "500", marginLeft: 12, marginRight: 6, color: "#0A2940" }}>Row:</Text>
        <TextInput value={seatRow} onChangeText={setSeatRow} style={[styles.input, { width: 50, textAlign: "center", marginBottom: 0 }]} />
        <Text style={{ fontWeight: "500", marginLeft: 12, marginRight: 6, color: "#0A2940" }}>Seat:</Text>
        <TextInput value={seatNumber} onChangeText={setSeatNumber} style={[styles.input, { width: 50, textAlign: "center", marginBottom: 0 }]} />
      </View>
      <TextInput
        placeholder="Who did you go with?"
        value={companions}
        onChangeText={setCompanions}
        style={styles.input}
      />
      <TextInput
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        style={styles.input}
        multiline
      />

      <Text style={styles.label}>Upload Photo (1 only):</Text>
      <TouchableOpacity style={styles.input} onPress={pickImage}>
        <Text>{images.length > 0 ? 'Replace Photo' : 'Select Photo'}</Text>
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

      <Text style={styles.label}>Did you buy any merch?</Text>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Pressable
          style={[
            styles.choiceButton,
            didBuyMerch === true && styles.choiceButtonSelected,
          ]}
          onPress={() => setDidBuyMerch(true)}
        >
          <Text style={styles.choiceButtonText}>Yes</Text>
        </Pressable>

        <Pressable
          style={[
            styles.choiceButton,
            didBuyMerch === false && styles.choiceButtonSelected,
          ]}
          onPress={() => setDidBuyMerch(false)}
        >
          <Text style={styles.choiceButtonText}>No</Text>
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
                  color="black"
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

      <Text style={styles.label}>Did you buy any concessions?</Text>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Pressable
          style={[
            styles.choiceButton,
            didBuyConcessions === true && styles.choiceButtonSelected,
          ]}
          onPress={() => setDidBuyConcessions(true)}
        >
          <Text style={styles.choiceButtonText}>Yes</Text>
        </Pressable>

        <Pressable
          style={[
            styles.choiceButton,
            didBuyConcessions === false && styles.choiceButtonSelected,
          ]}
          onPress={() => setDidBuyConcessions(false)}
        >
          <Text style={styles.choiceButtonText}>No</Text>
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
                  color="black"
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
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0A2940',
    marginBottom: 20,
    textAlign: 'center',
  },
  dropdown: {
    marginBottom: 14,
    borderColor: '#CBD5E0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 6,
    color: '#0A2940',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#0A2940',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#0A2940',
    textTransform: 'capitalize',
  },
  submitButton: {
    backgroundColor: '#0A2940',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 28,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryContainer: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2940',
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  choiceButtonSelected: {
    backgroundColor: '#0A2940',
    borderColor: '#0A2940',
  },
  choiceButtonText: {
    color: '#0A2940',
    fontSize: 16,
  },
});