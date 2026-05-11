import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fetchDiscoverProfiles,
  type DiscoverProfile,
} from '../lib/discover';
import { hasRoomPearPlusEntitlement } from '../lib/purchasesConfig';
import { fetchProfileIsPremium } from '../lib/profileSubscriptionTier';
import { usePurchases } from './PurchasesContext';

const BATCH_SIZE = 10;
const PREFETCH_REMAINING = 3;

type DiscoverDeckContextValue = {
  userId: string;
  profiles: DiscoverProfile[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  deckInitialLoading: boolean;
  hasPremiumAccess: boolean;
  /** Re-read `profiles.subscription_tier` so Discover limits / filters match after dev toggle or RC sync. */
  syncPremiumFromDatabase: () => Promise<void>;
  refreshDeck: (opts?: { silent?: boolean }) => Promise<void>;
  removeProfileFromDeck: (profileId: string) => void;
};

const DiscoverDeckContext = createContext<DiscoverDeckContextValue | null>(null);

export function useDiscoverDeck(): DiscoverDeckContextValue {
  const v = useContext(DiscoverDeckContext);
  if (!v) {
    throw new Error('useDiscoverDeck must be used within DiscoverDeckProvider');
  }
  return v;
}

type Props = {
  userId: string;
  children: React.ReactNode;
};

export function DiscoverDeckProvider({ userId, children }: Props) {
  const { customerInfo, isRoomPearPlus } = usePurchases();
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckInitialLoading, setDeckInitialLoading] = useState(true);
  const [hasPremiumTier, setHasPremiumTier] = useState(false);

  const profilesRef = useRef(profiles);
  const currentIndexRef = useRef(currentIndex);
  profilesRef.current = profiles;
  currentIndexRef.current = currentIndex;

  const customerInfoRef = useRef(customerInfo);
  const isRoomPearPlusRef = useRef(isRoomPearPlus);
  customerInfoRef.current = customerInfo;
  isRoomPearPlusRef.current = isRoomPearPlus;

  const prefetchInFlight = useRef(false);
  const appendExhausted = useRef(false);
  /** First fetch finished for this user (even if deck is empty) — avoids refetch on tab blur/focus. */
  const deckInitRef = useRef<{ userId: string | null; complete: boolean }>({
    userId: null,
    complete: false,
  });
  /** Tracks premium for "flip to paid → refresh deck" (null = not yet anchored after load). */
  const prevHasPremiumForDeckRef = useRef<boolean | null>(null);

  const hasPremiumAccess = useMemo(
    () =>
      hasRoomPearPlusEntitlement(customerInfo) ||
      isRoomPearPlus ||
      hasPremiumTier,
    [customerInfo, isRoomPearPlus, hasPremiumTier]
  );

  const hasPremiumAccessRef = useRef(hasPremiumAccess);
  hasPremiumAccessRef.current = hasPremiumAccess;

  const syncPremiumFromDatabase = useCallback(async () => {
    const tierPremium = await fetchProfileIsPremium(userId);
    setHasPremiumTier(tierPremium);
  }, [userId]);

  const resolvePremiumForFetch = useCallback(async () => {
    const tierPremium = await fetchProfileIsPremium(userId);
    setHasPremiumTier(tierPremium);
    return (
      hasRoomPearPlusEntitlement(customerInfoRef.current) ||
      isRoomPearPlusRef.current ||
      tierPremium
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void syncPremiumFromDatabase();
  }, [userId, customerInfo, syncPremiumFromDatabase]);

  const refreshDeck = useCallback(async (opts?: { silent?: boolean }) => {
    appendExhausted.current = false;
    prefetchInFlight.current = false;
    if (!opts?.silent) setDeckInitialLoading(true);
    try {
      const premium = await resolvePremiumForFetch();
      const data = await fetchDiscoverProfiles(userId, BATCH_SIZE, {
        useAdvancedFilters: premium,
        isPremium: premium,
      });
      setProfiles(data);
      setCurrentIndex(0);
    } finally {
      if (!opts?.silent) setDeckInitialLoading(false);
    }
  }, [userId, resolvePremiumForFetch]);

  const removeProfileFromDeck = useCallback((profileId: string) => {
    const prev = profilesRef.current;
    const idx = prev.findIndex(p => p.id === profileId);
    if (idx === -1) return;
    const next = prev.filter(p => p.id !== profileId);
    let ci = currentIndexRef.current;
    if (ci > idx) ci -= 1;
    else if (ci === idx) ci = Math.min(ci, Math.max(0, next.length - 1));
    ci = Math.max(0, Math.min(ci, Math.max(0, next.length - 1)));
    setProfiles(next);
    setCurrentIndex(ci);
  }, []);

  /** Same user returning to Discover: keep deck. New user / cold deck: load once. */
  useEffect(() => {
    if (!userId) {
      deckInitRef.current = { userId: null, complete: false };
      prevHasPremiumForDeckRef.current = null;
      setProfiles([]);
      setCurrentIndex(0);
      setDeckInitialLoading(false);
      return;
    }

    if (deckInitRef.current.userId === userId && deckInitRef.current.complete) {
      setDeckInitialLoading(false);
      return;
    }

    if (deckInitRef.current.userId !== null && deckInitRef.current.userId !== userId) {
      prevHasPremiumForDeckRef.current = null;
      setProfiles([]);
      setCurrentIndex(0);
    }

    let cancelled = false;
    (async () => {
      setDeckInitialLoading(true);
      try {
        const premium = await resolvePremiumForFetch();
        if (cancelled) return;
        const data = await fetchDiscoverProfiles(userId, BATCH_SIZE, {
          useAdvancedFilters: premium,
          isPremium: premium,
        });
        if (cancelled) return;
        setProfiles(data);
        setCurrentIndex(0);
        deckInitRef.current = { userId, complete: true };
        appendExhausted.current = false;
      } finally {
        if (!cancelled) setDeckInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, resolvePremiumForFetch]);

  /** After subscribe / dev premium: rebuild deck with premium scoring + advanced filters (skip cold start). */
  useEffect(() => {
    if (!userId) return;
    if (deckInitialLoading) return;

    const prev = prevHasPremiumForDeckRef.current;
    if (prev === null) {
      prevHasPremiumForDeckRef.current = hasPremiumAccess;
      return;
    }

    if (!prev && hasPremiumAccess && deckInitRef.current.complete) {
      prevHasPremiumForDeckRef.current = hasPremiumAccess;
      void refreshDeck();
      return;
    }

    prevHasPremiumForDeckRef.current = hasPremiumAccess;
  }, [userId, hasPremiumAccess, deckInitialLoading, refreshDeck]);

  useEffect(() => {
    if (!userId || deckInitialLoading) return;
    if (appendExhausted.current || prefetchInFlight.current) return;

    const remaining = profiles.length - currentIndex;
    if (remaining > PREFETCH_REMAINING) return;
    if (profiles.length === 0) return;

    prefetchInFlight.current = true;
    let alive = true;

    (async () => {
      try {
        const premium = hasPremiumAccessRef.current;
        const excludeIds = profilesRef.current.map(p => p.id);
        const more = await fetchDiscoverProfiles(userId, BATCH_SIZE, {
          useAdvancedFilters: premium,
          isPremium: premium,
          excludeIds,
        });
        if (!alive) return;
        if (more.length === 0) {
          appendExhausted.current = true;
          return;
        }
        setProfiles(prev => {
          const seen = new Set(prev.map(p => p.id));
          const merged = [...prev];
          for (const p of more) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              merged.push(p);
            }
          }
          return merged;
        });
        if (more.length < BATCH_SIZE) {
          appendExhausted.current = true;
        }
      } finally {
        prefetchInFlight.current = false;
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, deckInitialLoading, profiles.length, currentIndex]);

  const value = useMemo<DiscoverDeckContextValue>(
    () => ({
      userId,
      profiles,
      currentIndex,
      setCurrentIndex,
      deckInitialLoading,
      hasPremiumAccess,
      syncPremiumFromDatabase,
      refreshDeck,
      removeProfileFromDeck,
    }),
    [
      userId,
      profiles,
      currentIndex,
      deckInitialLoading,
      hasPremiumAccess,
      syncPremiumFromDatabase,
      refreshDeck,
      removeProfileFromDeck,
    ]
  );

  return (
    <DiscoverDeckContext.Provider value={value}>{children}</DiscoverDeckContext.Provider>
  );
}
