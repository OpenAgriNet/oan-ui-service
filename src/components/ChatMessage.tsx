import { Volume2, Copy, ThumbsUp, ThumbsDown, User, UserRound, Bot, BotMessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AudioWaveform } from "./AudioWaveform";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/components/ThemeProvider";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
// import { useKeycloak } from "@react-keycloak/web";
import { useTts } from "@/hooks/use-tts";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/contexts/AuthContext";
import { SourceCitation } from "@/components/SourceCitation";

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp: Date;
  onPlayAudio?: () => void;
  onDislike?: (messageId: string, questionText: string, responseText: string) => void;
  onLike?: (messageId: string, questionText: string, responseText: string) => void;
  messageId: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  questionText?: string;
  responseText?: string;
  isFeedbackMessage?: boolean;
  isErrorMessage?: boolean;
  errorTranslationKey?: string;
  hideActions?: boolean; // Hide action buttons (listen, copy, like, dislike)
  source?: string[]; // Source citations for AI responses (array of URLs or text)
}

export function ChatMessage({
  message,
  isUser,
  timestamp,
  onPlayAudio,
  onDislike,
  onLike,
  messageId,
  questionText = '',
  responseText = '',
  isLoading = false,
  isStreaming = false,
  isFeedbackMessage = false,
  isErrorMessage = false,
  errorTranslationKey,
  hideActions = false,
  source,
}: ChatMessageProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { isPlaying, currentPlayingId, audioState, toggleAudio } = useTts();
  const { t } = useLanguage();
  const { user } = useAuth();

  const getInitials = (username: string) => {
    return username?.substring(0, 2).toUpperCase() || "U";
  };
  
  const handlePlayAudio = () => {
    toggleAudio(message, messageId);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast({
      title: t("toast.messageCopied.title") as string,
      description: t("toast.messageCopied.description") as string,
    });
  };

  const handleLike = (questionText: string, responseText: string) => {
    if (isDisliked) {
      setIsDisliked(false);
    }
    setIsLiked(!isLiked);
    
    if (!isLiked && onLike) {
      onLike(messageId, questionText, responseText);
    }
  };

  const handleDislike = (questionText: string, responseText: string) => {
    if (isLiked) {
      setIsLiked(false);
    }
    setIsDisliked(!isDisliked);
    
    if (!isDisliked && onDislike) {
      onDislike(messageId, questionText, responseText);
    }
  };

  const iconColor = theme === "dark" ? "white" : "currentColor";

  const markdownComponents: Components = {
    p: ({ children }) => <p className="m-0 leading-normal">{children}</p>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
        {children}
      </a>
    ),
    pre: ({ children }) => (
      <pre className="bg-muted/50 p-2 rounded-lg overflow-x-auto">
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      return isInline ? (
        <code className="bg-muted/50 rounded px-1 py-0.5" {...props}>{children}</code>
      ) : (
        <code className={className} {...props}>{children}</code>
      );
    },
    hr: () => (
      <hr className="border-none h-px my-4 bg-primary/30 dark:bg-primary/40" />
    ),
  };

  const renderStreamingIndicator = () => (
    <div className="flex items-center gap-1 h-6 px-1">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );

  const renderAudioButton = () => {
    const state = audioState[messageId] || 'idle';
    const isCurrentlyPlaying = isPlaying && currentPlayingId === messageId;

    return (
      <Button
        variant={isCurrentlyPlaying ? "secondary" : "outline"}
        size="sm"
        onClick={handlePlayAudio}
        className="h-9 px-3 rounded-md"
        style={{
          backgroundColor: isCurrentlyPlaying
            ? 'hsl(var(--button-interactive) / 0.2)'
            : 'hsl(var(--button-interactive) / 0.1)',
          color: 'hsl(var(--button-interactive))',
          borderColor: 'hsl(var(--button-interactive) / 0.2)',
        }}
        aria-label={isCurrentlyPlaying ? "Stop audio" : "Listen"}
        disabled={state === 'loading' || isErrorMessage}
      >
        {state === 'loading' ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Volume2 className={cn(
            "h-4 w-4 mr-1",
            isCurrentlyPlaying && "animate-pulse"
          )} />
        )}
        {t("Listen") as string}
      </Button>
    );
  };

  // Use translation key for error messages if present
  const displayMessage = isErrorMessage && errorTranslationKey ? (t(errorTranslationKey) as string) : message;

  // If it's an AI response on mobile (not a user message), use a simplified layout
  if (!isUser && isMobile && (!isLoading || isErrorMessage)) {
    return (
      <TooltipProvider>
        <div className="animate-fade-in my-6 px-1 relative">
          {/* Subtle top separator */}
          {/* <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-muted rounded-full -mt-5 opacity-40" /> */}
          
          <div className={cn(
            "w-full max-w-full pt-1 px-3 py-3 rounded-lg",
            isErrorMessage ? "bg-red-100/20 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30" : ""
          )}>
            <div className={cn(
              "prose prose-sm dark:prose-invert w-full",
              isErrorMessage ? "text-destructive dark:text-red-400 font-medium" : ""
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {displayMessage}
              </ReactMarkdown>
            </div>

            {/* Show source citation if available */}
            {source && source.length > 0 && !isErrorMessage && (
              <SourceCitation sources={source} />
            )}

            {!hideActions && (
              <div className="flex items-center justify-start gap-3 mt-4">
                {isStreaming && !isErrorMessage ? (
                  renderStreamingIndicator()
                ) : (
                  <>
                    {renderAudioButton()}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="h-8 w-8 p-0 rounded-full hover:bg-muted/50"
                          aria-label="Copy message"
                          disabled={isErrorMessage}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("copyMessage").toString()}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isLiked ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => handleLike(questionText, responseText)}
                          className={cn(
                            "h-8 w-8 p-0 rounded-full hover:bg-muted/50",
                            isLiked && "like-active"
                          )}
                          aria-label="Like message"
                          disabled={isErrorMessage}
                        >
                          <ThumbsUp className={cn("h-4 w-4", isLiked && "like-active-text")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("likeMessage").toString()}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isDisliked ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => handleDislike(questionText, responseText)}
                          className="h-8 w-8 p-0 rounded-full hover:bg-muted/50"
                          aria-label="Dislike message"
                          disabled={isErrorMessage}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("dislikeMessage").toString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Subtle bottom separator */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-muted rounded-full -mb-5 opacity-40" />
        </div>
      </TooltipProvider>
    );
  }

  // If it's a loading message on mobile
  if (!isUser && isMobile && isLoading && !isErrorMessage) {
    return (
      <TooltipProvider>
        <div className="animate-fade-in my-6 px-1 relative">
          {/* Subtle top separator */}
          {/* <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-muted rounded-full -mt-5 opacity-40" /> */}
          
          <div className="w-full max-w-full pt-2">
            <div className="flex items-center gap-1 h-6 px-1 justify-start">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          </div>
          
          {/* Subtle bottom separator */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-muted rounded-full -mb-5 opacity-40" />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn(
        "flex w-full items-start gap-2 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        <Avatar className={cn(
          "h-8 w-8 flex-shrink-0",
          isUser ? "ml-2" : "mr-2"
        )}>
          {isUser ? (
            <>
              <AvatarImage src="" alt="User" />
              <AvatarFallback>
                {getInitials(user?.username || "U")}
              </AvatarFallback>
            </>
          ) : (
            <>
              <AvatarImage src="" alt="Bot" />
              <AvatarFallback>
                <BotMessageSquare className="h-4 w-4" />
              </AvatarFallback>
            </>
          )}
        </Avatar>

        <div className={cn(
          "flex flex-col max-w-[80%] min-w-[80px]",
          isUser ? "items-end" : "items-start"
        )}>
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 mb-1 w-fit",
              isUser
                ? "rounded-tr-none word-break-break-word"
                : `${displayMessage.length > 0 || isLoading ? "bg-muted" : "hidden"} rounded-tl-none`
            )}
            style={isUser ? {
              backgroundColor: 'hsl(var(--button-interactive))',
              color: 'hsl(var(--button-interactive-foreground))',
            } : undefined}
          >
            {isLoading && !isErrorMessage ? (
              <div className="flex items-center gap-1 h-6 px-1">
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                <span className="thinking-dot" />
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={markdownComponents}
                >
                  {displayMessage}
                </ReactMarkdown>
              </div>
            )}

            {/* Show source citation if available (desktop) */}
            {!isUser && source && source.length > 0 && !isErrorMessage && !isLoading && (
              <SourceCitation sources={source} className="mt-2" />
            )}
          </div>

          {!hideActions && !isUser && !isLoading && !isFeedbackMessage && !isMobile && (
            <div className="flex items-center gap-1 mt-1 opacity-70 hover:opacity-100 transition-opacity">
              {isStreaming && !isErrorMessage ? (
                renderStreamingIndicator()
              ) : (
                <>
                  {renderAudioButton()}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className="h-7 w-7 p-0 rounded-full hover:bg-muted/50"
                        aria-label="Copy message"
                        disabled={isErrorMessage}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("copyMessage").toString()}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isLiked ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLike(questionText, responseText)}
                        className={cn(
                          "h-7 w-7 p-0 rounded-full hover:bg-muted/50",
                          isLiked && "like-active"
                        )}
                        aria-label="Like message"
                        disabled={isErrorMessage}
                      >
                        <ThumbsUp className={cn("h-3.5 w-3.5", isLiked && "like-active-text")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("likeMessage").toString()}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isDisliked ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleDislike(questionText, responseText)}
                        className="h-7 w-7 p-0 rounded-full hover:bg-muted/50"
                        aria-label="Dislike message"
                        disabled={isErrorMessage}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("dislikeMessage").toString()}</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
