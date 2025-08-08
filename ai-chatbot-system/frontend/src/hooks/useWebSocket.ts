'use client';

import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';
    
    socketRef.current = io(`${wsUrl}/chat`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socketRef.current.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
  };
}