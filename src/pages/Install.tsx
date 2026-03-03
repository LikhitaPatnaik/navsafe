import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, CheckCircle, Share, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl p-8 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Install NavSafe</h1>
          <p className="text-muted-foreground text-sm">
            Add NavSafe to your home screen for instant access, offline support, and a native app experience.
          </p>
        </div>

        {isInstalled ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-12 h-12 text-primary" />
            <p className="text-foreground font-medium">NavSafe is installed!</p>
            <Button variant="hero" onClick={() => navigate('/')}>
              Open App
            </Button>
          </div>
        ) : isIOS ? (
          <div className="space-y-4 text-left">
            <p className="text-sm font-medium text-foreground">To install on iPhone/iPad:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tap the <Share className="w-4 h-4 inline text-primary" /> Share button in Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tap <strong>"Add"</strong> to confirm
                </p>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <Button variant="hero" className="w-full" onClick={handleInstall}>
            <Download className="w-5 h-5 mr-2" />
            Install NavSafe
          </Button>
        ) : (
          <div className="space-y-4 text-left">
            <p className="text-sm font-medium text-foreground">To install on Android:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tap the <MoreVertical className="w-4 h-4 inline text-primary" /> menu in Chrome
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate('/')}>
          Continue in browser
        </Button>
      </div>
    </div>
  );
};

export default Install;
