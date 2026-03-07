import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';
import CrimeTypeFilter from './CrimeTypeFilter';
import RouteCard from './RouteCard';
import { RouteInfo } from '@/types/route';
import { CrimeType } from '@/utils/crimeTypeMapping';
import { useState } from 'react';

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
}: RouteSidebarProps) => {
  const [open, setOpen] = useState(false);

  const hasRoutes = routes.length > 0 && !isMonitoring;

  if (!hasRoutes) return null;

  // Desktop: always-visible sidebar panel
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
            onSelect={() => onSelectRoute(route)}
            onStartMonitoring={onStartMonitoring}
            safetyZones={safetyZones}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="glass"
          size="sm"
          className="fixed bottom-28 left-3 z-30 shadow-elevated gap-2"
        >
          <Layers className="w-4 h-4" />
          <span className="text-xs">Routes & Zones</span>
        </Button>
      </SheetTrigger>
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
