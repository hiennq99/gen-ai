'use client';

import { Message } from '@/store/chatStore';
import MessageItem from './MessageItem';
import { motion } from 'framer-motion';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {messages.map((message, index) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <MessageItem message={message} />
        </motion.div>
      ))}
    </div>
  );
}