'use client';

import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary-600" />
        </div>
      </div>
      
      <div className="bg-gray-100 rounded-lg px-4 py-3">
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}