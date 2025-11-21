//app/checkin/manual.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Image, TouchableOpacity } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import Checkbox from 'expo-checkbox';
import { Pressable } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseApp from '../../firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from "expo-router";

import arenasData from '../../assets/data/arenas.json';
import historicalTeamsData from '../../assets/data/historicalTeams.json';
import arenaHistoryData from '../../assets/data/arenaHistory.json';

const db = getFirestore(firebaseApp);

const ManualCheckIn = () => {
  const [gameDate, setGameDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [arenas, setArenas] = useState([]);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [arenaOpen, setArenaOpen] = useState(false);
  const [homeTeamOpen, setHomeTeamOpen] = useState(false);
  const [opponentTeamOpen, setOpponentTeamOpen] = useState(false);

  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedArena, setSelectedArena] = useState(null);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [favoritePlayer, setFavoritePlayer] = useState('');
  const [seatSection, setSeatSection] = useState('');
  const [seatRow, setSeatRow] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [didBuyMerch, setDidBuyMerch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [merchItems, setMerchItems] = useState({});
  const [didBuyConcessions, setDidBuyConcessions] = useState(false);
  const [concessionItems, setConcessionItems] = useState({});
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

  const handleCheckInSubmit = async () => {
    try {
      const user = getAuth(firebaseApp).currentUser;
      if (!user) {
        alert('You must be logged in to submit a check-in.');
        return;
      }

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
        checkinType: 'Manual',
        photos: images,
        userId: user.uid,
        timestamp: serverTimestamp(),
        latitude: match?.latitude ?? null,
        longitude: match?.longitude ?? null,
      };

      await addDoc(collection(db, 'profiles', user.uid, 'checkins'), docData);
      alert('Check-in saved!');
    } catch (error) {
      console.error('Error saving check-in:', error);
      alert('Failed to save check-in.');
    }
  };

  // league dropdown
  useEffect(() => {
    const selectedDate = gameDate;

    const processed = arenasData.map(arena => {
      const history = arenaHistoryData.find(
        h =>
          h.teamName === arena.teamName &&
          h.league === arena.league
      );

      // If team has no history → return arena unchanged
      if (!history) {
        return { ...arena, arena: arena.arena };
      }

      // Team HAS history → determine correct name
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

    // Also include historicalTeamsData unchanged
    const allArenas = [...processed, ...historicalTeamsData];

    setArenas(allArenas);

    const leagues = [...new Set(allArenas.map(a => a.league))];
    setLeagueItems(leagues.map(l => ({ label: l, value: l })));
  }, [gameDate]);

  // League → arena dropdown WITH ARENA HISTORY SUPPORT
  useEffect(() => {
    if (!selectedLeague) return;

    const selectedDate = gameDate; // <— we use the user's chosen date

    // 1. FILTER ARENAS BY LEAGUE
    let filtered = arenas.filter(a => a.league === selectedLeague);

    // 2. APPLY ARENA HISTORY FILTERING
    const finalArenaNames = new Set<string>();

    filtered.forEach(arenaItem => {
      const historyRecord = arenaHistoryData.find(
        h =>
          h.teamName === arenaItem.teamName &&
          h.league === selectedLeague
      );

      // If this team has NO history → always include the arena
      if (!historyRecord) {
        finalArenaNames.add(arenaItem.arena);
        return;
      }

      // If the team DOES have history → pick the correct arena version
      const record = historyRecord.history.find(h => {
        const from = new Date(h.from);
        const to = h.to ? new Date(h.to) : null;

        return (
          selectedDate >= from &&
          (to === null || selectedDate <= to)
        );
      });

      if (record) {
        finalArenaNames.add(record.name);
      }
    });

    // 3. BUILD ARENA DROPDOWN
    const arenaList = Array.from(finalArenaNames)
      .sort()
      .map(a => ({ label: a, value: a }));

    setArenaItems(arenaList);

    // 4. HOMETEAMS (unchanged logic)
    const uniqueTeams = Array.from(
      new Set(filtered.map(a => a.teamName))
    ).sort();

    setHomeTeamItems(uniqueTeams.map(t => ({ label: t, value: t })));

    // 5. RESET SELECTIONS
    setSelectedArena(null);
    setSelectedHomeTeam(null);
    setSelectedOpponent(null);

  }, [selectedLeague, gameDate]);

  // Arena → filter Home Teams
  useEffect(() => {
    if (selectedArena && selectedLeague && arenas.length > 0) {
      const teamsAtArena = arenas
        .filter(item => item.arena === selectedArena && item.league === selectedLeague)
        .map(item => ({ label: item.teamName, value: item.teamName }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setHomeTeamItems(teamsAtArena);

      if (selectedHomeTeam && !teamsAtArena.find(t => t.value === selectedHomeTeam)) {
        setSelectedHomeTeam(null);
      }
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

      if (selectedArena && !arenasForTeam.find(a => a.value === selectedArena)) {
        setSelectedArena(null);
      }
    }
  }, [selectedHomeTeam, selectedLeague, arenas]);

  // Home Team → Opponents (unchanged)
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
      setSelectedOpponent(null);
    }
  }, [selectedHomeTeam, selectedLeague, arenas]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      alert('Permission to access camera roll is required!');
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
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Manual Check-In" }} />
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
        ListEmptyComponent={() => (
          <Text style={{ padding: 20, textAlign: "center", color: "#666" }}>
            Try selecting League first!
          </Text>
        )}
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
        ListEmptyComponent={() => (
          <Text style={{ padding: 20, textAlign: "center", color: "#666" }}>
            Try selecting League first!
          </Text>
        )}
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
        ListEmptyComponent={() => (
          <Text style={{ padding: 20, textAlign: "center", color: "#666" }}>
            Try selecting Home Team first!
          </Text>
        )}
      />

      <TextInput
        placeholder="Favorite Player"
        value={favoritePlayer}
        onChangeText={setFavoritePlayer}
        style={styles.input}
      />
      <Text style={{ fontWeight:"500", marginRight:6, color:"#0A2940" }}>Seat Information</Text>
      <View style={{ flexDirection:"row", alignItems:"center", flexWrap:"wrap", marginBottom:12 }}>
        <Text style={{ fontWeight:"500", marginRight:6, color:"#0A2940" }}>Section:</Text>
        <TextInput value={seatSection} onChangeText={setSeatSection} style={[styles.input,{ width:50, textAlign:"center", marginBottom:0 }]} />
        <Text style={{ fontWeight:"500", marginLeft:12, marginRight:6, color:"#0A2940" }}>Row:</Text>
        <TextInput value={seatRow} onChangeText={setSeatRow} style={[styles.input,{ width:50, textAlign:"center", marginBottom:0 }]} />
        <Text style={{ fontWeight:"500", marginLeft:12, marginRight:6, color:"#0A2940" }}>Seat:</Text>
        <TextInput value={seatNumber} onChangeText={setSeatNumber} style={[styles.input,{ width:50, textAlign:"center", marginBottom:0 }]} />
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

      <TouchableOpacity style={styles.submitButton} onPress={handleCheckInSubmit}>
        <Text style={styles.submitText}>Submit</Text>
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
};

export default ManualCheckIn;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 100,   // ← adds safe space at the bottom
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#0D2C42',
    marginTop: 10,
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  dropdown: {
    marginBottom: 14,
    borderColor: '#0D2C42',
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 6,
    color: '#0D2C42',
  },
  input: {
    borderWidth: 2,
    borderColor: '#0D2C42',
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
    color: '#0D2C42',
    textTransform: 'capitalize',
  },
  submitButton: {
    backgroundColor: '#0A2940',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#ffffff44",
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
    backgroundColor: '#0E5B90',
    borderColor: '#0A2940',
  },
  choiceButtonText: {
    color: '#0A2940',
    fontSize: 16,
  },
});