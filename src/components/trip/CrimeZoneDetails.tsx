import { CrimeZone, crimeTypeConfig, groupCrimeZonesByType, CrimeType } from '@/utils/crimeTypeMapping';
import { AlertTriangle, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CrimeZoneDetailsProps {
  zones: CrimeZone[];
}

const CrimeZoneDetails = ({ zones }: CrimeZoneDetailsProps) => {
  const [expanded, setExpanded] = useState(true);
  
  if (zones.length === 0) {
    return (
      <div className="glass rounded-xl p-4 border border-safe/30 bg-safe/5">
        <div className="flex items-center gap-2 text-safe">
          <span className="text-lg">✅</span>
          <span className="font-medium">No high-risk zones detected on this route</span>
        </div>
      </div>
    );
  }
  
  const groupedZones = groupCrimeZonesByType(zones);
  const activeTypes = (Object.keys(groupedZones) as CrimeType[]).filter(
    type => groupedZones[type].length > 0
  );
  
  const totalCrimes = zones.reduce((sum, z) => sum + z.crimeCount, 0);
  
  return (
    <div className="glass rounded-xl border border-destructive/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-destructive/10 hover:bg-destructive/15 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <div className="text-left">
            <h3 className="font-semibold text-foreground">
              ⚠️ {zones.length} Risk Zone{zones.length > 1 ? 's' : ''} on Route
            </h3>
            <p className="text-sm text-muted-foreground">
              {totalCrimes} reported incidents across {activeTypes.length} crime type{activeTypes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {/* Crime Zone List */}
      {expanded && (
        <div className="p-4 space-y-4">
          {activeTypes.map(type => {
            const config = crimeTypeConfig[type];
            const typeZones = groupedZones[type];
            const typeTotalCrimes = typeZones.reduce((sum, z) => sum + z.crimeCount, 0);
            
            return (
              <div key={type} className={cn('rounded-lg border p-3', config.color)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className="font-semibold">{config.label}</span>
                  </div>
                  <span className="text-sm font-medium px-2 py-0.5 rounded bg-background/50">
                    {typeTotalCrimes} crime{typeTotalCrimes > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {typeZones.map((zone, idx) => (
                    <div
                      key={`${zone.area}-${idx}`}
                      className="flex items-start gap-2 text-sm bg-background/30 rounded-md p-2"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{zone.area}</p>
                        {zone.street && (
                          <p className="text-xs opacity-80 truncate">{zone.street}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{zone.crimeCount}</p>
                        <p className="text-xs opacity-80 capitalize">{zone.severity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Safety Tips */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium text-foreground mb-1">🛡️ Safety Tips:</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Keep emergency contacts readily accessible</li>
              <li>• Stay alert in marked zones, especially after dark</li>
              <li>• Consider the safest route option for better security</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrimeZoneDetails;
