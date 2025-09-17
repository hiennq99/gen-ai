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

      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: uuidv4(),
          timestamp: new Date(),
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
          const conversations = await conversationService.getAllConversations({ userId });
          
          // Check if conversations is an array
          if (!Array.isArray(conversations)) {
            console.warn('No conversations found or invalid response');
            set({ sessions: [], isLoading: false });
            return;
          }
          
          // Transform backend conversations to local session format
          const sessions: ChatSession[] = conversations
            .filter((conv: any) => conv && conv.sessionId) // Filter out invalid entries
            .map((conv: any) => {
              const createdAt = conv.createdAt ? new Date(conv.createdAt) : new Date();
              const updatedAt = conv.updatedAt ? new Date(conv.updatedAt) : createdAt;
              
              return {
                id: conv.sessionId,
                title: conv.title || (conv.userMessage ?
                  (conv.userMessage.length > 50 ?
                    conv.userMessage.substring(0, 50) + '...' :
                    conv.userMessage) :
                  'Chat Session'),
                messages: [
                  {
                    id: conv.messageId || uuidv4(),
                    role: 'user' as const,
                    content: conv.userMessage || '',
                    timestamp: createdAt,
                    emotion: conv.emotion?.primaryEmotion,
                    confidence: conv.emotion?.confidence,
                  },
                  {
                    id: uuidv4(),
                    role: 'assistant' as const,
                    content: conv.assistantMessage || '',
                    timestamp: createdAt,
                    metadata: conv.metadata,
                  }
                ],
                createdAt,
                updatedAt,
              };
            });

          // Group messages by session
          const sessionMap = new Map<string, ChatSession>();
          sessions.forEach(session => {
            if (sessionMap.has(session.id)) {
              const existing = sessionMap.get(session.id)!;
              existing.messages.push(...session.messages);
              existing.updatedAt = session.updatedAt > existing.updatedAt ? session.updatedAt : existing.updatedAt;
            } else {
              sessionMap.set(session.id, session);
            }
          });

          const groupedSessions = Array.from(sessionMap.values())
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

          set({ sessions: groupedSessions, isLoading: false });
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

            // Handle new response format with title
            const conversationData = conversation.messages || conversation;
            sessionTitle = conversation.title || sessionTitle;

            if (Array.isArray(conversationData)) {
              conversationData.forEach((msg: any) => {
                messages.push({
                  id: uuidv4(),
                  role: 'user' as const,
                  content: msg.userMessage,
                  timestamp: new Date(msg.createdAt),
                  emotion: msg.emotion?.primaryEmotion,
                  confidence: msg.emotion?.confidence,
                });
                messages.push({
                  id: uuidv4(),
                  role: 'assistant' as const,
                  content: msg.assistantMessage,
                  timestamp: new Date(msg.createdAt),
                  metadata: msg.metadata,
                  media: msg.metadata?.media || [], // Include media
                });
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