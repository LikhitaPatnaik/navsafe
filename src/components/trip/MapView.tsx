import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { RouteInfo, LatLng } from '@/types/route';
import { fetchSafetyZones } from '@/services/routingService';

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
}

// Visakhapatnam coordinates
const defaultCenter: LatLng = {
  lat: 17.6868,
  lng: 83.2185,
};

// Safety zone coordinates for Visakhapatnam areas (imported from astarRouting for consistency)
import { areaCoordinates } from '@/services/astarRouting';

const MapView = ({ routes = [], sourceCoords, destinationCoords, selectedRoute, currentPosition, isMonitoring, showSafetyZones = true }: MapViewProps) => {
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
      sourceMarker.bindPopup('<strong style="color: #22c55e;">📍 Source</strong>');
      
      const destMarker = L.marker([destinationCoords.lat, destinationCoords.lng], { 
        icon: destIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
      destMarker.bindPopup('<strong style="color: #ef4444;">🎯 Destination</strong>');
      
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

    // Draw each route
    routes.forEach(route => {
      if (route.path && route.path.length > 0) {
        const isSelected = selectedRoute?.id === route.id;
        const latLngs: L.LatLngExpression[] = route.path.map(p => [p.lat, p.lng] as L.LatLngTuple);
        const polyline = L.polyline(latLngs, {
          color: getRouteColor(route.type, isSelected),
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 1 : 0.6,
        });
        polyline.addTo(mapRef.current!);
        routeLayersRef.current.push(polyline);
      }
    });
  }, [routes, selectedRoute, mapReady]);

  // Load and display safety zones on map - load on init
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
        const zones = await fetchSafetyZones();
        console.log('Loaded safety zones:', zones.length);
        
        zones.forEach(zone => {
          const normalizedArea = zone.area.toLowerCase().trim();
          let coords: LatLng | null = null;
          
          // Match area name to coordinates
          for (const [key, value] of Object.entries(areaCoordinates)) {
            const normalizedKey = key.toLowerCase().trim();
            if (normalizedKey === normalizedArea || 
                normalizedArea.includes(normalizedKey) ||
                normalizedKey.includes(normalizedArea)) {
              coords = value;
              break;
            }
          }
          
          if (!coords || !mapRef.current) {
            console.log('No coords for:', zone.area);
            return;
          }

          const color = getSafetyZoneColor(zone.safety_score);
          const isCritical = zone.safety_score < 35;
          const isRisky = zone.safety_score < 50;
          const isSafe = zone.safety_score >= 75;

          // Determine marker size based on risk level
          let markerRadius = 8;
          let areaRadius = 400;
          if (isCritical) {
            markerRadius = 18;
            areaRadius = 1000;
          } else if (isRisky) {
            markerRadius = 14;
            areaRadius = 700;
          } else if (!isSafe) {
            markerRadius = 10;
            areaRadius = 500;
          }

          // Create circle marker for the zone
          const circle = L.circleMarker([coords.lat, coords.lng], {
            radius: markerRadius,
            fillColor: color,
            color: isCritical ? '#450a0a' : isRisky ? '#7f1d1d' : color,
            weight: isCritical ? 4 : isRisky ? 3 : 2,
            opacity: 1,
            fillOpacity: isCritical ? 0.7 : isRisky ? 0.5 : 0.4,
          });

          // Risk label
          let riskLabel = 'SAFE';
          let riskIcon = '✅';
          if (isCritical) {
            riskLabel = 'CRITICAL - BLACK SPOT';
            riskIcon = '🚨';
          } else if (isRisky) {
            riskLabel = 'HIGH RISK';
            riskIcon = '⚠️';
          } else if (zone.safety_score < 75) {
            riskLabel = 'MODERATE';
            riskIcon = '⚡';
          }

          // Add popup with zone info
          const popupContent = `
            <div style="padding: 10px; min-width: 180px;">
              <strong style="font-size: 15px; color: ${color};">${riskIcon} ${zone.area}</strong>
              <hr style="margin: 8px 0; border-color: ${color}20;"/>
              <div style="font-size: 12px; color: #333; margin-bottom: 4px;">
                <strong>Safety Score:</strong> ${zone.safety_score}/100
              </div>
              <div style="font-size: 12px; color: #333; margin-bottom: 4px;">
                <strong>Crime Count:</strong> ${zone.crime_count}
              </div>
              <div style="font-size: 12px; color: #333; margin-bottom: 8px;">
                <strong>Severity:</strong> ${zone.severity?.toUpperCase() || 'N/A'}
              </div>
              <div style="font-size: 12px; padding: 4px 8px; border-radius: 4px; background: ${color}; color: white; text-align: center; font-weight: bold;">
                ${riskLabel}
              </div>
            </div>
          `;
          circle.bindPopup(popupContent);

          circle.addTo(mapRef.current);
          safetyZoneLayersRef.current.push(circle);

          // Add a larger semi-transparent area circle for risky zones
          if (isRisky) {
            const areaCircle = L.circle([coords.lat, coords.lng], {
              radius: areaRadius,
              fillColor: color,
              color: isCritical ? '#7f1d1d' : 'transparent',
              weight: isCritical ? 2 : 0,
              fillOpacity: isCritical ? 0.25 : 0.15,
            });
            areaCircle.addTo(mapRef.current);
            safetyZoneLayersRef.current.push(areaCircle as unknown as L.CircleMarker);
          }
        });
        
        console.log('Safety zones rendered:', safetyZoneLayersRef.current.length);
      } catch (error) {
        console.error('Error loading safety zones:', error);
      }
    };

    loadSafetyZones();
  }, [mapReady, showSafetyZones]);

  // Handle current position marker during monitoring
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      mapRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (isMonitoring && currentPosition) {
      // Create pulsing user location marker
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; inset: 0; border-radius: 50%; background: hsl(217, 91%, 60%); opacity: 0.3; animation: pulse 2s infinite;"></div>
            <div style="position: absolute; inset: 4px; border-radius: 50%; background: hsl(217, 91%, 60%); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
            <div style="position: absolute; inset: 8px; border-radius: 50%; background: white;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([currentPosition.lat, currentPosition.lng], { 
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
      
      userMarkerRef.current = marker;

      // Pan map to follow user
      mapRef.current.panTo([currentPosition.lat, currentPosition.lng], { animate: true });
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

      {/* Legend */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="glass rounded-xl p-4">
          {/* Route Legend */}
          {routes.length > 0 && (
            <>
              <p className="text-sm font-medium text-foreground mb-2">Routes</p>
              <div className="flex flex-wrap gap-4 mb-3">
                {routes.map((route) => (
                  <div key={route.id} className="flex items-center gap-2">
                    <div
                      className="w-6 h-1.5 rounded-full"
                      style={{ backgroundColor: getRouteColor(route.type, selectedRoute?.id === route.id) }}
                    />
                    <span className="text-xs text-muted-foreground capitalize">
                      {route.type === 'fastest' ? '🔵 Fastest' : route.type === 'safest' ? '🟢 Safest' : '🟠 Optimized'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Safety Zone Legend */}
          <p className="text-sm font-medium text-foreground mb-2">Safety Zones</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Safe (75+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-muted-foreground">Moderate (50-74)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">Risky (35-49)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-red-900 border-2 border-red-700" />
              <span className="text-xs text-muted-foreground font-medium">⚠️ Black Spot (&lt;35)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
