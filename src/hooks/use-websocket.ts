
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export enum WebSocketStatus {
  Connecting = 'Connecting',
  Open = 'Open',
  Closing = 'Closing',
  Closed = 'Closed',
  Error = 'Error',
}

interface UseWebSocketOptions {
  url: string | null;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number; // in milliseconds
}

export function useWebSocket({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  reconnect = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.Closed);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttemptCount = useRef(0);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!url || ws.current) return;

    console.log(`Attempting to connect WebSocket to ${url}`);
    setStatus(WebSocketStatus.Connecting);
    ws.current = new WebSocket(url);

    ws.current.onopen = (event) => {
      console.log('WebSocket connection opened');
      setStatus(WebSocketStatus.Open);
      reconnectAttemptCount.current = 0; // Reset attempts on successful connection
      if (onOpen) onOpen(event);
    };

    ws.current.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      if (onMessage) onMessage(event);
    };

    ws.current.onerror = (event) => {
      console.error('WebSocket error:', event);
      setStatus(WebSocketStatus.Error);
      if (onError) onError(event);
      // Don't automatically close here, let onClose handle it
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      ws.current = null;
      if (event.wasClean) {
        setStatus(WebSocketStatus.Closed);
      } else {
        // If not clean close, treat as error/unexpected close
        setStatus(WebSocketStatus.Error);
        if (reconnect && reconnectAttemptCount.current < reconnectAttempts) {
          reconnectAttemptCount.current++;
          console.log(`WebSocket closed unexpectedly. Reconnecting attempt ${reconnectAttemptCount.current}/${reconnectAttempts}...`);
          toast({
            title: "Connection Issue",
            description: `Trying to reconnect... Attempt ${reconnectAttemptCount.current}`,
            variant: "destructive",
          });
          setTimeout(connect, reconnectInterval);
        } else if (reconnect) {
           console.error(`WebSocket reconnection failed after ${reconnectAttempts} attempts.`);
           toast({
             title: "Connection Failed",
             description: "Could not reconnect to the server.",
             variant: "destructive",
           });
           setStatus(WebSocketStatus.Closed); // Set to Closed after max attempts
        } else {
           setStatus(WebSocketStatus.Closed);
        }
      }
      if (onClose) onClose(event);
    };
  }, [url, onMessage, onError, onOpen, onClose, reconnect, reconnectAttempts, reconnectInterval, toast]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      console.log('Closing WebSocket connection manually.');
      setStatus(WebSocketStatus.Closing);
      ws.current.close();
      // Status will be set to Closed in the onclose handler
    }
  }, []);

  useEffect(() => {
    if (url) {
      connect();
    } else {
      disconnect();
      setStatus(WebSocketStatus.Closed);
    }

    // Cleanup function to disconnect on component unmount or URL change
    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  const sendMessage = useCallback((data: string | ArrayBuffer | Blob) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', data);
      ws.current.send(data);
    } else {
      console.error('WebSocket is not open. Cannot send message.');
      toast({
        title: "Send Error",
        description: "Cannot send message, connection is not open.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return { status, sendMessage, connect, disconnect };
}
