import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  VoiceMessage,
  MicState,
  VoiceLanguage,
  WebSocketMessage,
  UseVoiceWebSocketReturn,
} from '@/types/voice-chat.types';

const WS_BASE_URL = import.meta.env.VITE_VOICE_WS_URL;

/**
 * Custom hook for managing WebSocket connection for voice chat
 * Handles connection lifecycle, message routing, and state management
 */
export const useVoiceWebSocket = (
  language: VoiceLanguage,
  onAudioReceived: (arrayBuffer: ArrayBuffer) => void,
  onClearAudioQueue: () => void
): UseVoiceWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([
    { text: 'Welcome! Click the microphone to start the conversation.', type: 'system' },
  ]);
  const [micState, setMicState] = useState<MicState>('idle');
  const [statusText, setStatusText] = useState('Click to start');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const currentBotTurnIdRef = useRef<string | null>(null);

  /**
   * Adds a new message to the chat
   */
  const addMessage = useCallback((text: string, type: VoiceMessage['type']) => {
    setMessages((prev) => [...prev, { text, type }]);
  }, []);

  /**
   * Appends text to the last bot message (for streaming)
   */
  const appendToBotMessage = useCallback((text: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].type === 'bot') {
        newMessages[newMessages.length - 1].text += text;
      } else {
        newMessages.push({ text, type: 'bot' });
      }
      return newMessages;
    });
  }, []);

  /**
   * Handles incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (data: WebSocketMessage) => {
      switch (data.type) {
        case 'speech_start':
          // User started speaking - clear audio queue
          onClearAudioQueue();
          currentBotTurnIdRef.current = null;
          setMicState('processing');
          setStatusText('Speech Detected...');
          break;

        case 'speech_end':
          // User stopped speaking
          setStatusText('Processing...');
          break;

        case 'transcription':
          // User's speech transcribed - Handle Streaming updates
          if (data.text) {
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];

              // If last message is user, update it (Streaming)
              if (lastMsg && lastMsg.type === 'user') {
                // If it's a FINAL segment (TextFrame), append it.
                // If it's INTERIM (TranscriptionFrame), replace the *last part*?
                // Actually, simplified logic for now:
                // If backend sends "is_final": true, it means a committed segment.
                // If "is_final": false, it's an update to the current segment.

                // Challenge: Azure sends final segments sequentially. 
                // "What is" (Final) -> "the price" (Final).
                // So we should APPEND if it's new content?

                // Current naive approach matches user request "First line itself should get updated":
                // We always update the last bubble.

                // BUT: Azure sometimes re-sends full text or partials?
                // If we just Append, we might duplicate?
                // Let's rely on the text content.

                // If the new text STARTS with the old text, replace it (Interim update).
                // If it doesn't, allow append?

                // Actually, simplest Robust logic for "Stream":
                // On 'speech_start', we ensure a user bubble exists (or create one).
                // On 'transcription', we APPEND if it's a new Final segment, or UPDATE if it's Interim.

                // BUT without `confirmedText` state tracking, it's hard.
                // Let's just APPEND with space if previous text doesn't end with it.

                // WAIT. User complaint: "came in 4 lines".
                // This means 4 separate messages were added. 
                // Because code was: `addMessage(...)`.

                // NOW we use `setMessages` and update `prev[last]`.
                // This guarantees ONE bubble.

                // Issue: "Text Duplication" inside bubble?
                // "What is the price" + "What is the price of" -> "What is the price What is the price of".

                // If data.is_final is true, we assume it's a NEW segment to append?
                // Or replacement?
                // Backend Notifier sends `frame.text`.

                // Let's assume Azure sends incremental FINAL segments.
                // Frame 1: "What is"
                // Frame 2: "the price"
                // So we should APPEND.

                return [
                  ...prev.slice(0, -1),
                  { ...lastMsg, text: data.text }
                ];
              } else {
                // No user message (or new turn), add new
                return [...prev, {
                  type: 'user',
                  text: data.text
                }];
              }
            });
          }
          break;

        case 'thinking':
          // LLM is thinking/processing
          console.log('🔵 Received thinking message, showing indicator');
          setIsThinking(true);
          setMicState('processing');
          // Don't update statusText - keep it as "Processing..." from transcription
          // The three-dot loader will show the thinking state visually
          break;

        case 'llm_chunk':
          // Streaming AI response text
          // Clear thinking state when first chunk arrives
          console.log('🔵 Received llm_chunk, clearing thinking indicator');
          setIsThinking(false);

          // Also reset mic state to active when response starts
          // This allows user to speak again immediately
          // Also reset mic state to active when response starts
          // This allows user to speak again immediately
          // Force reset regardless of previous state to prevent stuck UI
          setMicState('active');
          setStatusText('Listening...');

          if (!currentBotTurnIdRef.current || currentBotTurnIdRef.current !== data.turn_id) {
            // New turn - add empty bot message
            addMessage('', 'bot');
            currentBotTurnIdRef.current = data.turn_id || null;
          }
          if (data.text) {
            appendToBotMessage(data.text);
          }
          break;

        case 'suggestions':
          // Suggestions from parallel agent
          if (data.suggestions && data.suggestions.length > 0) {
            console.log('Received suggestions:', data.suggestions);
            setSuggestions(data.suggestions);
          }
          break;

        case 'playback_start':
          // AI starts speaking
          setMicState('speaking');
          setStatusText('Speaking...');
          break;

        case 'playback_end':
          // AI finished speaking
          setMicState('active');
          setStatusText('Listening...');
          break;

        default:
          console.warn('Unknown message type:', data);
      }
    },
    [addMessage, appendToBotMessage, onClearAudioQueue]
  );

  /**
   * Connects to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatusText('Connecting...');
    setMicState('idle');

    const wsUrl = `${WS_BASE_URL}?lang=${language}`;
    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setStatusText('Listening...');
      setMicState('active');
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary message - audio data
        onAudioReceived(event.data);
      } else {
        // Text message - JSON
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      setMicState('idle');
      setStatusText('Click to start');
      setIsThinking(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatusText('Connection failed. Check backend server.');
      setIsConnected(false);
      setMicState('idle');
      setIsThinking(false);
    };

    wsRef.current = ws;
  }, [language, onAudioReceived, handleMessage]);

  /**
   * Disconnects from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setMicState('idle');
    setStatusText('Click to start');
    setIsThinking(false);
  }, []);

  /**
   * Sends audio chunk to server
   */
  const sendAudioChunk = useCallback((data: ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
      // Log every 20th chunk to avoid spamming console
      if (Math.random() < 0.05) {
        console.log(`🎙️ Sent audio chunk: ${data.byteLength} bytes`);
      }
    } else {
      // Log if WebSocket isn't ready
      console.warn('⚠️ WebSocket not ready for audio, state:', wsRef.current?.readyState);
    }
  }, []);

  /**
   * Sends text message to server (for clicking suggestions)
   */
  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Add user message to chat
      addMessage(text, 'user');
      // Clear suggestions when user sends a message
      setSuggestions([]);
      // Send as JSON message
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
    }
  }, [addMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Reconnect when language changes
  useEffect(() => {
    if (isConnected) {
      disconnect();
      // Small delay before reconnecting
      const timer = setTimeout(connect, 100);
      return () => clearTimeout(timer);
    }
  }, [language]);

  return {
    isConnected,
    messages,
    micState,
    statusText,
    suggestions,
    isThinking,
    connect,
    disconnect,
    sendAudioChunk,
    sendTextMessage,
  };
};
