'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on desktop

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Chat Interface */}
        <main className="flex-1 overflow-hidden">
          <ChatInterface />
        </main>
      </div>
    </div>
  );
}