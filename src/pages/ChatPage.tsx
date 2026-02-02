import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChatInterface } from "@/components/VoiceChatInterface";
import { Layout } from "@/components/Layout";
import { LanguageSelectionScreen } from "@/components/LanguageSelectionScreen";

type ChatMode = 'text' | 'voice';

export default function ChatPage() {
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('text');

  // Check if language was previously selected (you could use localStorage)
  useEffect(() => {
    const languageSelected = localStorage.getItem("languageSelected");
    if (languageSelected === "true") {
      setHasSelectedLanguage(true);
    }

    // Check if there's a saved chat mode preference
    const savedMode = localStorage.getItem("chatMode") as ChatMode;
    if (savedMode && (savedMode === 'text' || savedMode === 'voice')) {
      setChatMode(savedMode);
    }
  }, []);

  const handleLanguageSelected = () => {
    localStorage.setItem("languageSelected", "true");
    setHasSelectedLanguage(true);
  };

  const handleModeChange = (mode: ChatMode) => {
    setChatMode(mode);
    localStorage.setItem("chatMode", mode);
  };

  // Voice mode doesn't use Layout - it has its own full-screen UI
  if (chatMode === 'voice' && hasSelectedLanguage) {
    return <VoiceChatInterface onModeChange={handleModeChange} />;
  }

  return (
    <Layout showFooter={false} onModeChange={handleModeChange}>
      <div className="container mx-auto px-4 h-[calc(100vh-var(--header-height)-var(--input-height))] pt-1">
        {hasSelectedLanguage ? (
          <ChatInterface />
        ) : (
          <LanguageSelectionScreen onLanguageSelected={handleLanguageSelected} />
        )}
      </div>
    </Layout>
  );
}
