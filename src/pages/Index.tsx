import { useState, useEffect } from 'react';
import { TripProvider, useTrip } from '@/context/TripContext';
import HeroSection from '@/components/landing/HeroSection';
import TripInputPanel from '@/components/trip/TripInputPanel';
import MapView from '@/components/trip/MapView';
import RouteCard from '@/components/trip/RouteCard';
import LiveStatusBanner from '@/components/trip/LiveStatusBanner';
import AlertPopup from '@/components/trip/AlertPopup';
import SafetyActionsPanel from '@/components/trip/SafetyActionsPanel';
import TripSummaryComponent from '@/components/trip/TripSummary';
import { RouteInfo } from '@/types/route';
import { Button } from '@/components/ui/button';
import { ArrowLeft, StopCircle } from 'lucide-react';

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
  
  const [showLanding, setShowLanding] = useState(true);

  // Simulate route generation
  const handleFindRoutes = () => {
    const mockRoutes: RouteInfo[] = [
      {
        id: '1',
        type: 'fastest',
        distance: 12.5,
        duration: 18,
        safetyScore: 62,
        riskLevel: 'moderate',
        path: [],
      },
      {
        id: '2',
        type: 'safest',
        distance: 14.8,
        duration: 24,
        safetyScore: 89,
        riskLevel: 'safe',
        path: [],
      },
      {
        id: '3',
        type: 'optimized',
        distance: 13.2,
        duration: 20,
        safetyScore: 75,
        riskLevel: 'moderate',
        path: [],
      },
    ];
    setRoutes(mockRoutes);
  };

  // Simulate position updates and alerts during monitoring
  useEffect(() => {
    if (!trip.isMonitoring) return;

    const positionInterval = setInterval(() => {
      updatePosition({
        lat: 40.7128 + (Math.random() - 0.5) * 0.01,
        lng: -74.006 + (Math.random() - 0.5) * 0.01,
      });
    }, 2000);

    // Simulate a deviation alert after 5 seconds
    const alertTimeout = setTimeout(() => {
      if (trip.isMonitoring) {
        addAlert({
          type: 'deviation',
          message: '⚠ You are 200m off the trusted route near a low-safety area.',
        });
      }
    }, 5000);

    return () => {
      clearInterval(positionInterval);
      clearTimeout(alertTimeout);
    };
  }, [trip.isMonitoring, updatePosition, addAlert]);

  const handleStartMonitoring = () => {
    if (trip.selectedRoute) {
      startMonitoring();
    }
  };

  const activeAlert = trip.alerts.find(a => !a.dismissed);

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
      <header className="fixed top-0 left-0 right-0 z-30 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="glass"
            size="sm"
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
                <StopCircle className="w-4 h-4 mr-2" />
                End Trip
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </>
            )}
          </Button>
          
          {trip.isMonitoring && (
            <div className="glass rounded-full px-4 py-2">
              <span className="text-sm text-muted-foreground">
                Monitoring: <span className="text-primary font-medium capitalize">{trip.selectedRoute?.type}</span>
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row min-h-screen pt-20 pb-6 px-4 gap-6">
        {/* Left Panel */}
        <div className="lg:w-96 flex-shrink-0 space-y-4">
          {(trip.status === 'idle' || (trip.status === 'planning' && trip.routes.length === 0)) && (
            <TripInputPanel onFindRoutes={handleFindRoutes} />
          )}

          {/* Route Cards */}
          {trip.routes.length > 0 && !trip.isMonitoring && (
            <div className="space-y-3 animate-slide-up">
              <h2 className="text-lg font-semibold text-foreground px-1">Available Routes</h2>
              {trip.routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={trip.selectedRoute?.id === route.id}
                  onSelect={() => selectRoute(route)}
                  onStartMonitoring={handleStartMonitoring}
                />
              ))}
            </div>
          )}

          {/* Selected Route Info During Monitoring */}
          {trip.isMonitoring && trip.selectedRoute && (
            <div className="glass-strong rounded-2xl p-6 animate-slide-up">
              <h3 className="font-semibold text-foreground mb-4">Active Route</h3>
              <RouteCard
                route={trip.selectedRoute}
                isSelected={true}
                onSelect={() => {}}
                onStartMonitoring={() => {}}
              />
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 min-h-[400px] lg:min-h-0">
          <MapView routes={trip.routes} />
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
            // Implement reroute logic
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
