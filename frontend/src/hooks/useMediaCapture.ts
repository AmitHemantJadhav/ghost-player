import { useRef, useState, useCallback, useEffect } from "react";

interface UseMediaCaptureOptions {
  onAudioChunk?: (pcmBuffer: ArrayBuffer) => void;
  onVideoFrame?: (jpegBase64: string) => void;
}

interface UseMediaCaptureReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMicActive: boolean;
  isCameraActive: boolean;
  startMic: () => Promise<void>;
  stopMic: () => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  error: string | null;
}

export function useMediaCapture(options: UseMediaCaptureOptions = {}): UseMediaCaptureReturn {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Mic refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Camera refs
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startMic = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      micStreamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule("/audio-processor.js");

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent) => {
        optionsRef.current.onAudioChunk?.(event.data);
      };

      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);

      setIsMicActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, []);

  const stopMic = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    setIsMicActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Create canvas for JPEG capture
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }

      // Capture frames at 1 FPS
      captureIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        // Strip "data:image/jpeg;base64," prefix
        const base64 = dataUrl.split(",")[1];
        if (base64) {
          optionsRef.current.onVideoFrame?.(base64);
        }
      }, 1000);

      setIsCameraActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = undefined;
    }

    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      stopCamera();
    };
  }, [stopMic, stopCamera]);

  return {
    videoRef,
    isMicActive,
    isCameraActive,
    startMic,
    stopMic,
    startCamera,
    stopCamera,
    error,
  };
}
