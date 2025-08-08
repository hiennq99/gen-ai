import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: string;
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
          title: title || 'New Chat',
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