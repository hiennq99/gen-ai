'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Heart, MessageSquare, Settings, BookOpen, Sparkles } from 'lucide-react';
import { useSpiritualGuidance } from '@/hooks/useSpiritualGuidance';
import { SpiritualMessageInput } from './SpiritualMessageInput';
import { SpiritualMessageList } from './SpiritualMessageList';
import { CitationPanel } from './CitationPanel';
import { SpiritualDiseasePanel } from './SpiritualDiseasePanel';
import { QualityIndicator } from './QualityIndicator';
import { EmptyState } from './EmptyState';

interface SpiritualGuidanceInterfaceProps {
  className?: string;
}

export function SpiritualGuidanceInterface({ className }: SpiritualGuidanceInterfaceProps) {
  const [selectedMode, setSelectedMode] = useState<'guidance' | 'learning' | 'analysis'>('guidance');
  const [showCitations, setShowCitations] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    lastResponse,
    sendGuidanceMessage,
    analyzeEmotion,
    getSpiritualDiseases,
    isConnected
  } = useSpiritualGuidance();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    await sendGuidanceMessage(message, {
      mode: selectedMode,
      includeCitations: showCitations,
      includeQuality: showQuality
    });
  };

  const handleModeChange = (mode: 'guidance' | 'learning' | 'analysis') => {
    setSelectedMode(mode);
  };

  return (
    <div className={`flex h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 ${className}`}>
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="border-b border-emerald-200 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-6 h-6 text-emerald-600" />
                <h1 className="text-lg font-semibold text-gray-900">
                  Spiritual Guidance AI
                </h1>
              </div>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center space-x-2">
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                {[
                  { id: 'guidance', label: 'Guidance', icon: Heart },
                  { id: 'learning', label: 'Learning', icon: Book },
                  { id: 'analysis', label: 'Analysis', icon: MessageSquare }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleModeChange(id as any)}
                    className={`flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      selectedMode === id
                        ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setShowQuality(!showQuality)}
                className={`p-2 rounded-lg transition-colors ${
                  showQuality
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="Toggle quality indicators"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mode Description */}
          <div className="mt-2 text-sm text-gray-600">
            {selectedMode === 'guidance' && (
              <span>Get personalized spiritual guidance based on &quot;A Handbook of Spiritual Medicine&quot;</span>
            )}
            {selectedMode === 'learning' && (
              <span>Explore spiritual diseases and their treatments from Islamic teachings</span>
            )}
            {selectedMode === 'analysis' && (
              <span>Analyze emotional patterns and spiritual states for deeper understanding</span>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {messages.length === 0 ? (
              <EmptyState
                mode={selectedMode}
                onExampleClick={handleSendMessage}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <SpiritualMessageList
                  messages={messages}
                  isLoading={isLoading}
                  showQuality={showQuality}
                />
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-emerald-200 bg-white/80 backdrop-blur-sm p-4">
              <SpiritualMessageInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                placeholder={
                  selectedMode === 'guidance'
                    ? "Share what's on your heart and receive spiritual guidance..."
                    : selectedMode === 'learning'
                    ? "Ask about spiritual diseases, treatments, or Islamic teachings..."
                    : "Describe your emotional state or patterns for analysis..."
                }
                mode={selectedMode}
              />

              {/* Citation Toggle */}
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center space-x-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={showCitations}
                    onChange={(e) => setShowCitations(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Include citations from handbook</span>
                </label>

                {lastResponse?.qualityScore && (
                  <div className="text-xs text-gray-500">
                    Quality: {Math.round(lastResponse.qualityScore * 100)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <AnimatePresence>
        {(showCitations || showQuality) && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 384, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-l border-emerald-200 bg-white/80 backdrop-blur-sm overflow-hidden"
          >
            <div className="w-96 h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-medium text-gray-900">
                    {showQuality ? 'Response Quality' : 'Citations & References'}
                  </h3>
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {showQuality && lastResponse && (
                  <QualityIndicator response={lastResponse} />
                )}

                {showCitations && lastResponse?.citations && (
                  <CitationPanel citations={lastResponse.citations} />
                )}

                {lastResponse?.spiritualDisease && (
                  <SpiritualDiseasePanel disease={lastResponse.spiritualDisease} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}