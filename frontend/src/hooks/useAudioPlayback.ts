import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioPlaybackReturn {
  playChunk: (base64Pcm: string) => void;
  stop: () => void;
  isPlaying: boolean;
}

/**
 * Decode a base64 string to an Int16Array.
 * Handles URL-safe base64 and missing padding from Gemini.
 */
function base64ToInt16Array(base64: string): Int16Array {
  let b64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Audio playback using scheduled AudioBufferSourceNodes.
 *
 * Instead of a worklet ring buffer (which loses timing and causes fast/glitchy
 * playback), this schedules each PCM chunk as an AudioBuffer at the correct
 * time in the AudioContext timeline. This is the same approach used by the
 * ADK web dev UI.
 */
export function useAudioPlayback(): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Next time to schedule audio (in AudioContext.currentTime units)
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      // Gemini outputs 24kHz PCM audio
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playChunk = useCallback((base64Pcm: string) => {
    try {
      const int16 = base64ToInt16Array(base64Pcm);
      if (int16.length === 0) return;

      const ctx = getAudioContext();

      // Convert Int16 to Float32 for AudioBuffer
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // Create AudioBuffer
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      // Create source and schedule it
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Schedule at the right time — if we've fallen behind, start now
      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

      // Track active sources for stop()
      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
          setIsPlaying(false);
        }
      };

      setIsPlaying(true);
    } catch {
      // Skip malformed audio chunks
    }
  }, [getAudioContext]);

  const stop = useCallback(() => {
    // Stop all scheduled sources
    for (const source of activeSourcesRef.current) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const source of activeSourcesRef.current) {
        try { source.stop(); } catch { /* already stopped */ }
      }
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
    };
  }, []);

  return { playChunk, stop, isPlaying };
}
