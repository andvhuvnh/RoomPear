import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
} from '@rnmapbox/maps';
import circle from '@turf/circle';
import Constants from 'expo-constants';
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  reverseGeocode,
  type PlacePrediction,
} from '../lib/googlePlaces';
import type { SearchAreaValue } from '../lib/searchAreaTypes';

export type { SearchAreaValue };

type Props = {
  onChange: (value: SearchAreaValue | null) => void;
};

const DEFAULT_RADIUS_MILES = 10;
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;
const DEFAULT_MAP_CENTER: [number, number] = [-98.5795, 39.8283];

function buildCircleGeoJson(lng: number, lat: number, radiusMiles: number) {
  const radiusKm = radiusMiles * 1.609344;
  return circle([lng, lat], radiusKm, { steps: 64, units: 'kilometers' });
}

/** Bounding box around circle (center + radius in miles) for fitting the camera. */
function boundsForRadiusMiles(lat: number, lng: number, radiusMiles: number) {
  const radiusKm = radiusMiles * 1.609344;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.25, Math.abs(cosLat)));
  return {
    ne: [lng + dLng, lat + dLat] as [number, number],
    sw: [lng - dLng, lat - dLat] as [number, number],
  };
}

export default function SearchAreaMapPicker({ onChange }: Props) {
  const googleApiKey =
    (Constants.expoConfig?.extra?.googlePlacesApiKey as string | undefined) ?? '';
  const mapboxToken =
    (Constants.expoConfig?.extra?.mapboxAccessToken as string | undefined) ?? '';

  const cameraRef = useRef<Camera | null>(null);

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [searchLabel, setSearchLabel] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

  const emit = useCallback(
    (next: {
      latitude: number;
      longitude: number;
      radiusMiles: number;
      searchLabel: string;
      city: string;
      state: string;
      zipCode: string;
    } | null) => {
      if (!next) {
        onChange(null);
        return;
      }
      onChange({
        latitude: next.latitude,
        longitude: next.longitude,
        radiusMiles: next.radiusMiles,
        searchLabel: next.searchLabel,
        city: next.city,
        state: next.state,
        zipCode: next.zipCode,
      });
    },
    [onChange]
  );

  useEffect(() => {
    if (!center || !searchLabel.trim()) {
      emit(null);
      return;
    }
    emit({
      latitude: center.lat,
      longitude: center.lng,
      radiusMiles,
      searchLabel: searchLabel.trim(),
      city,
      state,
      zipCode,
    });
  }, [center, radiusMiles, searchLabel, city, state, zipCode, emit]);

  useEffect(() => {
    if (!googleApiKey || query.trim().length < 2) {
      setPredictions([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingPredictions(true);
      try {
        const list = await fetchPlacePredictions(googleApiKey, query);
        setPredictions(list);
      } finally {
        setLoadingPredictions(false);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [query, googleApiKey]);

  const circleFeature = useMemo(() => {
    if (!center) return null;
    return buildCircleGeoJson(center.lng, center.lat, radiusMiles);
  }, [center, radiusMiles]);

  const fitCameraToRadiusRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refit camera when radius changes only (not when pin moves) so drag isn't fighting the camera.
  useEffect(() => {
    if (!center) return;
    if (fitCameraToRadiusRef.current) {
      clearTimeout(fitCameraToRadiusRef.current);
    }
    fitCameraToRadiusRef.current = setTimeout(() => {
      fitCameraToRadiusRef.current = null;
      const { ne, sw } = boundsForRadiusMiles(center.lat, center.lng, radiusMiles);
      cameraRef.current?.setCamera({
        bounds: { ne, sw },
        padding: {
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 28,
          paddingBottom: 28,
        },
        animationDuration: 220,
      });
    }, 90);
    return () => {
      if (fitCameraToRadiusRef.current) {
        clearTimeout(fitCameraToRadiusRef.current);
      }
    };
  }, [radiusMiles]);

  const selectPrediction = async (p: PlacePrediction) => {
    if (!googleApiKey) return;
    Keyboard.dismiss();
    setPredictions([]);
    setQuery(p.description);
    const details = await fetchPlaceDetails(googleApiKey, p.place_id);
    if (!details) return;
    setCenter({ lat: details.latitude, lng: details.longitude });
    setSearchLabel(details.formattedAddress || p.description);
    setCity(details.city);
    setState(details.state);
    setZipCode(details.zipCode);
    const { ne, sw } = boundsForRadiusMiles(
      details.latitude,
      details.longitude,
      radiusMiles
    );
    cameraRef.current?.setCamera({
      bounds: { ne, sw },
      padding: {
        paddingLeft: 28,
        paddingRight: 28,
        paddingTop: 28,
        paddingBottom: 28,
      },
      animationDuration: 600,
    });
  };

  const onDragEnd = (feature: { geometry?: { type: string; coordinates: number[] } }) => {
    const g = feature.geometry;
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return;
    const [lng, lat] = g.coordinates;
    setCenter({ lat, lng });
  };

  const refreshLabelFromPin = async () => {
    if (!googleApiKey || !center) return;
    setReverseLoading(true);
    try {
      const rev = await reverseGeocode(googleApiKey, center.lat, center.lng);
      if (rev) {
        setSearchLabel(rev.formattedAddress);
        setCity(rev.city);
        setState(rev.state);
        setZipCode(rev.zipCode);
      }
    } finally {
      setReverseLoading(false);
    }
  };

  if (!mapboxToken) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.warnTitle}>Mapbox token missing</Text>
        <Text style={styles.warnBody}>
          Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in apps/mobile/.env and rebuild the native app (Mapbox does
          not run in Expo Go).
        </Text>
        {!googleApiKey ? (
          <Text style={styles.warnBody}>Also add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY for search.</Text>
        ) : null}
      </View>
    );
  }

  const mapCenter: [number, number] = center
    ? [center.lng, center.lat]
    : DEFAULT_MAP_CENTER;

  return (
    <View style={styles.root}>
      {!googleApiKey ? (
        <Text style={styles.warnInline}>
          Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to enable location search.
        </Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="City, neighborhood, or ZIP"
        placeholderTextColor="#8899aa"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="words"
      />

      {loadingPredictions ? (
        <ActivityIndicator color="#0C5389" style={styles.loader} />
      ) : null}

      {predictions.length > 0 ? (
        <View style={styles.predList}>
          {predictions.map((item) => (
            <TouchableOpacity
              key={item.place_id}
              style={styles.predRow}
              onPress={() => selectPrediction(item)}
            >
              <Text style={styles.predText}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.mapWrap} collapsable={false}>
        <MapView
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
          compassEnabled={false}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: mapCenter,
              zoomLevel: center ? 11 : 3,
            }}
          />
          {circleFeature ? (
            <ShapeSource
              id="search-radius"
              key={`circle-${center.lat}-${center.lng}-${radiusMiles}`}
              shape={circleFeature}
            >
              <FillLayer
                id="search-radius-fill"
                style={{ fillColor: '#189AA2', fillOpacity: 0.22 }}
              />
              <LineLayer
                id="search-radius-line"
                style={{
                  lineColor: '#0C5389',
                  lineWidth: 3,
                  lineOpacity: 0.95,
                }}
              />
            </ShapeSource>
          ) : null}
          {center ? (
            <PointAnnotation
              id="search-pin"
              coordinate={[center.lng, center.lat]}
              draggable
              anchor={{ x: 0.5, y: 0.5 }}
              onDragEnd={onDragEnd}
            >
              <View style={styles.pinDot} />
            </PointAnnotation>
          ) : null}
        </MapView>
      </View>

      <Text style={styles.radiusLabel}>Radius: {Math.round(radiusMiles)} mi</Text>
      <Slider
        style={styles.slider}
        minimumValue={MIN_RADIUS}
        maximumValue={MAX_RADIUS}
        step={1}
        value={radiusMiles}
        onValueChange={(v) => setRadiusMiles(v)}
        minimumTrackTintColor="#189AA2"
        maximumTrackTintColor="#D9E1E6"
        thumbTintColor="#0C5389"
      />

      {searchLabel ? (
        <Text style={styles.areaLabel} numberOfLines={3}>
          {searchLabel}
        </Text>
      ) : (
        <Text style={styles.hint}>
          Search above to place the pin, then press and drag the dot to move it. You can also pan the map.
        </Text>
      )}

      {center && googleApiKey ? (
        <TouchableOpacity onPress={refreshLabelFromPin} disabled={reverseLoading}>
          <Text style={styles.link}>
            {reverseLoading ? 'Updating label…' : 'Update location label from pin'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  fallback: {
    padding: 12,
  },
  warnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 8,
  },
  warnBody: {
    fontSize: 14,
    color: '#0C5389',
    lineHeight: 20,
  },
  warnInline: {
    fontSize: 13,
    color: '#B35C00',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FDFDFD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    color: '#0C5389',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 4,
  },
  predList: {
    maxHeight: 120,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  predRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9E1E6',
  },
  predText: {
    fontSize: 14,
    color: '#0C5389',
  },
  mapWrap: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    marginBottom: 8,
  },
  map: {
    flex: 1,
  },
  pinDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0C5389',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 6,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 36,
    marginBottom: 8,
  },
  areaLabel: {
    fontSize: 13,
    color: '#355',
    lineHeight: 18,
  },
  hint: {
    fontSize: 13,
    color: '#789',
    fontStyle: 'italic',
  },
  link: {
    fontSize: 13,
    color: '#189AA2',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
