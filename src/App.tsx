import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { AudioPlayerProvider } from "@/components/AudioPlayer";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ChatPage from "./pages/ChatPage";
// import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import { useKeycloak } from "@react-keycloak/web";
import { useEffect } from "react";
import apiService from "@/lib/api";

const queryClient = new QueryClient();

// Component to update the document title
const TitleUpdater = () => {
  const { t } = useLanguage();
  
  useEffect(() => {
    document.title = t("appTitle") as string;
  }, [t]);
  
  return null;
};

const App = () => {
  const { keycloak, initialized } = useKeycloak();
  
  useEffect(() => {
    if (keycloak) {
      apiService.setKeycloakInstance(keycloak);
    }
  }, [keycloak]);
  
  // Show loading state while Keycloak is initializing
  if (!initialized) {
    return <div className=" bg-foreground/80 flex justify-center items-center h-screen text-background">Loading...</div>;
  }
  
  // If not authenticated, don't render the app
  if (!keycloak.authenticated) {
    return null;
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <LanguageProvider>
          <TitleUpdater />
          <AudioPlayerProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  {/* <Route path="/login" element={<LoginPage />} /> */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AudioPlayerProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
