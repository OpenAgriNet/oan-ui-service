import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createAudioWorkletProcessor,
  convertInt16ToFloat32,
  drawAudioVisualizer,
  createVoiceAudioContext,
  getMicrophoneStream,
  cleanupAudioResources,
} from '@/lib/voice-audio-utils';
import type { AudioChunk, UseVoiceAudioReturn } from '@/types/voice-chat.types';

/**
 * Custom hook for managing voice audio recording and playback
 * Handles microphone input, audio visualization, and playback queue
 */
export const useVoiceAudio = (): UseVoiceAudioReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Audio recording refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Audio playback refs
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackQueueRef = useRef<AudioChunk[]>([]);
  const isPlayingAudioRef = useRef(false);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  /**
   * Draws audio visualization on canvas
   */
  const drawVisualizer = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !canvasRef.current) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);

    drawAudioVisualizer(
      analyserRef.current,
      dataArrayRef.current,
      canvasRef.current,
      'rgba(234, 157, 33, 1)' // ATI gold
    );
  }, []);

  /**
   * Starts audio recording and streams to WebSocket
   * @param onAudioData - Callback to send audio chunks
   */
  const startRecording = useCallback(async (onAudioData: (data: ArrayBuffer) => void) => {
    try {
      // Create audio context
      const audioContext = createVoiceAudioContext();

      // Create and load AudioWorklet processor
      const processorUrl = createAudioWorkletProcessor();
      await audioContext.audioWorklet.addModule(processorUrl);

      // Get microphone stream
      const mediaStream = await getMicrophoneStream();

      // Create audio source
      const source = audioContext.createMediaStreamSource(mediaStream);

      // Create analyser for visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      // Create AudioWorklet node
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        // Send Float32Array buffer to WebSocket
        onAudioData(event.data.buffer);
      };

      // Connect audio graph
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      // Store refs
      audioContextRef.current = audioContext;
      workletNodeRef.current = workletNode;
      sourceRef.current = source;
      mediaStreamRef.current = mediaStream;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Start visualization
      drawVisualizer();

      // Clean up processor URL
      URL.revokeObjectURL(processorUrl);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }, [drawVisualizer]);

  /**
   * Stops audio recording and cleans up resources
   */
  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    cleanupAudioResources(audioContextRef.current, mediaStreamRef.current);

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    // Reset refs
    audioContextRef.current = null;
    workletNodeRef.current = null;
    sourceRef.current = null;
    mediaStreamRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;

    setIsRecording(false);
  }, []);

  /**
   * Processes audio playback queue sequentially
   */
  const processAudioQueue = useCallback(async () => {
    if (audioPlaybackQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      return;
    }

    isPlayingAudioRef.current = true;

    const { arrayBuffer, resolve } = audioPlaybackQueueRef.current.shift()!;

    // Create playback audio context if needed
    if (!playbackAudioContextRef.current) {
      playbackAudioContextRef.current = createVoiceAudioContext();
    }

    const audioContext = playbackAudioContextRef.current;

    // Convert Int16Array to Float32Array
    const float32Data = convertInt16ToFloat32(arrayBuffer);

    // Create audio buffer
    const buffer = audioContext.createBuffer(1, float32Data.length, 16000);
    buffer.copyToChannel(float32Data, 0);

    // Create and play buffer source
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(audioContext.destination);

    currentAudioSourceRef.current = bufferSource;

    bufferSource.onended = () => {
      currentAudioSourceRef.current = null;
      resolve();
      processAudioQueue();
    };

    bufferSource.start();
  }, []);

  /**
   * Adds audio chunk to playback queue
   * @param arrayBuffer - Audio data from server
   */
  const playAudio = useCallback(
    async (arrayBuffer: ArrayBuffer): Promise<void> => {
      return new Promise<void>((resolve) => {
        audioPlaybackQueueRef.current.push({ arrayBuffer, resolve });
        if (!isPlayingAudioRef.current) {
          processAudioQueue();
        }
      });
    },
    [processAudioQueue]
  );

  /**
   * Clears audio playback queue and stops current playback
   */
  const clearAudioQueue = useCallback(() => {
    audioPlaybackQueueRef.current = [];
    isPlayingAudioRef.current = false;

    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      } catch (e) {
        console.warn('Audio source already stopped');
      }
      currentAudioSourceRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      clearAudioQueue();
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close();
      }
    };
  }, [stopRecording, clearAudioQueue]);

  return {
    startRecording,
    stopRecording,
    playAudio,
    clearAudioQueue,
    audioLevel,
    canvasRef,
    isRecording,
  };
};
