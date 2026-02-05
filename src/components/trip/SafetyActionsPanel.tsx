import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Flag, AlertOctagon, Loader2, Mic, MicOff, MapPin } from 'lucide-react';
import { useTrip } from '@/context/TripContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { areaCoordinates, haversineDistance } from '@/services/astarRouting';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { getStreetLocations } from '@/utils/streetCoordinates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

// Report reason options
const REPORT_REASONS = [
  'Poor Lighting',
  'Damaged Roads',
  'Suspicious Activity',
  'Unsafe Intersection',
  'No Police Patrol',
  'Isolated Area',
  'Recent Crime',
  'Other',
] as const;

// Find nearest street within an area
const findNearestStreet = (lat: number, lng: number, areaName: string): string | null => {
  const streetLocations = getStreetLocations(areaName);
  if (!streetLocations || streetLocations.length === 0) return null;
  
  let nearestStreet = streetLocations[0].street;
  let nearestDistance = Infinity;
  
  for (const loc of streetLocations) {
    const distance = haversineDistance({ lat, lng }, loc.coords);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStreet = loc.street;
    }
  }
  
  return nearestStreet;
};

const SafetyActionsPanel = () => {
  const { trip } = useTrip();
  const { voiceSosEnabled } = useSettings();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportSeverity, setReportSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSending, setIsSending] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportLocation, setReportLocation] = useState<{ lat: number; lng: number; area: string; street: string | null } | null>(null);

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

  // Open report modal and capture current location
  const openReportModal = async () => {
    try {
      let location = trip.currentPosition;
      
      try {
        location = await getFreshLocation();
      } catch {
        if (!trip.currentPosition) {
          toast.error('Unable to get your location. Please enable GPS.');
          return;
        }
      }

      if (!location) {
        toast.error('Unable to get your location.');
        return;
      }

      const area = findNearestLandmark(location.lat, location.lng);
      const street = findNearestStreet(location.lat, location.lng, area);
      
      setReportLocation({ lat: location.lat, lng: location.lng, area, street });
      setShowReportModal(true);
    } catch (err) {
      console.error('[Report] Error getting location:', err);
      toast.error('Failed to get location');
    }
  };

  // Submit report to database and update safety scores
  const handleReport = async () => {
    if (!reportReason || !reportLocation) {
      toast.error('Please select a reason for the report');
      return;
    }

    setIsReporting(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert report into database
      const { error: reportError } = await supabase.from('area_reports').insert({
        user_id: user?.id || null,
        latitude: reportLocation.lat,
        longitude: reportLocation.lng,
        area: reportLocation.area,
        street: reportLocation.street,
        reason: reportReason,
        severity: reportSeverity,
      });

      if (reportError) {
        console.error('[Report] Insert error:', reportError);
        toast.error('Failed to submit report');
        setIsReporting(false);
        return;
      }

      // Calculate safety score impact based on severity
      const severityImpact = { low: 2, medium: 5, high: 10 };
      const impact = severityImpact[reportSeverity];

      // Update safety_zones table for this area/street
      const { data: existingZone } = await supabase
        .from('safety_zones')
        .select('*')
        .eq('area', reportLocation.area)
        .eq('street', reportLocation.street || '')
        .single();

      if (existingZone) {
        // Update existing zone - decrease safety score
        const newScore = Math.max(0, existingZone.safety_score - impact);
        const newSeverity = newScore < 30 ? 'high' : newScore < 60 ? 'medium' : 'low';
        
        await supabase
          .from('safety_zones')
          .update({
            safety_score: newScore,
            crime_count: existingZone.crime_count + 1,
            severity: newSeverity,
          })
          .eq('id', existingZone.id);
          
        console.log('[Report] Updated safety zone:', reportLocation.area, reportLocation.street, 'New score:', newScore);
      } else {
        // Create new safety zone entry
        const initialScore = 100 - impact;
        const severity = initialScore < 30 ? 'high' : initialScore < 60 ? 'medium' : 'low';
        
        await supabase.from('safety_zones').insert({
          area: reportLocation.area,
          street: reportLocation.street || '',
          safety_score: initialScore,
          crime_count: 1,
          severity,
        });
        
        console.log('[Report] Created new safety zone:', reportLocation.area, reportLocation.street);
      }

      toast.success(`Report submitted for ${reportLocation.street || reportLocation.area}`);
      setShowReportModal(false);
      setReportReason('');
      setReportLocation(null);
    } catch (err) {
      console.error('[Report] Error:', err);
      toast.error('Failed to submit report');
    } finally {
      setIsReporting(false);
    }
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
        {/* Voice SOS Button - Only shown when enabled in settings */}
        {voiceSosEnabled && isSupported && (
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
          onClick={openReportModal}
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
      <Dialog open={showReportModal} onOpenChange={(open) => {
        setShowReportModal(open);
        if (!open) {
          setReportReason('');
          setReportLocation(null);
        }
      }}>
        <DialogContent className="glass-strong border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Flag className="w-5 h-5" />
              Report Unsafe Area
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Help improve safety data by reporting this location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Location Display */}
            {reportLocation && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-medium">{reportLocation.street || reportLocation.area}</span>
                </div>
                {reportLocation.street && (
                  <p className="text-xs text-muted-foreground mt-1 ml-6">{reportLocation.area}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {reportLocation.lat.toFixed(5)}, {reportLocation.lng.toFixed(5)}
                </p>
              </div>
            )}

            {/* Reason Selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Reason
              </label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severity Selection */}
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
                    className={`capitalize flex-1 ${
                      level === 'low' ? 'data-[active=true]:bg-green-600' :
                      level === 'medium' ? 'data-[active=true]:bg-yellow-600' :
                      'data-[active=true]:bg-red-600'
                    }`}
                    data-active={reportSeverity === level}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              variant="hero" 
              className="w-full" 
              onClick={handleReport}
              disabled={isReporting || !reportReason}
            >
              {isReporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
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