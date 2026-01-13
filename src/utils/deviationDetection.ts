import { LatLng } from '@/types/route';

/**
 * Calculate the distance between two points using Haversine formula
 */
export const calculateDistance = (point1: LatLng, point2: LatLng): number => {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Find the minimum distance from a point to the route path
 */
export const getDistanceFromRoute = (currentPosition: LatLng, routePath: LatLng[]): number => {
  if (!routePath || routePath.length === 0) {
    return Infinity;
  }

  let minDistance = Infinity;

  // Check distance to each segment of the route
  for (let i = 0; i < routePath.length - 1; i++) {
    const segmentDistance = pointToSegmentDistance(currentPosition, routePath[i], routePath[i + 1]);
    minDistance = Math.min(minDistance, segmentDistance);
  }

  return minDistance;
};

/**
 * Calculate perpendicular distance from a point to a line segment
 */
const pointToSegmentDistance = (point: LatLng, segStart: LatLng, segEnd: LatLng): number => {
  const dx = segEnd.lng - segStart.lng;
  const dy = segEnd.lat - segStart.lat;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Segment is a point
    return calculateDistance(point, segStart);
  }

  // Calculate projection parameter t
  let t = ((point.lng - segStart.lng) * dx + (point.lat - segStart.lat) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  // Find closest point on segment
  const closestPoint: LatLng = {
    lat: segStart.lat + t * dy,
    lng: segStart.lng + t * dx,
  };

  return calculateDistance(point, closestPoint);
};

export interface DeviationResult {
  isDeviated: boolean;
  distance: number; // in meters
  severity: 'safe' | 'warning' | 'danger';
  message: string;
}

/**
 * Check if user has deviated from the route
 * - Within 100m: Safe
 * - 100-200m: Warning
 * - Beyond 200m: Danger
 */
export const checkDeviation = (
  currentPosition: LatLng | null,
  routePath: LatLng[],
  areaInfo?: { safetyScore: number; areaName: string } | null
): DeviationResult | null => {
  if (!currentPosition || !routePath || routePath.length === 0) {
    return null;
  }

  const distance = getDistanceFromRoute(currentPosition, routePath);
  const roundedDistance = Math.round(distance);

  if (distance <= 100) {
    return {
      isDeviated: false,
      distance: roundedDistance,
      severity: 'safe',
      message: 'You are on the recommended route',
    };
  }

  if (distance <= 200) {
    const safetyWarning = areaInfo && areaInfo.safetyScore < 50 
      ? ` You are entering a low-safety area (${areaInfo.areaName}).`
      : '';
    return {
      isDeviated: true,
      distance: roundedDistance,
      severity: 'warning',
      message: `⚠️ You are ${roundedDistance}m off the trusted route.${safetyWarning}`,
    };
  }

  // Beyond 200m - danger
  const safetyWarning = areaInfo && areaInfo.safetyScore < 50 
    ? ` Driver is taking a low-safety road in ${areaInfo.areaName} (Safety: ${areaInfo.safetyScore}%).`
    : ' Driver may be taking an unverified route.';
  
  return {
    isDeviated: true,
    distance: roundedDistance,
    severity: 'danger',
    message: `⚠️ You are ${roundedDistance}m off the trusted route.${safetyWarning}`,
  };
};
