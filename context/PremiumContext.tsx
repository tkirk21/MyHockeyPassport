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

      console.log('AUTH UID:', user.uid);

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
        // 🔹 STEP 1: CHECK WHITELIST
        const whitelistRef = doc(db, 'premiumWhitelist', 'global');
        const whitelistSnap = await getDoc(whitelistRef);

        if (whitelistSnap.exists()) {
          const data = whitelistSnap.data();
          if (data?.whitelistedUids?.includes(user.uid)) {
            console.log('WHITELISTED USER:', user.uid);
            setIsPremium(true);
            setIsLoadingPremium(false);
            return; // ⛔ BYPASS TRIAL LOGIC COMPLETELY
          }
        }

        // 🔹 STEP 2: FALL BACK TO TRIAL LOGIC (use getDoc instead of onSnapshot to avoid listen permission weirdness)
        const profileRef = doc(db, 'profiles', user.uid);

        console.log('Fetching profile with getDoc for trial check:', user.uid);

        try {
          const profileSnap = await getDoc(profileRef);
          setIsLoadingPremium(false);

          if (!profileSnap.exists()) {
            console.log('Profile does not exist → creating with trialStart');
            await setDoc(profileRef, {
              trialStart: serverTimestamp(),
              // add any other default fields you want
            }, { merge: true });

            setIsPremium(true);
            return;
          }

          const data = profileSnap.data();
          console.log('Profile data (getDoc):', data);

          const trialStartRaw = data?.trialStart;

          let trialStartDate = new Date(0);
          if (trialStartRaw?.toDate) {
            trialStartDate = trialStartRaw.toDate();
          }

          const trialExpired =
            Date.now() - trialStartDate.getTime() >
            3 * 24 * 60 * 60 * 1000; // 3 days

          setIsPremium(!trialExpired);

        } catch (err) {
          console.error('getDoc trial check failed:', err);
          setIsLoadingPremium(false);
          setIsPremium(false); // fail closed
        }

      } catch (err) {
        console.error('Premium check failed:', err);
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