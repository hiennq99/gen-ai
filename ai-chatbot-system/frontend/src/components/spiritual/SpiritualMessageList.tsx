'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot } from 'lucide-react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  citations?: any[];
  spiritualDisease?: any;
  citationLevel?: string;
  qualityScore?: number;
  emotion?: string;
  metadata?: any;
}

interface SpiritualMessageListProps {
  messages: Message[];
  isLoading?: boolean;
  showQuality?: boolean;
}

export function SpiritualMessageList({
  messages,
  isLoading = false,
  showQuality = false
}: SpiritualMessageListProps) {
  return (
    <div className="space-y-6">
      <AnimatePresence initial={false}>
        {messages.map((message, index) => (
          <motion.div
            key={message.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div className="flex items-start space-x-3 max-w-4xl">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                  message.role === 'user'
                    ? 'bg-blue-500'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-500'
                }`}>
                  {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="prose prose-sm max-w-none">
                    {message.content}
                  </div>
                  {showQuality && message.qualityScore && (
                    <div className="mt-2 text-xs text-gray-500">
                      Quality: {Math.round(message.qualityScore * 100)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Typing Indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <div className="flex items-start space-x-3 max-w-4xl">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-medium">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 p-4">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}