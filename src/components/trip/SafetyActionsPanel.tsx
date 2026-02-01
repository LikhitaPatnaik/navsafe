import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Flag, AlertOctagon, Loader2 } from 'lucide-react';
import { useTrip } from '@/context/TripContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { areaCoordinates, haversineDistance } from '@/services/astarRouting';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Find nearest landmark/area for a given location
const findNearestLandmark = (lat: number, lng: number): string => {
  let nearestArea = 'Unknown Area';
  let nearestDistance = Infinity;
  
  for (const [areaName, coords] of Object.entries(areaCoordinates)) {
    const distance = haversineDistance({ lat, lng }, coords);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestArea = areaName;
    }
  }
  
  return nearestArea;
};

const SafetyActionsPanel = () => {
  const { trip } = useTrip();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSending, setIsSending] = useState(false);

  if (!trip.isMonitoring) return null;

  const handleReroute = () => {
    console.log('Rerouting to safest path...');
    toast.info('Calculating safest route from your current position...');
  };

  const handleReport = () => {
    console.log('Reporting:', { reason: reportReason, severity: reportSeverity });
    setShowReportModal(false);
    setReportReason('');
    toast.success('Area reported successfully');
  };

  const getFreshLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Force fresh location
        }
      );
    });
  };

  const handleSos = async () => {
    setIsSending(true);
    
    try {
      // Get fresh GPS location directly, don't rely on trip context
      let location = trip.currentPosition;
      
      try {
        console.log('[SOS] Fetching fresh GPS location...');
        location = await getFreshLocation();
        console.log('[SOS] Fresh location obtained:', location);
      } catch (geoError) {
        console.warn('[SOS] Fresh location failed, using trip position:', geoError);
        // Fall back to trip context position if available
        if (!trip.currentPosition) {
          toast.error('Unable to get your location. Please enable GPS and try again.');
          setIsSending(false);
          return;
        }
      }

      if (!location) {
        toast.error('Unable to get your location. Please enable GPS.');
        setIsSending(false);
        return;
      }

      // Find nearest landmark for the location
      const landmark = findNearestLandmark(location.lat, location.lng);
      console.log('[SOS] Sending SOS with location:', location, 'Landmark:', landmark);
      
      const { data, error } = await supabase.functions.invoke('send-sos', {
        body: {
          landmark,
          location: {
            lat: location.lat,
            lng: location.lng,
          },
        },
      });

      if (error) {
        console.error('SOS error:', error);
        toast.error('Failed to send SOS. Please call emergency services directly.');
        return;
      }

      if (data?.error === 'No emergency contacts found') {
        toast.error('No emergency contacts configured. Please add contacts first.');
        return;
      }

      toast.success(`SOS sent to ${data?.sent || 0} emergency contacts with your location!`);
      setShowSosModal(false);
    } catch (err) {
      console.error('SOS error:', err);
      toast.error('Failed to send SOS. Please call emergency services directly.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Mobile: Horizontal bottom bar | Desktop: Vertical side panel */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-40 flex flex-row sm:flex-col gap-2 sm:gap-3 animate-slide-up safe-area-bottom">
        {/* Reroute Button */}
        <Button
          variant="glass"
          size="default"
          className="flex-1 sm:flex-none shadow-lg text-xs sm:text-sm py-3 sm:py-2"
          onClick={handleReroute}
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
          <span className="hidden sm:inline">Reroute</span>
        </Button>

        {/* Report Button */}
        <Button
          variant="glass"
          size="default"
          className="flex-1 sm:flex-none shadow-lg text-xs sm:text-sm py-3 sm:py-2"
          onClick={() => setShowReportModal(true)}
        >
          <Flag className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
          <span className="hidden sm:inline">Report Area</span>
        </Button>

        {/* SOS Button */}
        <Button
          variant="sos"
          size="default"
          className="flex-1 sm:flex-none shadow-lg text-xs sm:text-sm py-3 sm:py-2"
          onClick={() => setShowSosModal(true)}
        >
          <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
          <span className="hidden sm:inline">SOS</span>
        </Button>
      </div>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="glass-strong border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Report Unsafe Area</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Help improve safety data by reporting this area
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Reason
              </label>
              <Input
                placeholder="Describe the safety concern..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Severity
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <Button
                    key={level}
                    variant={reportSeverity === level ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportSeverity(level)}
                    className="capitalize"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={handleReport}>
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SOS Modal */}
      <Dialog open={showSosModal} onOpenChange={setShowSosModal}>
        <DialogContent className="glass-strong border-destructive/30">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              Emergency SOS
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will send your live location to emergency contacts via SMS
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-foreground">
              Are you sure you want to activate SOS? Your location will be sent immediately to all emergency contacts.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSosModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="sos"
                className="flex-1"
                onClick={handleSos}
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send SOS Alert'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SafetyActionsPanel;
