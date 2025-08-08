'use client';

import { useEffect, useState, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { chatService } from '@/lib/chatService';
import { useWebSocket } from './useWebSocket';
import toast from 'react-hot-toast';

export function useChat() {
  const [isConnected, setIsConnected] = useState(false);
  const { 
    currentSession, 
    addMessage, 
    updateMessage, 
    setLoading, 
    setTyping,
    createSession 
  } = useChatStore();

  const { socket, connected } = useWebSocket();

  useEffect(() => {
    setIsConnected(connected);
  }, [connected]);

  const sendMessage = useCallback(async (content: string, options?: { mode?: 'exact' | 'ai' | 'hybrid' }) => {
    try {
      // Ensure we have a session
      let sessionId = currentSession?.id;
      if (!sessionId) {
        const newSession = createSession();
        sessionId = newSession.id;
      }

      // Add user message
      addMessage({
        role: 'user',
        content,
      });

      setLoading(true);
      setTyping(true);

      // Get user ID from localStorage or generate anonymous ID
      const userId = localStorage.getItem('userId') || (() => {
        const anonymousId = `user-${Date.now()}`;
        localStorage.setItem('userId', anonymousId);
        return anonymousId;
      })();

      // Send via WebSocket if connected, otherwise use HTTP
      if (socket && connected) {
        socket.emit('message', {
          message: content,
          sessionId,
          userId,
          metadata: {
            mode: options?.mode || 'ai',
          },
        });

        // Listen for response
        socket.once('response', (response) => {
          addMessage({
            role: 'assistant',
            content: response.content,
            emotion: response.emotion,
            confidence: response.confidence,
            media: response.media,
            metadata: response.metadata,
          });
          setTyping(false);
          setLoading(false);
        });

        socket.once('error', (_error) => {
          toast.error('Failed to get response');
          setTyping(false);
          setLoading(false);
        });
      } else {
        // Fallback to HTTP
        const userId = localStorage.getItem('userId') || (() => {
          const anonymousId = `user-${Date.now()}`;
          localStorage.setItem('userId', anonymousId);
          return anonymousId;
        })();
        
        const response = await chatService.sendMessage({
          message: content,
          sessionId,
          userId,
          metadata: {
            mode: options?.mode || 'ai',
          },
        });

        addMessage({
          role: 'assistant',
          content: response.content,
          emotion: response.emotion,
          confidence: response.confidence,
          media: response.media,
          metadata: response.metadata,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
      setTyping(false);
    }
  }, [currentSession, socket, connected, addMessage, setLoading, setTyping, createSession]);

  const streamMessage = useCallback(async (content: string) => {
    if (!socket || !connected) {
      return sendMessage(content);
    }

    try {
      let sessionId = currentSession?.id;
      if (!sessionId) {
        const newSession = createSession();
        sessionId = newSession.id;
      }

      // Add user message
      addMessage({
        role: 'user',
        content,
      });

      setLoading(true);
      setTyping(true);

      // Create placeholder for streaming message
      const tempMessageId = Date.now().toString();
      addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      socket.emit('stream', {
        message: content,
        sessionId,
        userId: 'user-1',
      });

      let streamedContent = '';

      socket.on('stream-chunk', (chunk: string) => {
        streamedContent += chunk;
        updateMessage(tempMessageId, streamedContent);
      });

      socket.once('stream-end', () => {
        setTyping(false);
        setLoading(false);
      });

      socket.once('stream-error', (_error) => {
        toast.error('Stream failed');
        setTyping(false);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error streaming message:', error);
      toast.error('Failed to stream message');
      setLoading(false);
      setTyping(false);
    }
  }, [currentSession, socket, connected, addMessage, updateMessage, setLoading, setTyping, createSession, sendMessage]);

  return {
    sendMessage,
    streamMessage,
    isConnected,
  };
}