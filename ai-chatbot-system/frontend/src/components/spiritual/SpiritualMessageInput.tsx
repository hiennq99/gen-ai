'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Heart, Brain, BookOpen, Mic, MicOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface SpiritualMessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  mode: 'guidance' | 'learning' | 'analysis';
}

export function SpiritualMessageInput({
  onSendMessage,
  isLoading = false,
  placeholder = "Share what's on your heart...",
  mode
}: SpiritualMessageInputProps) {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Voice input (placeholder for future implementation)
  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    // TODO: Implement speech-to-text
  };

  // Quick suggestion prompts based on mode
  const suggestions = {
    guidance: [
      "I'm feeling angry and need guidance on controlling my temper",
      "I struggle with envy when I see others' success",
      "My heart feels hardened and I want to soften it",
      "I need help with patience during difficult times"
    ],
    learning: [
      "What does Islam teach about anger management?",
      "Explain the spiritual disease of envy and its cure",
      "What are the signs of a hardened heart?",
      "How can I increase my faith and connection to Allah?"
    ],
    analysis: [
      "Analyze my emotional patterns from recent conversations",
      "Help me understand my spiritual state",
      "What recurring themes do you notice in my questions?",
      "Assess my spiritual growth areas"
    ]
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'guidance': return <Heart className="w-4 h-4" />;
      case 'learning': return <BookOpen className="w-4 h-4" />;
      case 'analysis': return <Brain className="w-4 h-4" />;
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case 'guidance': return 'emerald';
      case 'learning': return 'blue';
      case 'analysis': return 'purple';
    }
  };

  const colorClass = getModeColor();

  return (
    <div className="space-y-3">
      {/* Quick Suggestions */}
      {message === '' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          {suggestions[mode].slice(0, 2).map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setMessage(suggestion)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm bg-${colorClass}-50 border-${colorClass}-200 text-${colorClass}-700 hover:bg-${colorClass}-100`}
            >
              {suggestion.slice(0, 50)}...
            </button>
          ))}
        </motion.div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className={`relative border rounded-xl shadow-sm focus-within:shadow-md transition-all bg-white border-${colorClass}-200 focus-within:border-${colorClass}-400`}>
          {/* Mode Indicator */}
          <div className={`absolute left-3 top-3 text-${colorClass}-500`}>
            {getModeIcon()}
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className={`
              w-full pl-12 pr-20 py-3 text-sm
              bg-transparent border-none outline-none resize-none
              placeholder-gray-500 text-gray-900
              min-h-[48px] max-h-32
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />

          {/* Right Actions */}
          <div className="absolute right-2 bottom-2 flex items-center space-x-2">
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading}
              className={`
                p-2 rounded-lg transition-all
                ${isListening
                  ? `bg-red-100 text-red-600 hover:bg-red-200`
                  : `text-gray-400 hover:text-${colorClass}-600 hover:bg-${colorClass}-50`
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className={`
                p-2 rounded-lg transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${message.trim() && !isLoading
                  ? `bg-${colorClass}-500 text-white shadow-sm hover:bg-${colorClass}-600 hover:shadow-md`
                  : `text-gray-400 hover:text-${colorClass}-600 hover:bg-${colorClass}-50`
                }
              `}
              title="Send message"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Character count */}
        {message.length > 0 && (
          <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
            <span>{message.length} characters</span>
            <span className="text-gray-400">Press Shift+Enter for new line</span>
          </div>
        )}
      </form>
    </div>
  );
}