import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Clock, Shield, AlertTriangle, Navigation, Trash2, Loader2, History } from 'lucide-react';
import { toast } from 'sonner';
import ProfileDropdown from '@/components/ProfileDropdown';

interface TripRecord {
  id: string;
  source: string;
  destination: string;
  route_type: string;
  total_distance: number;
  time_taken: number;
  safety_score: number;
  alerts_raised: number;
  started_at: string;
  ended_at: string;
  created_at: string;
}

const normalizeSafetyScore = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  return 0;
};

const TripHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) fetchTrips();
  }, [user]);

  const fetchTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trip_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load trip history');
      console.error(error);
    } else {
      setTrips((data || []).map((trip) => ({
        ...trip,
        safety_score: normalizeSafetyScore(trip.safety_score),
      })));
    }
    setLoading(false);
  };

  const deleteTrip = async (id: string) => {
    const { error } = await supabase.from('trip_history').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete trip');
    } else {
      setTrips(prev => prev.filter(t => t.id !== id));
      toast.success('Trip deleted');
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 70) return 'text-safe';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const formatSafetyScore = (score: number) => `${normalizeSafetyScore(score)}/100`;

  const getRouteEmoji = (type: string) => {
    switch (type) {
      case 'fastest': return '🟦';
      case 'safest': return '🟩';
      case 'optimized': return '🟨';
      default: return '📍';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-30 p-3 sm:p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <Button variant="glass" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-bold text-foreground">Trip History</h1>
          <ProfileDropdown />
        </div>
      </header>

      <div className="pt-20 pb-8 px-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No trips yet</h2>
            <p className="text-muted-foreground mb-6">Complete a trip to see it here</p>
            <Button variant="hero" onClick={() => navigate('/')}>
              <Navigation className="w-4 h-4 mr-2" />
              Start a Trip
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map(trip => (
              <div key={trip.id} className="glass-strong rounded-2xl p-5 animate-slide-up">
                {/* Route header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{getRouteEmoji(trip.route_type)}</span>
                      <span className="text-sm font-semibold text-foreground capitalize">{trip.route_type} Route</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 text-safe shrink-0" />
                      <span className="truncate">{trip.source}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 text-destructive shrink-0" />
                      <span className="truncate">{trip.destination}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteTrip(trip.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <MapPin className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">{trip.total_distance.toFixed(1)} km</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <Clock className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">{trip.time_taken} min</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <Shield className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className={`text-xs font-medium ${getSafetyColor(trip.safety_score)}`}>{formatSafetyScore(trip.safety_score)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <AlertTriangle className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">{trip.alerts_raised}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="mt-3 text-xs text-muted-foreground text-right">
                  {new Date(trip.started_at).toLocaleDateString()} · {new Date(trip.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripHistory;
