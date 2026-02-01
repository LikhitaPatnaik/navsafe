import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Bell, MapPin, Shield, Volume2, Palette, Sun, Moon, Mic } from 'lucide-react';

const Settings = () => {
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const { voiceSosEnabled, setVoiceSosEnabled } = useSettings();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how NavSafe looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="light-mode" className="flex-1 cursor-pointer">
                  Light Mode
                </Label>
              </div>
              <Switch 
                id="light-mode" 
                checked={theme === 'light'}
                onCheckedChange={(checked) => setTheme(checked ? 'light' : 'dark')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="dark-mode" className="flex-1 cursor-pointer">
                  Dark Mode
                </Label>
              </div>
              <Switch 
                id="dark-mode" 
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Voice SOS
            </CardTitle>
            <CardDescription>
              Enable voice-activated emergency alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="voice-sos" className="cursor-pointer">
                  Enable Voice SOS
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Say "Help", "SOS", "Bachao", or "Save" to auto-send alerts
                </p>
              </div>
              <Switch 
                id="voice-sos" 
                checked={voiceSosEnabled}
                onCheckedChange={setVoiceSosEnabled}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="deviation-alerts" className="flex-1">
                Route deviation alerts
              </Label>
              <Switch id="deviation-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="safety-alerts" className="flex-1">
                Safety zone warnings
              </Label>
              <Switch id="safety-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sos-confirm" className="flex-1">
                SOS confirmation alerts
              </Label>
              <Switch id="sos-confirm" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </CardTitle>
            <CardDescription>
              Manage location tracking preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="high-accuracy" className="flex-1">
                High accuracy GPS
              </Label>
              <Switch id="high-accuracy" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="background-tracking" className="flex-1">
                Background location tracking
              </Label>
              <Switch id="background-tracking" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Sound & Vibration
            </CardTitle>
            <CardDescription>
              Configure audio and haptic feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sound-alerts" className="flex-1">
                Sound alerts
              </Label>
              <Switch id="sound-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="vibration" className="flex-1">
                Vibration feedback
              </Label>
              <Switch id="vibration" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="share-location" className="flex-1">
                Share location with emergency contacts
              </Label>
              <Switch id="share-location" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="analytics" className="flex-1">
                Anonymous usage analytics
              </Label>
              <Switch id="analytics" />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
