import { Button } from '@/components/ui/button';
import { Shield, MapPin, Navigation, AlertTriangle } from 'lucide-react';

interface HeroSectionProps {
  onStartTrip: () => void;
}

const HeroSection = ({ onStartTrip }: HeroSectionProps) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-12 sm:py-0">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-40 sm:w-80 h-40 sm:h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      
      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 glass rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-8 animate-fade-in">
          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          <span className="text-xs sm:text-sm text-muted-foreground">AI-Powered Safety Navigation</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 animate-slide-up">
          <span className="text-foreground">Nav</span>
          <span className="gradient-text">Safe</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-3 sm:mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Travel Smart. Travel Safe.
        </p>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground/80 mb-8 sm:mb-12 max-w-2xl mx-auto px-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          AI-powered route safety monitoring with crime-aware navigation. 
          Find the safest path to your destination in real-time.
        </p>

        {/* CTA Button */}
        <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Button variant="hero" size="xl" onClick={onStartTrip} className="group text-sm sm:text-base px-6 sm:px-8">
            <Navigation className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-45 transition-transform duration-300" />
            Start Safe Trip
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-20 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <FeatureCard
            icon={<MapPin className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Smart Routes"
            description="Compare fastest, safest, and optimized routes instantly"
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Safety Scores"
            description="Real-time safety scores based on area crime data"
          />
          <FeatureCard
            icon={<AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Live Monitoring"
            description="Get alerts when deviating from trusted routes"
          />
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="glass rounded-xl p-4 sm:p-6 hover:bg-card/60 transition-all duration-300 group">
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3 sm:mb-4 mx-auto sm:mx-0 group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 sm:mb-2">{title}</h3>
    <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
  </div>
);

export default HeroSection;
