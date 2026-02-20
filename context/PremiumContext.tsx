import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/firebaseConfig';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

type PremiumContextType = {
  isPremium: boolean;
  isLoadingPremium: boolean;
};

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoadingPremium, setIsLoadingPremium] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setIsPremium(false);
        setIsLoadingPremium(false);
        return;
      }

      // User is logged in — set loading and let the separate listener handle profile
      setIsLoadingPremium(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setIsPremium(false);
      setIsLoadingPremium(false);
      return;
    }

    let unsubscribeProfile: (() => void) | null = null;

    const run = async () => {
      try {
        // STEP 1: WHITELIST
        const whitelistRef = doc(db, 'premiumWhitelist', 'global');
        const whitelistSnap = await getDoc(whitelistRef);

        if (whitelistSnap.exists()) {
          const data = whitelistSnap.data();
          if (data?.whitelistedUids?.includes(user.uid)) {
            setIsPremium(true);
            setIsLoadingPremium(false);
            return;
          }
        }

        // STEP 2: PROFILE
        const profileRef = doc(db, 'profiles', user.uid);
        const profileSnap = await getDoc(profileRef);

        // STEP 2A: PAID SUBSCRIPTION
        const sub = profileSnap.data()?.subscription;
        if (
          sub?.status === 'active' &&
          sub?.expiresAt?.toDate &&
          sub.expiresAt.toDate() > new Date()
        ) {
          setIsPremium(true);
          setIsLoadingPremium(false);
          return;
        }

        // STEP 2B: TRIAL (SAFE)
        const data = profileSnap.data();
        if (!profileSnap.exists()) {
          setIsPremium(true);
          setIsLoadingPremium(false);
          return;
        }

        if (!data?.trialStart) {
          setIsPremium(true);
          setIsLoadingPremium(false);
          return;
        }

        const trialStartDate = data.trialStart.toDate();
        const expired =
          Date.now() - trialStartDate.getTime() >
          3 * 24 * 60 * 60 * 1000;

        setIsPremium(!expired);
        setIsLoadingPremium(false);

      } catch (err: any) {
        if (err?.code !== 'permission-denied') {
          console.error('Premium check failed:', err);
        }

        setIsPremium(false);
        setIsLoadingPremium(false);
      }
    };

    run();

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [auth.currentUser?.uid]);

  return (
    <PremiumContext.Provider value={{ isPremium, isLoadingPremium }}>
      {children}
    </PremiumContext.Provider>
  );
}

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};