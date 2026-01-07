import { useState, useRef, useEffect } from 'react';
import { Mic, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/LanguageProvider';
import { useVoiceWebSocket } from '@/hooks/use-voice-websocket';
import { useVoiceAudio } from '@/hooks/use-voice-audio';
import type { VoiceChatInterfaceProps, VoiceLanguage } from '@/types/voice-chat.types';
import { getThemeConfig } from '@/config/theme.config';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ChatMessage } from '@/components/ChatMessage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

export function VoiceChatInterface({ onModeChange }: VoiceChatInterfaceProps) {
  const { language: appLanguage, t } = useLanguage();
  const [language, setLanguage] = useState<VoiceLanguage>(
    appLanguage === 'am' ? 'am' : 'en'
  );
  const themeConfig = getThemeConfig();
  const isMobile = useIsMobile();

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio hook
  const {
    startRecording,
    stopRecording,
    playAudio,
    clearAudioQueue,
    canvasRef,
    isRecording,
  } = useVoiceAudio();

  // WebSocket hook
  const { isConnected, messages, micState, statusText, connect, disconnect, sendAudioChunk } =
    useVoiceWebSocket(language, playAudio, clearAudioQueue);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle language change
  useEffect(() => {
    const newLang: VoiceLanguage = appLanguage === 'am' ? 'am' : 'en';
    if (newLang === language) return;

    // Stop current connection when language changes
    if (isConnected) {
      stopRecording();
      disconnect();
    }

    setLanguage(newLang);
  }, [appLanguage, language, isConnected, stopRecording, disconnect]);

  /**
   * Toggles voice connection
   */
  const toggleConnection = async () => {
    if (isConnected) {
      // Disconnect
      stopRecording();
      disconnect();
    } else {
      // Connect
      connect();

      // Start recording when connected
      setTimeout(async () => {
        try {
          await startRecording((audioData) => {
            sendAudioChunk(audioData);
          });
        } catch (error) {
          console.error('Failed to start recording:', error);
          disconnect();
        }
      }, 100);
    }
  };

  /**
   * Get mic button styling based on state
   */
  const getMicButtonStyle = () => {
    switch (micState) {
      case 'idle':
        return {
          bg: 'bg-[hsl(37_25%_94%)]', // Light gold
          border: 'border-[hsl(37_30%_85%)]',
          text: 'text-[#5a544f]',
          hover: 'hover:bg-[hsl(37_30%_88%)]',
          shadow: '',
        };
      case 'active':
        return {
          bg: 'bg-[hsl(37_83%_52%)]', // Gold
          border: 'border-[hsl(37_83%_52%)]',
          text: 'text-white',
          hover: 'hover:bg-[hsl(37_83%_48%)]',
          shadow: 'shadow-[0_0_0_8px_rgba(234,157,33,0.2)]',
        };
      case 'processing':
        return {
          bg: 'bg-[hsl(152_90%_27%)]', // Green
          border: 'border-[hsl(152_90%_27%)]',
          text: 'text-white',
          hover: '',
          shadow: '',
        };
      case 'speaking':
        return {
          bg: 'bg-[hsl(0_84%_60%)]', // Red
          border: 'border-[hsl(0_84%_60%)]',
          text: 'text-white',
          hover: '',
          shadow: 'shadow-[0_0_20px_rgba(231,76,60,0.4)]',
        };
    }
  };

  const micButtonStyle = getMicButtonStyle();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          {themeConfig.showLogo ? (
            <picture>
              <source srcSet={themeConfig.logo.webp} type="image/webp" />
              <img
                src={themeConfig.logo.primary}
                alt={themeConfig.name}
                className="h-10 w-auto"
              />
            </picture>
          ) : (
            <span className="font-bold text-lg text-primary">{t("appTitle").toString()}</span>
          )}
        </div>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-4">
          {onModeChange && (
            <Button
              onClick={() => onModeChange('text')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Text Mode
            </Button>
          )}
          <LanguageSelector />
          <ThemeToggle />
        </div>

        {/* Mobile menu */}
        <div className="md:hidden flex items-center gap-2">
          {onModeChange && (
            <Button
              onClick={() => onModeChange('text')}
              variant="outline"
              size="sm"
              className="gap-1 text-xs px-2 py-1 h-8"
            >
              <MessageSquare className="h-3 w-3" />
              Text
            </Button>
          )}
          <ThemeToggle />
          <LanguageSelector />
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 relative w-full pt-16">
        <ScrollArea className="flex-1 h-[calc(100vh-var(--header-height)-250px)]">
          <div
            ref={chatContainerRef}
            className={cn(
              isMobile ? "pb-24 md:pb-20" : "pb-24 md:pb-20",
              messages.length === 1 ? "min-h-[70vh]" : ""
            )}
          >
            <div className={cn(
              "message-container",
              isMobile ? "space-y-4 px-6" : "space-y-4 px-16"
            )}>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={`voice-msg-${idx}`}
                  message={msg.text}
                  isUser={msg.type === 'user'}
                  timestamp={new Date()}
                  messageId={`voice-msg-${idx}`}
                  isLoading={false}
                  isStreaming={false}
                  isFeedbackMessage={msg.type === 'system'}
                  questionText=""
                  responseText={msg.text}
                  hideActions={true}
                />
              ))}
              <div ref={messagesEndRef} className="h-8" />
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* Controls Footer */}
      <footer className="flex-shrink-0 bg-background border-t border-border p-4 pb-6 z-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-muted/50 border border-border rounded-xl p-3 shadow-sm">
            {/* Status Text */}
            <div className="text-center mb-3">
              <p className="text-sm text-muted-foreground font-medium">{statusText}</p>
            </div>

            {/* Mic Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleConnection}
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 border-2',
                  micButtonStyle.bg,
                  micButtonStyle.border,
                  micButtonStyle.text,
                  micButtonStyle.hover,
                  micButtonStyle.shadow
                )}
                aria-label={isConnected ? 'Stop conversation' : 'Start conversation'}
              >
                {isConnected ? <X className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center mt-2">
            <p className="text-[10px] text-muted-foreground/60">
              Voice assistant can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
