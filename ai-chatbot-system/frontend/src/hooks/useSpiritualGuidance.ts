'use client';

import { useState, useCallback } from 'react';
import { spiritualGuidanceService, SpiritualGuidanceRequest, SpiritualGuidanceResponse } from '@/lib/spiritualGuidanceService';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: any[];
  spiritualDisease?: any;
  citationLevel?: string;
  qualityScore?: number;
  metadata?: any;
}

interface SpiritualGuidanceOptions {
  mode?: 'guidance' | 'learning' | 'analysis';
  includeCitations?: boolean;
  includeQuality?: boolean;
}

export function useSpiritualGuidance() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Assume connected for now
  const [lastResponse, setLastResponse] = useState<SpiritualGuidanceResponse | null>(null);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const sendGuidanceMessage = useCallback(async (
    content: string,
    options: SpiritualGuidanceOptions = {}
  ) => {
    try {
      // Add user message
      const userMessage = addMessage({
        role: 'user',
        content,
      });

      setIsLoading(true);

      // Prepare conversation history
      const conversationHistory = messages
        .filter(m => m.role === 'user')
        .slice(-5) // Last 5 user messages for context
        .map(m => m.content);

      // Create request
      const request: SpiritualGuidanceRequest = {
        message: content,
        conversationHistory,
      };

      // Get spiritual guidance response
      const response = await spiritualGuidanceService.getSpiritualGuidance(request);

      setLastResponse(response);

      // Add assistant message
      const assistantMessage = addMessage({
        role: 'assistant',
        content: response.response,
        citations: response.citations,
        spiritualDisease: response.spiritualDisease,
        citationLevel: response.citationLevel,
        qualityScore: response.metadata?.qualityScore,
        metadata: response.metadata,
      });

      return { userMessage, assistantMessage, response };
    } catch (error) {
      console.error('Error sending spiritual guidance message:', error);
      toast.error('Failed to get spiritual guidance');

      // Add error message
      addMessage({
        role: 'assistant',
        content: "I'm sorry, I'm having trouble providing spiritual guidance right now. Please try again later.",
        metadata: { error: true },
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, addMessage]);

  const analyzeEmotion = useCallback(async (message: string) => {
    try {
      return await spiritualGuidanceService.analyzeEmotion(message);
    } catch (error) {
      console.error('Error analyzing emotion:', error);
      toast.error('Failed to analyze emotional state');
      return null;
    }
  }, []);

  const getSpiritualDiseases = useCallback(async () => {
    try {
      return await spiritualGuidanceService.getSpiritualDiseases();
    } catch (error) {
      console.error('Error getting spiritual diseases:', error);
      toast.error('Failed to load spiritual diseases');
      return [];
    }
  }, []);

  const testCitationMatching = useCallback(async (message: string, emotion?: string) => {
    try {
      return await spiritualGuidanceService.testCitationMatching(message, emotion);
    } catch (error) {
      console.error('Error testing citation matching:', error);
      toast.error('Failed to test citation matching');
      return null;
    }
  }, []);

  const analyzeEmotionalPatterns = useCallback(async () => {
    try {
      const userMessages = messages
        .filter(m => m.role === 'user')
        .map(m => m.content);

      if (userMessages.length < 2) {
        toast.info('Need at least 2 messages to analyze patterns');
        return [];
      }

      return await spiritualGuidanceService.analyzeEmotionalPatterns(userMessages);
    } catch (error) {
      console.error('Error analyzing emotional patterns:', error);
      toast.error('Failed to analyze emotional patterns');
      return [];
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastResponse(null);
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, ...updates } : m
    ));
  }, []);

  return {
    messages,
    isLoading,
    isConnected,
    lastResponse,
    sendGuidanceMessage,
    analyzeEmotion,
    getSpiritualDiseases,
    testCitationMatching,
    analyzeEmotionalPatterns,
    addMessage,
    clearMessages,
    removeMessage,
    updateMessage,
  };
}