import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CrimeTypeFilter from './CrimeTypeFilter';
import RouteCard from './RouteCard';
import { RouteInfo } from '@/types/route';
import { CrimeType } from '@/utils/crimeTypeMapping';
import { useEffect, useRef } from 'react';

interface RouteSidebarProps {
  routes: RouteInfo[];
  selectedRoute: RouteInfo | null;
  isMonitoring: boolean;
  selectedCrimeTypes: CrimeType[];
  safetyZones: any[];
  onToggleCrimeType: (crimeType: CrimeType) => void;
  onClearAllFilters: () => void;
  onSelectRoute: (route: RouteInfo) => void;
  onStartMonitoring: () => void;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const RouteSidebar = ({
  routes,
  selectedRoute,
  isMonitoring,
  selectedCrimeTypes,
  safetyZones,
  onToggleCrimeType,
  onClearAllFilters,
  onSelectRoute,
  onStartMonitoring,
  externalOpen,
  onExternalOpenChange,
}: RouteSidebarProps) => {
  const prevRoutesLength = useRef(0);

  const hasRoutes = routes.length > 0 && !isMonitoring;

  // Derive open state from external control
  const open = externalOpen ?? false;
  const setOpen = onExternalOpenChange ?? (() => {});

  // Auto-open sidebar when routes first appear
  useEffect(() => {
    if (routes.length > 0 && prevRoutesLength.current === 0 && !isMonitoring) {
      setOpen(true);
    }
    prevRoutesLength.current = routes.length;
  }, [routes.length, isMonitoring]);

  if (!hasRoutes) return null;

  const sidebarContent = (
    <div className="space-y-4">
      <CrimeTypeFilter
        selectedCrimeTypes={selectedCrimeTypes}
        onToggle={onToggleCrimeType}
        onClearAll={onClearAllFilters}
      />

      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Available Routes</h2>
        </div>
        {routes.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            isSelected={selectedRoute?.id === route.id}
            onSelect={() => {
              onSelectRoute(route);
            }}
            onStartMonitoring={() => {
              onStartMonitoring();
              setOpen(false);
            }}
            safetyZones={safetyZones}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[85vw] max-w-sm bg-background border-border overflow-y-auto p-4">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-foreground">Routes & Crime Zones</SheetTitle>
        </SheetHeader>
        {sidebarContent}
      </SheetContent>
    </Sheet>
  );
};

export default RouteSidebar;
