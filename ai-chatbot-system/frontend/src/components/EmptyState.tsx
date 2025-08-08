'use client';

import { MessageSquarePlus, Heart, Smile, Meh, Frown, HelpCircle, AlertCircle } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { motion } from 'framer-motion';

const feelings = [
  { icon: <Smile className="w-5 h-5" />, label: 'Happy', color: 'bg-green-100 hover:bg-green-200 text-green-700', prompt: "I'm feeling great today!" },
  { icon: <Heart className="w-5 h-5" />, label: 'Grateful', color: 'bg-pink-100 hover:bg-pink-200 text-pink-700', prompt: "I'm feeling grateful and thankful" },
  { icon: <Meh className="w-5 h-5" />, label: 'Neutral', color: 'bg-gray-100 hover:bg-gray-200 text-gray-700', prompt: "I'm feeling okay, just normal" },
  { icon: <Frown className="w-5 h-5" />, label: 'Sad', color: 'bg-blue-100 hover:bg-blue-200 text-blue-700', prompt: "I'm feeling a bit down today" },
  { icon: <HelpCircle className="w-5 h-5" />, label: 'Confused', color: 'bg-purple-100 hover:bg-purple-200 text-purple-700', prompt: "I'm feeling confused and need help" },
  { icon: <AlertCircle className="w-5 h-5" />, label: 'Stressed', color: 'bg-orange-100 hover:bg-orange-200 text-orange-700', prompt: "I'm feeling stressed and overwhelmed" },
];

export default function EmptyState() {
  const { createSession, addMessage } = useChatStore();

  const handleFeelingClick = (prompt: string) => {
    if (!useChatStore.getState().currentSession) {
      createSession();
    }
    // This would trigger the actual message send
    // For now, just add to store
    addMessage({ role: 'user', content: prompt });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquarePlus className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to AI Assistant
          </h2>
          <p className="text-gray-600">
            What are you feeling today?
          </p>
        </div>

        {/* Feelings Selection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {feelings.map((feeling, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleFeelingClick(feeling.prompt)}
              className={`p-4 rounded-xl border transition-all transform hover:scale-105 ${feeling.color}`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-full bg-white bg-opacity-50">
                  {feeling.icon}
                </div>
                <span className="font-medium text-sm">{feeling.label}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}