'use client';

import { useState } from 'react';
import { Settings, FileText, Brain, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatSettingsProps {
  onModeChange: (mode: 'exact' | 'ai' | 'hybrid') => void;
}

export default function ChatSettings({ onModeChange }: ChatSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'exact' | 'ai' | 'hybrid'>('ai');

  const handleModeChange = (newMode: 'exact' | 'ai' | 'hybrid') => {
    setMode(newMode);
    onModeChange(newMode);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        title="Chat Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50"
          >
            <h3 className="font-semibold text-gray-800 mb-3">Response Mode</h3>
            
            <div className="space-y-2">
              {/* Exact Match Mode */}
              <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                style={{ borderColor: mode === 'exact' ? '#3b82f6' : '#e5e7eb' }}
              >
                <input
                  type="radio"
                  name="mode"
                  value="exact"
                  checked={mode === 'exact'}
                  onChange={() => handleModeChange('exact')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-gray-800">
                    <FileText className="w-4 h-4" />
                    Exact Match (100% Document)
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Returns the exact text from your documents without any AI interpretation. 
                    Best for FAQ, policies, or when you need verbatim answers.
                  </p>
                </div>
              </label>

              {/* AI Mode */}
              <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                style={{ borderColor: mode === 'ai' ? '#3b82f6' : '#e5e7eb' }}
              >
                <input
                  type="radio"
                  name="mode"
                  value="ai"
                  checked={mode === 'ai'}
                  onChange={() => handleModeChange('ai')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-gray-800">
                    <Brain className="w-4 h-4" />
                    AI Interpretation
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    AI processes and understands your documents to provide intelligent, 
                    context-aware responses. Best for complex questions.
                  </p>
                </div>
              </label>

              {/* Hybrid Mode */}
              <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                style={{ borderColor: mode === 'hybrid' ? '#3b82f6' : '#e5e7eb' }}
              >
                <input
                  type="radio"
                  name="mode"
                  value="hybrid"
                  checked={mode === 'hybrid'}
                  onChange={() => handleModeChange('hybrid')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-gray-800">
                    <div className="flex">
                      <FileText className="w-4 h-4" />
                      <Brain className="w-4 h-4 -ml-1" />
                    </div>
                    Hybrid Mode
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Shows exact document match first, then adds AI interpretation. 
                    Best for verification and transparency.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Current Mode: {mode === 'exact' ? 'Exact Match' : mode === 'ai' ? 'AI' : 'Hybrid'}</strong>
                  <p className="mt-1">
                    {mode === 'exact' 
                      ? 'Responses will be direct quotes from your documents.'
                      : mode === 'ai'
                      ? 'AI will interpret and enhance responses based on documents.'
                      : 'You\'ll see both exact matches and AI interpretations.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}