import { CrimeType, crimeTypeConfig } from '@/utils/crimeTypeMapping';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrimeTypeFilterProps {
  selectedCrimeTypes: CrimeType[];
  onToggle: (crimeType: CrimeType) => void;
  onClearAll: () => void;
}

// Only show these 5 crime types as per dataset
const crimeTypes: CrimeType[] = ['kidnap', 'assault', 'accident', 'robbery', 'murder'];

const CrimeTypeFilter = ({ selectedCrimeTypes, onToggle, onClearAll }: CrimeTypeFilterProps) => {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <MapPin className="w-4 h-4" />
          <h3 className="font-semibold text-sm">Show Crime Zones</h3>
        </div>
        {selectedCrimeTypes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearAll}
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Select crime types to highlight on map
      </p>
      
      <div className="space-y-2">
        {crimeTypes.map((type) => {
          const config = crimeTypeConfig[type];
          const isChecked = selectedCrimeTypes.includes(type);
          
          return (
            <div
              key={type}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer',
                isChecked 
                  ? 'bg-primary/10 border-primary/30' 
                  : 'border-border/50 hover:border-border bg-background/50'
              )}
              onClick={() => onToggle(type)}
            >
              <Checkbox
                id={`filter-${type}`}
                checked={isChecked}
                onCheckedChange={() => onToggle(type)}
                className="pointer-events-none"
              />
              <Label
                htmlFor={`filter-${type}`}
                className="flex-1 text-sm cursor-pointer"
              >
                {config.label}
              </Label>
            </div>
          );
        })}
      </div>
      
      {selectedCrimeTypes.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 text-primary" />
            <span>Showing {selectedCrimeTypes.length} crime type{selectedCrimeTypes.length > 1 ? 's' : ''} on map</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrimeTypeFilter;