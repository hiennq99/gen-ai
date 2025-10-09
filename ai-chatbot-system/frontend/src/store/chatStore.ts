import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { conversationService } from '@/lib/conversationService';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: string; // Primary emotion for backward compatibility
  emotions?: string[]; // Multiple detected emotions
  emotionAnalysis?: {
    primaryEmotion: string;
    secondaryEmotions?: string[];
    intensity?: 'low' | 'medium' | 'high';
    confidence?: number;
    aiEnhanced?: boolean;
  };
  emotionTags?: {
    inputEmotions: string[];
    responseEmotions: string[];
    empathyLevel: 'low' | 'medium' | 'high';
    responseStyle: {
      tone: string;
      formality: 'casual' | 'neutral' | 'formal';
      supportLevel: 'basic' | 'supportive' | 'highly_supportive';
    };
  };
  confidence?: number;
  media?: Array<{
    type: string;
    url?: string;
    content?: string;
    caption?: string;
  }>;
  metadata?: {
    documentsUsed?: number;
    documents?: Array<{
      title: string;
      relevanceScore: string;
      excerpt: string;
    }>;
    contextInfo?: {
      totalDocuments: number;
      contextUsed: boolean;
      message: string;
    };
    [key: string]: any;
  };
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  isLoading: boolean;
  isTyping: boolean;

  // Actions
  createSession: (title?: string) => ChatSession;
  setCurrentSession: (sessionId: string) => void;
  updateSessionId: (oldSessionId: string, newSessionId: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, content: string) => void;
  deleteSession: (sessionId: string) => void;
  clearSessions: () => void;
  setLoading: (loading: boolean) => void;
  setTyping: (typing: boolean) => void;
  fetchSessions: (userId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      currentSession: null,
      isLoading: false,
      isTyping: false,

      createSession: (title?: string) => {
        const newSession: ChatSession = {
          id: uuidv4(),
          title: title || 'New Conversation',  // Will be updated with first message
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id,
          currentSession: newSession,
        }));

        return newSession;
      },

      setCurrentSession: (sessionId: string) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (session) {
          set({
            currentSessionId: sessionId,
            currentSession: session,
          });
        }
      },

      updateSessionId: (oldSessionId: string, newSessionId: string) => {
        set((state) => {
          // Update session ID in sessions array
          const updatedSessions = state.sessions.map((s) =>
            s.id === oldSessionId ? { ...s, id: newSessionId } : s
          );

          // Update current session if it's the one being changed
          const updatedCurrentSession = state.currentSessionId === oldSessionId && state.currentSession
            ? { ...state.currentSession, id: newSessionId }
            : state.currentSession;

          const updatedCurrentSessionId = state.currentSessionId === oldSessionId
            ? newSessionId
            : state.currentSessionId;

          return {
            sessions: updatedSessions,
            currentSession: updatedCurrentSession,
            currentSessionId: updatedCurrentSessionId,
          };
        });
      },

      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: uuidv4(),
          timestamp: new Date(),
          // Extract emotionAnalysis from metadata if it exists
          emotionAnalysis: message.metadata?.emotionAnalysis || message.emotionAnalysis,
        };

        set((state) => {
          if (!state.currentSession) {
            const newSession = get().createSession();
            return {
              ...state,
              currentSession: {
                ...newSession,
                messages: [newMessage],
                updatedAt: new Date(),
              },
              sessions: state.sessions.map((s) =>
                s.id === newSession.id
                  ? { ...s, messages: [newMessage], updatedAt: new Date() }
                  : s
              ),
            };
          }

          const updatedSession = {
            ...state.currentSession,
            messages: [...state.currentSession.messages, newMessage],
            updatedAt: new Date(),
          };

          // Update session title with first user message
          if (message.role === 'user' && state.currentSession.messages.length === 0) {
            updatedSession.title = message.content.substring(0, 100) || 'New Chat';
          }

          return {
            ...state,
            currentSession: updatedSession,
            sessions: state.sessions.map((s) =>
              s.id === state.currentSessionId ? updatedSession : s
            ),
          };
        });
      },

      updateMessage: (messageId: string, content: string) => {
        set((state) => {
          if (!state.currentSession) return state;

          const updatedMessages = state.currentSession.messages.map((msg) =>
            msg.id === messageId ? { ...msg, content } : msg
          );

          const updatedSession = {
            ...state.currentSession,
            messages: updatedMessages,
            updatedAt: new Date(),
          };

          return {
            ...state,
            currentSession: updatedSession,
            sessions: state.sessions.map((s) =>
              s.id === state.currentSessionId ? updatedSession : s
            ),
          };
        });
      },

      deleteSession: (sessionId: string) => {
        set((state) => {
          const filteredSessions = state.sessions.filter((s) => s.id !== sessionId);
          const isCurrentSession = state.currentSessionId === sessionId;

          return {
            ...state,
            sessions: filteredSessions,
            currentSessionId: isCurrentSession ? null : state.currentSessionId,
            currentSession: isCurrentSession ? null : state.currentSession,
          };
        });
      },

      clearSessions: () => {
        set({
          sessions: [],
          currentSessionId: null,
          currentSession: null,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setTyping: (typing: boolean) => {
        set({ isTyping: typing });
      },

      fetchSessions: async (userId?: string) => {
        try {
          set({ isLoading: true });
          console.log('📡 Fetching conversations from backend...');
          const conversations = await conversationService.getAllConversations({ userId });
          console.log(`✅ Received ${conversations?.length || 0} conversations from backend`);

          // Check if conversations is an array
          if (!Array.isArray(conversations)) {
            console.warn('No conversations found or invalid response');
            set({ sessions: [], isLoading: false });
            return;
          }

          // Backend already groups by session and sorts correctly
          // Just transform to local format
          const sessions: ChatSession[] = conversations
            .filter((conv: any) => conv && conv.sessionId)
            .map((conv: any) => {
              const startedAt = conv.startedAt ? new Date(conv.startedAt) : new Date();

              // Backend already provides messages array
              const messages: Message[] = (conv.messages || []).map((msg: any) => ({
                id: uuidv4(),
                role: msg.role as 'user' | 'assistant',
                content: msg.content || '',
                timestamp: new Date(msg.timestamp),
                emotion: msg.emotion,
                emotionAnalysis: msg.emotionAnalysis,
                emotionTags: msg.emotionTags,
                confidence: msg.confidence,
                media: msg.media || [],
                metadata: msg.metadata,
              }));

              return {
                id: conv.sessionId,
                title: conv.title || 'Chat Session',
                messages,
                createdAt: startedAt,
                updatedAt: startedAt,
              };
            });

          // Backend already sorted by startedAt desc, keep that order
          console.log(`💾 Stored ${sessions.length} sessions in state`);
          set({ sessions, isLoading: false });
        } catch (error) {
          console.error('Error fetching sessions:', error);
          set({ isLoading: false });
        }
      },

      loadSession: async (sessionId: string) => {
        try {
          set({ isLoading: true });
          const conversation = await conversationService.getConversation(sessionId);

          if (conversation) {
            // Transform to local session format
            const messages: Message[] = [];
            let sessionTitle = 'Chat Session';

            // Handle new response format with title and messages array
            const conversationData = conversation.messages || conversation;
            sessionTitle = conversation.title || sessionTitle;

            if (Array.isArray(conversationData)) {
              // New format: messages array already contains user and assistant messages
              conversationData.forEach((msg: any) => {
                if (msg && msg.content) {
                  messages.push({
                    id: uuidv4(),
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content || '',
                    timestamp: new Date(msg.timestamp || Date.now()),
                    emotion: msg.emotion,
                    emotionAnalysis: msg.emotionAnalysis,
                    emotionTags: msg.emotionTags,
                    confidence: msg.confidence,
                    metadata: msg.metadata,
                    media: msg.media || [],
                  });
                }
              });
            }

            // Fallback title generation if not provided
            if (!conversation.title) {
              const firstUserMessage = messages.find(m => m.role === 'user');
              sessionTitle = firstUserMessage?.content ?
                (firstUserMessage.content.length > 50 ?
                  firstUserMessage.content.substring(0, 50) + '...' :
                  firstUserMessage.content) :
                'Chat Session';
            }

            const session: ChatSession = {
              id: sessionId,
              title: sessionTitle,
              messages,
              createdAt: messages[0]?.timestamp || new Date(),
              updatedAt: messages[messages.length - 1]?.timestamp || new Date(),
            };

            set((state) => {
              const existingIndex = state.sessions.findIndex(s => s.id === sessionId);
              const newSessions = [...state.sessions];
              
              if (existingIndex >= 0) {
                newSessions[existingIndex] = session;
              } else {
                newSessions.unshift(session);
              }

              return {
                sessions: newSessions,
                currentSessionId: sessionId,
                currentSession: session,
                isLoading: false,
              };
            });
          }
        } catch (error) {
          console.error('Error loading session:', error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);