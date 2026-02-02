/**
 * Voice Chat TypeScript Interfaces
 * Types for WebSocket messages, audio processing, and component state
 */

// Microphone states during voice interaction
export type MicState = "idle" | "active" | "processing" | "speaking";

// Message types in the chat
export type MessageType = "user" | "bot" | "system";

// Language options
export type VoiceLanguage = "en" | "am";

// Chat message structure
export interface VoiceMessage {
  text: string;
  type: MessageType;
}

// WebSocket message types from server
export interface WebSocketMessage {
  type: "speech_start" | "speech_end" | "transcription" | "thinking" | "llm_chunk" | "playback_start" | "playback_end" | "suggestions";
  text?: string;
  turn_id?: string;
  suggestions?: string[];
}

// Audio chunk in playback queue
export interface AudioChunk {
  arrayBuffer: ArrayBuffer;
  resolve: () => void;
}

// WebSocket hook return type
export interface UseVoiceWebSocketReturn {
  isConnected: boolean;
  messages: VoiceMessage[];
  micState: MicState;
  statusText: string;
  suggestions: string[];
  isThinking: boolean;
  connect: () => void;
  disconnect: () => void;
  sendAudioChunk: (data: ArrayBuffer) => void;
  sendTextMessage: (text: string) => void;
}

// Audio hook return type
export interface UseVoiceAudioReturn {
  startRecording: (onAudioData: (data: ArrayBuffer) => void) => Promise<void>;
  stopRecording: () => void;
  playAudio: (arrayBuffer: ArrayBuffer) => Promise<void>;
  clearAudioQueue: () => void;
  audioLevel: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isRecording: boolean;
}

// Voice chat interface props
export interface VoiceChatInterfaceProps {
  onModeChange?: (mode: 'text' | 'voice') => void;
}
