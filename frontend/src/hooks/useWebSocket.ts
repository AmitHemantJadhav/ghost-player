// import { useEffect, useRef, useState, useCallback } from "react";
// import type { PlayerMessage } from "../types/game";
//
// /**
//  * WebSocket hook for bidirectional communication with the Ghost Player backend.
//  *
//  * The backend exposes a WebSocket endpoint that bridges to ADK's run_live(),
//  * enabling real-time audio and video streaming to/from the Gemini Live API.
//  *
//  * Usage:
//  *   const { send, lastMessage, isConnected, connect, disconnect } = useWebSocket();
//  *
//  * Data flow:
//  *   Browser mic/camera → WebSocket → FastAPI → LiveRequestQueue → ADK → Gemini Live API
//  *   Gemini response → ADK → FastAPI → WebSocket → Browser speaker/UI
//  */
//
// interface UseWebSocketOptions {
//   /** WebSocket URL, defaults to ws://localhost:8000/ws */
//   url?: string;
//   /** Auto-reconnect on disconnect */
//   reconnect?: boolean;
//   /** Reconnect delay in ms */
//   reconnectDelay?: number;
// }
//
// interface UseWebSocketReturn {
//   /** Send a message (text, audio chunk, or video frame) to the backend */
//   send: (data: string | ArrayBuffer) => void;
//   /** Last received message from the backend */
//   lastMessage: PlayerMessage | null;
//   /** Whether the WebSocket is currently connected */
//   isConnected: boolean;
//   /** Manually open the connection */
//   connect: () => void;
//   /** Manually close the connection */
//   disconnect: () => void;
// }
//
// export function useWebSocket(_options?: UseWebSocketOptions): UseWebSocketReturn {
//   // TODO: Implement WebSocket connection
//   // 1. Create WebSocket connection to backend
//   // 2. Handle incoming messages (audio responses, game state updates, transcript)
//   // 3. Provide send() for outgoing audio chunks and video frames
//   // 4. Handle reconnection for session resumption (2-min video limit)
//   // 5. Parse incoming messages into PlayerMessage type
//
//   return {
//     send: () => {},
//     lastMessage: null,
//     isConnected: false,
//     connect: () => {},
//     disconnect: () => {},
//   };
// }
