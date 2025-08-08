'use client';

import { Menu, Settings, HelpCircle, Bot } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { currentSession } = useChatStore();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary-500" />
            <h1 className="text-xl font-semibold text-gray-800">
              AI Assistant
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentSession && (
            <div className="hidden md:block px-3 py-1 bg-gray-100 rounded-full">
              <span className="text-sm text-gray-600">
                {currentSession.title}
              </span>
            </div>
          )}
          
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <HelpCircle className="w-5 h-5 text-gray-600" />
          </button>
          
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
}