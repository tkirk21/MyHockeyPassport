// app/(tabs)/friends.tsx
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ImageBackground, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc,  } from 'firebase/firestore';
import { useDebouncedCallback } from 'use-debounce';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileAlertContext } from '../_layout';
import { useColorScheme } from '../../hooks/useColorScheme';
import { logFriendship, logCheer } from "../../utils/activityLogger";
import LoadingPuck from "../../components/loadingPuck";
import CheerButton from '@/components/friends/cheerButton';
import ChirpBox from '@/components/friends/chirpBox';
import type { ActivityItem, Checkin, Chirp, Profile } from '@/types/friends';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const arenasData = require("@/assets/data/arenas.json");
const arenaHistory = require("@/assets/data/arenaHistory.json");
const historicalTeams = require("@/assets/data/historicalTeams.json");


const resolveTeamName = (item: any): string => {
  return (
    item.teamName ||
    item.team ||
    item.homeTeam ||
    item.team_name || // legacy
    "Unknown"
  );
};

const resolveTeamCode = (item: any): string | null => {
  return (
    item.teamCode ||
    item.team_code ||
    item.homeTeamCode ||
    item.team_code_alt ||
    null
  );
};

const resolveArenaName = (item: any): string => {
  return (
    item.arenaName ||
    item.arena ||
    item.locationArena ||
    item.venue ||
    item.arena_name || // older format
    item.checkinArena ||
    item.arenaSelected ||
    "Unknown arena"
  );
};

const getTimestamp = (ts: any): Date => {
  if (!ts) return new Date(0);
  if (ts.seconds) return new Date(ts.seconds * 1000);        // Firestore Timestamp object (seconds + nanoseconds)
  if (ts instanceof Date) return ts;                         // JS Date object passed directly
  if (typeof ts === "string") return new Date(ts);           // ISO string (unlikely but safe)

  return new Date(0);
};

export default function FriendsTab() {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [blockedFriends, setBlockedFriends] = useState<string[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [userFriendsMap, setUserFriendsMap] = useState<{ [uid: string]: string[] }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<Array<{ id: string; name: string; imageUrl?: string; arenas: number; teams: number }>>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'arenas' | 'teams'>('arenas');
  const debouncedSetSearchQuery = useDebouncedCallback((value: string) => {
    setSearchQuery(value);
  }, 300);

  const currentUser = auth.currentUser;
  const router = useRouter();
  const colorScheme = useColorScheme();

  const getMutualFriendsCount = (userId: string) => {
    const theirFriends = userFriendsMap[userId] || [];
    if (!theirFriends.length || !friends.length) return 0;
    return friends.filter(fid => theirFriends.includes(fid)).length;
  };

  useEffect(() => {
    const fetchUsersAndFriends = async () => {
      if (!currentUser) return;
      try {
        const friendsRef = collection(db, 'profiles', currentUser.uid, 'friends');
        const friendsSnap = await getDocs(friendsRef);
        const friendIds = friendsSnap.docs.map((d) => d.id);
        setFriends(friendIds);

        const requestsRef = collection(db, 'profiles', currentUser.uid, 'friendRequests');
        const requestsSnap = await getDocs(requestsRef);
        const requests = requestsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPendingRequests(requests);

        // Load sent friend requests (safe mode)
        let sentList: string[] = [];
        try {
          const sentRef = collection(db, "profiles", currentUser.uid, "sentFriendRequests");
          const sentSnap = await getDocs(sentRef);
          sentList = sentSnap.docs.map((d) => d.id);
        } catch (err) {
          console.warn("Could not load sentFriendRequests:", err);
        }
        setSentRequests(sentList);

        const snapshot = await getDocs(collection(db, 'profiles'));
        const users = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const tempMap: { [uid: string]: string[] } = {};
        for (let u of users) {
          try {
            const uFriendsRef = collection(db, 'profiles', u.id, 'friends');
            const uFriendsSnap = await getDocs(uFriendsRef);
            tempMap[u.id] = uFriendsSnap.docs.map((d) => d.id);
          } catch (err) {
            console.warn(`Could not fetch friends for ${u.id}:`, err);
            tempMap[u.id] = [];
          }
        }
        setUserFriendsMap(tempMap);

        const currentFriends = new Set(friendIds);
        const usersWithMutuals = users.map((u) => {
          const theirFriends = tempMap[u.id] || [];
          const mutuals = theirFriends.filter((fid) => currentFriends.has(fid));
          return {
            ...u,
            mutualCount: mutuals.length,
            mutualIds: mutuals,
          };
        });
        setAllUsers(usersWithMutuals);

        let activities: any[] = [];
        for (let friendId of friendIds) {
          const checkinsRef = collection(db, 'profiles', friendId, 'checkins');
          const checkinSnap = await getDocs(
            query(checkinsRef, orderBy('timestamp', 'desc'), limit(3))
          );
          checkinSnap.docs.forEach((doc) => {
            activities.push({
              id: doc.id,
              friendId,
              type: "checkin",
              ...doc.data(),
            });
          });

          const activityRef = collection(db, 'profiles', friendId, 'activity');
          const activitySnap = await getDocs(
            query(activityRef, orderBy('timestamp', 'desc'), limit(5))
          );
          activitySnap.docs.forEach((doc) => {
            const data = doc.data();

            activities.push({
              id: doc.id,
              friendId,
              type: data.type || "unknown",
              ...data,
            });
          });
        }

        const safeActivities = activities.filter(
          (a) => !isBlocked(a.friendId)
        );
        setFeed(
          safeActivities
            .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
        );

        const blockedRef = collection(db, 'profiles', currentUser.uid, 'blocked');
        const blockedSnap = await getDocs(blockedRef);
        const blockedIds = blockedSnap.docs.map((d) => d.id);
        setBlockedFriends(blockedIds);
      } catch (error) {
        console.error('Error fetching users or feed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndFriends();
  }, []);

  const onRefresh = async () => {
      setRefreshing(true);
      try {
        let activities: any[] = [];
        for (let friendId of friends) {
          const checkinsRef = collection(db, 'profiles', friendId, 'checkins');
          const checkinSnap = await getDocs(
            query(checkinsRef, orderBy('timestamp', 'desc'), limit(3))
          );
          checkinSnap.docs.forEach(doc => {
            activities.push({
              id: doc.id,
              friendId,
              type: "checkin",
              ...doc.data(),
            });
          });

          const activityRef = collection(db, 'profiles', friendId, 'activity');
          const activitySnap = await getDocs(
            query(activityRef, orderBy('timestamp', 'desc'), limit(5))
          );
          activitySnap.docs.forEach(doc => {
            activities.push({
              id: doc.id,
              friendId,
              ...doc.data(),
            });
          });
        }

        const safeActivities = activities.filter(a => !isBlocked(a.friendId));
        setFeed(
          safeActivities
            .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
        );

      } catch (err) {
        console.error("Refresh failed:", err);
      } finally {

        setRefreshing(false);

        if (currentUser) {
          setDoc(
            doc(db, 'profiles', currentUser.uid, 'notifications', 'lastViewedFriendsTab'),
            { timestamp: serverTimestamp() },
            { merge: true }
          ).catch(() => {});
        }
      }
    };

    const loadLeaderboardData = async () => {
      if (!currentUser) {
        setLeaderboardData([]);
        setLbLoading(false);
        return;
      }

      setLbLoading(true);

      try {
        // Always include yourself, even with 0 friends
        const allFriendIds = Array.from(new Set([...friends, currentUser.uid].filter(Boolean)));

        const profilePromises = allFriendIds.map(id =>
          getDoc(doc(db, 'profiles', id)).then(snap => ({ id, data: snap.data() }))
        );

        const checkinsPromises = allFriendIds.map(id =>
          getDocs(collection(db, 'profiles', id, 'checkins'))
            .then(snap => ({ id, checkins: snap.docs.map(d => d.data()) }))
        );

        const [profilesResult, checkinsResult] = await Promise.all([
          Promise.all(profilePromises),
          Promise.all(checkinsPromises)
        ]);

        const leaderboard = allFriendIds.map(userId => {
          const profile = profilesResult.find(p => p.id === userId)?.data || {};
          const checkins = checkinsResult.find(c => c.id === userId)?.checkins || [];

          const arenas = new Set(
            checkins.map(c => c.arenaName || c.arena).filter(Boolean)
          ).size;

          const teams = new Set(
            checkins.flatMap(c => [
              c.teamName || c.team,
              c.opponent
            ].filter(Boolean))
          ).size;

          return {
            id: userId,
            name: profile.name || (userId === currentUser.uid ? 'You' : 'Unknown'),
            imageUrl: profile.imageUrl,
            arenas,
            teams,
          };
        });

        setLeaderboardData(leaderboard);
      } catch (err) {
        console.error('Leaderboard failed:', err);
        setLeaderboardData([]);
      } finally {
        setLbLoading(false);
      }
    };

  useEffect(() => {
    if (!currentUser || friends.length === 0) {
      setFeed([]);
      return () => {}; // no listeners
    }

    const unsubs: (() => void)[] = [];

    friends.forEach(friendId => {
      if (isBlocked(friendId)) return;

      const checkinsQuery = query(
        collection(db, 'profiles', friendId, 'checkins'),
        orderBy('timestamp', 'desc')
      );

      const unsubCheckins = onSnapshot(checkinsQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const newItem = {
              id: change.doc.id,
              friendId,
              type: "checkin",
              ...data
            };

            setFeed(prev => {
              if (prev.some(i => i.id === newItem.id && i.type === "checkin")) return prev;
              return [...prev, newItem]
                .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
            });
          }
        });
      });
      unsubs.push(unsubCheckins);

      const activityQuery = query(
        collection(db, 'profiles', friendId, 'activity'),
        orderBy('timestamp', 'desc')
      );

      const unsubActivity = onSnapshot(activityQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const newItem = {
              id: change.doc.id,
              friendId,
              ...data
            };

            setFeed(prev => {
              if (prev.some(i => i.id === newItem.id)) return prev;
              return [...prev, newItem]
                .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
            });
          }
        });
      });
      unsubs.push(unsubActivity);
    });

    return () => unsubs.forEach(u => u());
  }, [currentUser?.uid, friends, blockedFriends]);

  const handleSendRequest = async (userId: string) => {
    if (!currentUser) return;
    try {
      const requestRef = doc(db, 'profiles', userId, 'friendRequests', currentUser.uid);
      await setDoc(requestRef, { fromId: currentUser.uid, createdAt: new Date() });
      setSentRequests((prev) => [...prev, userId]);
      alert('Friend request sent!');
    } catch (err) {
      console.error('Error sending friend request:', err);
      alert('Failed to send friend request. Try again.');
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    if (!currentUser) return;
    setFriends((prev) => [...prev, senderId]);
    setPendingRequests((prev) => prev.filter((r) => r.id !== senderId));
    try {
      await setDoc(doc(db, 'profiles', currentUser.uid, 'friends', senderId), {
        addedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'profiles', senderId, 'friends', currentUser.uid), {
        addedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'profiles', currentUser.uid, 'friendRequests', senderId));
      await logFriendship(senderId);
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  const handleDenyRequest = async (senderId: string) => {
    if (!currentUser) return;
    setPendingRequests((prev) => prev.filter((r) => r.id !== senderId));
    try {
      await deleteDoc(doc(db, 'profiles', currentUser.uid, 'friendRequests', senderId));
    } catch (err) {
      console.error('Error denying friend request:', err);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    if (!currentUser) return;
    const myRef = doc(db, 'profiles', currentUser.uid, 'friends', friendId);
    const theirRef = doc(db, 'profiles', friendId, 'friends', currentUser.uid);
    try {
      await deleteDoc(myRef);
      setFriends((prev) => prev.filter((id) => id !== friendId));
      setSelectedFriend(null);
      try {
        await deleteDoc(theirRef);
      } catch (err) {
        console.warn('Unfriend cleanup (their side) failed:', err);
      }
    } catch (err) {
      console.error('Error unfriending user:', err);
    }
  };

  const handleBlock = async (user: any) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'profiles', currentUser.uid, 'blocked', user.id), {
        blockedAt: new Date(),
      });
      // Only add to blocked list – DO NOT unfriend
      setBlockedFriends((prev) => [...prev, user.id]);
      setSelectedFriend(null);
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  const handleUnblock = async (userId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'profiles', currentUser.uid, 'blocked', userId));
      setBlockedFriends((prev) => prev.filter((id) => id !== userId));
    } catch (err) {
      console.error('Error unblocking user:', err);
    }
  };

  const isBlocked = (userId: string) => {
    return blockedFriends.includes(userId);
  };

  const filteredUsers = React.useMemo(() =>
    allUsers.filter(
      (user) =>
        user.id !== currentUser.uid &&
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !friends.includes(user.id) &&
        !sentRequests.includes(user.id) &&
        !blockedFriends.includes(user.id)
    ),
    [allUsers, searchQuery, friends, sentRequests, blockedFriends, currentUser.uid]
  );

  useEffect(() => {
    loadLeaderboardData();
  }, [friends, currentUser?.uid]);

  const styles = StyleSheet.create({
    activityAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, },
    activityCard: { borderLeftWidth: 6, borderRadius: 10, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF' },
    activityHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    activityItemBold: { fontWeight: "bold", color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    activityItemCard: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : "#dce3ff", borderRadius: 10, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: colorScheme === 'dark' ? '#666' : '#D1D5DB' },
    activityItemText: { fontSize: 15, color: colorScheme === 'dark' ? '#FFFFFF' : "#0A2940", flex: 1 },
    activityUserText: { fontSize: 14, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    arenaNameText: { fontSize: 16, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', flex: 1 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    activeDot: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#4ADE80', borderWidth: 3, borderColor: '#fff', },
    acceptButton: { backgroundColor: '#4CAF50', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, marginLeft: 8 },
    background: { flex: 1, width: '100%', height: '100%' },
    button: { color: colorScheme === 'dark' ? '#FFFFFF' : '#1E3A8A', fontWeight: 'bold' },
    buttonTextWhite: { color: '#FFFFFF', fontWeight: 'bold' },
    card: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#fff', borderRadius: 12, padding: 16, marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 4, borderColor: '#0D2C42' },
    cheerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, },
    cheerDate: { fontSize: 12, color: colorScheme === 'dark' ? '#BBBBBB' : '#6B7280', marginTop: 4 },
    cheerHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, },
    container: { flex: 1, paddingVertical: 16, paddingHorizontal: 20 },
    dateAndCheerRow: { flexDirection: "row", justifyContent: "flex-start", alignItems: "center", gap: 108, marginBottom: 6, },
    dateText: { fontSize: 12, color: colorScheme === 'dark' ? '#BBBBBB' : "#6B7280" },
    denyButton: { backgroundColor: '#F44336', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, marginLeft: 8 },
    emptyText: { fontSize: 15, color: colorScheme === 'dark' ? '#BBBBBB' : '#6B7280', textAlign: "center", lineHeight: 20 },
    emptyTitle: { fontSize: 20, fontWeight: "700", color: colorScheme === 'dark' ? '#FFFFFF' : "#1E3A8A", textAlign: "center", marginBottom: 8 },
    friendshipBoldName: { fontWeight: "bold", color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    friendshipTime: { fontSize: 12, color: colorScheme === 'dark' ? '#BBBBBB' : "#6B7280", marginTop: 4 },
    itemText: { fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    lbAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, },
    lbName: { flex: 1, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: colorScheme === 'dark' ? '#0A2940' : 'rgba(255,255,255,0.9)', borderRadius: 10, marginBottom: 6 },
    lbRowMe: { backgroundColor: colorScheme === 'dark' ? '#333300' : '#FFFACD', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#FBBF24' : '#FBBF24' },
    lbRowTop3: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#E0E7FF', borderWidth: 2, borderColor: '#0D2C42' },
    lbScore: { fontSize: 18, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', minWidth: 40, textAlign: 'right' },
    leagueAndArenaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 6, },
    leagueBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1.5, marginBottom: 6, },
    leagueBadgeInline: { borderWidth: 1, borderRadius: 4, },
    leagueBadgeText: { fontSize: 12, fontWeight: '600', },
    leagueBadgeTextInline: { fontSize: 12, fontWeight: '600', },
    listRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadMoreButton: { alignSelf: "center", backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 2, borderColor: '#2F4F68' },
    loadMoreText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: "bold", fontSize: 14 },
    loadingOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colorScheme === 'dark' ? '#0A2940' : "#ffffff" },
    matchupText: { fontSize: 14, fontWeight: '500', color: colorScheme === 'dark' ? '#CCCCCC' : '#2F4F68', marginBottom: 6 },
    modalOverlay: { flex: 1, backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#fff', padding: 20, borderRadius: 16, width: '85%', maxWidth: 340, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', textAlign: 'center' },
    modalButton: { paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', },
    modalButtonText: { fontSize: 17, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '600' },
    mutualText: { fontSize: 12, color: colorScheme === 'dark' ? '#BBBBBB' : '#6B7280', marginTop: 2 },
    overlay: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16 },
    placeholder: { fontSize: 16, color: colorScheme === 'dark' ? '#BBBBBB' : '#374151', textAlign: 'center' },
    rank: { fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#4B5563', width: 50 },
    rankGold: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', fontWeight: 'bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colorScheme === 'dark' ? '#fff' : '#D1D5DB', backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#F9FAFB', borderRadius: 12, paddingHorizontal: 12, height: 48 },
    searchIcon: { marginRight: 10, fontSize: 20, color: colorScheme === 'dark' ? '#fff' : '#6B7280' },
    searchInput: { flex: 1, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', height: '100%', },
    subheading: { fontSize: 20, fontWeight: '600', color: colorScheme === 'dark' ? '#FFFFFF' : '#1E3A8A', textAlign: 'center', marginBottom: 10 },
    tabActive: { backgroundColor: colorScheme === 'dark' ? '#1E3A5A' : '#0D2C42' },
    tabButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#E5E7EB' },
    tabText: { fontSize: 14, color: colorScheme === 'dark' ? '#6B7280' : '#000000', fontWeight: '600' },
    tabTextActive: { color: colorScheme === 'dark' ? '#fff' : '#FFF' },
    title: { fontSize: 34, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginTop: 30,  marginBottom: 15, textAlign: 'center', textShadowColor: colorScheme === 'dark' ? '#000000' : '#ffffff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, },
    unblockText: { color: '#1E3A8A', fontWeight: 'bold', },
    unknownActivityCard: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : "#dce3ff", borderRadius: 10, padding: 14, marginBottom: 12 },
    unknownActivityText: { fontSize: 15, color: colorScheme === 'dark' ? '#FFFFFF' : "#0A2940" },
    unknownActivityTime: { fontSize: 12, color: colorScheme === 'dark' ? '#BBBBBB' : "#6B7280", marginTop: 4 },
  });

  if (loading) {
    return (
      <View style={styles.loadingOverlay}>
        <LoadingPuck />
      </View>
    );
  }



  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
    <ImageBackground
      source={colorScheme === 'dark' ? require('@/assets/images/background_dark.jpg') : require('@/assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <ScrollView
        contentContainerStyle={styles.overlay}
        refreshControl={

          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0D2C42"]}
            tintColor="#0D2C42"
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Friends</Text>

        {/* Search Bar */}
        <View style={styles.card}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              placeholderTextColor={colorScheme === 'dark' ? '#BBBBBB' : '#6B7280'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {searchQuery.length > 0 && filteredUsers.length > 0 && (
            <>
              <Text style={styles.subheading}>Search Results</Text>
              {filteredUsers.map((item) => (
                <View key={item.id} style={styles.searchRow}>
                  <Image
                    source={
                      item.imageUrl
                        ? { uri: item.imageUrl }
                        : require('@/assets/images/icon.png')
                    }
                    style={styles.avatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>{item.name}</Text>
                    <Text style={styles.mutualText}>
                      {item.location || 'No location set'}
                      {getMutualFriendsCount(item.id) > 0 && ` · ${getMutualFriendsCount(item.id)} mutual friend${getMutualFriendsCount(item.id) > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleSendRequest(item.id)}>
                    <Text style={styles.button}>Add Friend</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {searchQuery.length > 0 && filteredUsers.length === 0 && (
            <Text style={styles.placeholder}>
              No users found for "{searchQuery}"
            </Text>
          )}

           {searchQuery.length === 0 && (
             <>
               <Text style={styles.subheading}>Suggested Friends</Text>
               {allUsers
                 .filter(u =>
                   u.id !== currentUser?.uid &&                                   // ← THIS BLOCKS YOU 100%
                   !friends.includes(u.id) &&
                   !sentRequests.includes(u.id) &&
                   !blockedFriends.includes(u.id) &&
                   getMutualFriendsCount(u.id) >= 2
                 )
                 .sort((a, b) => getMutualFriendsCount(b.id) - getMutualFriendsCount(a.id))
                 .slice(0, 5)
                 .map(item => {
                   const mutualCount = getMutualFriendsCount(item.id);
                   return (
                     <View key={item.id} style={styles.searchRow}>
                       <Image
                         source={item.imageUrl ? { uri: item.imageUrl } : require('@/assets/images/icon.png')}
                         style={styles.avatar}
                       />
                       <View style={{ flex: 1 }}>
                         <Text style={styles.itemText}>{item.name}</Text>
                         <Text style={styles.mutualText}>
                           {mutualCount} mutual friend{mutualCount > 1 ? 's' : ''}
                         </Text>
                       </View>
                       <TouchableOpacity onPress={() => handleSendRequest(item.id)}>
                         <Text style={styles.button}>Add</Text>
                       </TouchableOpacity>
                     </View>
                   );
                 })}

               {/* Empty state */}
               {allUsers.filter(u =>
                 u.id !== currentUser?.uid &&
                 !friends.includes(u.id) &&
                 !sentRequests.includes(u.id) &&
                 !blockedFriends.includes(u.id) &&
                 getMutualFriendsCount(u.id) >= 2
               ).length === 0 && (
                 <Text style={[styles.placeholder, { textAlign: 'center' }]}>No suggested friends right now</Text>
               )}
             </>
           )}
        </View>

        {/* Pending Friend Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Pending Friend Requests</Text>
            {pendingRequests.map((req) => {
              const sender = allUsers.find((u) => u.id === req.id);
              return (
                <View key={req.id} style={styles.listRow}>
                  <Image
                    source={
                      sender?.imageUrl
                        ? { uri: sender.imageUrl }
                        : require('@/assets/images/icon.png')
                    }
                    style={styles.avatar}
                  />
                  <Text style={[styles.itemText, { flex: 1 }]}>
                    {sender?.name || 'Unknown User'}
                  </Text>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(req.id)}
                  >
                    <Text style={styles.buttonTextWhite}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.denyButton}
                    onPress={() => handleDenyRequest(req.id)}
                  >
                    <Text style={styles.buttonTextWhite}>Deny</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Your Friends */}
        {friends.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Your Friends ({friends.length})</Text>
            {allUsers
              .filter((u) => friends.includes(u.id) && !isBlocked(u.id))
              .sort((a, b) => {
                // Put recently active friends at the top
                const aActive = feed.some(act =>
                  act.friendId === a.id &&
                  act.timestamp &&
                  Date.now() - getTimestamp(act.timestamp).getTime() < 24 * 60 * 60 * 1000
                );
                const bActive = feed.some(act =>
                  act.friendId === b.id &&
                  act.timestamp &&
                  Date.now() - getTimestamp(act.timestamp).getTime() < 24 * 60 * 60 * 1000
                );
                return bActive - aActive || a.name.localeCompare(b.name);
              })
              .map((item) => {
                const isActiveLast24h = feed.some((act) => {
                  if (act.friendId !== item.id) return false;
                  if (!act.timestamp) return false;
                  const ts = getTimestamp(act.timestamp).getTime();
                  return Date.now() - ts < 24 * 60 * 60 * 1000; // 24 hours
                });

                return (
                  <View key={item.id} style={styles.listRow}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => router.push(`/userprofile/${item.id}`)}
                    >
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={item.imageUrl ? { uri: item.imageUrl } : require('@/assets/images/icon.png')}
                          style={styles.avatar}
                        />
                        {isActiveLast24h && <View style={styles.activeDot} />}
                      </View>

                      <Text style={[styles.itemText, { marginLeft: 12 }]}>{item.name}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setSelectedFriend(item)}>
                      <Ionicons name="ellipsis-vertical" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#0A2940'} />
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        )}

          {friends.length === 0 && !loading && (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyText}>
                Search for people above and send some friend requests!
              </Text>
            </View>
          )}

          {feed.length === 0 && !loading && (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Quiet in here...</Text>
              <Text style={styles.emptyText}>
                When your friends check in, cheer, or chirp — it’ll show up here.
              </Text>
            </View>
          )}

          {/* FRIEND LEADERBOARD */}
          {friends.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.subheading}>Friend Leaderboard</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 24 }}>
                <TouchableOpacity
                  onPress={() => setActiveTab('arenas')}
                  style={[styles.tabButton, activeTab === 'arenas' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, activeTab === 'arenas' && styles.tabTextActive]}>
                    Arenas Visited
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('teams')}
                  style={[styles.tabButton, activeTab === 'teams' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, activeTab === 'teams' && styles.tabTextActive]}>
                    Teams Watched
                  </Text>
                </TouchableOpacity>
              </View>

              {lbLoading ? (
                <ActivityIndicator size="small" color="#0D2C42" />
              ) : leaderboardData.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#6B7280', paddingVertical: 20 }}>
                  No check-ins yet
                </Text>
              ) : (
                leaderboardData
                  .sort((a, b) =>
                    activeTab === 'arenas'
                      ? b.arenas - a.arenas
                      : b.teams - a.teams
                  )
                  .slice(0, 5)
                  .map((user, index) => {
                    const score = activeTab === 'arenas' ? user.arenas : user.teams;
                    const isMe = user.id === currentUser?.uid;

                    return (
                      <View
                        key={user.id}
                        style={[
                          styles.lbRow,
                          isMe && styles.lbRowMe,
                          index < 3 && styles.lbRowTop3
                        ]}
                      >
                        <Text style={[styles.rank, index < 3 && styles.rankGold]}>
                          {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}.`}
                        </Text>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => router.push(`/userprofile/${user.id}`)}
                        >
                          <Image
                            source={user.imageUrl ? { uri: user.imageUrl } : require('@/assets/images/icon.png')}
                            style={styles.lbAvatar}
                          />
                          <Text style={[styles.lbName, isMe && { fontWeight: 'bold' }, index < 3 && styles.lbNameTop3]}>
                            {user.name}{isMe ? ' (You)' : ''}
                          </Text>
                        </TouchableOpacity>

                        <Text style={[styles.lbScore, index < 3 && styles.lbScoreTop3]}>
                          {score}
                        </Text>
                      </View>
                    );
                  })
              )}
            </View>
          )}



          {/* Friends Activity */}
          {feed.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.subheading}>Friends Activity</Text>

              {feed.slice(0, visibleCount).map((item, index) => {
                const friend = allUsers.find((u) => u.id === item.friendId);
                const friendName = friend?.name || "Unknown User";
                const friendImage = friend?.imageUrl || null;
                const time = getTimestamp(item.timestamp).toLocaleString();

                if (item.type === "checkin") {
                  const arenaName = resolveArenaName(item);
                  const league = item.league || item.leagueName || item.league_code || "Unknown league";
                  const teamCode = resolveTeamCode(item);
                  const teamName = resolveTeamName(item);

                  let arenaData: any = null;

                  arenaData = (arenasData as any[]).find(
                    (a) =>
                      a.league === item.league &&
                      (a.arena === item.arenaName || a.arena === item.arena)
                  );

                  if (!arenaData) {
                    const historyEntry = (arenaHistory as any[]).find(
                      (h) =>
                        h.league === item.league &&
                        h.teamName === resolveTeamName(item) &&
                        h.history.some(
                          (old) => old.name === item.arenaName || old.name === item.arena
                        )
                    );

                    if (historyEntry) {
                      arenaData = (arenasData as any[]).find(
                        (a) =>
                          a.league === historyEntry.league &&
                          a.teamName === historyEntry.teamName &&
                          a.arena === historyEntry.currentArena
                      );
                    }
                  }

                  if (!arenaData) {
                    arenaData = (historicalTeams as any[]).find(
                      (h) =>
                        h.league === item.league &&
                        (h.teamName === resolveTeamName(item) || h.teamCode === resolveTeamCode(item))
                    );
                  }

                  const colorCode = arenaData?.colorCode || "#6B7280";
                  const bgColor = `${colorCode}22`;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.activityCard, { backgroundColor: bgColor, borderLeftColor: colorCode }]}
                      onPress={() =>
                        router.push({
                          pathname: "/checkin/[checkinId]",
                          params: { checkinId: item.id, userId: item.friendId },
                        })
                      }
                    >

                      <View style={styles.activityHeader}>
                        <Image
                          source={friendImage ? { uri: friendImage } : require('@/assets/images/icon.png')}
                          style={styles.activityAvatar}
                        />
                        <Text style={styles.activityUserText}>
                          {friendName} checked in at
                        </Text>
                      </View>

                      <View style={styles.leagueAndArenaRow}>
                        <View style={[styles.leagueBadgeInline, { borderColor: colorCode }]}>
                          <Text style={[styles.leagueBadgeTextInline, { color: colorCode }]}>
                            {league}
                          </Text>
                        </View>
                        <Text style={styles.arenaNameText}>
                          {arenaName}
                        </Text>
                      </View>

                      <Text style={styles.matchupText}>
                        {resolveTeamName(item)} vs {resolveTeamName(item.opponent ? { teamName: item.opponent } : item)}
                      </Text>

                      <View
                        style={styles.dateAndCheerRow}
                      >
                        <Text style={styles.dateText}>
                          {new Date(item.gameDate || item.timestamp).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Text>
                        <CheerButton friendId={item.friendId} checkinId={item.id} />
                      </View>

                      <ChirpBox friendId={item.friendId} checkinId={item.id} />
                    </TouchableOpacity>
                  );
                }

                if (item.type === "cheer") {
                  const actor = allUsers.find((u) => u.id === item.actorId);
                  return (
                    <View
                      key={index}
                      style={styles.activityItemCard}
                    >
                      <View style={styles.cheerHeader}>
                        <Image
                          source={
                            actor?.imageUrl
                              ? { uri: actor.imageUrl }
                              : require("@/assets/images/icon.png")
                          }
                          style={styles.cheerAvatar}
                        />
                        <Text style={styles.activityItemText}>
                          <Text style={styles.activityItemBold}>
                            {actor?.name || "Unknown User"}
                          </Text>{" "}
                          cheered a check-in 🎉
                        </Text>
                      </View>
                      <Text style={styles.cheerDate}>
                        {new Date(getTimestamp(item.timestamp)).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </Text>
                    </View>
                  );
                }

              if (item.type === "friendship") {
                  const userA = allUsers.find((u) => u.id === item.actorId);
                  const userB = allUsers.find((u) => u.id === item.targetId);
                  return (
                    <View
                      key={index}
                      style={styles.activityItemCard}
                    >
                      <Text style={styles.activityItemText}>
                        <Text style={styles.friendshipBoldName}>
                          {userA?.name || "Unknown User"}
                        </Text>
                        {" became friends with "}
                        <Text style={styles.friendshipBoldName}>
                          {userB?.name || "Unknown User"}
                        </Text>
                      </Text>
                      <Text style={styles.friendshipTime}>
                        {new Date(item.timestamp?.seconds ? item.timestamp.seconds * 1000 : item.timestamp)
                          .toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={index}
                    style={styles.unknownActivityCard}
                  >
                    <Text style={styles.unknownActivityText}>
                      {item.message || "Unknown activity"}
                    </Text>
                    <Text style={styles.unknownActivityTime}>
                      {getTimestamp(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                );
              })}

              {visibleCount < feed.length && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() => setVisibleCount(prev => Math.min(prev + 5, feed.length))}
                >
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {selectedFriend && (
            <Modal
              transparent={true}
              visible={true}
              animationType="fade"
              onRequestClose={() => setSelectedFriend(null)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{selectedFriend.name}</Text>

                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setSelectedFriend(null);
                      router.push({
                        pathname: '/userprofile/[userId]',
                        params: { userId: selectedFriend.id },
                      });
                    }}
                  >
                    <Text style={styles.modalButtonText}>View Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => handleUnfriend(selectedFriend.id)}
                  >
                    <Text style={styles.modalButtonText}>Unfriend</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => handleBlock(selectedFriend)}
                  >
                    <Text style={styles.modalButtonText}>Block</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#fff', borderRadius: 30, }]}
                    onPress={() => setSelectedFriend(null)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}