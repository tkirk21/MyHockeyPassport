// app/checkin/live.tsx
import Checkbox from 'expo-checkbox';
import { AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseApp from '../../firebaseConfig';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '../../hooks/useColorScheme';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp, 'gs://myhockeypassport.firebasestorage.app');
const toStr = (v: any) => Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default function LiveCheckInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [friendsList, setFriendsList] = useState<{ id: string; name: string }[]>([]);
  const [companionsText, setCompanionsText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredFriends, setFilteredFriends] = useState<{ id: string; name: string }[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const params = useLocalSearchParams();
  const league = toStr(params.league);
  const arenaName = toStr(params.arenaName);
  const homeTeam = toStr(params.homeTeam);
  const opponent = toStr(params.opponent);
  const gameDate = toStr(params.gameDate);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [favoritePlayer, setFavoritePlayer] = useState('');
  const [seatSection, setSeatSection] = useState('');
  const [seatRow, setSeatRow] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [companions, setCompanions] = useState('');
  const [highlights, setHighlights] = useState('');
  const [parkingAndTravel, setParkingAndTravel] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [didBuyMerch, setDidBuyMerch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [merchItems, setMerchItems] = useState<Record<string, boolean>>({});

  const [didBuyConcessions, setDidBuyConcessions] = useState(false);
  const [concessionItems, setConcessionItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const friendsRef = collection(db, 'profiles', user.uid, 'friends');
    const unsub = onSnapshot(friendsRef, async (snap) => {
      const friendIds = snap.docs.map(d => d.id);

      const profiles = await Promise.all(
        friendIds.map(async (id) => {
          const profSnap = await getDoc(doc(db, 'profiles', id));
          const name = profSnap.data()?.name?.trim();
          return name ? { id, name } : null;
        })
      );

      setFriendsList(profiles.filter(Boolean));
      console.log('Friends loaded in live.tsx:', friendsList.length, friendsList);
    });

    return () => unsub();
  }, []);

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
        setAlertMessage('You must be logged in to submit a check-in.');
        setAlertVisible(true);
        return;
      }

      // Upload photos to Firebase Storage
      let photoUrls: string[] = [];

      if (images.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const basePath = `checkins/${user.uid}/${timestamp}`;

        const uploadPromises = images.map(async (localUri, index) => {
          try {
            const response = await fetch(localUri);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

            const blob = await response.blob();
            const photoRef = ref(storage, `${basePath}/${index}.jpg`);

            await uploadBytes(photoRef, blob);
            const url = await getDownloadURL(photoRef);
            console.log(`Uploaded photo ${index}: ${url}`);
            return url;
          } catch (uploadErr) {
            console.error(`Upload failed for photo ${index}:`, uploadErr);
            throw uploadErr; // let outer catch handle it
          }
        });

        photoUrls = await Promise.all(uploadPromises);
      }

      // Original data prep
      const getSelectedItems = (sourceObject: any, categories: any) => {
        const result: any = {};
        Object.keys(categories).forEach((category) => {
          result[category] = categories[category].filter(
            (item: string) => sourceObject[item]
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
        highlights,
        parkingAndTravel,
        merchBought: getSelectedItems(merchItems, merchCategories),
        concessionsBought: getSelectedItems(concessionItems, concessionCategories),
        gameDate: gameDate.toISOString(),
        checkinType: 'Manual',
        photos: photoUrls,  // ← now real URLs
        userId: user.uid,
        timestamp: serverTimestamp(),
        latitude: match?.latitude ?? null,
        longitude: match?.longitude ?? null,
      };

      await addDoc(collection(db, 'profiles', user.uid, 'checkins'), docData);

      setAlertMessage('Check-in saved! Taking you to your profile...');
      setAlertVisible(true);

      // Clean up local state
      setImages([]);

    } catch (error: any) {
      console.error('Error during check-in submit:', error);
      let msg = 'Failed to save check-in.';
      if (error.message?.includes('fetch')) {
        msg += ' Issue loading one of the photos.';
      } else if (error.code === 'storage/unauthorized') {
        msg += ' Storage permission issue — check Firebase rules.';
      }
      setAlertMessage(msg);
      setAlertVisible(true);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Permission to access camera roll is required!');
      return;
    }

    const remaining = 3 - images.length;
    if (remaining <= 0) {
      alert('Maximum 3 photos allowed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages].slice(0, 3));
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

  const styles = StyleSheet.create({
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 16 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    backButton: { backgroundColor: '#0A2940', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6, },
    backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', },
    bottomRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, marginTop: 24, },
    backIconButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', padding: 14, borderRadius: 30, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68',  },
    buySectionLabel: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginBottom: 12 },
    categoryContainer: { marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10, },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9', paddingHorizontal: 16, borderRadius: 8 },
    categoryTitle: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
    checkboxLabel: { marginLeft: 12, fontSize: 15, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, },
    checkboxLabel: { marginLeft: 10, fontSize: 16,color: '#0D2C42', textTransform: 'capitalize', },
    choiceButton: { borderWidth: 0, borderRadius: 30, paddingVertical: 8, paddingHorizontal: 16, marginRight: 10 },
    choiceButtonSelected: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#5E819F' : '#0D2C42' },
    choiceButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, fontWeight: '600' },
    choiceButtonTextSelected: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700' },
    companionsPlaceholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666', },
    deleteButton: { position: 'absolute', top: -8, right: -8, backgroundColor: 'red', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
    deleteText: { color: 'white', fontSize: 16 },
    editLaterMessage: { textAlign: 'center', color: colorScheme === 'dark' ? '#fff' : '#666666', fontStyle: 'italic', padding: 16, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9', borderRadius: 12, },
    editLaterMessageText: { textAlign: 'center', color: colorScheme === 'dark' ? '#fff' : '#666666', fontStyle: 'italic' },
    fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20,},
    fallbackText: { fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 20, },
    gameInfoContainer: { alignItems: 'center', marginBottom: 24, },
    gameInfoCard: { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#E3E8F0', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#334155' : '#0D2C42', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: colorScheme === 'dark' ? 0.5 : 0.1, shadowRadius: 8, elevation: 8 },
    gameInfoLabel: { fontSize: 18, fontWeight: '600', color: colorScheme === 'dark' ? '#ffffff' : '#0D2C42', marginTop: 12, textAlign: 'center' },
    gameInfoValue: { fontSize: 15, fontWeight: 'bold', color: colorScheme === 'dark' ? '#BBBBBB' : '#0A2940', textAlign: 'center', marginBottom: 8 },
    input: { borderWidth: 2, borderColor: colorScheme === 'dark' ? '#5E819F' : '#0D2C42', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    label: { fontSize: 16, fontWeight: '600', color: '#0D2C42', marginTop: 18, marginBottom: 6, },
    merchConcessionsContainer: { marginTop: 20, marginBottom: 20, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9', padding: 16, borderRadius: 12 },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
    photoThumbnailWrapper: { position: 'relative', width: 100, height: 100 },
    photoThumbnail: { width: 100, height: 100, borderRadius: 8 },
    Placeholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666' },
    seatSectionContainer: { marginTop: 20, marginBottom: 20, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9', padding: 16, borderRadius: 12 },
    seatSectionTitle: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginBottom: 8 },
    seatRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    seatLabel: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginRight: 6 },
    seatLabelWithMargin: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginLeft: 12, marginRight: 6 },
    seatInput: { width: 40, textAlign: 'center', marginTop: 0 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    scrollContainer: { padding: 16, paddingBottom: 250, },
    submitButton: { backgroundColor: '#0A2940', paddingVertical: 14, borderRadius: 30, width: '50%', alignSelf: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2F4F68', },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '600', },
    uploadPhotoLabel: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginTop: 18, marginBottom: 6 },
    uploadPhotoText: { color: colorScheme === 'dark' ? '#BBBBBB' : '#0A2940' },
  });

  if (true) { // change to false to hide
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => {
          router.replace({
            pathname: '/checkin/live',
            params: {
              league: 'NHL',
              arenaName: 'Enterprise Center',
              homeTeam: 'St. Louis Blues',
              opponent: 'Colorado Avalanche',
              gameDate: new Date().toISOString(),
            },
          });
        }} style={{ padding: 20, backgroundColor: 'red' }}>
          <Text style={{ color: 'white' }}>TEST LIVE CHECKIN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screenBackground}>
      {/* CUSTOM THEMED ALERT MODAL */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>
              {alertMessage.includes('saved') ? 'Success' : 'Error'}
            </Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity
              onPress={() => {
                setAlertVisible(false);
                if (alertMessage.includes('saved')) {
                  router.replace('/(tabs)/profile');
                }
              }}
              style={styles.alertButton}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: "Live Check-In" }} />
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.gameInfoContainer}>
            <View style={styles.gameInfoCard}>
              <Text style={styles.gameInfoLabel}>League</Text>
              <Text style={styles.gameInfoValue}>{league}</Text>

              <Text style={styles.gameInfoLabel}>Arena</Text>
              <Text style={styles.gameInfoValue}>{arenaName}</Text>

              <Text style={styles.gameInfoLabel}>Home Team</Text>
              <Text style={styles.gameInfoValue}>{homeTeam}</Text>

              <Text style={styles.gameInfoLabel}>Opponent</Text>
              <Text style={styles.gameInfoValue}>{opponent}</Text>

              <Text style={styles.gameInfoLabel}>Date / Time</Text>
              <Text style={styles.gameInfoValue}>
                {new Date(gameDate || Date.now()).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.editLaterMessage}>
            <Text style={styles.editLaterMessageText}>
              Final score and favorite player can be added later by editing this check-in on your profile.
            </Text>
          </View>

          <View style={styles.seatSectionContainer}>
            <Text style={styles.seatSectionTitle}>Seat Information</Text>
            <View style={styles.seatRow}>
              <Text style={styles.seatLabel}>Section:</Text>
              <TextInput value={seatSection} onChangeText={setSeatSection} style={[styles.input, styles.seatInput]} />
              <Text style={styles.seatLabelWithMargin}>Row:</Text>
              <TextInput value={seatRow} onChangeText={setSeatRow} style={[styles.input, styles.seatInput]} />
              <Text style={styles.seatLabelWithMargin}>Seat:</Text>
              <TextInput value={seatNumber} onChangeText={setSeatNumber} style={[styles.input, styles.seatInput]} />
            </View>
          </View>

          <View>
            <TextInput
              placeholder="Who did you go with? (@ to tag friends)"
              placeholderTextColor={styles.companionsPlaceholder.color}
              value={companionsText}
              onChangeText={(text) => {
                setCompanionsText(text);
                setCompanions(text); // keeps the saved value in sync
                const atIndex = text.lastIndexOf('@');
                if (atIndex >= 0) {
                  const query = text.slice(atIndex + 1).toLowerCase().trim();
                  const matches = friendsList.filter(f => f.name.toLowerCase().includes(query));
                  setFilteredFriends(matches);
                  setShowSuggestions(matches.length > 0 && query.length > 0);
                } else {
                  setShowSuggestions(false);
                }
              }}
              onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
              multiline
              style={styles.input}
            />

            {showSuggestions && filteredFriends.length > 0 && (
              <View style={{
                position: 'absolute',
                top: 48,
                left: 0,
                right: 0,
                backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? '#334155' : '#D1D5DB',
                borderRadius: 8,
                maxHeight: 200,
                zIndex: 10,
              }}>
                <ScrollView>
                  {filteredFriends.map((friend) => (
                    <TouchableOpacity
                      key={friend.id}
                      style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colorScheme === 'dark' ? '#334155' : '#E5E7EB',
                      }}
                      onPress={() => {
                        const beforeAt = companionsText.slice(0, companionsText.lastIndexOf('@'));
                        const newText = `${beforeAt}@${friend.name} `;
                        setCompanionsText(newText);
                        setCompanions(newText);
                        setShowSuggestions(false);
                      }}
                    >
                      <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' }}>
                        {friend.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.uploadPhotoLabel}>Upload Photos (up to 3)</Text>
            <TouchableOpacity style={styles.input} onPress={pickImage}>
              <Text style={styles.uploadPhotoText}>
                {images.length === 0 ? 'Select Photos' : images.length < 3 ? 'Add More (max 3)' : 'Max 3 reached'}
              </Text>
            </TouchableOpacity>

            <View style={styles.photoGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.photoThumbnailWrapper}>
                  <Image
                    source={{ uri }}
                    style={styles.photoThumbnail}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                  >
                    <Text style={styles.deleteText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
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
            placeholder="Parking and travel Tips"
            placeholderTextColor={styles.Placeholder.color}
            value={parkingAndTravel}
            onChangeText={setParkingAndTravel}
            style={styles.input}
            multiline
          />

          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.backIconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={handleCheckInSubmit}>
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}