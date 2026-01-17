import { TripAlert } from '@/types/route';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertPopupProps {
  alert: TripAlert;
  onDismiss: () => void;
  onReroute?: () => void;
}

const AlertPopup = ({ alert, onDismiss, onReroute }: AlertPopupProps) => {
  const getAlertConfig = () => {
    switch (alert.type) {
      case 'deviation':
        return {
          icon: MapPin,
          title: 'Route Deviation',
          className: 'border-warning/50 bg-warning/5',
          iconClassName: 'text-warning bg-warning/20',
        };
      case 'high-risk':
        return {
          icon: AlertTriangle,
          title: 'High Risk Zone',
          className: 'border-destructive/50 bg-destructive/5',
          iconClassName: 'text-destructive bg-destructive/20',
        };
      default:
        return {
          icon: AlertTriangle,
          title: 'Alert',
          className: 'border-border bg-card',
          iconClassName: 'text-primary bg-primary/20',
        };
    }
  };

  const config = getAlertConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed bottom-20 sm:bottom-24 left-3 right-3 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50',
        'sm:w-full sm:max-w-md',
        'glass-strong rounded-xl sm:rounded-2xl border-2 p-4 sm:p-6 shadow-elevated',
        'animate-slide-up',
        config.className
      )}
    >
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 rounded-lg hover:bg-secondary transition-colors"
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 sm:gap-4 pr-6">
        <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0', config.iconClassName)}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1">{config.title}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{alert.message}</p>
          
          {alert.type === 'deviation' && onReroute && (
            <Button variant="warning" size="sm" onClick={onReroute} className="text-xs sm:text-sm">
              Reroute to Safest Path
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertPopup;
