import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Image, TouchableOpacity } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import Checkbox from 'expo-checkbox';
import arenasData from '../../assets/data/arenas.json';
import { Pressable } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseApp from '../../firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

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
  const [seatInfo, setSeatInfo] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [didBuyMerch, setDidBuyMerch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [merchItems, setMerchItems] = useState({});
  const [didBuyConcessions, setDidBuyConcessions] = useState(false);
  const [concessionItems, setConcessionItems] = useState({});
  const merchCategories = {
      'Jerseys': ['Home Jersey', 'Away Jersey', 'Third Jersey', 'Retro Jersey', 'Custom Jersey', 'Special Occasion Jersey',],
      'Apparel & Headwear': [ 'T-shirt', 'Hoodie', 'Sweatshirt', 'Long sleeve shirt', 'Jacket', 'Windbreaker', 'Beanie', 'Knit cap', 'Snapback hat', 'Dad hat', 'Baseball cap', 'Bucket hat', 'Winter hat', 'Scarf', 'Gloves', 'Socks', 'Shorts', 'Pajama pants', 'Face mask', 'Neck gaiter', 'Baby onesie', 'Toddler gear', ],
      'Equipment & Themed Items': ['Mini stick', 'Foam puck', 'Replica Puck', 'Foam finger', 'Souvenir helmet or goalie mask', 'Signed memorabilia (non-game-used)', ],
      'Game-Used Items': [ 'Game-used puck', 'Game-used stick', 'Game-worn jersey', 'Game-used glove', 'Game-used helmet', ],
      'Toys & Collectibles': ['Bobblehead', 'Plush mascot', 'LEGO-style players', 'Team figurines', 'Keychain', 'Pin / lapel pin', 'Trading cards', 'Souvenir coin / medallion', 'Zamboni toy', ],
      'Printed & Media': ['Team program', 'Poster', 'Schedule magnet', 'Wall calendar', 'Sticker set', 'Decals',],
      'Home & Lifestyle': ['Coffee mug', 'Water bottle', 'Shot glass', 'Beer glass', 'Koozie', 'Blanket', 'Pillow', 'Towel', 'Christmas ornament', 'Wall flag', 'Mousepad', 'Air freshener', 'Magnets', ],
      'Auto Accessories': ['Car flag', 'Window decal', 'Steering wheel cover', 'Seatbelt pad', 'Car magnet', 'Hitch cover', 'License plate frame', ],
      'Bags & Utility': [ 'Drawstring bag', 'Backpack', 'Tote bag', 'Lanyard', 'Phone case', 'Wallet', ],
    };

  const concessionCategories = {
    'Classic Arena Fare': ['Hot Dog', 'Corn Dog', 'Bratwurst', 'Sausage', 'Nachos', 'Soft Pretzel', 'French Fries', 'Cheese Curds', 'Popcorn', 'Pizza Slice', ],
    'Hot Food': ['Chicken Tenders', 'Buffalo Wings', 'Pulled Pork Sandwich', 'Cheeseburger', 'Veggie Burger', 'Loaded Fries', 'Mac and Cheese', ],
    'Cold Food & Snacks': ['Sandwich', 'Salad', 'Fruit Cup', 'Chips', 'Granola Bar', 'Trail Mix', 'Candy', 'Chocolate Bar', ],
    'Desserts & Treats': ['Ice Cream', 'Funnel Cake', 'Mini Donuts', 'Cotton Candy', 'Cookies', 'Brownie', 'Churros', ],
    'Non-Alcoholic Beverages': ['Soda', 'Bottled Water', 'Sports Drink', 'Lemonade', 'Iced Tea', 'Hot Chocolate', 'Coffee', 'Energy Drink', ],
    'Alcoholic Beverages': ['Beer (Domestic)', 'Beer (Craft)', 'Cider', 'Hard Seltzer', 'Wine', 'Cocktail', 'Spiked Slushie', ]
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
        arenaName: selectedArena,
        teamName: selectedHomeTeam,
        opponent: selectedOpponent,
        favoritePlayer,
        seatInfo,
        companions,
        notes,
        merchBought: getSelectedItems(merchItems, merchCategories),
        concessionsBought: getSelectedItems(concessionItems, concessionCategories),
        gameDate: gameDate.toISOString(),
        checkinType: 'manual',
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

  useEffect(() => {
    setArenas(arenasData);
    const leagues = [...new Set(arenasData.map(item => item.league))];
    setLeagueItems(leagues.map(l => ({ label: l, value: l })));
  }, []);

  useEffect(() => {
    if (selectedLeague) {
      const filteredArenas = arenas.filter(a => a.league === selectedLeague);
      const uniqueArenas = Array.from(new Set(filteredArenas.map(a => a.arena)));
      setArenaItems(uniqueArenas.map(a => ({ label: a, value: a })));
      setSelectedArena(null);
      setSelectedHomeTeam(null);
      setSelectedOpponent(null);
    }
  }, [selectedLeague]);

  useEffect(() => {
    if (selectedArena && selectedLeague && arenas.length > 0) {
      const teamsAtArena = arenas
        .filter(
          (item) =>
            item.arena === selectedArena &&
            item.league === selectedLeague
        )
        .map((item) => ({
          label: item.teamName,
          value: item.teamName,
        }));

      setHomeTeamItems(teamsAtArena);
      setSelectedHomeTeam(null); // clear selection when arena changes
    }
  }, [selectedArena]);

  useEffect(() => {
    if (selectedHomeTeam && selectedLeague && arenas.length > 0) {
      const opponentOptions = arenas
        .filter(
          (item) =>
            item.league === selectedLeague && item.teamName !== selectedHomeTeam)
        .map((item) => ({
          label: item.teamName,
          value: item.teamName,
        }));

      // Remove duplicates
      const uniqueOpponents = Array.from(
        new Map(opponentOptions.map((item) => [item.value, item])).values()
      );

      setOpponentItems(uniqueOpponents);
      setSelectedOpponent(null); // reset selection when home team changes
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
      setImages([selectedURI]); // always replace with the new one
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Manual Check-In</Text>

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
      <TextInput
        placeholder="Seat Info"
        value={seatInfo}
        onChangeText={setSeatInfo}
        style={styles.input}
      />
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
        <Text style={styles.submitText}>Submit Check-In</Text>
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
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dropdown: {
    marginBottom: 12,
    zIndex: 10,
  },
  label: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
    textTransform: 'capitalize',
  },
  submitButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 6,
    marginTop: 20,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
  },
  categoryContainer: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  choiceButtonSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  choiceButtonText: {
    color: '#000',
  },
});


