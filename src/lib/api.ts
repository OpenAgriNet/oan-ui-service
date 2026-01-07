import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTenant } from '@/config/theme.config';

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface ChatResponse {
  response: string;
  status: string;
}

export interface TranscriptionResponse {
  text: string;
  lang_code: string;
  status: string;
}

export interface SuggestionItem {
  question: string;
}

interface TTSResponse {
  status: string;
  audio_data: string;
  session_id: string;
}

// ATI Chat API Interfaces
export interface ATIChatRequest {
  user_id: string;
  conversation_id?: string;
  message: string;
  language: string;
}

export interface ATIScore {
  score_id: string;
  ai_relevance_score: string;
  ai_accuracy_score: string;
  ai_completeness_score: string;
  ai_overall_score: string;
  ai_confidence: string;
  ai_reasoning: string;
  user_feedback: string;
  user_feedback_timestamp: string;
  final_score: string;
  score_status: string;
}

export interface ATIMessage {
  message_id: string;
  role: string;
  content: string;
  timestamp: string;
  turn_number: number;
  score: ATIScore;
  translated_content: string;
  original_language: string;
  is_translated: boolean;
  source?: string[]; // Source citations for AI responses (array of URLs or text)
}

export interface ATIChatResponse {
  user_id: string;
  conversation_id: string;
  message: ATIMessage;
  assistant_message: ATIMessage;
}

export interface ATIConversation {
  conversation_id: string;
  title: string;
  started_at: string;
  last_message_at: string;
  language: string;
  total_messages: number;
  is_active: boolean;
  messages: ATIMessage[];
}

export interface ATIConversationsResponse {
  conversations: ATIConversation[];
}

// Constants
const JWT_STORAGE_KEY = 'auth_jwt';
const ATI_USER_ID = '34052121-d15e-4b2b-a4f5-fed074f97b64';
const ATI_API_URL = 'https://api-agri.sulopa.com';
const ATI_TRANSCRIBE_SERVICE_URL = import.meta.env.VITE_TRANSCRIBE_SERVICE_URL || 'http://13.203.218.202:8000';

class ApiService {
  private apiUrl: string;
  private locationData: LocationData | null = null;
  private currentSessionId: string | null = null;
  private axiosInstance: AxiosInstance;
  private authToken: string | null = null;

  // ATI-specific properties
  private atiAxiosInstance: AxiosInstance;
  private atiTranscribeInstance: AxiosInstance;
  private currentConversationId: string | null = null;

  constructor() {
    // Get API URL from environment variable with fallback to localhost
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    this.authToken = this.getAuthToken();
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authToken ? `Bearer ${this.authToken}` : 'NA'
      }
    });

    // Create ATI axios instance
    this.atiAxiosInstance = axios.create({
      baseURL: ATI_API_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Create ATI transcribe-service instance for voice chat
    this.atiTranscribeInstance = axios.create({
      baseURL: ATI_TRANSCRIBE_SERVICE_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Log the API URL and token being used
    console.log('Using API URL:', this.apiUrl);
    console.log('ATI Mode:', getCurrentTenant() === 'ATI');
    console.log('ATI Transcribe Service:', ATI_TRANSCRIBE_SERVICE_URL);
    // console.log('Using auth token:', this.authToken );
  }

  private getAuthToken(): string | null {
    try {
      const tokenData = localStorage.getItem(JWT_STORAGE_KEY);
      if (!tokenData) return null;

      const parsedData = JSON.parse(tokenData);
      const now = new Date().getTime();

      // Check if token is expired
      if (now > parsedData.expiry) {
        localStorage.removeItem(JWT_STORAGE_KEY);
        return null;
      }

      return parsedData.token;
    } catch (error) {
      console.error("Error retrieving JWT for API calls:", error);
      return null;
    }
  }

  private refreshAuthToken(): void {
    this.authToken = this.getAuthToken();
    if (this.authToken) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    } else {
      this.axiosInstance.defaults.headers.common['Authorization'] = 'NA';
      // Don't redirect in development mode - backend handles auth bypass
      // this.redirectToErrorPage();
    }
  }

  private redirectToErrorPage(): void {
    // Check if we're in a browser environment and not already on error page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/error')) {
      window.location.href = '/error?reason=auth';
    }
  }

  updateAuthToken(): void {
    this.refreshAuthToken();
  }

  private getAuthHeaders(): Record<string, string> {
    // Always get fresh token before generating headers
    this.refreshAuthToken();
    return {
      'Authorization': this.authToken ? `Bearer ${this.authToken}` : 'NA'
    };
  }

  private validateAuth(): boolean {
    // In development, allow requests without auth token
    if (!this.authToken) {
      console.warn('No auth token found - proceeding in development mode');
      // Don't redirect to error page in development
      // this.redirectToErrorPage();
      return true; // Allow the request to proceed
    }
    return true;
  }

  async sendUserQuery(
    msg: string,
    session: string,
    sourceLang: string,
    targetLang: string,
    onStreamData?: (data: string) => void
  ): Promise<ChatResponse> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) {
        return { response: "Authentication error", status: "error" };
      }

      const payload = {
        session_id: session,
        query: msg,
        source_lang: sourceLang,
        target_lang: targetLang,
        user_id: 'anonymous'
      };

      const headers = {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      };

      if (onStreamData) {
        // Handle streaming response
        const response = await fetch(`${this.apiUrl}/api/chat/`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          try {
            // Try to parse as JSON
            const jsonData = JSON.parse(chunk);
            if (jsonData.response) {
              fullResponse = jsonData.response;
              onStreamData(jsonData.response);
            }
          } catch (e) {
            // If not valid JSON, treat as text
            fullResponse += chunk;
            onStreamData(chunk);
          }
        }

        return { response: fullResponse, status: 'success' };
      } else {
        // Regular non-streaming request
        const config = {
          headers: this.getAuthHeaders()
        };
        const response = await this.axiosInstance.post('/api/chat/', payload, config);
        return response.data;
      }
    } catch (error) {
      console.error('Error sending user query:', error);
      throw error;
    }
  }

  async getSuggestions(session: string, targetLang: string = 'mr'): Promise<SuggestionItem[]> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) {
        return [];
      }

      const payload = {
        session_id: session,
        target_lang: targetLang
      };

      const config = {
        headers: this.getAuthHeaders()
      };

      const response = await this.axiosInstance.post('/api/suggest/', payload, config);
      // Backend returns {status, suggestions, session_id}
      return response.data.suggestions.map((item: string) => ({
        question: item
      }));
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  }

  async transcribeAudio(
    audioBase64: string,
    sessionId: string
  ): Promise<TranscriptionResponse> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) {
        return { text: "", lang_code: "", status: "error" };
      }

      const payload = {
        audio_content: audioBase64,
        session_id: sessionId
      };

      // Explicitly set headers for this request
      const config = {
        headers: this.getAuthHeaders()
      };

      const response = await this.axiosInstance.post('/api/transcribe/', payload, config);
      return response.data;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  getTranscript(sessionId: string, text: string, targetLang: string): Promise<AxiosResponse<TTSResponse>> {
    this.refreshAuthToken();
    if (!this.validateAuth()) {
      return Promise.reject(new Error("Authentication required"));
    }

    const config = {
      headers: this.getAuthHeaders()
    };

    return this.axiosInstance.post(`/api/tts/`, {
      session_id: sessionId,
      text: text,
      lang_code: targetLang
    }, config);
  }

  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        } catch (error) {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  setLocationData(location: LocationData): void {
    this.locationData = location;
  }

  getLocationData(): LocationData | null {
    return this.locationData;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  // ATI Chat API Methods
  setConversationId(conversationId: string): void {
    this.currentConversationId = conversationId;
  }

  getConversationId(): string | null {
    return this.currentConversationId;
  }

  getATIUserId(): string {
    return ATI_USER_ID;
  }

  async sendATIChatMessage(
    message: string,
    language: string,
    conversationId?: string
  ): Promise<ATIChatResponse> {
    try {
      const payload: ATIChatRequest = {
        user_id: ATI_USER_ID,
        message,
        language
      };

      // Include conversation_id only if it exists (for continuing conversations)
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await this.atiAxiosInstance.post<ATIChatResponse>(
        '/api/v1/chatbot/chat',
        payload
      );

      // Store the conversation ID for future messages
      if (response.data.conversation_id) {
        this.setConversationId(response.data.conversation_id);
      }

      return response.data;
    } catch (error) {
      console.error('Error sending ATI chat message:', error);
      throw error;
    }
  }

  async getATIConversations(): Promise<ATIConversationsResponse> {
    try {
      const response = await this.atiAxiosInstance.get<ATIConversationsResponse>(
        `/api/v1/chatbot/conversations/${ATI_USER_ID}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting ATI conversations:', error);
      throw error;
    }
  }

  // Helper method to check if using ATI tenant
  isATITenant(): boolean {
    return getCurrentTenant() === 'ATI';
  }

  // ===== NEW ATI VOICE CHAT METHODS (Using transcribe-service) =====

  /**
   * Transcribe audio using Amazon Transcribe (ATI only)
   * @param audioBlob - Audio blob from microphone
   * @param languageCode - Language code (en-US, am-ET, etc.)
   * @returns Transcribed text
   */
  async atiTranscribeAudio(audioBlob: Blob, languageCode: string = 'en-US'): Promise<string> {
    try {
      if (!this.isATITenant()) {
        throw new Error('ATI transcribe service only available for ATI tenant');
      }

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('language_code', languageCode);
      formData.append('wait_for_completion', 'true');

      const response = await this.atiTranscribeInstance.post('/api/asr/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.transcript) {
        return response.data.transcript;
      }

      throw new Error('No transcript in response');
    } catch (error) {
      console.error('Error with ATI transcribe:', error);
      throw error;
    }
  }

  /**
   * Get chat response using ATI Chat API (ATI only)
   * @param message - User message
   * @param language - Language code (en, am, etc.)
   * @param conversationId - Optional conversation ID to continue conversation
   * @returns AI response text
   */
  async atiChatMessage(message: string, language: string = 'en', conversationId?: string): Promise<string> {
    try {
      if (!this.isATITenant()) {
        throw new Error('ATI chat service only available for ATI tenant');
      }

      // Use the proper ATI chat API instead of simple chat endpoint
      const response = await this.sendATIChatMessage(message, language, conversationId);

      if (response && response.assistant_message && response.assistant_message.content) {
        return response.assistant_message.content;
      }

      throw new Error('No response in chat data');
    } catch (error) {
      console.error('Error with ATI chat:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech using Azure TTS (ATI only)
   * @param text - Text to convert
   * @param language - Language code
   * @returns Audio blob
   */
  async atiTextToSpeech(text: string, language: string = 'en'): Promise<Blob> {
    try {
      if (!this.isATITenant()) {
        throw new Error('ATI TTS service only available for ATI tenant');
      }

      // Determine endpoint based on language
      const endpoint = language === 'am' ? '/api/tts/amh/speak' : '/api/tts/speak';

      const response = await this.atiTranscribeInstance.post(endpoint, {
        text: text,
        lang_code: language,
        session_id: this.currentSessionId || undefined
      }, {
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      console.error('Error with ATI TTS:', error);
      throw error;
    }
  }

  /**
   * Complete voice conversation flow: ASR -> Chat -> TTS (ATI only)
   * @param audioBlob - Recorded audio from user
   * @param languageCode - Language for transcription
   * @param conversationId - Optional conversation ID to continue conversation
   * @param onTranscript - Optional callback when transcript is ready
   * @param onResponse - Optional callback when chat response is ready
   * @returns Object with transcript, chat response, and audio blob
   */
  async atiVoiceConversation(
    audioBlob: Blob,
    languageCode: string = 'en-US',
    conversationId?: string,
    onTranscript?: (transcript: string) => void,
    onResponse?: (response: string) => void
  ): Promise<{
    transcript: string;
    response: string;
    audioBlob: Blob;
    conversationId: string;
  }> {
    try {
      if (!this.isATITenant()) {
        throw new Error('ATI voice conversation only available for ATI tenant');
      }

      // Map language code to simple language format (en-US -> en, am-ET -> am)
      const language = languageCode.startsWith('en') ? 'en' : languageCode.split('-')[0];

      // Step 1: Transcribe audio to text
      console.log('Step 1: Transcribing audio...');
      const transcript = await this.atiTranscribeAudio(audioBlob, languageCode);
      console.log('Transcript:', transcript);

      // Immediately notify UI with transcript
      if (onTranscript) {
        onTranscript(transcript);
      }

      // Step 2: Get chat response using ATI Chat API
      console.log('Step 2: Getting chat response from ATI API...');
      const chatApiResponse = await this.sendATIChatMessage(transcript, language, conversationId);
      console.log('Chat response:', chatApiResponse);

      // Extract response text
      const chatResponse = chatApiResponse.assistant_message.content;

      // Immediately notify UI with response
      if (onResponse) {
        onResponse(chatResponse);
      }

      // Step 3: Convert response to speech
      console.log('Step 3: Converting to speech...');
      const responseAudio = await this.atiTextToSpeech(chatResponse, language);
      console.log('Audio generated');

      return {
        transcript,
        response: chatResponse,
        audioBlob: responseAudio,
        conversationId: chatApiResponse.conversation_id
      };
    } catch (error) {
      console.error('Error in ATI voice conversation:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const apiService = new ApiService();
export default apiService;
