import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'roompear_discover_usage_v1';

function localDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}:${localDateKey()}`;
}

export type DiscoverDailyUsage = {
  swipes: number;
  topPicks: number;
};

export async function getDiscoverUsage(userId: string): Promise<DiscoverDailyUsage> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return { swipes: 0, topPicks: 0 };
    const p = JSON.parse(raw) as Partial<DiscoverDailyUsage>;
    return {
      swipes: typeof p.swipes === 'number' ? p.swipes : 0,
      topPicks: typeof p.topPicks === 'number' ? p.topPicks : 0,
    };
  } catch {
    return { swipes: 0, topPicks: 0 };
  }
}

export async function recordDiscoverAction(
  userId: string,
  direction: 'like' | 'pass' | 'top_pick'
): Promise<void> {
  const u = await getDiscoverUsage(userId);
  if (direction === 'top_pick') {
    u.swipes += 1;
    u.topPicks += 1;
  } else {
    u.swipes += 1;
  }
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(u));
}
