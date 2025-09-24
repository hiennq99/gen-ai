'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Heart, MessageSquare, Sparkles, Send, Bot, User } from 'lucide-react';
import { useSpiritualGuidance } from '@/hooks/useSpiritualGuidance';

export default function SpiritualGuidancePage() {
  const [message, setMessage] = useState('');
  const [showCitations, setShowCitations] = useState(true);

  const {
    messages,
    isLoading,
    lastResponse,
    sendGuidanceMessage,
  } = useSpiritualGuidance();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      await sendGuidanceMessage(message.trim(), {
        includeCitations: showCitations,
        includeQuality: true
      });
      setMessage('');
    }
  };

  const quickPrompts = [
    "I'm feeling angry and need guidance on controlling my temper",
    "I struggle with envy when I see others' success",
    "My heart feels hardened and I want to soften it",
    "I need help with patience during difficult times"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-emerald-100 rounded-full">
              <Book className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              Spiritual Guidance AI
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Receive personalized spiritual guidance based on &quot;A Handbook of Spiritual Medicine&quot;
            with authentic citations from Islamic teachings
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-[600px] flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Welcome to Spiritual Guidance
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Share what&apos;s on your heart and receive guidance rooted in authentic Islamic teachings
                    </p>

                    {/* Quick Prompts */}
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500 mb-3">Try these examples:</p>
                      {quickPrompts.map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => setMessage(prompt)}
                          className="block w-full max-w-md mx-auto px-4 py-2 text-left text-sm bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          &quot;{prompt.slice(0, 60)}...&quot;
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex items-start space-x-3 max-w-3xl ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${
                          msg.role === 'user' ? 'bg-blue-500' : 'bg-emerald-500'
                        }`}>
                          {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>

                        <div className={`rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <div className="whitespace-pre-wrap">{msg.content}</div>

                          {/* Citations */}
                          {msg.citations && msg.citations.length > 0 && showCitations && (
                            <div className="mt-3 pt-3 border-t border-gray-300">
                              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <Book className="w-4 h-4 mr-1" />
                                References ({msg.citations.length})
                              </p>
                              <div className="space-y-1">
                                {msg.citations.map((citation: any, idx: number) => (
                                  <div key={idx} className="text-xs bg-white rounded p-2">
                                    <span className="font-medium">Page {citation.page}:</span> &quot;{citation.quote}&quot;
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quality Score */}
                          {msg.qualityScore && (
                            <div className="mt-2 flex items-center space-x-2">
                              <Sparkles className="w-4 h-4 text-yellow-500" />
                              <span className="text-xs text-gray-600">
                                Quality: {Math.round(msg.qualityScore * 100)}%
                              </span>
                              {msg.citationLevel && (
                                <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                                  {msg.citationLevel.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Typing Indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3 max-w-3xl">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSendMessage} className="flex space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share what&apos;s on your heart and receive spiritual guidance..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />

                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={showCitations}
                          onChange={(e) => setShowCitations(e.target.checked)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Include citations</span>
                      </label>

                      <span className="text-xs text-gray-400">
                        Press Shift+Enter for new line
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!message.trim() || isLoading}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* System Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-emerald-600" />
                System Status
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Connection</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Citations</span>
                  <span className="text-sm font-medium text-emerald-600">Active</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Quality Control</span>
                  <span className="text-sm font-medium text-emerald-600">Enabled</span>
                </div>
              </div>
            </div>

            {/* Last Response Info */}
            {lastResponse && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                  Response Analysis
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Citation Level</span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      lastResponse.citationLevel === 'perfect_match' ? 'bg-purple-100 text-purple-700' :
                      lastResponse.citationLevel === 'related_theme' ? 'bg-blue-100 text-blue-700' :
                      lastResponse.citationLevel === 'general_guidance' ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {lastResponse.citationLevel?.replace('_', ' ')}
                    </span>
                  </div>

                  {lastResponse.metadata?.qualityScore && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Quality Score</span>
                      <span className="text-sm font-medium text-emerald-600">
                        {Math.round(lastResponse.metadata.qualityScore * 100)}%
                      </span>
                    </div>
                  )}

                  {lastResponse.citations && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Citations</span>
                      <span className="text-sm font-medium text-emerald-600">
                        {lastResponse.citations.length} references
                      </span>
                    </div>
                  )}

                  {lastResponse.spiritualDisease && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Spiritual Disease Detected</span>
                      <div className="mt-1">
                        <div className="text-sm font-medium text-gray-900">
                          {lastResponse.spiritualDisease.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {lastResponse.spiritualDisease.arabicName}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Pages {lastResponse.spiritualDisease.pageRange}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Help */}
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6">
              <h3 className="text-lg font-semibold text-emerald-900 mb-3 flex items-center">
                <Heart className="w-5 h-5 mr-2" />
                How It Works
              </h3>

              <div className="space-y-2 text-sm text-emerald-800">
                <p>• Share your spiritual concerns or emotional challenges</p>
                <p>• Receive guidance based on Islamic teachings</p>
                <p>• View authentic citations from the handbook</p>
                <p>• Get personalized advice for your situation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}