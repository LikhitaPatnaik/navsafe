import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UseVoiceCommandOptions {
  triggerPhrases?: string[];
  onTrigger: () => void;
  continuous?: boolean;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// Define the SpeechRecognition type for TypeScript
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const DEFAULT_TRIGGER_PHRASES = [
  'sos',
  'help',
  'help me',
  'emergency',
  'danger',
  'save me',
  'call for help',
  'i need help',
  'bachao', // Hindi for "save me"
  'madad', // Hindi for "help"
];

export const useVoiceCommand = ({
  triggerPhrases = DEFAULT_TRIGGER_PHRASES,
  onTrigger,
  continuous = true,
}: UseVoiceCommandOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-IN'; // English (India) for better local accent recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [continuous]);

  const checkForTrigger = useCallback((transcript: string) => {
    const normalizedTranscript = transcript.toLowerCase().trim();
    setLastTranscript(normalizedTranscript);

    for (const phrase of triggerPhrases) {
      if (normalizedTranscript.includes(phrase.toLowerCase())) {
        console.log('[Voice] Trigger phrase detected:', phrase, 'in:', normalizedTranscript);
        return true;
      }
    }
    return false;
  }, [triggerPhrases]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      toast.error('Voice recognition not supported in this browser');
      return;
    }

    try {
      recognitionRef.current.onstart = () => {
        console.log('[Voice] Recognition started');
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const fullTranscript = finalTranscript || interimTranscript;
        
        if (fullTranscript && checkForTrigger(fullTranscript)) {
          // Stop listening temporarily to prevent multiple triggers
          recognitionRef.current?.stop();
          onTrigger();
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('[Voice] Recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please enable microphone permissions.');
          setIsListening(false);
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          // Auto-restart on recoverable errors
          restartTimeoutRef.current = setTimeout(() => {
            if (isListening) {
              try {
                recognitionRef.current?.start();
              } catch (e) {
                console.log('[Voice] Could not restart:', e);
              }
            }
          }, 1000);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('[Voice] Recognition ended');
        
        // Auto-restart if continuous mode and still supposed to be listening
        if (continuous && isListening) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.log('[Voice] Could not restart:', e);
              setIsListening(false);
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.start();
      toast.success('Voice SOS activated. Say "SOS" or "Help" to trigger alert.');
    } catch (error) {
      console.error('[Voice] Failed to start recognition:', error);
      toast.error('Failed to start voice recognition');
    }
  }, [isSupported, checkForTrigger, onTrigger, continuous, isListening]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
    }
    
    setIsListening(false);
    toast.info('Voice SOS deactivated');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    lastTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
};
