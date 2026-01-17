import { useTrip } from '@/context/TripContext';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusType = 'safe' | 'deviation' | 'high-risk';

const LiveStatusBanner = () => {
  const { trip } = useTrip();

  // Determine status based on alerts
  const getStatus = (): StatusType => {
    const activeAlerts = trip.alerts.filter(a => !a.dismissed);
    if (activeAlerts.some(a => a.type === 'high-risk')) return 'high-risk';
    if (activeAlerts.some(a => a.type === 'deviation')) return 'deviation';
    return 'safe';
  };

  const status = getStatus();

  const statusConfig = {
    safe: {
      icon: CheckCircle,
      message: 'You are on a trusted route',
      className: 'bg-safe/10 border-safe/30 text-safe',
      iconClassName: 'text-safe',
    },
    deviation: {
      icon: AlertTriangle,
      message: 'Deviation detected from planned route',
      className: 'bg-warning/10 border-warning/30 text-warning',
      iconClassName: 'text-warning',
    },
    'high-risk': {
      icon: XCircle,
      message: 'High-risk zone entered',
      className: 'bg-destructive/10 border-destructive/30 text-destructive',
      iconClassName: 'text-destructive',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  if (!trip.isMonitoring) return null;

  return (
    <div
      className={cn(
        'fixed top-3 sm:top-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50',
        'flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-full border backdrop-blur-xl',
        'animate-slide-up shadow-lg safe-area-top',
        config.className
      )}
    >
      <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5 shrink-0', config.iconClassName)} />
      <span className="font-medium text-xs sm:text-sm truncate">{config.message}</span>
      {status === 'safe' && (
        <span className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-safe rounded-full animate-pulse" />
          <span className="text-[10px] sm:text-xs opacity-70">Live</span>
        </span>
      )}
    </div>
  );
};

export default LiveStatusBanner;
