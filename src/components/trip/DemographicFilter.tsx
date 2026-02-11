import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Gender = 'male' | 'female' | 'other';
export type AgeGroup = 'below1' | '1-10' | '11-20' | '21-30' | '31-40' | '41-50' | '51-60' | '61-70' | '71-80' | '81-90';

export const genderOptions: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const ageGroupOptions: { value: AgeGroup; label: string }[] = [
  { value: 'below1', label: 'Below 1' },
  { value: '1-10', label: '1–10' },
  { value: '11-20', label: '11–20' },
  { value: '21-30', label: '21–30' },
  { value: '31-40', label: '31–40' },
  { value: '41-50', label: '41–50' },
  { value: '51-60', label: '51–60' },
  { value: '61-70', label: '61–70' },
  { value: '71-80', label: '71–80' },
  { value: '81-90', label: '81–90' },
];

interface DemographicFilterProps {
  selectedGenders: Gender[];
  selectedAgeGroups: AgeGroup[];
  onToggleGender: (gender: Gender) => void;
  onToggleAgeGroup: (ageGroup: AgeGroup) => void;
  onClearAll: () => void;
}

/**
 * Returns a safety weight multiplier based on demographics.
 * Higher multiplier = more cautious routing (prefer safer paths).
 */
export const getDemographicSafetyWeight = (
  genders: Gender[],
  ageGroups: AgeGroup[]
): number => {
  let weight = 1.0;

  // Gender-based adjustments
  if (genders.includes('female')) weight += 0.3;
  if (genders.includes('other')) weight += 0.15;

  // Age-based adjustments — vulnerable ages get higher weights
  const vulnerableYoung: AgeGroup[] = ['below1', '1-10', '11-20'];
  const vulnerableOld: AgeGroup[] = ['61-70', '71-80', '81-90'];
  const hasVulnerableYoung = ageGroups.some(a => vulnerableYoung.includes(a));
  const hasVulnerableOld = ageGroups.some(a => vulnerableOld.includes(a));

  if (hasVulnerableYoung) weight += 0.25;
  if (hasVulnerableOld) weight += 0.2;

  return weight;
};

const DemographicFilter = ({
  selectedGenders,
  selectedAgeGroups,
  onToggleGender,
  onToggleAgeGroup,
  onClearAll,
}: DemographicFilterProps) => {
  const hasSelection = selectedGenders.length > 0 || selectedAgeGroups.length > 0;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Users className="w-4 h-4" />
          <h3 className="font-semibold text-sm">Traveller Profile</h3>
        </div>
        {hasSelection && (
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
        Select gender & age to personalise route safety
      </p>

      {/* Gender */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gender</span>
        <div className="flex flex-wrap gap-2">
          {genderOptions.map(({ value, label }) => {
            const isChecked = selectedGenders.includes(value);
            return (
              <div
                key={value}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer text-sm',
                  isChecked
                    ? 'bg-primary/10 border-primary/30'
                    : 'border-border/50 hover:border-border bg-background/50'
                )}
                onClick={() => onToggleGender(value)}
              >
                <Checkbox
                  id={`gender-${value}`}
                  checked={isChecked}
                  onCheckedChange={() => onToggleGender(value)}
                  className="pointer-events-none h-3.5 w-3.5"
                />
                <Label htmlFor={`gender-${value}`} className="cursor-pointer text-xs">
                  {label}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Age Groups */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Age Group</span>
        <div className="flex flex-wrap gap-1.5">
          {ageGroupOptions.map(({ value, label }) => {
            const isChecked = selectedAgeGroups.includes(value);
            return (
              <div
                key={value}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all cursor-pointer',
                  isChecked
                    ? 'bg-primary/10 border-primary/30'
                    : 'border-border/50 hover:border-border bg-background/50'
                )}
                onClick={() => onToggleAgeGroup(value)}
              >
                <Checkbox
                  id={`age-${value}`}
                  checked={isChecked}
                  onCheckedChange={() => onToggleAgeGroup(value)}
                  className="pointer-events-none h-3 w-3"
                />
                <Label htmlFor={`age-${value}`} className="cursor-pointer text-[11px]">
                  {label}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      {hasSelection && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3 text-primary" />
            <span>Routes will be optimised for selected profile</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemographicFilter;
