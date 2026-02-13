import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { RouteInfo, LatLng } from '@/types/route';
import { fetchSafetyZones } from '@/services/routingService';
import { CrimeType, crimeTypeConfig } from '@/utils/crimeTypeMapping';
import { supabase } from '@/integrations/supabase/client';
import { areaStreetCoordinates, getStreetLocationsForCrimeType, getStreetKeysForDbArea, StreetLocation } from '@/utils/streetCoordinates';
// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  routes?: RouteInfo[];
  sourceCoords?: LatLng | null;
  destinationCoords?: LatLng | null;
  selectedRoute?: RouteInfo | null;
  currentPosition?: LatLng | null;
  isMonitoring?: boolean;
  showSafetyZones?: boolean;
  sourceName?: string;
  destinationName?: string;
  highlightedCrimeTypes?: CrimeType[];
}

// Visakhapatnam coordinates
const defaultCenter: LatLng = {
  lat: 17.6868,
  lng: 83.2185,
};

// Safety zone coordinates for Visakhapatnam areas (imported from astarRouting for consistency)
import { areaCoordinates, haversineDistance } from '@/services/astarRouting';

const MapView = ({ routes = [], sourceCoords, destinationCoords, selectedRoute, currentPosition, isMonitoring, showSafetyZones = true, sourceName, destinationName, highlightedCrimeTypes = [] }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const safetyZoneLayersRef = useRef<L.CircleMarker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Get distinct colors for routes - BLUE for fastest, GREEN for safest
  const getRouteColor = (type: RouteInfo['type'], isSelected: boolean) => {
    const colors = {
      fastest: '#3b82f6', // Blue - fastest route
      safest: '#22c55e',  // Green - safest route  
      optimized: '#f59e0b', // Orange - optimized
    };
    return isSelected ? colors[type] : `${colors[type]}99`;
  };

  // Get color for safety zone based on safety score
  const getSafetyZoneColor = (safetyScore: number): string => {
    if (safetyScore >= 75) return '#22c55e'; // Green - safe
    if (safetyScore >= 50) return '#f59e0b'; // Orange - moderate  
    if (safetyScore >= 35) return '#ef4444'; // Red - risky
    return '#7f1d1d'; // Dark red - critical/black spot
  };

  // Initialize map using callback ref for reliable DOM access
  const initializeMap = useCallback((node: HTMLDivElement | null) => {
    if (!node || mapRef.current) return;
    
    // Ensure the container has dimensions
    node.style.height = '100%';
    node.style.minHeight = '500px';
    node.style.width = '100%';
    
    try {
      const map = L.map(node, {
        center: [defaultCenter.lat, defaultCenter.lng],
        zoom: 12,
        zoomControl: true,
      });

      // Add OSM tiles (using standard OSM for better reliability)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      mapContainer.current = node;
      
      // Force map to recalculate size
      requestAnimationFrame(() => {
        map.invalidateSize();
        setMapReady(true);
      });
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }, []);

  // Invalidate map size on scroll/resize to prevent route disappearing
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleInvalidate = () => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    window.addEventListener('scroll', handleInvalidate, { passive: true });
    window.addEventListener('resize', handleInvalidate, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleInvalidate);
      window.removeEventListener('resize', handleInvalidate);
    };
  }, [mapReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle routing when source and destination are set
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Remove existing routing control
    if (routingControlRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }

    if (sourceCoords && destinationCoords) {
      // Create custom source marker (GREEN for start)
      const sourceIcon = L.divIcon({
        className: 'custom-marker source-marker',
        html: `<div style="width: 40px; height: 40px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(34,197,94,0.5); border: 3px solid white;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      // Create custom destination marker (RED for end)
      const destIcon = L.divIcon({
        className: 'custom-marker dest-marker',
        html: `<div style="width: 40px; height: 40px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(239,68,68,0.5); border: 3px solid white;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const sourceMarker = L.marker([sourceCoords.lat, sourceCoords.lng], { 
        icon: sourceIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
      sourceMarker.bindPopup(`
        <div style="padding: 8px; min-width: 150px;">
          <strong style="color: #22c55e; font-size: 14px;">📍 Source</strong>
          <div style="margin-top: 6px; font-size: 13px; color: #333; font-weight: 500;">${sourceName || 'Start Location'}</div>
        </div>
      `);
      
      const destMarker = L.marker([destinationCoords.lat, destinationCoords.lng], { 
        icon: destIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
      destMarker.bindPopup(`
        <div style="padding: 8px; min-width: 150px;">
          <strong style="color: #ef4444; font-size: 14px;">🎯 Destination</strong>
          <div style="margin-top: 6px; font-size: 13px; color: #333; font-weight: 500;">${destinationName || 'End Location'}</div>
        </div>
      `);
      
      markersRef.current.push(sourceMarker, destMarker);

      // Remove routing control - we draw our own routes
      // Just fit bounds to show both points
      const bounds = L.latLngBounds([
        [sourceCoords.lat, sourceCoords.lng],
        [destinationCoords.lat, destinationCoords.lng],
      ]);
      mapRef.current.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [sourceCoords, destinationCoords, mapReady]);

  // Draw route paths from routes array
  useEffect(() => {
    if (!mapRef.current || !mapReady || routes.length === 0) return;

    // Clear existing route layers
    routeLayersRef.current.forEach(layer => {
      mapRef.current?.removeLayer(layer);
    });
    routeLayersRef.current = [];

    // Clean path: only trim dangling tails at endpoints; preserve all OSRM road-snapped points
    const cleanPath = (path: LatLng[]): LatLng[] => {
      if (path.length < 4 || !sourceCoords || !destinationCoords) return path;
      
      // Trim to closest points near source/destination
      let startIdx = 0;
      let endIdx = path.length - 1;
      let minStartDist = Infinity;
      let minEndDist = Infinity;
      
      for (let i = 0; i < Math.min(path.length, 50); i++) {
        const d = haversineDistance(path[i], sourceCoords);
        if (d < minStartDist) { minStartDist = d; startIdx = i; }
      }
      
      for (let i = Math.max(0, path.length - 50); i < path.length; i++) {
        const d = haversineDistance(path[i], destinationCoords);
        if (d < minEndDist) { minEndDist = d; endIdx = i; }
      }
      
      let trimmed = path.slice(startIdx, endIdx + 1);
      if (trimmed.length < 3) return trimmed;

      // Only trim dangling tails at ends (points moving away from dest/source)
      while (trimmed.length > 3) {
        if (haversineDistance(trimmed[trimmed.length - 1], destinationCoords) > 
            haversineDistance(trimmed[trimmed.length - 2], destinationCoords) + 100) {
          trimmed.pop();
        } else break;
      }
      while (trimmed.length > 3) {
        if (haversineDistance(trimmed[0], sourceCoords) > 
            haversineDistance(trimmed[1], sourceCoords) + 100) {
          trimmed.shift();
        } else break;
      }
      
      return trimmed;
    };

    // Draw each route
    routes.forEach(route => {
      if (route.path && route.path.length > 0) {
        const isSelected = selectedRoute?.id === route.id;
        const cleaned = cleanPath(route.path);
        const latLngs: L.LatLngExpression[] = cleaned.map(p => [p.lat, p.lng] as L.LatLngTuple);
        const polyline = L.polyline(latLngs, {
          color: getRouteColor(route.type, isSelected),
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 1 : 0.6,
        });
        polyline.addTo(mapRef.current!);
        routeLayersRef.current.push(polyline);
      }
    });
  }, [routes, selectedRoute, mapReady, sourceCoords, destinationCoords]);

  // Load and display safety zones on map - filter by highlighted crime types AND route path
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Clear existing safety zone layers
    safetyZoneLayersRef.current.forEach(layer => {
      mapRef.current?.removeLayer(layer);
    });
    safetyZoneLayersRef.current = [];

    if (!showSafetyZones) return;

    // Fetch and display safety zones
    const loadSafetyZones = async () => {
      try {
        const allZones = await fetchSafetyZones();
        console.log('Loaded safety zones:', allZones.length);
        
        // Auto-show crime zones along the route when a route is selected
        // If crime type filters are active, use those; otherwise show ALL crime types
        const hasRoute = selectedRoute && selectedRoute.path && selectedRoute.path.length > 0;
        
        if (hasRoute) {
          // Only show crime zones when user has selected checkboxes
          if (highlightedCrimeTypes.length === 0) return;
          const crimeTypesToShow: CrimeType[] = highlightedCrimeTypes;
          
          // Fetch crime type counts from database
          // Map lowercase crime types to DB capitalized format
          const dbCrimeTypes = crimeTypesToShow.map(ct => ct.charAt(0).toUpperCase() + ct.slice(1));
          
          const { data: crimeTypeCounts, error } = await supabase
            .from('crime_type_counts')
            .select('area, crime_type, count')
            .in('crime_type', dbCrimeTypes);
          
          if (error) {
            console.error('Error fetching crime type counts:', error);
            return;
          }
          
          console.log('Fetched crime type counts:', crimeTypeCounts?.length);
          
          // Group by area and crime type
          const crimeDataByArea = new Map<string, Map<CrimeType, number>>();
          crimeTypeCounts?.forEach(record => {
            const normalizedArea = record.area.toLowerCase().trim();
            if (!crimeDataByArea.has(normalizedArea)) {
              crimeDataByArea.set(normalizedArea, new Map());
            }
            // Normalize DB crime_type (capitalized) to lowercase to match CrimeType
            const crimeType = record.crime_type.toLowerCase() as CrimeType;
            crimeDataByArea.get(normalizedArea)!.set(crimeType, record.count);
          });
          
          // Helper: Check if a specific coordinate is along the route path (within 1km radius)
          const isPointAlongRoute = (coords: LatLng): boolean => {
            const maxDistance = 1000; // 1km detection radius
            const sampleRate = Math.max(1, Math.floor(selectedRoute.path.length / 100));
            
            for (let i = 0; i < selectedRoute.path.length; i += sampleRate) {
              const point = selectedRoute.path[i];
              const distance = haversineDistance(point, coords);
              if (distance < maxDistance) {
                return true;
              }
            }
            return false;
          };
          
          // Render STREET-LEVEL markers for areas along the selected route
          crimeDataByArea.forEach((crimeTypes, normalizedArea) => {
            let mainCoords: LatLng | null = null;
            let originalAreaName = normalizedArea;
            
            for (const [key, value] of Object.entries(areaCoordinates)) {
              const normalizedKey = key.toLowerCase().trim();
              if (normalizedKey === normalizedArea || 
                  normalizedArea.includes(normalizedKey) ||
                  normalizedKey.includes(normalizedArea)) {
                mainCoords = value;
                originalAreaName = key;
                break;
              }
            }
            
            if (!mainCoords || !mapRef.current) return;
            
            const safetyZone = allZones.find(z => 
              z.area.toLowerCase().trim() === normalizedArea ||
              normalizedArea.includes(z.area.toLowerCase().trim()) ||
              z.area.toLowerCase().trim().includes(normalizedArea)
            );
            
            const safetyScore = safetyZone?.safety_score ?? 50;
            
            // For each crime type, show ONLY street markers that are on the route
            crimeTypesToShow.forEach((crimeType) => {
              const count = crimeTypes.get(crimeType);
              if (!count || count === 0) return;
              
              const crimeConfig = crimeTypeConfig[crimeType];
              const color = crimeConfig.mapColor;
              
              // Get street locations for this crime type in this area
              const streetLocations = getStreetLocationsForCrimeType(originalAreaName, crimeType);
              
              // Filter streets that are actually along the route path
              const onRouteStreets = streetLocations.filter(sl => isPointAlongRoute(sl.coords));
              
              if (onRouteStreets.length === 0) return;
              
              // Distribute crime count across on-route streets
              const countPerStreet = Math.max(1, Math.floor(count / streetLocations.length));
              const remainder = count % Math.max(1, streetLocations.length);
              
              onRouteStreets.forEach((streetLoc, streetIndex) => {
                const streetCount = countPerStreet + (streetIndex < remainder ? 1 : 0);
                if (streetCount === 0) return;
                
                // Medium marker sizes for visibility
                const markerRadius = streetCount > 3 ? 10 : streetCount > 1 ? 8 : 7;
                const areaRadius = streetCount > 3 ? 300 : streetCount > 1 ? 220 : 150;
                
                const circle = L.circleMarker([streetLoc.coords.lat, streetLoc.coords.lng], {
                  radius: markerRadius,
                  fillColor: color,
                  color: color,
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.85,
                });
                
                let riskLabel = 'LOW RISK';
                if (streetCount > 3) riskLabel = 'HIGH RISK';
                else if (streetCount > 1) riskLabel = 'MODERATE RISK';
                
                const popupContent = `
                  <div style="padding: 10px; min-width: 200px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></div>
                      <strong style="font-size: 14px; color: #333;">${originalAreaName}</strong>
                    </div>
                    <div style="font-size: 12px; color: #555; margin-bottom: 8px; padding: 4px 8px; background: #f5f5f5; border-radius: 4px;">
                      📍 ${streetLoc.street}
                    </div>
                    <hr style="margin: 6px 0; border-color: ${color}40;"/>
                    <div style="font-size: 13px; color: #333; margin-bottom: 6px; padding: 6px; background: ${color}15; border-radius: 4px; border-left: 3px solid ${color};">
                      <strong>${crimeConfig.icon} ${crimeConfig.label}</strong>
                    </div>
                    <div style="font-size: 12px; color: #333; margin-bottom: 4px;">
                      <strong>🚔 Cases:</strong> <span style="color: ${streetCount > 3 ? '#ef4444' : streetCount > 1 ? '#f59e0b' : '#666'}; font-weight: bold;">${streetCount}</span>
                    </div>
                    <div style="font-size: 12px; color: #333; margin-bottom: 4px;">
                      <strong>🛡️ Area Score:</strong> <span style="font-weight: bold;">${safetyScore}/100</span>
                    </div>
                    <div style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: ${color}; color: white; text-align: center; font-weight: bold; margin-top: 6px;">
                      ${riskLabel}
                    </div>
                  </div>
                `;
                circle.bindPopup(popupContent);
                circle.addTo(mapRef.current!);
                safetyZoneLayersRef.current.push(circle);
                
                // Smaller area circle
                const areaCircle = L.circle([streetLoc.coords.lat, streetLoc.coords.lng], {
                  radius: areaRadius,
                  fillColor: color,
                  color: color,
                  weight: 1,
                  fillOpacity: 0.12,
                });
                areaCircle.addTo(mapRef.current!);
                safetyZoneLayersRef.current.push(areaCircle as unknown as L.CircleMarker);
              });
            });
          });
          
          console.log('Street-level crime zones rendered:', safetyZoneLayersRef.current.length);
          return; // Exit early - we've rendered filtered zones
        }
        
        // Default behavior: show ALL 50 areas from dataset with total crime counts
        const { data: allCrimeCounts, error: crimeError } = await supabase
          .from('crime_type_counts')
          .select('area, crime_type, count');
        
        // Aggregate total crime counts per DB area name
        const dbAreaTotals = new Map<string, number>();
        if (allCrimeCounts) {
          allCrimeCounts.forEach(record => {
            const current = dbAreaTotals.get(record.area) || 0;
            dbAreaTotals.set(record.area, current + record.count);
          });
        }

        // Build safety zone lookup by DB area name
        const safetyZoneByDbArea = new Map<string, typeof allZones[0]>();
        allZones.forEach(zone => {
          safetyZoneByDbArea.set(zone.area, zone);
        });

        // Track which streetCoordinates keys we've already rendered (avoid duplicates)
        const renderedKeys = new Set<string>();

        // For each DB area, find the matching streetCoordinates key(s) and render
        dbAreaTotals.forEach((totalCrimes, dbArea) => {
          const streetKeys = getStreetKeysForDbArea(dbArea);
          if (streetKeys.length === 0 || !mapRef.current) return;

          const zone = safetyZoneByDbArea.get(dbArea);
          const safetyScore = zone?.safety_score ?? 50;
          const severity = zone?.severity || 'medium';

          // For each matching streetCoordinates key, render the marker
          streetKeys.forEach(streetKey => {
            if (renderedKeys.has(streetKey)) {
              // Already rendered this key from another DB area — add crime count
              return;
            }
            renderedKeys.add(streetKey);

            const streets = areaStreetCoordinates[streetKey];
            if (!streets || streets.length === 0) return;

            const centerCoords = streets[0].coords;
            
            // Accumulate totals from all DB areas that map to this streetKey
            let combinedCrimes = 0;
            let bestSafetyScore = safetyScore;
            let bestSeverity = severity;
            dbAreaTotals.forEach((count, otherDbArea) => {
              const otherKeys = getStreetKeysForDbArea(otherDbArea);
              if (otherKeys.includes(streetKey)) {
                combinedCrimes += count;
                const otherZone = safetyZoneByDbArea.get(otherDbArea);
                if (otherZone) {
                  // Use the worst (lowest) safety score among mapped DB areas
                  if (otherZone.safety_score < bestSafetyScore) {
                    bestSafetyScore = otherZone.safety_score;
                    bestSeverity = otherZone.severity || 'medium';
                  }
                }
              }
            });

            const color = getSafetyZoneColor(bestSafetyScore);
            const isCritical = bestSafetyScore < 35;
            const isRisky = bestSafetyScore < 50;

            let markerRadius = 9;
            if (combinedCrimes > 20) markerRadius = 12;
            else if (combinedCrimes > 10) markerRadius = 10;

            const circle = L.circleMarker([centerCoords.lat, centerCoords.lng], {
              radius: markerRadius,
              fillColor: color,
              color: isCritical ? '#450a0a' : isRisky ? '#7f1d1d' : color,
              weight: isCritical ? 4 : isRisky ? 3 : 2,
              opacity: 1,
              fillOpacity: isCritical ? 0.7 : isRisky ? 0.5 : 0.4,
            });

            let riskLabel = 'SAFE';
            if (isCritical) riskLabel = 'CRITICAL - BLACK SPOT';
            else if (isRisky) riskLabel = 'HIGH RISK';
            else if (bestSafetyScore < 75) riskLabel = 'MODERATE';

            const popupContent = `
              <div style="padding: 12px; min-width: 220px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
                  <strong style="font-size: 15px; color: #333;">${streetKey}</strong>
                </div>
                <hr style="margin: 8px 0; border-color: ${color}40;"/>
                <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                  <strong>🚔 Total Crime Count:</strong> <span style="color: ${combinedCrimes > 10 ? '#ef4444' : combinedCrimes > 5 ? '#f59e0b' : '#666'}; font-weight: bold; font-size: 14px;">${combinedCrimes}</span>
                </div>
                <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                  <strong>🛡️ Safety Score:</strong> <span style="color: ${color}; font-weight: bold;">${bestSafetyScore}/100</span>
                </div>
                <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                  <strong>⚠️ Severity:</strong> <span style="text-transform: uppercase; color: ${color}; font-weight: 500;">${bestSeverity}</span>
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">📍 ${streets.length} street locations mapped</div>
                <div style="font-size: 12px; padding: 6px 10px; border-radius: 6px; background: ${color}; color: white; text-align: center; font-weight: bold;">
                  ${riskLabel}
                </div>
              </div>
            `;
            circle.bindPopup(popupContent);
            circle.addTo(mapRef.current!);
            safetyZoneLayersRef.current.push(circle);

            if (isRisky) {
              const areaRadius = isCritical ? 500 : 400;
              const areaCircle = L.circle([centerCoords.lat, centerCoords.lng], {
                radius: areaRadius,
                fillColor: color,
                color: isCritical ? '#7f1d1d' : 'transparent',
                weight: isCritical ? 2 : 0,
                fillOpacity: isCritical ? 0.25 : 0.15,
              });
              areaCircle.addTo(mapRef.current!);
              safetyZoneLayersRef.current.push(areaCircle as unknown as L.CircleMarker);
            }
          });
        });

        // Also render streetCoordinates areas not in DB — count crimes from local crimeTypes data
        Object.entries(areaStreetCoordinates).forEach(([areaName, streets]) => {
          if (renderedKeys.has(areaName) || !streets || streets.length === 0 || !mapRef.current) return;
          renderedKeys.add(areaName);

          const centerCoords = streets[0].coords;
          
          // Count crimes from local street crimeTypes arrays
          let localCrimeCount = 0;
          streets.forEach(st => {
            if (st.crimeTypes) localCrimeCount += st.crimeTypes.length;
          });

          const estimatedSafetyScore = Math.max(0, 100 - (localCrimeCount * 2.5));
          const color = getSafetyZoneColor(estimatedSafetyScore);
          const isCritical = estimatedSafetyScore < 35;
          const isRisky = estimatedSafetyScore < 50;

          let markerRadius = 7;
          if (localCrimeCount > 20) markerRadius = 12;
          else if (localCrimeCount > 10) markerRadius = 10;
          else if (localCrimeCount > 5) markerRadius = 9;

          let riskLabel = 'SAFE';
          if (isCritical) riskLabel = 'CRITICAL - BLACK SPOT';
          else if (isRisky) riskLabel = 'HIGH RISK';
          else if (estimatedSafetyScore < 75) riskLabel = 'MODERATE';

          const circle = L.circleMarker([centerCoords.lat, centerCoords.lng], {
            radius: markerRadius,
            fillColor: color,
            color: isCritical ? '#450a0a' : isRisky ? '#7f1d1d' : color,
            weight: isCritical ? 4 : isRisky ? 3 : 2,
            opacity: 1,
            fillOpacity: isCritical ? 0.7 : isRisky ? 0.5 : 0.4,
          });

          circle.bindPopup(`
            <div style="padding: 12px; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
                <strong style="font-size: 15px; color: #333;">${areaName}</strong>
              </div>
              <hr style="margin: 8px 0; border-color: ${color}40;"/>
              <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                <strong>🚔 Total Crime Count:</strong> <span style="color: ${localCrimeCount > 10 ? '#ef4444' : localCrimeCount > 5 ? '#f59e0b' : '#666'}; font-weight: bold; font-size: 14px;">${localCrimeCount}</span>
              </div>
              <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                <strong>🛡️ Safety Score:</strong> <span style="color: ${color}; font-weight: bold;">${Math.round(estimatedSafetyScore)}/100</span>
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px;">📍 ${streets.length} street locations mapped</div>
              <div style="font-size: 12px; padding: 6px 10px; border-radius: 6px; background: ${color}; color: white; text-align: center; font-weight: bold;">
                ${riskLabel}
              </div>
            </div>
          `);
          circle.addTo(mapRef.current!);
          safetyZoneLayersRef.current.push(circle);

          if (isRisky) {
            const areaRadius = isCritical ? 500 : 400;
            const areaCircle = L.circle([centerCoords.lat, centerCoords.lng], {
              radius: areaRadius,
              fillColor: color,
              color: isCritical ? '#7f1d1d' : 'transparent',
              weight: isCritical ? 2 : 0,
              fillOpacity: isCritical ? 0.25 : 0.15,
            });
            areaCircle.addTo(mapRef.current!);
            safetyZoneLayersRef.current.push(areaCircle as unknown as L.CircleMarker);
          }
        });
        console.log('All 50 areas rendered:', safetyZoneLayersRef.current.length);
      } catch (error) {
        console.error('Error loading safety zones:', error);
      }
    };

    loadSafetyZones();
  }, [mapReady, showSafetyZones, highlightedCrimeTypes, selectedRoute]);


  // Handle current position marker during monitoring
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      mapRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (currentPosition) {
      // Create pulsing user location marker with navigation arrow
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="position: relative; width: 48px; height: 48px;">
            <div style="position: absolute; inset: 0; border-radius: 50%; background: hsl(217, 91%, 60%); opacity: 0.2; animation: pulse 1.5s infinite;"></div>
            <div style="position: absolute; inset: 6px; border-radius: 50%; background: hsl(217, 91%, 60%); opacity: 0.3; animation: pulse 1.5s infinite 0.3s;"></div>
            <div style="position: absolute; inset: 12px; border-radius: 50%; background: linear-gradient(135deg, hsl(217, 91%, 60%), hsl(217, 91%, 45%)); border: 3px solid white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);"></div>
            <div style="position: absolute; inset: 16px; display: flex; align-items: center; justify-content: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker([currentPosition.lat, currentPosition.lng], { 
        icon: userIcon,
        zIndexOffset: 2000,
      }).addTo(mapRef.current);
      
      marker.bindPopup(`
        <div style="padding: 8px; min-width: 150px; text-align: center;">
          <strong style="color: #3b82f6; font-size: 14px;">📍 Your Location</strong>
          <div style="margin-top: 6px; font-size: 11px; color: #666;">
            ${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}
          </div>
          ${isMonitoring ? '<div style="margin-top: 6px; font-size: 12px; color: #22c55e; font-weight: 500;">🔴 Live Tracking Active</div>' : ''}
        </div>
      `);
      
      userMarkerRef.current = marker;

      // Pan map to follow user when monitoring
      if (isMonitoring) {
        mapRef.current.setView([currentPosition.lat, currentPosition.lng], 16, { animate: true });
      }
    }
  }, [currentPosition, isMonitoring, mapReady]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden">
      <div 
        ref={initializeMap} 
        className="absolute inset-0 rounded-2xl z-0"
      />
      
      {!mapReady && (
        <div className="absolute inset-0 glass flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Legend - Collapsible on mobile */}
      <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-6 right-3 sm:right-6">
        <div className="glass rounded-lg sm:rounded-xl p-2.5 sm:p-4">
          {/* Route Legend */}
          {routes.length > 0 && (
            <>
              <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Routes</p>
              <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-3">
                {routes.map((route) => (
                  <div key={route.id} className="flex items-center gap-1 sm:gap-2">
                    <div
                      className="w-4 sm:w-6 h-1 sm:h-1.5 rounded-full"
                      style={{ backgroundColor: getRouteColor(route.type, selectedRoute?.id === route.id) }}
                    />
                    <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                      {route.type === 'fastest' ? '🔵 Fast' : route.type === 'safest' ? '🟢 Safe' : '🟠 Opt'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Crime Type Legend - Show when route is selected */}
          {(highlightedCrimeTypes.length > 0 || selectedRoute) ? (
            <>
              <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Crime Types</p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {(highlightedCrimeTypes.length > 0 ? highlightedCrimeTypes : (['kidnap', 'robbery', 'murder', 'assault', 'accident'] as CrimeType[])).map((crimeType) => {
                  const config = crimeTypeConfig[crimeType];
                  return (
                    <div key={crimeType} className="flex items-center gap-1 sm:gap-1.5">
                      <div 
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2"
                        style={{ backgroundColor: config.mapColor, borderColor: config.mapColor }}
                      />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {config.icon} {config.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Safety Zone Legend - Default view */}
              <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Safety Zones</p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Safe</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-amber-500" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Moderate</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Risky</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-red-900 border sm:border-2 border-red-700" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">⚠️ Black</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapView;
