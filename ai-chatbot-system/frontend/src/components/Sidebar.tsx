'use client';

import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Plus, MessageSquare, Trash2, X, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { 
    sessions, 
    currentSessionId, 
    createSession, 
    setCurrentSession, 
    deleteSession,
    fetchSessions,
    loadSession,
    isLoading 
  } = useChatStore();
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNewChat = () => {
    createSession();
    onClose();
  };

  const handleSelectSession = async (sessionId: string) => {
    // Check if we're already on this session
    if (currentSessionId === sessionId) {
      onClose();
      return;
    }
    
    // Load the session data
    await loadSession(sessionId);
    
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSessions();
    setIsRefreshing(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 flex flex-col h-screen transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Chat History</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Refresh sessions"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="lg:hidden p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <button
            onClick={handleNewChat}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-spin" />
              <p className="text-sm">Loading conversations...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  currentSessionId === session.id
                    ? 'bg-primary-50 border-2 border-primary-400 shadow-sm'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                }`}
                onClick={() => handleSelectSession(session.id)}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => setHoveredSession(null)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {session.title}
                    </p>
                    {session.messages.length > 0 && (
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {session.messages[session.messages.length - 1].content}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {(() => {
                        try {
                          const date = session.updatedAt instanceof Date 
                            ? session.updatedAt 
                            : new Date(session.updatedAt);
                          
                          // Check if date is valid
                          if (isNaN(date.getTime())) {
                            return 'Recently';
                          }
                          
                          return format(date, 'MMM d, HH:mm');
                        } catch (error) {
                          return 'Recently';
                        }
                      })()}
                    </div>
                  </div>
                  
                  {hoveredSession === session.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          Powered by Claude AI
        </div>
      </aside>
    </>
  );
}