'use client';

import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import EmptyState from './EmptyState';
import TypingIndicator from './TypingIndicator';
import ChatSettings from './ChatSettings';
import { useChat } from '@/hooks/useChat';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatInterface() {
  const { currentSession, isTyping } = useChatStore();
  const { sendMessage, isConnected } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [responseMode, setResponseMode] = useState<'exact' | 'ai' | 'hybrid'>('ai');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, { mode: responseMode });
  };

  const handleModeChange = (mode: 'exact' | 'ai' | 'hybrid') => {
    setResponseMode(mode);
  };

  if (!currentSession || currentSession.messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with Settings */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Chat Assistant</h3>
        <ChatSettings onModeChange={handleModeChange} />
      </div>

      {/* Connection Status */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-yellow-50 border-b border-yellow-200 px-4 py-2"
          >
            <p className="text-sm text-yellow-800">
              Connecting to server...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-6">
        <MessageList messages={currentSession.messages} />
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-4 bg-white">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}