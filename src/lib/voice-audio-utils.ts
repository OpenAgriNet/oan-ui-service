/**
 * Voice Audio Utilities
 * AudioWorklet processor and audio conversion utilities for voice chat
 */

/**
 * Creates a Blob URL for the PCM AudioWorklet processor
 * This processor captures audio input and sends it to the main thread
 */
export const createAudioWorkletProcessor = (): string => {
  const processorCode = `
    class PCMProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        // Buffer to accumulate samples before sending
        // At 16kHz: 2048 samples = 128ms of audio (balanced latency/stability)
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }

      process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input.length > 0) {
          const channelData = input[0]; // Get first channel (mono)
          
          // Copy samples to buffer
          for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];
            
            // When buffer is full, send it
            if (this.bufferIndex >= this.bufferSize) {
              // Send a copy of the buffer
              const chunk = this.buffer.slice(0);
              this.port.postMessage(chunk);
              this.bufferIndex = 0;
            }
          }
        }

        return true; // Keep processor alive
      }
    }

    registerProcessor('pcm-processor', PCMProcessor);
  `;

  const blob = new Blob([processorCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

/**
 * Converts Int16Array audio data from server to Float32Array for playback
 * @param arrayBuffer - Raw audio data from server
 * @returns Float32Array normalized to -1.0 to 1.0 range
 */
export const convertInt16ToFloat32 = (arrayBuffer: ArrayBuffer): Float32Array => {
  const audioData = new Int16Array(arrayBuffer);
  const float32Data = new Float32Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
    // Normalize to -1.0 to 1.0 range
    float32Data[i] = audioData[i] / 32768.0;
  }

  return float32Data;
};

/**
 * Draws audio visualization on canvas
 * @param analyser - AnalyserNode from AudioContext
 * @param dataArray - Uint8Array buffer for frequency data
 * @param canvas - Canvas element to draw on
 * @param color - RGB color for bars (default: ATI gold)
 */
export const drawAudioVisualizer = (
  analyser: AnalyserNode,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  color: string = 'rgba(234, 157, 33, 1)' // ATI gold
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Get frequency data
  analyser.getByteFrequencyData(dataArray);

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / dataArray.length) * 2.5;
  let x = 0;

  // Draw bars
  for (let i = 0; i < dataArray.length; i++) {
    const barHeight = dataArray[i] / 2;

    // Extract RGB values and apply opacity based on bar height
    const opacity = barHeight / 100;
    const colorWithOpacity = color.replace('1)', `${opacity})`);

    ctx.fillStyle = colorWithOpacity;
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }
};

/**
 * Creates an AudioContext with optimal settings for voice chat
 * @returns AudioContext configured for 16kHz mono audio
 */
export const createVoiceAudioContext = (): AudioContext => {
  return new AudioContext({ sampleRate: 16000 });
};

/**
 * Gets user microphone with optimal settings for voice chat
 * @returns Promise resolving to MediaStream
 */
export const getMicrophoneStream = async (): Promise<MediaStream> => {
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });
};

/**
 * Cleans up audio resources
 * @param audioContext - AudioContext to close
 * @param mediaStream - MediaStream to stop
 */
export const cleanupAudioResources = (
  audioContext: AudioContext | null,
  mediaStream: MediaStream | null
): void => {
  if (audioContext) {
    audioContext.close();
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
};
