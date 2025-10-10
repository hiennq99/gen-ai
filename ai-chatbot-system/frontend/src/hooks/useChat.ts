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
    createSession,
    fetchSessions,
    updateSessionId
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
        console.log('🆕 Created new session:', sessionId);
      } else {
        console.log('📌 Using existing session:', sessionId);
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
      console.log('🔌 WebSocket status:', { socket: !!socket, connected, isConnected });
      // TEMPORARILY DISABLE WEBSOCKET DUE TO CONNECTION ISSUES - USE HTTP ONLY
      if (false && socket && connected) {
        console.log('📡 Using WebSocket to send message');

        // Listen for response with timeout fallback
        let responseReceived = false;
        let messageSent = false;

        const responseTimeout = setTimeout(async () => {
          if (!responseReceived && !messageSent) {
            console.log('⏰ WebSocket response timeout, falling back to HTTP');
            try {
              const response = await chatService.sendMessage({
                message: content,
                sessionId,
                userId,
                metadata: {
                  mode: options?.mode || 'ai',
                },
              });

              console.log('📩 HTTP Fallback Response received:', response);
              addMessage({
                role: 'assistant',
                content: response.content,
                emotion: response.emotion,
                confidence: response.confidence,
                media: response.media,
                metadata: response.metadata,
              });
              console.log('✅ Assistant message added to store (fallback)');
              setTimeout(() => fetchSessions(), 500);
            } catch (fallbackError) {
              console.error('❌ HTTP fallback failed:', fallbackError);
              toast.error('Failed to get response');
            }
            setTyping(false);
            setLoading(false);
          }
        }, 3000); // Reduced to 3 seconds

        // Only send via WebSocket if we haven't timed out
        setTimeout(() => {
          if (!responseReceived && socket) {
            messageSent = true;
            socket!.emit('message', {
              message: content,
              sessionId,
              userId,
              metadata: {
                mode: options?.mode || 'ai',
              },
            });
            console.log('📡 WebSocket message sent');
          }
        }, 100); // Small delay to set up listeners first

        if (socket) {
          socket!.once('response', (response) => {
            responseReceived = true;
            clearTimeout(responseTimeout);
            console.log('📡 WebSocket Response received:', response);
            addMessage({
              role: 'assistant',
              content: response.content,
              emotion: response.emotion,
              confidence: response.confidence,
              media: response.media,
              metadata: response.metadata,
            });
            setTimeout(() => fetchSessions(), 500);
            setTyping(false);
            setLoading(false);
          });

          socket!.once('error', async (_error) => {
            responseReceived = true;
            clearTimeout(responseTimeout);
            console.log('❌ WebSocket error, falling back to HTTP');
            try {
              const response = await chatService.sendMessage({
                message: content,
                sessionId,
                userId,
                metadata: {
                  mode: options?.mode || 'ai',
                },
              });

              console.log('📩 HTTP Error Fallback Response received:', response);
              addMessage({
                role: 'assistant',
                content: response.content,
                emotion: response.emotion,
                confidence: response.confidence,
                media: response.media,
                metadata: response.metadata,
              });
              console.log('✅ Assistant message added to store (error fallback)');
              setTimeout(() => fetchSessions(), 500);
            } catch (fallbackError) {
              console.error('❌ HTTP error fallback failed:', fallbackError);
              toast.error('Failed to get response');
            }
            setTyping(false);
            setLoading(false);
          });
        }
      } else {
        // Fallback to HTTP
        console.log('🌐 Using HTTP fallback to send message');
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

        console.log('📩 HTTP Response received:', response);

        // Update sessionId if backend provided a different one
        if (response.metadata?.sessionId && response.metadata.sessionId !== sessionId) {
          console.log(`🔄 Updating sessionId from ${sessionId} to ${response.metadata.sessionId}`);
          updateSessionId(sessionId, response.metadata.sessionId);
        }

        addMessage({
          role: 'assistant',
          content: response.content,
          emotion: response.emotion,
          confidence: response.confidence,
          media: response.media,
          metadata: response.metadata,
        });
        console.log('✅ Assistant message added to store');

        // Refresh conversations list to show new conversation
        // Add small delay to ensure backend has saved the conversation
        setTimeout(() => {
          console.log('🔄 Fetching sessions after message sent...');
          fetchSessions();
        }, 500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
      setTyping(false);
    }
  }, [currentSession, socket, connected, isConnected, addMessage, setLoading, setTyping, createSession, fetchSessions, updateSessionId]);

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