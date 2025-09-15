'use client';

import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChat } from '@/hooks/useChat';
import MessageInput from './MessageInput';

export default function EmptyState() {
  const { sendMessage } = useChat();

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Welcome Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center"
        >
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Heart className="w-10 h-10 text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Hey there, friend! 👋
            </h2>
            <p className="text-lg text-gray-700 mb-2">
              I&apos;m here to chat, listen, and help however you need.
            </p>
            <p className="text-gray-600">
              Start typing below to begin our conversation...
            </p>
          </div>
        </motion.div>
      </div>

      {/* Message Input */}
      <div className="px-4 py-4 bg-white border-t border-gray-200">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}