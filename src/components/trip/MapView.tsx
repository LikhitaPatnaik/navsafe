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
  sourceName?: string;
  destinationName?: string;
}

// Visakhapatnam coordinates
const defaultCenter: LatLng = {
  lat: 17.6868,
  lng: 83.2185,
};

// Safety zone coordinates for Visakhapatnam areas (imported from astarRouting for consistency)
import { areaCoordinates } from '@/services/astarRouting';

const MapView = ({ routes = [], sourceCoords, destinationCoords, selectedRoute, currentPosition, isMonitoring, showSafetyZones = true, sourceName, destinationName }: MapViewProps) => {
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

          // Determine marker size based on risk level - smaller circles for red zones
          let markerRadius = 8;
          let areaRadius = 300;
          if (isCritical) {
            markerRadius = 12;
            areaRadius = 500;
          } else if (isRisky) {
            markerRadius = 10;
            areaRadius = 400;
          } else if (!isSafe) {
            markerRadius = 8;
            areaRadius = 350;
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

          // Add popup with zone info - show crime count & safety score for ALL zones (especially risky)
          const showCrimeDetails = zone.safety_score < 75; // Show details for risky/moderate/critical
          const popupContent = `
            <div style="padding: 10px; min-width: 200px;">
              <strong style="font-size: 15px; color: ${color};">${riskIcon} ${zone.area}</strong>
              <hr style="margin: 8px 0; border-color: ${color}40;"/>
              <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                <strong>🛡️ Safety Score:</strong> <span style="color: ${color}; font-weight: bold;">${zone.safety_score}/100</span>
              </div>
              <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                <strong>🚔 Crime Count:</strong> <span style="color: ${isRisky ? '#ef4444' : '#666'}; font-weight: ${isRisky ? 'bold' : 'normal'};">${zone.crime_count} incidents</span>
              </div>
              <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                <strong>⚠️ Severity:</strong> <span style="text-transform: uppercase; color: ${color};">${zone.severity || 'N/A'}</span>
              </div>
              ${zone.street ? `<div style="font-size: 12px; color: #666; margin-bottom: 8px;">📍 ${zone.street}</div>` : ''}
              <div style="font-size: 12px; padding: 6px 10px; border-radius: 6px; background: ${color}; color: white; text-align: center; font-weight: bold;">
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
          
          {/* Safety Zone Legend */}
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
        </div>
      </div>
    </div>
  );
};

export default MapView;
