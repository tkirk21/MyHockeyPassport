// components/editCheckinForm.tsx
import React, { useState, useEffect } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, ScrollView as RNScrollView, ScrollView, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { getAuth } from 'firebase/auth';
import DropDownPicker from 'react-native-dropdown-picker';
import Checkbox from 'expo-checkbox';
import { Pressable } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseApp from "@/firebaseConfig"; // Adjust path if needed
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import LoadingPuck from './loadingPuck';

import arenasData from "@/assets/data/arenas.json";
import historicalTeamsData from '@/assets/data/historicalTeams.json';
import arenaHistoryData from "@/assets/data/arenaHistory.json";

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp, 'gs://myhockeypassport.firebasestorage.app');

export default function editCheckinForm({ initialData }: { initialData: any }) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [cursorPosition, setCursorPosition] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
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
  const [homeScore, setHomeScore] = useState(
    initialData.homeScore !== undefined && initialData.homeScore !== null
      ? String(initialData.homeScore)
      : ''
  );
  const [awayScore, setAwayScore] = useState(
    initialData.awayScore !== undefined && initialData.awayScore !== null
      ? String(initialData.awayScore)
      : ''
  );
  const [overtimeWin, setOvertimeWin] = useState(initialData.overtimeWin ?? false);
  const [shootoutWin, setShootoutWin] = useState(initialData.shootoutWin ?? false);
  const [favoritePlayer, setFavoritePlayer] = useState(initialData.favoritePlayer || '');
  const [seatSection, setSeatSection] = useState(initialData.seatInfo?.section || '');
  const [seatRow, setSeatRow] = useState(initialData.seatInfo?.row || '');
  const [seatNumber, setSeatNumber] = useState(initialData.seatInfo?.seat || '');
  const [companions, setCompanions] = useState(initialData.companions || '');
  const [friendsList, setFriendsList] = useState<{ id: string; name: string }[]>([]);
  const [companionsText, setCompanionsText] = useState(initialData.companions || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredFriends, setFilteredFriends] = useState<{ id: string; name: string }[]>([]);
  const [highlights, setHighlights] = useState(initialData.highlights || '');
  const [parkingAndTravel, setParkingAndTravel] = useState(initialData.ParkingAndTravel || '');
  const [images, setImages] = useState<string[]>(initialData.photos?.slice(0, 3) || []);
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
  const [isSaving, setIsSaving] = useState(false);
  const scrollViewRef = React.useRef(null);

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
    if (isSaving) return;

    setIsSaving(true);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setAlertMessage('You must be logged in to edit.');
        setAlertVisible(true);
        setIsSaving(false);
        return;
      }

      // Current images state contains both remote URLs (kept) and local new ones
      // Filter out any deleted ones (deleted means removed from images array)
      const keptRemoteUrls = images.filter(uri =>
        typeof uri === 'string' && uri.startsWith('https://')
      );

      // New local images to upload
      const newLocalImages = images.filter(uri =>
        typeof uri === 'string' && (uri.startsWith('file://') || uri.startsWith('content://'))
      );

      let newPhotoUrls: string[] = [];

      if (newLocalImages.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const basePath = `checkins/${user.uid}/${timestamp}`;

        const uploadPromises = newLocalImages.map(async (localUri, index) => {
          try {
            const response = await fetch(localUri);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

            const blob = await response.blob();
            const photoRef = ref(storage, `${basePath}/edit_${index}.jpg`);

            await uploadBytes(photoRef, blob);
            const url = await getDownloadURL(photoRef);
            console.log(`Uploaded new edit photo ${index}: ${url}`);
            return url;
          } catch (err) {
            console.error(`New photo upload failed ${index}:`, err);
            throw err;
          }
        });

        newPhotoUrls = await Promise.all(uploadPromises);
      }

      // Final photos = kept old remote + new uploaded
      const finalPhotos = [...keptRemoteUrls, ...newPhotoUrls];

      const getSelectedItems = (sourceObject: any, categories: any) => {
        const result: any = {};
        Object.keys(categories).forEach((category) => {
          result[category] = categories[category].filter(
            (item: string) => sourceObject[item]
          );
        });
        return result;
      };

      const match = allArenas.find(
        (arena: any) =>
          arena.league === selectedLeague && arena.arena === selectedArena
      );

      const docData = {
        league: selectedLeague,
        arenaId: match?.id ?? null,
        arenaName: selectedArena,
        teamName: selectedHomeTeam,
        opponent: selectedOpponent,
        homeScore: homeScore.trim() === '' ? null : Number(homeScore),
        awayScore: awayScore.trim() === '' ? null : Number(awayScore),
        overtimeWin: overtimeWin,
        shootoutWin: shootoutWin,
        favoritePlayer,
        seatInfo:
          seatSection || seatRow || seatNumber
            ? {
                section: seatSection,
                row: seatRow,
                seat: seatNumber,
              }
            : null,
        companions,
        highlights,
        ParkingAndTravel: parkingAndTravel,
        merchBought: didBuyMerch
          ? getSelectedItems(merchItems, merchCategories)
          : {},
        concessionsBought: didBuyConcessions
          ? getSelectedItems(concessionItems, concessionCategories)
          : {},
        gameDate: gameDate.toISOString(),
        photos: finalPhotos,
        latitude: match?.latitude ?? null,
        longitude: match?.longitude ?? null,
      };

      const checkinRef = doc(db, 'profiles', userId as string, 'checkins', initialData.id);
      await updateDoc(checkinRef, docData);

      setAlertMessage('Check-in updated!');
      setAlertVisible(true);
    } catch (error: any) {
      console.error('Error updating check-in:', error);
      let msg = 'Failed to update check-in.';
      if (error.message?.includes('fetch')) {
        msg += ' Issue loading one of the new photos.';
      }
      setAlertMessage(msg);
      setAlertVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  // APPLY ARENA NAME HISTORY BASED ON EXISTING CHECK-IN DATE
  useEffect(() => {
    const selectedDate = gameDate;

    const processed = arenasData
      .filter(arena => !arena.startDate || selectedDate >= new Date(arena.startDate))
      .map(arena => ({ ...arena, league: arena.league?.trim() || null }));

    const processedHistorical = historicalTeamsData
      .filter(hist => {
        const start = new Date(hist.startDate);
        let end = hist.endDate ? new Date(hist.endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);
        return selectedDate >= start && (!end || selectedDate <= end);
      })
      .map(arena => ({ ...arena, league: arena.league?.trim() || null }));

    const allArenasRaw = [...processedHistorical, ...processed];

    // Filter out anything missing real league
    const allArenas = allArenasRaw.filter(a =>
      a.league &&
      typeof a.league === 'string' &&
      a.league.trim() !== ''
    );

    setAllArenas(allArenas);
    setArenas(allArenas);

    const leagues = [...new Set(allArenas.map(a => a.league))];
    setLeagueItems(leagues.map(l => ({ label: l, value: l })));
  }, [gameDate]);

  // League + Date → populate arenas & teams
  useEffect(() => {
    if (!selectedLeague) {
      setArenaItems([]);
      setHomeTeamItems([]);
      return;
    }

    const date = gameDate;

    const arenaOptions: any[] = [];

    for (const a of allArenas) {
      if (a.league !== selectedLeague) continue;

      arenaOptions.push({
        label: a.arena,
        value: a.arena,
      });
    }

    const uniqueArenas = Array.from(
      new Map(arenaOptions.map(i => [i.value, i])).values()
    ).sort((a, b) => a.label.localeCompare(b.label));

    setArenaItems(uniqueArenas);

    const validTeams = allArenas.filter(team => {
      if (team.league !== selectedLeague) return false;

      const start = team.startDate ? new Date(team.startDate) : new Date(0);
      const end = team.endDate ? new Date(team.endDate) : null;

      return date >= start && (!end || date <= end);
    });

    const uniqueTeams = Array.from(
      new Set(validTeams.map(a => a.teamName))
    ).sort();

    setHomeTeamItems(
      uniqueTeams.map(t => ({ label: t, value: t }))
    );

  }, [selectedLeague, gameDate, allArenas]);

  // Home Team selected → set correct Arena (with historical name)
  useEffect(() => {
    if (!selectedHomeTeam || !selectedLeague) return;

    const teamEntry = allArenas.find(
      a => a.teamName === selectedHomeTeam && a.league === selectedLeague
    );
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
  }, [selectedHomeTeam, selectedLeague, gameDate, allArenas]);

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
      console.log('Friends loaded in edit form:', friendsList.length, friendsList);
    });

    return () => unsub();
  }, []);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Need access to photos to upload.');
      return;
    }

    const remaining = 3 - images.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', 'Maximum 3 photos allowed. Delete one to add more.');
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

  const styles = StyleSheet.create({
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 16 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    backIconButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', padding: 14, borderRadius: 30, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68',  },
    bottomRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, marginTop: 24, marginBottom: 40 },
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
    dateModalContainer: { padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, },
    dateModalDone: { marginTop: 12, alignSelf: 'flex-end', },
    dateModalDoneText: { fontSize: 16, fontWeight: '600', color: '#0066CC', },
    dateModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', },
    deleteButton: { position: 'absolute', top: -8, right: -8, backgroundColor: 'red', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
    deleteText: { color: 'white', fontSize: 16 },
    Placeholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#666666' },
    input: { borderWidth: 2, borderColor: colorScheme === 'dark' ? '#334155' : '#0D2C42', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' },
    label: { fontSize: 16, fontWeight: '600', marginTop: 18, marginBottom: 6, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    merchConcessionsContainer: { marginTop: 20, marginBottom: 20, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9', padding: 16, borderRadius: 12 },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
    photoThumbnailWrapper: { position: 'relative', width: 100, height: 100 },
    photoThumbnail: { width: 100, height: 100, borderRadius: 8 },
    resultOptionsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12, },
    resultOptionItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, },
    resultOptionText: { marginLeft: 8, fontSize: 15, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', },
    scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    scoreLabel: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    scoreInput: { width: 60, textAlign: 'center', marginBottom: 0 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    seatInfoTitle: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    seatInfoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
    seatLabel: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginRight: 6 },
    seatLabelRow: { fontWeight: '500', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', marginLeft: 12, marginRight: 6 },
    seatInput: { width: 50, textAlign: 'center', marginBottom: 0 },
    submitButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 14, borderRadius: 30, width: '60%', alignItems: 'center', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68' },
    submitButtonSaving: { opacity: 0.7 },
    submitText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, fontWeight: '600' },
    uploadPhotoText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
  });

  return (
    <View style={styles.screenBackground}>
      {/* CUSTOM THEMED ALERT MODAL */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>
              {alertMessage.includes('updated') ? 'Success' : 'Error'}
            </Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity
              onPress={() => {
                setAlertVisible(false);
                router.back();
              }}
              style={styles.alertButton}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <RNScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
            <Text style={styles.scoreLabel}>Home:</Text>
            <TextInput
              value={homeScore}
              onChangeText={setHomeScore}
              style={[styles.input, styles.scoreInput]}
              keyboardType="number-pad"
              placeholder=" "
            />

            <Text style={styles.scoreLabel}>  Away:</Text>
            <TextInput
              value={awayScore}
              onChangeText={setAwayScore}
              style={[styles.input, styles.scoreInput]}
              keyboardType="number-pad"
              placeholder=" "
            />
          </View>

          <View style={styles.resultOptionsRow}>

            <View style={styles.resultOptionItem}>
              <Checkbox
                value={overtimeWin}
                onValueChange={(value) => {
                  setOvertimeWin(value);
                  if (value) setShootoutWin(false);
                }}
              />
              <Text style={styles.resultOptionText}>
                Overtime Win
              </Text>
            </View>

            <View style={styles.resultOptionItem}>
              <Checkbox
                value={shootoutWin}
                onValueChange={(value) => {
                  setShootoutWin(value);
                  if (value) setOvertimeWin(false);
                }}
              />
              <Text style={styles.resultOptionText}>
                Shootout Win
              </Text>
            </View>

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

          <Text style={styles.label}>Upload Photos (up to 3):</Text>
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

          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.backIconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSaving && styles.submitButtonSaving
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <LoadingPuck size={56} />
                  <Text style={styles.submitText}>Saving...</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ANDROID — keep native behavior */}
          {showDatePicker && Platform.OS === 'android' && (
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

          {/* IOS / IPAD — modal picker */}
          {showDatePicker && Platform.OS === 'ios' && (
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
        </RNScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}