import { useRef, useState, useCallback } from "react";
import type { TranscriptEntry } from "../types/game";

/**
 * Encode an ArrayBuffer to a base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface UseWebSocketOptions {
  onAudioChunk?: (base64Pcm: string) => void;
  onTranscript?: (entry: TranscriptEntry) => void;
}

interface UseWebSocketReturn {
  sendAudio: (pcm16Data: ArrayBuffer) => void;
  sendImage: (jpegBase64: string) => void;
  sendText: (text: string) => void;
  isConnected: boolean;
  connect: (userId: string, sessionId: string) => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const connectParamsRef = useRef<{ userId: string; sessionId: string } | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track streaming transcript entries by a simple counter for agent output
  const agentTranscriptIdRef = useRef<string | null>(null);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const sendAudio = useCallback((pcm16Data: ArrayBuffer) => {
    const b64 = arrayBufferToBase64(pcm16Data);
    send(JSON.stringify({
      blob: { data: b64, mime_type: "audio/pcm;rate=16000" },
    }));
  }, [send]);

  const sendImage = useCallback((jpegBase64: string) => {
    send(JSON.stringify({
      blob: { data: jpegBase64, mime_type: "image/jpeg" },
    }));
  }, [send]);

  const sendText = useCallback((text: string) => {
    send(JSON.stringify({
      content: { parts: [{ text }] },
    }));
  }, [send]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    connectParamsRef.current = null;
    reconnectAttemptsRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Handle content parts (audio + text)
      if (data.content?.parts) {
        for (const part of data.content.parts) {
          // Audio chunk — inlineData with audio MIME
          if (part.inlineData?.mimeType?.startsWith("audio/")) {
            try {
              optionsRef.current.onAudioChunk?.(part.inlineData.data);
            } catch {
              // Skip malformed audio chunks
            }
          }
          // Text content from agent
          if (typeof part.text === "string" && part.text) {
            if (!agentTranscriptIdRef.current) {
              agentTranscriptIdRef.current = crypto.randomUUID();
            }
            optionsRef.current.onTranscript?.({
              id: agentTranscriptIdRef.current,
              sender: "ghost_player",
              content: part.text,
              timestamp: Date.now(),
              finished: false,
            });
          }
        }
      }

      // Input transcription — {text: string, finished: bool}
      if (data.inputTranscription?.text) {
        optionsRef.current.onTranscript?.({
          id: crypto.randomUUID(),
          sender: "player",
          content: data.inputTranscription.text,
          timestamp: Date.now(),
          finished: !!data.inputTranscription.finished,
        });
      }

      // Output transcription — {text: string, finished: bool}
      if (data.outputTranscription?.text) {
        if (!agentTranscriptIdRef.current) {
          agentTranscriptIdRef.current = crypto.randomUUID();
        }
        optionsRef.current.onTranscript?.({
          id: agentTranscriptIdRef.current,
          sender: "ghost_player",
          content: data.outputTranscription.text,
          timestamp: Date.now(),
          finished: !!data.outputTranscription.finished,
        });
        if (data.outputTranscription.finished) {
          agentTranscriptIdRef.current = null;
        }
      }

      // Turn complete (boolean) — finalize any in-progress transcript
      if (data.turnComplete === true) {
        if (agentTranscriptIdRef.current) {
          optionsRef.current.onTranscript?.({
            id: agentTranscriptIdRef.current,
            sender: "ghost_player",
            content: "",
            timestamp: Date.now(),
            finished: true,
          });
          agentTranscriptIdRef.current = null;
        }
      }
    } catch {
      // Non-JSON or unparseable — ignore
    }
  }, []);

  const connect = useCallback((userId: string, sessionId: string) => {
    // Store params for reconnection
    connectParamsRef.current = { userId, sessionId };
    reconnectAttemptsRef.current = 0;

    const doConnect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const url = `${protocol}//${host}/run_live?app_name=ghost_player&user_id=${userId}&session_id=${sessionId}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Don't auto-reconnect on policy violations (1008) or session errors (1002)
        // — these are permanent failures, not transient disconnects
        const noRetry = event.code === 1008 || event.code === 1002 || event.code === 1011;
        if (!noRetry && connectParamsRef.current && reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          reconnectTimerRef.current = setTimeout(doConnect, 2000);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    };

    doConnect();
  }, [handleMessage]);

  return {
    sendAudio,
    sendImage,
    sendText,
    isConnected,
    connect,
    disconnect,
  };
}
