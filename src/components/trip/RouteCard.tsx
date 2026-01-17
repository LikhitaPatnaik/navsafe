import { Button } from '@/components/ui/button';
import { RouteInfo, RiskLevel } from '@/types/route';
import { Clock, MapPin, Shield, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteCardProps {
  route: RouteInfo;
  isSelected: boolean;
  onSelect: () => void;
  onStartMonitoring: () => void;
}

const RouteCard = ({ route, isSelected, onSelect, onStartMonitoring }: RouteCardProps) => {
  const getRouteColor = () => {
    switch (route.type) {
      case 'fastest': return 'text-blue-400 border-blue-400/30 bg-blue-400/5';
      case 'safest': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5';
      case 'optimized': return 'text-amber-400 border-amber-400/30 bg-amber-400/5';
    }
  };

  const getRiskBadge = (level: RiskLevel) => {
    const config = {
      safe: { label: 'Safe', className: 'bg-safe/20 text-safe border-safe/30' },
      moderate: { label: 'Moderate', className: 'bg-warning/20 text-warning border-warning/30' },
      risky: { label: 'Risky', className: 'bg-destructive/20 text-destructive border-destructive/30' },
    };
    const { label, className } = config[level];
    return (
      <span className={cn('px-2 py-1 rounded-md text-xs font-medium border', className)}>
        {label}
      </span>
    );
  };

  const getRouteLabel = () => {
    switch (route.type) {
      case 'fastest': return '🟦 Fastest Route';
      case 'safest': return '🟩 Safest Route';
      case 'optimized': return '🟨 Optimized Route';
    }
  };

  return (
    <div
      className={cn(
        'glass rounded-xl p-3 sm:p-5 cursor-pointer transition-all duration-300 border-2',
        isSelected ? getRouteColor() : 'border-transparent hover:border-border',
        isSelected && 'ring-2 ring-primary/20'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{getRouteLabel()}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground capitalize">{route.type} option</p>
        </div>
        {getRiskBadge(route.riskLevel)}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2 text-center sm:text-left">
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">{route.distance} km</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Distance</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2 text-center sm:text-left">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">{route.duration} min</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Duration</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2 text-center sm:text-left">
          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">{route.safetyScore}/100</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Safety</p>
          </div>
        </div>
      </div>

      {isSelected && (
        <Button
          variant="hero"
          size="sm"
          className="w-full text-xs sm:text-sm py-2 sm:py-2.5"
          onClick={(e) => {
            e.stopPropagation();
            onStartMonitoring();
          }}
        >
          <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
          <span className="hidden sm:inline">Start Monitoring This Route</span>
          <span className="sm:hidden">Start Monitoring</span>
        </Button>
      )}
    </div>
  );
};

export default RouteCard;
