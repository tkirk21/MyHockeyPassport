//app/checkin/manual.tsx
import Checkbox from 'expo-checkbox';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from "expo-router";
import { AntDesign } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseApp from '../../firebaseConfig';
import React, { useEffect, useState, } from 'react';
import { KeyboardAvoidingView, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DropDownPicker from 'react-native-dropdown-picker';

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
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
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

    const processed = arenasData
      .filter(arena => !arena.startDate || selectedDate >= new Date(arena.startDate))
      .map(arena => {
        const history = arenaHistoryData.find(h => h.teamName === arena.teamName && h.league === arena.league);
        if (!history) return arena;

        const correct = history.history.find(h => {
          const from = new Date(h.from);
          const to = h.to ? new Date(h.to) : null;
          return selectedDate >= from && (!to || selectedDate <= to);
        });

        return correct ? { ...arena, arena: correct.name } : arena;
      });

    // Process historical teams (with history rename)
    const processedHistorical = historicalTeamsData
      .filter(hist => {
        const start = new Date(hist.startDate);
        const end = hist.endDate ? new Date(hist.endDate) : null;
        return selectedDate >= start && (!end || selectedDate <= end);
      })
      .map(arena => {
        const history = arenaHistoryData.find(h => h.teamName === arena.teamName && h.league === arena.league);
        if (!history) return arena;

        const correct = history.history.find(h => {
          const from = new Date(h.from);
          const to = h.to ? new Date(h.to) : null;
          return selectedDate >= from && (!to || selectedDate <= to);
        });

        return correct ? { ...arena, arena: correct.name } : arena;
      });

    const allArenas = [...processed, ...processedHistorical];

    setArenas(allArenas);

    const leagues = [...new Set(allArenas.map(a => a.league))];
    setLeagueItems(leagues.map(l => ({ label: l, value: l })));
  }, [gameDate]);

  // League → set both arenas & teams
  useEffect(() => {
    if (!selectedLeague) return;

    const selectedDate = gameDate; // <— we use the user's chosen date

    // 1. FILTER ARENAS BY LEAGUE
    let filtered = arenas.filter(a => a.league === selectedLeague);

    // 2. APPLY ARENA HISTORY FILTERING
const validArenas = filtered.filter(arenaItem => {
      const start = arenaItem.startDate ? new Date(arenaItem.startDate) : new Date(0);
      const end = arenaItem.endDate ? new Date(arenaItem.endDate) : null;
      return selectedDate >= start && (!end || selectedDate <= end);
    });

    const finalArenaNames = new Set<string>();

    validArenas.forEach(arenaItem => {
      const historyRecord = arenaHistoryData.find(h =>
        h.teamName === arenaItem.teamName && h.league === selectedLeague
      );

      let nameToAdd = arenaItem.arena;

      if (historyRecord) {
        const record = historyRecord.history.find(h => {
          const from = new Date(h.from);
          const to = h.to ? new Date(h.to) : null;
          return selectedDate >= from && (!to || selectedDate <= to);
        });
        if (record) nameToAdd = record.name;
      }

      finalArenaNames.add(nameToAdd);
    });

    const arenaList = Array.from(finalArenaNames)
      .sort()
      .map(a => ({ label: a, value: a }));

    setArenaItems(arenaList);

    // 4. HOMETEAMS — NOW FILTERED BY DATE USING startDate/endDate
    const validTeams = filtered.filter(team => {
      const start = team.startDate ? new Date(team.startDate) : new Date(0);
      const end = team.endDate ? new Date(team.endDate) : null;

      return selectedDate >= start && (!end || selectedDate <= end);
    });

    const uniqueTeams = Array.from(new Set(validTeams.map(a => a.teamName)))
      .sort();

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

// Home Team → filter Arenas (with neutral site override)
  useEffect(() => {
    if (!selectedLeague) {
      setArenaItems([]);
      return;
    }

    // If user has manually selected "Neutral Site", show all arenas in league
    if (selectedArena === 'Neutral Site') {
      const allArenasInLeague = arenas
        .filter(item => item.league === selectedLeague)
        .map(item => ({ label: item.arena, value: item.arena }))
        .sort((a, b) => a.label.localeCompare(b.label));

      // Add "Neutral Site" as first option so they can keep it selected
      setArenaItems([{ label: 'Neutral Site', value: 'Neutral Site' }, ...allArenasInLeague]);
      return;
    }

    // Normal behavior – filter by home team
    if (selectedHomeTeam) {
      const arenasForTeam = arenas
        .filter(item => item.league === selectedLeague && item.teamName === selectedHomeTeam)
        .map(item => ({ label: item.arena, value: item.arena }))
        .sort((a, b) => a.label.localeCompare(b.label));

      // Add "Neutral Site" option at the top
      setArenaItems([{ label: 'Neutral Site', value: 'Neutral Site' }, ...arenasForTeam]);
    } else {
      // No home team selected – show "Neutral Site" only
      setArenaItems([{ label: 'Neutral Site', value: 'Neutral Site' }]);
    }
  }, [selectedHomeTeam, selectedLeague, arenas, selectedArena]);

  // Home Team → Opponents (with date filter)
  useEffect(() => {
    if (selectedHomeTeam && selectedLeague && arenas.length > 0 && gameDate) {
      const gameDateObj = new Date(gameDate);

      const opponentOptions = arenas
        .filter(item => {
          if (item.league !== selectedLeague || item.teamName === selectedHomeTeam) return false;

          const start = item.startDate ? new Date(item.startDate) : new Date(0); // very early if no start
          const end = item.endDate ? new Date(item.endDate) : new Date(9999, 11, 31); // future if null

          return gameDateObj >= start && gameDateObj <= end;
        })
        .map(item => ({
          label: item.teamName,
          value: item.teamName,
        }));

      const uniqueOpponents = Array.from(
        new Map(opponentOptions.map(item => [item.value, item])).values()
      ).sort((a, b) => a.label.localeCompare(b.label));

      setOpponentItems(uniqueOpponents);
      setSelectedOpponent(null);
    } else {
      setOpponentItems([]);
    }
  }, [selectedHomeTeam, selectedLeague, arenas, gameDate]);

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
              What if you don't Know the Arena name? Try select Home team
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

      <Text style={styles.label}>Final Score:</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '500', marginRight: 6, color: '#0A2940' }}>{selectedHomeTeam || 'Home'}:</Text>
        <TextInput
          value={homeScore}
          onChangeText={setHomeScore}
          style={[styles.input, { width: 60, textAlign: 'center', marginBottom: 0 }]}
          keyboardType="number-pad"
          placeholder="0"
        />
        <Text style={{ fontWeight: '500', marginHorizontal: 12, color: '#0A2940' }}> - </Text>
        <Text style={{ fontWeight: '500', marginRight: 6, color: '#0A2940' }}>{selectedOpponent || 'Away'}:</Text>
        <TextInput
          value={awayScore}
          onChangeText={setAwayScore}
          style={[styles.input, { width: 60, textAlign: 'center', marginBottom: 0 }]}
          keyboardType="number-pad"
          placeholder="0"
        />
      </View>

        <TextInput
          placeholder="Favorite Player"
          value={favoritePlayer}
          onChangeText={setFavoritePlayer}
          style={styles.input}
        />
        <Text style={styles.label}>Seat Information:</Text>
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

        <TextInput
          placeholder="Notes"
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
          multiline
        />

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
    </KeyboardAvoidingView>
  );
};

export default ManualCheckIn;

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100, backgroundColor: '#FFFFFF', },
  categoryContainer: { marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10, },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, },
  categoryTitle: { fontSize: 16, fontWeight: '600', color: '#0A2940', },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, },
  checkboxLabel: { marginLeft: 10, fontSize: 16, color: '#0D2C42', textTransform: 'capitalize', },
  choiceButton: { borderWidth: 2, borderColor: '#0D2C42', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, },
  choiceButtonSelected: { backgroundColor: '#1A3A5A', borderColor: '#1A3A5A', },
  choiceButtonTextSelected: { color: '#FFFFFF', fontWeight: '700', },
  choiceButtonText: { color: '#0D2C42', fontSize: 16, },
  dropdown: { marginBottom: 14, borderColor: '#0D2C42', borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, },
  input: { borderWidth: 2, borderColor: '#0D2C42', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#0A2940', },
  label: { fontSize: 16, fontWeight: '600', marginTop: 18, marginBottom: 6, color: '#0D2C42', },
  scrollContainer: { padding: 16, paddingBottom: 100, },
  submitButton: { backgroundColor: '#0A2940', paddingVertical: 14, borderRadius: 30, marginBottom: -20, width: '50%', alignSelf: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2F4F68', },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600', },
});