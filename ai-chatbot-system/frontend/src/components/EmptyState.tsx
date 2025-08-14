'use client';

import { Heart, Smile, Meh, Frown, HelpCircle, AlertCircle } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { motion } from 'framer-motion';
import { chatService } from '@/lib/chatService';

const feelings = [
  { icon: <Smile className="w-5 h-5" />, label: 'Happy', emotion: 'happy', color: 'bg-green-100 hover:bg-green-200 text-green-700' },
  { icon: <Heart className="w-5 h-5" />, label: 'Grateful', emotion: 'grateful', color: 'bg-pink-100 hover:bg-pink-200 text-pink-700' },
  { icon: <Meh className="w-5 h-5" />, label: 'Just Okay', emotion: 'neutral', color: 'bg-gray-100 hover:bg-gray-200 text-gray-700' },
  { icon: <Frown className="w-5 h-5" />, label: 'Sad', emotion: 'sad', color: 'bg-blue-100 hover:bg-blue-200 text-blue-700' },
  { icon: <HelpCircle className="w-5 h-5" />, label: 'Confused', emotion: 'confused', color: 'bg-purple-100 hover:bg-purple-200 text-purple-700' },
  { icon: <AlertCircle className="w-5 h-5" />, label: 'Anxious', emotion: 'fear', color: 'bg-orange-100 hover:bg-orange-200 text-orange-700' },
];

export default function EmptyState() {
  const { createSession, addMessage } = useChatStore();

  const handleFeelingClick = async (emotion: string) => {
    // Create session if not exists
    let sessionId = useChatStore.getState().currentSession?.id;
    if (!sessionId) {
      createSession();
      sessionId = useChatStore.getState().currentSession?.id;
    }

    if (!sessionId) return;

    try {
      // Call the emotion selection endpoint using chatService
      const data = await chatService.selectEmotion(
        sessionId,
        'user', // You might want to get this from auth context
        emotion
      );
      
      // Add the emotion selection as a user message (visual indicator)
      const emotionMessages: Record<string, string> = {
        happy: "I'm feeling happy today! 😊",
        sad: "I'm feeling a bit down... 😔",
        angry: "I'm feeling frustrated right now 😤",
        confused: "I'm feeling confused and need clarity 🤔",
        fear: "I'm feeling anxious about things 😟",
        grateful: "I'm feeling grateful and thankful 🙏",
        neutral: "Just checking in 👋",
      };
      
      addMessage({ 
        role: 'user', 
        content: emotionMessages[emotion] || `I'm feeling ${emotion}`,
        metadata: { type: 'emotion-selection', emotion }
      });
      
      // Add the AI's emotional greeting response
      addMessage({ 
        role: 'assistant', 
        content: data.content,
        emotion: data.emotion,
        metadata: data.metadata
      });
    } catch (error) {
      console.error('Error setting emotion:', error);
      // Fallback to sending a regular message
      addMessage({ role: 'user', content: `I'm feeling ${emotion}` });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
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
            How are you feeling today? Let&apos;s start our conversation...
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
              onClick={() => handleFeelingClick(feeling.emotion)}
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