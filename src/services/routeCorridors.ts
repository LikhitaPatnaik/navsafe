import { LatLng } from '@/types/route';
import { haversineDistance } from './astarRouting';

export interface CorridorBlueprint {
  id: string;
  label: string;
  waypoints: LatLng[];
}

const corridorNodes = {
  yendada: { lat: 17.7772, lng: 83.3628 },
  pmPalem: { lat: 17.7990, lng: 83.3531 },
  madhurawada: { lat: 17.8017, lng: 83.3533 },
  madhurawadaNh16: { lat: 17.8017, lng: 83.3533 },
  itSezRoad: { lat: 17.8040, lng: 83.3560 },
  marikavalasa: { lat: 17.8359, lng: 83.3581 },
  marikavalasaHighway: { lat: 17.8340, lng: 83.3560 },
  kommadi: { lat: 17.8306, lng: 83.3358 },
  anandapuramBypass: { lat: 17.8980, lng: 83.3680 },
} as const;

const dedupeWaypoints = (points: LatLng[]) =>
  points.reduce<LatLng[]>((acc, point) => {
    const alreadyIncluded = acc.some((existing) => haversineDistance(existing, point) < 180);
    if (!alreadyIncluded) acc.push(point);
    return acc;
  }, []);

const orderWaypointsFromSource = (source: LatLng, points: LatLng[]) =>
  [...points].sort((a, b) => haversineDistance(source, a) - haversineDistance(source, b));

const normalizeWaypoints = (source: LatLng, destination: LatLng, points: LatLng[]) => {
  const filtered = points.filter(
    (point) => haversineDistance(source, point) > 250 && haversineDistance(destination, point) > 250,
  );

  return dedupeWaypoints(orderWaypointsFromSource(source, filtered));
};

const isNorthVizagCorridorTrip = (source: LatLng, destination: LatLng) => {
  const directDistance = haversineDistance(source, destination);
  const nearbyNodes = [
    corridorNodes.yendada,
    corridorNodes.pmPalem,
    corridorNodes.madhurawada,
    corridorNodes.itSezRoad,
    corridorNodes.marikavalasa,
    corridorNodes.kommadi,
  ];

  const sourceNearCorridor = nearbyNodes.some((node) => haversineDistance(source, node) <= 5000);
  const destinationNearCorridor = nearbyNodes.some((node) => haversineDistance(destination, node) <= 5000);

  return sourceNearCorridor && destinationNearCorridor && directDistance >= 1500 && directDistance <= 18000;
};

export const getPreferredRoadCorridors = (source: LatLng, destination: LatLng): CorridorBlueprint[] => {
  if (!isNorthVizagCorridorTrip(source, destination)) {
    return [];
  }

  const blueprints: Array<{ id: string; label: string; points: LatLng[] }> = [
    {
      id: 'madhurawada-inner',
      label: 'Madhurawada Road',
      points: [corridorNodes.pmPalem, corridorNodes.madhurawada],
    },
    {
      id: 'it-sez-road',
      label: 'IT SEZ Road',
      points: [corridorNodes.itSezRoad, corridorNodes.marikavalasa],
    },
    {
      id: 'nh16-highway',
      label: 'NH16 Highway',
      points: [corridorNodes.madhurawadaNh16, corridorNodes.marikavalasaHighway],
    },
    {
      id: 'outer-bypass',
      label: 'Outer Bypass',
      points: [corridorNodes.itSezRoad, corridorNodes.anandapuramBypass, corridorNodes.kommadi],
    },
  ];

  return blueprints
    .map((blueprint) => ({
      id: blueprint.id,
      label: blueprint.label,
      waypoints: normalizeWaypoints(source, destination, blueprint.points),
    }))
    .filter((blueprint) => blueprint.waypoints.length > 0);
};