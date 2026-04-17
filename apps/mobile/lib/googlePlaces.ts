/**
 * Google Places (legacy REST) + Geocoding — US-biased.
 * Requires: Places API + Geocoding API enabled on the API key.
 */

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export type PlacePrediction = {
  place_id: string;
  description: string;
};

export type ParsedPlace = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
};

function parseGeocodeComponents(
  components: { long_name: string; short_name: string; types: string[] }[]
): Pick<ParsedPlace, 'city' | 'state' | 'zipCode'> {
  let city = '';
  let state = '';
  let zipCode = '';

  for (const c of components) {
    const types = c.types;
    if (types.includes('locality')) {
      city = c.long_name;
    } else if (!city && types.includes('sublocality')) {
      city = c.long_name;
    } else if (!city && types.includes('neighborhood')) {
      city = c.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      state = c.short_name;
    }
    if (types.includes('postal_code')) {
      zipCode = c.long_name;
    }
  }

  return { city, state, zipCode };
}

export async function fetchPlacePredictions(
  apiKey: string,
  input: string
): Promise<PlacePrediction[]> {
  const q = input.trim();
  if (q.length < 2) return [];

  const url = `${AUTOCOMPLETE_URL}?input=${encodeURIComponent(q)}&components=country:us&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status === 'REQUEST_DENIED' || json.error_message) {
    if (__DEV__) {
      console.warn('[googlePlaces] autocomplete', json.status, json.error_message);
    }
    return [];
  }

  const preds = json.predictions ?? [];
  return preds.map((p: { place_id: string; description: string }) => ({
    place_id: p.place_id,
    description: p.description,
  }));
}

export async function fetchPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<ParsedPlace | null> {
  const fields = 'geometry,formatted_address,address_components';
  const url = `${DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== 'OK' || !json.result) {
    if (__DEV__) {
      console.warn('[googlePlaces] place details', json.status, json.error_message);
    }
    return null;
  }

  const r = json.result;
  const loc = r.geometry?.location;
  if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') {
    return null;
  }

  const { city, state, zipCode } = parseGeocodeComponents(r.address_components ?? []);

  return {
    latitude: loc.lat,
    longitude: loc.lng,
    formattedAddress: r.formatted_address ?? '',
    city,
    state,
    zipCode,
  };
}

/** Optional: reverse geocode after dragging the pin (one call per user action). */
export async function reverseGeocode(
  apiKey: string,
  latitude: number,
  longitude: number
): Promise<Pick<ParsedPlace, 'formattedAddress' | 'city' | 'state' | 'zipCode'> | null> {
  const url = `${GEOCODE_URL}?latlng=${latitude},${longitude}&result_type=street_address|route|neighborhood|locality|postal_code&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== 'OK' || !json.results?.[0]) {
    if (__DEV__) {
      console.warn('[googlePlaces] reverse geocode', json.status, json.error_message);
    }
    return null;
  }

  const best = json.results[0];
  const { city, state, zipCode } = parseGeocodeComponents(best.address_components ?? []);

  return {
    formattedAddress: best.formatted_address ?? '',
    city,
    state,
    zipCode,
  };
}
