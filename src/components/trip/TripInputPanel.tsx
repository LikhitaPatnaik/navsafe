import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Locate, ArrowRight } from 'lucide-react';
import { useTrip } from '@/context/TripContext';

interface TripInputPanelProps {
  onFindRoutes: () => void;
}

const TripInputPanel = ({ onFindRoutes }: TripInputPanelProps) => {
  const { trip, setSource, setDestination } = useTrip();
  const [isLocating, setIsLocating] = useState(false);

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setSource('Current Location', coords);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
          alert('Unable to get your location');
        }
      );
    }
  };

  const canFindRoutes = trip.source && trip.destination;

  return (
    <div className="glass-strong rounded-2xl p-6 w-full max-w-md shadow-elevated animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Navigation className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Plan Your Trip</h2>
          <p className="text-sm text-muted-foreground">Find the safest route</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Source Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Source Location
          </label>
          <div className="relative">
            <Input
              placeholder="Enter starting point..."
              value={trip.source}
              onChange={(e) => setSource(e.target.value)}
              className="pr-12"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-primary"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
          >
            <Locate className={`w-4 h-4 mr-2 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Locating...' : 'Use My Current Location'}
          </Button>
        </div>

        {/* Destination Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-destructive" />
            Destination
          </label>
          <Input
            placeholder="Enter destination..."
            value={trip.destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>

        {/* Find Routes Button */}
        <Button
          variant="hero"
          className="w-full mt-4"
          disabled={!canFindRoutes}
          onClick={onFindRoutes}
        >
          Find Safe Routes
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default TripInputPanel;
