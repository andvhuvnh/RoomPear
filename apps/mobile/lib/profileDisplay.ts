import type { Preferences } from './preferences';

/** Format city / state / legacy location for profile card subtitle. */
export function formatLocationLine(prefs: Preferences | null): string {
  if (!prefs) return '';
  const city = prefs.city?.trim();
  const state = prefs.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return prefs.location?.trim() ?? '';
}

/** Normalize stored profile_photo_url (JSON string, array, or single path) into file paths. */
export function profilePhotoPathsFromRow(profilePhotoUrl: unknown): string[] {
  if (profilePhotoUrl == null) return [];
  if (Array.isArray(profilePhotoUrl)) {
    return profilePhotoUrl.filter((p): p is string => typeof p === 'string' && p.length > 0);
  }
  if (typeof profilePhotoUrl === 'string') {
    const trimmed = profilePhotoUrl.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === 'string' && p.length > 0);
      }
    } catch {
      return [trimmed];
    }
    return [trimmed];
  }
  return [];
}
