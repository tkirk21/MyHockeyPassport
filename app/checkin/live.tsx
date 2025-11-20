// app/checkin/live.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Pressable, SafeAreaView } from 'react-native';
import Checkbox from 'expo-checkbox';
import { AntDesign } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseApp from '../../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';

const db = getFirestore(firebaseApp);

// helper to normalize expo-router params (string | string[] | undefined) -> string
const toStr = (v: any) => Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default function LiveCheckInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const league = toStr(params.league);
  const arenaName = toStr(params.arenaName);
  const homeTeam = toStr(params.homeTeam);
  const opponent = toStr(params.opponent);
  const gameDate = toStr(params.gameDate);

  const [seatSection, setSeatSection] = useState('');
  const [seatRow, setSeatRow] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [favoritePlayer, setFavoritePlayer] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [didBuyMerch, setDidBuyMerch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [merchItems, setMerchItems] = useState<Record<string, boolean>>({});

  const [didBuyConcessions, setDidBuyConcessions] = useState(false);
  const [concessionItems, setConcessionItems] = useState<Record<string, boolean>>({});

  // --- SAME CATEGORIES AS manual.tsx ---
  const merchCategories: Record<string, string[]> = {
    'Jerseys': ['Home Jersey', 'Away Jersey', 'Third Jersey', 'Retro Jersey', 'Custom Jersey', 'Special Occasion Jersey'],
    'Apparel & Headwear': [
      'T-shirt','Hoodie','Sweatshirt','Long sleeve shirt','Jacket','Windbreaker',
      'Beanie','Knit cap','Snapback hat','Dad hat','Baseball cap','Bucket hat',
      'Winter hat','Scarf','Gloves','Socks','Shorts','Pajama pants','Face mask',
      'Neck gaiter','Baby onesie','Toddler gear'
    ],
    'Equipment & Themed Items': ['Mini stick','Foam puck','Replica Puck','Foam finger','Souvenir helmet or goalie mask','Signed memorabilia (non-game-used)'],
    'Game-Used Items': ['Game-used puck','Game-used stick','Game-worn jersey','Game-used glove','Game-used helmet'],
    'Toys & Collectibles': ['Bobblehead','Plush mascot','LEGO-style players','Team figurines','Keychain','Pin / lapel pin','Trading cards','Souvenir coin / medallion','Zamboni toy'],
    'Printed & Media': ['Team program','Poster','Schedule magnet','Wall calendar','Sticker set','Decals'],
    'Home & Lifestyle': ['Coffee mug','Water bottle','Shot glass','Beer glass','Koozie','Blanket','Pillow','Towel','Christmas ornament','Wall flag','Mousepad','Air freshener','Magnets'],
    'Auto Accessories': ['Car flag','Window decal','Steering wheel cover','Seatbelt pad','Car magnet','Hitch cover','License plate frame'],
    'Bags & Utility': ['Drawstring bag','Backpack','Tote bag','Lanyard','Phone case','Wallet'],
  };

  const concessionCategories: Record<string, string[]> = {
    'Classic Arena Fare': ['Hot Dog','Corn Dog','Bratwurst','Sausage','Nachos','Soft Pretzel','French Fries','Cheese Curds','Popcorn','Pizza Slice'],
    'Hot Food': ['Chicken Tenders','Buffalo Wings','Pulled Pork Sandwich','Cheeseburger','Veggie Burger','Loaded Fries','Mac and Cheese'],
    'Cold Food & Snacks': ['Sandwich','Salad','Fruit Cup','Chips','Granola Bar','Trail Mix','Candy','Chocolate Bar'],
    'Desserts & Treats': ['Ice Cream','Funnel Cake','Mini Donuts','Cotton Candy','Cookies','Brownie','Churros'],
    'Non-Alcoholic Beverages': ['Soda','Bottled Water','Sports Drink','Lemonade','Iced Tea','Hot Chocolate','Coffee','Energy Drink'],
    'Alcoholic Beverages': ['Beer (Domestic)','Beer (Craft)','Cider','Hard Seltzer','Wine','Cocktail','Spiked Slushie'],
  };

  const getSelectedItems = (source: Record<string, boolean>, categories: Record<string, string[]>) => {
    const out: Record<string, string[]> = {};
    Object.keys(categories).forEach(cat => {
      out[cat] = categories[cat].filter(item => source[item]);
    });
    return out;
  };

  const handleCheckInSubmit = async () => {
    try {
      const user = getAuth(firebaseApp).currentUser;
      if (!user) {
        alert('You must be logged in to submit a check-in.');
        return;
      }

      const docData = {
        league,
        arenaName,
        teamName: homeTeam,
        opponent,
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
        gameDate: gameDate || new Date().toISOString(),
        checkinType: 'live',
        photos: images,
        userId: user.uid,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'profiles', user.uid, 'checkins'), docData);
      alert('Live check-in saved!');
    } catch (err) {
      console.error('Error saving live check-in:', err);
      alert('Failed to save live check-in.');
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Permission to access camera roll is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImages([result.assets[0].uri]);
    }
  };

  // Fallback if any required param missing
  if (!league || !arenaName || !homeTeam || !opponent) {
    return (
      <SafeAreaView style={styles.background}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Unable to start a live check-in — no game details found.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.background}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.title}>Live Game Check-In</Text>

          <Text style={styles.label}>League</Text>
          <Text style={styles.value}>{league}</Text>

          <Text style={styles.label}>Arena</Text>
          <Text style={styles.value}>{arenaName}</Text>

          <Text style={styles.label}>Home Team</Text>
          <Text style={styles.value}>{homeTeam}</Text>

          <Text style={styles.label}>Opponent</Text>
          <Text style={styles.value}>{opponent}</Text>

          <Text style={styles.label}>Date / Time</Text>
          <Text style={styles.value}>
            {new Date(gameDate || Date.now()).toLocaleString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: "600", marginRight: 6 }}>Seat Information</Text>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <Text style={{ fontWeight: "500", marginRight: 6 }}>Section:</Text>
            <TextInput value={seatSection} onChangeText={setSeatSection} style={[styles.input, { width: 45, textAlign: "center", marginTop: 0 }]} />
            <Text style={{ fontWeight: "500", marginLeft: 12, marginRight: 6 }}>Row:</Text>
            <TextInput value={seatRow} onChangeText={setSeatRow} style={[styles.input, { width: 45, textAlign: "center", marginTop: 0 }]} />
            <Text style={{ fontWeight: "500", marginLeft: 12, marginRight: 6 }}>Seat:</Text>
            <TextInput value={seatNumber} onChangeText={setSeatNumber} style={[styles.input, { width: 45, textAlign: "center", marginTop: 0 }]} />
          </View>
        </View>
        <View style={styles.section}>
          <TextInput
            placeholder="Favorite Player"
            value={favoritePlayer}
            onChangeText={setFavoritePlayer}
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
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Upload Photo (1 only):</Text>
          <TouchableOpacity style={styles.input} onPress={pickImage}>
            <Text>{images.length > 0 ? 'Replace Photo' : 'Select Photo'}</Text>
          </TouchableOpacity>
          {images.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.photo} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Did you buy any merch?</Text>
          <View style={styles.choiceRow}>
            <Pressable
              style={[styles.choiceButton, didBuyMerch && styles.choiceButtonSelected]}
              onPress={() => setDidBuyMerch(true)}
            >
              <Text style={styles.choiceButtonText}>Yes</Text>
            </Pressable>
            <Pressable
              style={[styles.choiceButton, !didBuyMerch && styles.choiceButtonSelected]}
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
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Did you buy any concessions?</Text>
          <View style={styles.choiceRow}>
            <Pressable
              style={[styles.choiceButton, didBuyConcessions && styles.choiceButtonSelected]}
              onPress={() => setDidBuyConcessions(true)}
            >
              <Text style={styles.choiceButtonText}>Yes</Text>
            </Pressable>
            <Pressable
              style={[styles.choiceButton, !didBuyConcessions && styles.choiceButtonSelected]}
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
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleCheckInSubmit}>
          <Text style={styles.submitText}>Submit Live Check-In</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 16 },
  section: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0D2C42', textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#1E3A8A', marginTop: 8 },
  value: { fontSize: 16, color: '#0A2940', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: '#fff' },
  photo: { width: '100%', height: 200, borderRadius: 8, marginTop: 10 },
  choiceRow: { flexDirection: 'row', marginTop: 8 },
  choiceButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginHorizontal: 4, alignItems: 'center' },
  choiceButtonSelected: { backgroundColor: '#0A2940', borderColor: '#0A2940' },
  choiceButtonText: { color: '#fff' },
  submitButton: { backgroundColor: '#0A2940', borderRadius: 10, padding: 14, marginTop: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  checkboxLabel: { marginLeft: 8, fontSize: 16, textTransform: 'capitalize' },
  categoryContainer: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 8 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  categoryTitle: { fontSize: 16, fontWeight: 'bold' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackText: { fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 20 },
  backButton: { backgroundColor: '#0A2940', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
