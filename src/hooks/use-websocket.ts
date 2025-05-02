
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
  reconnect = false, // Changed default to false to prevent automatic reconnection
  reconnectAttempts = 1, // Reduced to just 1 attempt
  reconnectInterval = 5000,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.Closed);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttemptCount = useRef(0);
  const serverUnavailable = useRef(false); // Track if server is unavailable
  const prevUrlRef = useRef<string | null>(null); // Track previous URL to detect changes
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!url) {
      console.warn('Cannot connect WebSocket: URL is null or undefined');
      return;
    }

    if (serverUnavailable.current) {
      console.warn(`[${new Date().toISOString()}] Server was previously marked as unavailable. Not attempting to connect.`);
      setStatus(WebSocketStatus.Closed);
      return;
    }

    if (ws.current) {
      console.warn('WebSocket connection already exists. Current readyState:', ws.current.readyState);
      return;
    }

    console.log(`[${new Date().toISOString()}] Attempting to connect WebSocket to ${url}`);
    setStatus(WebSocketStatus.Connecting);

    try {
      ws.current = new WebSocket(url);
      console.log(`[${new Date().toISOString()}] WebSocket instance created with URL: ${url}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creating WebSocket:`, error);
      setStatus(WebSocketStatus.Error);
      serverUnavailable.current = true; // Mark server as unavailable if we can't even create the WebSocket
      return;
    }

    ws.current.onopen = (event) => {
      console.log(`[${new Date().toISOString()}] WebSocket connection opened successfully`);
      setStatus(WebSocketStatus.Open);
      reconnectAttemptCount.current = 0; // Reset attempts on successful connection
      if (onOpen) onOpen(event);
    };

    ws.current.onmessage = (event) => {
      console.log(`[${new Date().toISOString()}] WebSocket message received:`, event.data);
      if (onMessage) onMessage(event);
    };

    ws.current.onerror = (event) => {
      console.error(`[${new Date().toISOString()}] WebSocket error:`, event);
      setStatus(WebSocketStatus.Error);
      if (onError) onError(event);
      // Don't automatically close here, let onClose handle it
    };

    ws.current.onclose = (event) => {
      console.log(`[${new Date().toISOString()}] WebSocket connection closed: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`);
      ws.current = null;

      // For any connection closure, mark the server as unavailable to prevent continuous reconnection attempts
      // This is a more aggressive approach to stop the flashing UI and console spam
      serverUnavailable.current = true;

      if (event.wasClean) {
        console.log(`[${new Date().toISOString()}] WebSocket closed cleanly`);
        setStatus(WebSocketStatus.Closed);
      } else {
        // If not clean close, treat as error/unexpected close
        console.warn(`[${new Date().toISOString()}] WebSocket closed unexpectedly with code ${event.code}`);

        // Immediately set to Closed status to prevent any UI flashing between Error and Closed states
        setStatus(WebSocketStatus.Closed);

        // Check if the error is likely due to server not being available
        const isServerUnavailable = event.code === 1006 || event.code === 1015;

        if (isServerUnavailable) {
          console.error(`[${new Date().toISOString()}] WebSocket server appears to be unavailable (code: ${event.code}). Stopping all reconnection attempts.`);
          // Only show toast once to prevent multiple notifications
          if (reconnectAttemptCount.current === 0) {
            toast({
              title: "Server Unavailable",
              description: "The WebSocket server appears to be offline. Please check server status.",
              variant: "destructive",
            });
          }
        } else {
          console.error(`[${new Date().toISOString()}] WebSocket connection failed with code ${event.code}.`);
          // Only show toast once
          if (reconnectAttemptCount.current === 0) {
            toast({
              title: "Connection Failed",
              description: "Could not connect to the WebSocket server.",
              variant: "destructive",
            });
          }
        }

        // Increment reconnect attempt count to track that we've already shown a toast
        reconnectAttemptCount.current++;
      }
      if (onClose) onClose(event);
    };
  }, [url, onMessage, onError, onOpen, onClose, reconnect, reconnectAttempts, reconnectInterval, toast]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      console.log(`[${new Date().toISOString()}] Closing WebSocket connection manually. Current readyState: ${ws.current.readyState}`);
      setStatus(WebSocketStatus.Closing);
      try {
        ws.current.close();
        console.log(`[${new Date().toISOString()}] WebSocket close() method called successfully`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error closing WebSocket:`, error);
      }
      // Status will be set to Closed in the onclose handler
    } else {
      console.log(`[${new Date().toISOString()}] Disconnect called but no WebSocket instance exists`);
    }
  }, []);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] useEffect triggered. URL: ${url ? url : 'null'}, Current status: ${status}`);

    // Only reset serverUnavailable flag when URL changes AND it's a different URL than before
    // This prevents reconnection attempts when the component remounts with the same URL
    const isNewUrl = url !== undefined && url !== null && url !== prevUrlRef.current;

    if (isNewUrl) {
      prevUrlRef.current = url;
      // Only reset if the URL is actually provided and different from before
      serverUnavailable.current = false;
      reconnectAttemptCount.current = 0;
      console.log(`[${new Date().toISOString()}] URL changed to a new value, reset serverUnavailable flag and reconnect count`);

      if (url) {
        console.log(`[${new Date().toISOString()}] URL is present, attempting to connect`);
        // Only attempt one connection
        connect();
      }
    } else if (!url) {
      console.log(`[${new Date().toISOString()}] URL is null/undefined, disconnecting if connected`);
      disconnect();
      setStatus(WebSocketStatus.Closed);
    } else {
      console.log(`[${new Date().toISOString()}] URL unchanged or server previously marked unavailable, not reconnecting automatically`);
    }

    // Cleanup function to disconnect on component unmount or URL change
    return () => {
      console.log(`[${new Date().toISOString()}] useEffect cleanup - disconnecting WebSocket`);
      disconnect();
    };
  }, [url, connect, disconnect]); // Removed status from dependencies to prevent infinite loop

  const sendMessage = useCallback((data: string | ArrayBuffer | Blob) => {
    console.log(`[${new Date().toISOString()}] Attempting to send message. WebSocket exists: ${!!ws.current}`);

    if (ws.current) {
      console.log(`[${new Date().toISOString()}] WebSocket readyState: ${ws.current.readyState} (${
        ws.current.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
        ws.current.readyState === WebSocket.OPEN ? 'OPEN' :
        ws.current.readyState === WebSocket.CLOSING ? 'CLOSING' :
        ws.current.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN'
      })`);
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log(`[${new Date().toISOString()}] Sending WebSocket message:`, data);
      try {
        ws.current.send(data);
        console.log(`[${new Date().toISOString()}] Message sent successfully`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error sending message:`, error);
        toast({
          title: "Send Error",
          description: "Failed to send message due to an error.",
          variant: "destructive",
        });
      }
    } else {
      console.error(`[${new Date().toISOString()}] WebSocket is not open. Cannot send message.`);
      toast({
        title: "Send Error",
        description: "Cannot send message, connection is not open.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Add a method to force reconnection even if server was marked unavailable
  const forceReconnect = useCallback(() => {
    console.log(`[${new Date().toISOString()}] Force reconnect called`);
    // Reset flags
    serverUnavailable.current = false;
    reconnectAttemptCount.current = 0;

    // Disconnect if connected
    if (ws.current) {
      disconnect();
    }

    // Try to connect again
    setTimeout(() => {
      if (url) {
        connect();
      }
    }, 500); // Small delay to ensure disconnect completes
  }, [url, connect, disconnect]);

  return { status, sendMessage, connect, disconnect, forceReconnect };
}
