'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, StopCircle } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { motion } from 'framer-motion';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const { isLoading } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Voice recording implementation would go here
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={isLoading}
          className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          rows={1}
        />
        
        <button
          type="button"
          onClick={() => {}}
          className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={isLoading}
        >
          <Paperclip className="w-5 h-5" />
        </button>
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={toggleRecording}
        className={`p-3 rounded-lg transition-colors ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
        }`}
        disabled={isLoading}
      >
        {isRecording ? (
          <StopCircle className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
        className="p-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-5 h-5" />
      </motion.button>
    </div>
  );
}