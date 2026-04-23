const EARTH_RADIUS_MILES = 3958.7613;

type Coordinates = {
  lat: number;
  lng: number;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMiles(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_MILES * angularDistance;
}

export function isWithinRadiusMiles(
  center: Coordinates,
  target: Coordinates,
  radiusMiles: number
): boolean {
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) return true;
  return calculateDistanceMiles(center, target) <= radiusMiles;
}
