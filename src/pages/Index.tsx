import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TripProvider, useTrip } from '@/context/TripContext';
import { useAuth } from '@/contexts/AuthContext';
import HeroSection from '@/components/landing/HeroSection';
import TripInputPanel from '@/components/trip/TripInputPanel';
import MapView from '@/components/trip/MapView';
import RouteCard from '@/components/trip/RouteCard';
import LiveStatusBanner from '@/components/trip/LiveStatusBanner';
import AlertPopup from '@/components/trip/AlertPopup';
import SafetyActionsPanel from '@/components/trip/SafetyActionsPanel';
import TripSummaryComponent from '@/components/trip/TripSummary';
import ProfileDropdown from '@/components/ProfileDropdown';
import CrimeTypeFilter from '@/components/trip/CrimeTypeFilter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, StopCircle, Loader2, LogIn } from 'lucide-react';
import { calculateRoutes } from '@/services/routingService';
import { toast } from 'sonner';
import { checkDeviation, DeviationResult } from '@/utils/deviationDetection';
import { getNearestSafetyZone, haversineDistance } from '@/services/astarRouting';
import { CrimeType } from '@/utils/crimeTypeMapping';
const TripApp = () => {
  const {
    trip,
    setRoutes,
    selectRoute,
    startMonitoring,
    updatePosition,
    addAlert,
    dismissAlert,
    resetTrip,
    tripSummary,
    completeTip,
  } = useTrip();
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [showLanding, setShowLanding] = useState(true);
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);
  const [safetyZones, setSafetyZones] = useState<any[]>([]);
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<CrimeType[]>([]);

  // Toggle crime type filter - for highlighting zones on map
  const handleToggleCrimeType = useCallback((crimeType: CrimeType) => {
    setSelectedCrimeTypes(prev => 
      prev.includes(crimeType) 
        ? prev.filter(t => t !== crimeType)
        : [...prev, crimeType]
    );
  }, []);

  // Clear all crime type filters
  const handleClearAllFilters = useCallback(() => {
    setSelectedCrimeTypes([]);
  }, []);


  // Fetch safety zones for deviation detection
  useEffect(() => {
    const fetchSafetyZones = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.from('safety_zones').select('*');
        if (data) setSafetyZones(data);
      } catch (error) {
        console.error('Error fetching safety zones:', error);
      }
    };
    fetchSafetyZones();
  }, []);

  // Calculate routes using OSRM and safety data
  const handleFindRoutes = async () => {
    if (!trip.sourceCoords || !trip.destinationCoords) {
      toast.error('Please select both source and destination');
      return;
    }

    setIsCalculatingRoutes(true);
    
    try {
      const routes = await calculateRoutes(trip.sourceCoords, trip.destinationCoords);
      
      if (routes.length === 0) {
        toast.error('No routes found. Please try different locations.');
        return;
      }
      
      setRoutes(routes);
      toast.success(`Found ${routes.length} route${routes.length > 1 ? 's' : ''} with safety analysis`);
    } catch (error) {
      console.error('Error calculating routes:', error);
      toast.error('Failed to calculate routes. Please try again.');
    } finally {
      setIsCalculatingRoutes(false);
    }
  };

  // Track if GPS toast has been shown
  const gpsToastShownRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const lastDeviationAlertRef = useRef<number>(0);
  const monitoringStartTimeRef = useRef<number>(0);
  const monitoringStartPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const deviationCooldown = 30000; // 30 seconds between deviation alerts
  const monitoringGracePeriod = 10000; // 10 second grace period after monitoring starts
  const minMovementFromStart = 500; // Must move 500m from start before deviation alerts

  // Get initial location on page load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updatePosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Initial location fetch failed:', error.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Real GPS tracking during monitoring with continuous updates
  useEffect(() => {
    if (!trip.isMonitoring) {
      gpsToastShownRef.current = false;
      monitoringStartPositionRef.current = null;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // Request location permission and start tracking
    if (navigator.geolocation) {
      if (!gpsToastShownRef.current) {
        toast.success('🔴 Live navigation started - Tracking your location', {
          duration: 3000,
        });
        gpsToastShownRef.current = true;
        monitoringStartTimeRef.current = Date.now();
      }
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          updatePosition(newPosition);
          
          // Store the first position as the monitoring start position
          if (!monitoringStartPositionRef.current) {
            monitoringStartPositionRef.current = newPosition;
            console.log('[Deviation] Monitoring started at position:', newPosition);
            return; // Skip first check
          }
          
          // Check for route deviation - but only after grace period
          const timeSinceStart = Date.now() - monitoringStartTimeRef.current;
          if (timeSinceStart < monitoringGracePeriod) {
            // Skip deviation checks during grace period
            return;
          }
          
          if (trip.selectedRoute && trip.selectedRoute.path.length > 0) {
            // Check if user has moved enough from where they started monitoring
            const distanceFromMonitoringStart = haversineDistance(newPosition, monitoringStartPositionRef.current);
            
            // Skip alerts if user hasn't moved 500m from where they started
            if (distanceFromMonitoringStart < minMovementFromStart) {
              console.log('[Deviation] User has only moved', Math.round(distanceFromMonitoringStart), 'm from start, need 500m');
              return;
            }
            
            const areaInfo = getNearestSafetyZone(newPosition, safetyZones);
            const deviation = checkDeviation(newPosition, trip.selectedRoute.path, areaInfo);
            
            if (deviation && deviation.isDeviated) {
              const now = Date.now();
              // Only alert if cooldown has passed
              if (now - lastDeviationAlertRef.current > deviationCooldown) {
                lastDeviationAlertRef.current = now;
                
                if (deviation.severity === 'danger') {
                  addAlert({
                    type: 'high-risk',
                    message: deviation.message,
                  });
                } else if (deviation.severity === 'warning') {
                  addAlert({
                    type: 'deviation',
                    message: deviation.message,
                  });
                }
              }
            }
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Location permission denied. Please enable location access.');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            toast.error('Location unavailable. Please check your GPS settings.');
          } else {
            toast.error('Unable to get your location.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0, // Always get fresh position
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [trip.isMonitoring]);

  const handleStartMonitoring = () => {
    if (trip.selectedRoute) {
      startMonitoring();
    }
  };

  // Reroute from current position to destination
  const handleReroute = async () => {
    if (!trip.currentPosition || !trip.destinationCoords) {
      toast.error('Unable to reroute - missing location data');
      return;
    }

    toast.loading('Calculating new route from your current location...', { id: 'reroute' });
    
    try {
      const routes = await calculateRoutes(trip.currentPosition, trip.destinationCoords);
      
      if (routes.length === 0) {
        toast.error('No routes found from current location', { id: 'reroute' });
        return;
      }
      
      // Find the safest route
      const safestRoute = routes.find(r => r.type === 'safest') || routes[0];
      
      // Update routes and auto-select the safest one
      setRoutes(routes);
      selectRoute(safestRoute);
      
      toast.success(`Rerouted! New ${safestRoute.type} route: ${safestRoute.distance.toFixed(1)} km`, { id: 'reroute' });
    } catch (error) {
      console.error('Error rerouting:', error);
      toast.error('Failed to calculate new route', { id: 'reroute' });
    }
  };

  const activeAlert = trip.alerts.find(a => !a.dismissed);

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show landing page
  if (showLanding && trip.status === 'idle') {
    return <HeroSection onStartTrip={() => setShowLanding(false)} />;
  }

  // Show trip summary
  if (trip.status === 'completed' && tripSummary) {
    return (
      <TripSummaryComponent
        summary={tripSummary}
        onNewTrip={resetTrip}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LiveStatusBanner />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-30 p-3 sm:p-4 safe-area-top">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="glass"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => {
              if (trip.isMonitoring) {
                completeTip();
              } else if (trip.routes.length > 0) {
                setRoutes([]);
              } else {
                setShowLanding(true);
                resetTrip();
              }
            }}
          >
            {trip.isMonitoring ? (
              <>
                <StopCircle className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">End Trip</span>
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </>
            )}
          </Button>
          
          {trip.isMonitoring && (
            <div className="glass rounded-full px-3 py-1.5 sm:px-4 sm:py-2">
              <span className="text-xs sm:text-sm text-muted-foreground">
                <span className="hidden sm:inline">Monitoring: </span>
                <span className="text-primary font-medium capitalize">{trip.selectedRoute?.type}</span>
              </span>
            </div>
          )}

          {/* Profile Dropdown or Login Button */}
          <div className="ml-auto">
            {user ? (
              <ProfileDropdown />
            ) : (
              <Button
                variant="glass"
                size="sm"
                onClick={() => navigate('/auth')}
                className="text-xs sm:text-sm"
              >
                <LogIn className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row min-h-screen pt-16 sm:pt-20 pb-24 sm:pb-6 px-3 sm:px-4 gap-4 sm:gap-6">
        {/* Left Panel - Full width on mobile, fixed width on desktop */}
        <div className="w-full lg:w-96 flex-shrink-0 space-y-3 sm:space-y-4 order-2 lg:order-1">
          {(trip.status === 'idle' || (trip.status === 'planning' && trip.routes.length === 0)) && (
            <TripInputPanel onFindRoutes={handleFindRoutes} isLoading={isCalculatingRoutes} />
          )}


          {/* Crime Type Filter - Show when routes are available */}
          {trip.routes.length > 0 && !trip.isMonitoring && (
            <CrimeTypeFilter 
              selectedCrimeTypes={selectedCrimeTypes}
              onToggle={handleToggleCrimeType}
              onClearAll={handleClearAllFilters}
            />
          )}

          {/* Route Cards */}
          {trip.routes.length > 0 && !trip.isMonitoring && (
            <div className="space-y-2 sm:space-y-3 animate-slide-up">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base sm:text-lg font-semibold text-foreground">Available Routes</h2>
              </div>
              {trip.routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={trip.selectedRoute?.id === route.id}
                  onSelect={() => selectRoute(route)}
                  onStartMonitoring={handleStartMonitoring}
                  safetyZones={safetyZones}
                />
              ))}
            </div>
          )}

          {/* Selected Route Info During Monitoring - Hidden on mobile during monitoring to save space */}
          {trip.isMonitoring && trip.selectedRoute && (
            <div className="hidden sm:block glass-strong rounded-2xl p-4 sm:p-6 animate-slide-up">
              <h3 className="font-semibold text-foreground mb-3 sm:mb-4">Active Route</h3>
              <RouteCard
                route={trip.selectedRoute}
                isSelected={true}
                onSelect={() => {}}
                onStartMonitoring={() => {}}
              />
            </div>
          )}
        </div>

        {/* Map Area - Shows first on mobile, takes remaining space on desktop */}
        <div className="flex-1 min-h-[50vh] sm:min-h-[400px] lg:min-h-0 lg:h-[calc(100vh-8rem)] order-1 lg:order-2">
          <MapView 
            routes={trip.routes} 
            sourceCoords={trip.sourceCoords}
            destinationCoords={trip.destinationCoords}
            selectedRoute={trip.selectedRoute}
            currentPosition={trip.currentPosition}
            isMonitoring={trip.isMonitoring}
            sourceName={trip.source}
            destinationName={trip.destination}
            highlightedCrimeTypes={selectedCrimeTypes}
          />
        </div>
      </div>

      {/* Safety Actions Panel */}
      <SafetyActionsPanel />

      {/* Alert Popup */}
      {activeAlert && (
        <AlertPopup
          alert={activeAlert}
          onDismiss={() => dismissAlert(activeAlert.id)}
          onReroute={() => {
            dismissAlert(activeAlert.id);
            handleReroute();
          }}
        />
      )}
    </div>
  );
};

const Index = () => (
  <TripProvider>
    <TripApp />
  </TripProvider>
);

export default Index;
