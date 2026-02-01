import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextType {
  voiceSosEnabled: boolean;
  setVoiceSosEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [voiceSosEnabled, setVoiceSosEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('voiceSosEnabled');
    return stored ? JSON.parse(stored) : false;
  });

  const setVoiceSosEnabled = (enabled: boolean) => {
    setVoiceSosEnabledState(enabled);
    localStorage.setItem('voiceSosEnabled', JSON.stringify(enabled));
  };

  return (
    <SettingsContext.Provider value={{ voiceSosEnabled, setVoiceSosEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
