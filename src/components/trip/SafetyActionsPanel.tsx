import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Flag, AlertOctagon, Loader2, Mic, MicOff } from 'lucide-react';
import { useTrip } from '@/context/TripContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { areaCoordinates, haversineDistance } from '@/services/astarRouting';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
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

// Get fresh GPS location
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
        maximumAge: 0,
      }
    );
  });
};

const SafetyActionsPanel = () => {
  const { trip } = useTrip();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSending, setIsSending] = useState(false);

  // Send SOS alert function
  const sendSosAlert = useCallback(async () => {
    try {
      let location = trip.currentPosition;
      
      try {
        console.log('[SOS] Fetching fresh GPS location...');
        location = await getFreshLocation();
        console.log('[SOS] Fresh location obtained:', location);
      } catch (geoError) {
        console.warn('[SOS] Fresh location failed:', geoError);
        if (!trip.currentPosition) {
          toast.error('Unable to get location. Please enable GPS.');
          return false;
        }
      }

      if (!location) {
        toast.error('Unable to get your location.');
        return false;
      }

      const landmark = findNearestLandmark(location.lat, location.lng);
      console.log('[SOS] Sending with location:', location, 'Landmark:', landmark);
      
      const { data, error } = await supabase.functions.invoke('send-sos', {
        body: {
          landmark,
          location: { lat: location.lat, lng: location.lng },
        },
      });

      if (error) {
        console.error('SOS error:', error);
        toast.error('Failed to send SOS. Call emergency services directly.');
        return false;
      }

      if (data?.error === 'No emergency contacts found') {
        toast.error('No emergency contacts configured.');
        return false;
      }

      toast.success(`SOS sent to ${data?.sent || 0} contacts!`);
      return true;
    } catch (err) {
      console.error('[SOS] Error:', err);
      toast.error('Failed to send SOS.');
      return false;
    }
  }, [trip.currentPosition]);

  // Voice command handler - auto-sends SOS immediately
  const handleVoiceTrigger = useCallback(async () => {
    console.log('[Voice] SOS trigger detected! Auto-sending...');
    toast.info('Voice SOS detected! Sending alert...');
    await sendSosAlert();
  }, [sendSosAlert]);

  const { isListening, isSupported, toggleListening } = useVoiceCommand({
    onTrigger: handleVoiceTrigger,
    continuous: true,
  });

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

  const handleSos = async () => {
    setIsSending(true);
    const success = await sendSosAlert();
    if (success) {
      setShowSosModal(false);
    }
    setIsSending(false);
  };

  return (
    <>
      {/* Mobile: Horizontal bottom bar | Desktop: Vertical side panel */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-40 flex flex-row sm:flex-col gap-2 sm:gap-3 animate-slide-up safe-area-bottom">
        {/* Voice SOS Button */}
        {isSupported && (
          <Button
            variant={isListening ? 'sos' : 'glass'}
            size="default"
            className="flex-1 sm:flex-none shadow-lg text-xs sm:text-sm py-3 sm:py-2"
            onClick={toggleListening}
          >
            {isListening ? (
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            ) : (
              <MicOff className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            )}
            <span className="hidden sm:inline">{isListening ? 'Voice On' : 'Voice SOS'}</span>
          </Button>
        )}

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