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
          // User's speech transcribed
          if (data.text) {
            addMessage(data.text, 'user');
          }
          break;

        case 'llm_chunk':
          // Streaming AI response text
          if (!currentBotTurnIdRef.current || currentBotTurnIdRef.current !== data.turn_id) {
            // New turn - add empty bot message
            addMessage('', 'bot');
            currentBotTurnIdRef.current = data.turn_id || null;
          }
          if (data.text) {
            appendToBotMessage(data.text);
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
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatusText('Connection failed. Check backend server.');
      setIsConnected(false);
      setMicState('idle');
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
  }, []);

  /**
   * Sends audio chunk to server
   */
  const sendAudioChunk = useCallback((data: ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

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
    connect,
    disconnect,
    sendAudioChunk,
  };
};
