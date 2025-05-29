import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type Keycloak from 'keycloak-js';

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

class ApiService {
  private apiUrl: string = 'https://vistaar.kenpath.ai';
  private locationData: LocationData | null = null;
  private currentSessionId: string | null = null;
  private axiosInstance: AxiosInstance;
  private keycloak: Keycloak | null = null;

  setKeycloakInstance(keycloak: Keycloak | null) {
    this.keycloak = keycloak;
  }

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (this.keycloak) {
          if (this.keycloak.updateToken) {
            try {
              await this.keycloak.updateToken(10);
            } catch (e) {
              console.error('Failed to refresh token', e);
            }
          }
          if (this.keycloak.token) {
            if (config.headers) {
              (config.headers as Record<string, string>)["Authorization"] = `Bearer ${this.keycloak.token}`;
              console.log('Attaching Authorization header:', config.headers["Authorization"]);
            }
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  async sendUserQuery(
    msg: string,
    session: string,
    sourceLang: string,
    targetLang: string,
    onStreamData?: (data: string) => void
  ): Promise<ChatResponse> {
    try {
      const params = {
        session_id: session,
        query: msg,
        source_lang: sourceLang,
        target_lang: targetLang,
        ...(this.locationData && { location: `${this.locationData.latitude},${this.locationData.longitude}` })
      };

      if (onStreamData) {
        // Handle streaming response
        const headers: Record<string, string> = {};
        if (this.keycloak && this.keycloak.token) {
          headers["Authorization"] = `Bearer ${this.keycloak.token}`;
        }
        const response = await fetch(`${this.apiUrl}/api/chat/?${new URLSearchParams(params)}`, {
          method: 'GET',
          headers,
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
        const response = await this.axiosInstance.get('/api/chat/', { params });
        return response.data;
      }
    } catch (error) {
      console.error('Error sending user query:', error);
      throw error;
    }
  }

  async getSuggestions(session: string, targetLang: string = 'mr'): Promise<SuggestionItem[]> {
    try {
      const params = {
        session_id: session,
        target_lang: targetLang
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.keycloak && this.keycloak.token) {
        headers["Authorization"] = `Bearer ${this.keycloak.token}`;
      }
      const url = `${this.apiUrl}/api/suggest/?${new URLSearchParams(params)}`;
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.map((item: string) => ({ question: item }));
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  }

  async transcribeAudio(
    audioBase64: string,
    serviceType: string = 'whisper',
    sessionId: string
  ): Promise<TranscriptionResponse> {
    try {
      const payload = {
        audio_content: audioBase64,
        service_type: serviceType,
        session_id: sessionId
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.keycloak && this.keycloak.token) {
        headers["Authorization"] = `Bearer ${this.keycloak.token}`;
      }
      const response = await fetch(`${this.apiUrl}/api/transcribe/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  async getTranscript(sessionId: string, text: string, targetLang: string): Promise<TTSResponse> {
    const payload = {
      session_id: sessionId,
      text: text,
      target_lang: targetLang
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.keycloak && this.keycloak.token) {
      headers["Authorization"] = `Bearer ${this.keycloak.token}`;
    }
    const response = await fetch(`${this.apiUrl}/api/tts/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
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
}

// Create a singleton instance
const apiService = new ApiService();
export default apiService; 