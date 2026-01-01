import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { RouteInfo, LatLng } from '@/types/route';

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
}

// Visakhapatnam coordinates
const defaultCenter: LatLng = {
  lat: 17.6868,
  lng: 83.2185,
};

const MapView = ({ routes = [], sourceCoords, destinationCoords, selectedRoute, currentPosition, isMonitoring }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const getRouteColor = (type: RouteInfo['type'], isSelected: boolean) => {
    const colors = {
      fastest: '#60a5fa',
      safest: '#34d399',
      optimized: '#fbbf24',
    };
    return isSelected ? colors[type] : `${colors[type]}80`;
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
      // Create custom markers
      const sourceIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width: 32px; height: 32px; border-radius: 50%; background: hsl(var(--primary)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const destIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width: 32px; height: 32px; border-radius: 50%; background: hsl(var(--destructive)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const sourceMarker = L.marker([sourceCoords.lat, sourceCoords.lng], { icon: sourceIcon }).addTo(mapRef.current);
      const destMarker = L.marker([destinationCoords.lat, destinationCoords.lng], { icon: destIcon }).addTo(mapRef.current);
      markersRef.current.push(sourceMarker, destMarker);

      // Add routing control
      const routingControl = L.Routing.control({
        waypoints: [
          L.latLng(sourceCoords.lat, sourceCoords.lng),
          L.latLng(destinationCoords.lat, destinationCoords.lng),
        ],
        routeWhileDragging: false,
        showAlternatives: true,
        fitSelectedRoutes: true,
        show: false, // Hide the directions panel
        addWaypoints: false,
        lineOptions: {
          styles: [
            { color: '#34d399', weight: 6, opacity: 0.8 }
          ],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        altLineOptions: {
          styles: [
            { color: '#60a5fa', weight: 5, opacity: 0.6 }
          ],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
      });

      routingControl.addTo(mapRef.current);
      routingControlRef.current = routingControl;

      // Fit bounds to show both points
      const bounds = L.latLngBounds([
        [sourceCoords.lat, sourceCoords.lng],
        [destinationCoords.lat, destinationCoords.lng],
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
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

      {/* Route Legend */}
      {routes.length > 0 && (
        <div className="absolute bottom-6 left-6 right-6">
          <div className="glass rounded-xl p-4">
            <p className="text-sm font-medium text-foreground mb-3">Route Legend</p>
            <div className="flex flex-wrap gap-4">
              {routes.map((route) => (
                <div key={route.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-1 rounded-full"
                    style={{ backgroundColor: getRouteColor(route.type, selectedRoute?.id === route.id) }}
                  />
                  <span className="text-xs text-muted-foreground capitalize">{route.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
