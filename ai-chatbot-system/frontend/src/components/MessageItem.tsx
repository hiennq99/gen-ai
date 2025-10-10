'use client';

import { useState } from 'react';
import { Message } from '@/store/chatStore';
import { User, Bot, Heart, Frown, Smile, AlertCircle, BookOpen, FileText, Zap, HelpCircle, Meh, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

// Default image utility function
const getDefaultImage = (emotion?: string, content?: string) => {
  // Define default images based on emotion
  const emotionImages = {
    happy: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
    sad: 'https://images.unsplash.com/photo-1493836512294-502baa1986e2?w=400&h=300&fit=crop',
    angry: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=400&h=300&fit=crop',
    fear: 'https://images.unsplash.com/photo-1544725121-be3bf52e2dc8?w=400&h=300&fit=crop',
    anxious: 'https://images.unsplash.com/photo-1544725121-be3bf52e2dc8?w=400&h=300&fit=crop',
    surprise: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
    grateful: 'https://images.unsplash.com/photo-1532635270-c2e3a9cd827a?w=400&h=300&fit=crop',
    confused: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&h=300&fit=crop',
    urgent: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop',
    neutral: 'https://picsum.photos/400/300?random=50',
  };

  // Get emotion-based image
  if (emotion && emotionImages[emotion as keyof typeof emotionImages]) {
    return {
      url: emotionImages[emotion as keyof typeof emotionImages],
      caption: `Calming image for ${emotion} feeling`
    };
  }

  // Content-based fallback
  if (content) {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('prayer') || lowerContent.includes('dua') || lowerContent.includes('allah')) {
      return {
        url: 'https://images.unsplash.com/photo-1532635270-c2e3a9cd827a?w=400&h=300&fit=crop',
        caption: 'Islamic spiritual image'
      };
    }
    if (lowerContent.includes('anxiety') || lowerContent.includes('worry')) {
      return {
        url: 'https://images.unsplash.com/photo-1544725121-be3bf52e2dc8?w=400&h=300&fit=crop',
        caption: 'Calming nature scene'
      };
    }
    if (lowerContent.includes('breathe') || lowerContent.includes('breathing')) {
      return {
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        caption: 'Peaceful breathing space'
      };
    }
  }

  // Default fallback
  return {
    url: 'https://picsum.photos/400/300?random=99',
    caption: 'Related image'
  };
};

interface MessageItemProps {
  message: Message;
}

// Helper function to format answer text with proper list formatting (same as admin CMS)
const formatAnswerText = (text: string) => {
  if (!text) return text;

  if (text.includes('▪️')) {
    const parts = text.split('▪️').filter(part => part.trim().length > 0);

    if (parts.length > 1) {
      let result = parts[0].trim();
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const spacedPart = part.startsWith(' ') ? part : ' ' + part;
        result += '\n▪️' + spacedPart;
      }
      const finalText = result
        .replace(/(\s+)(Inhale:)/g, '\n$2')
        .replace(/(\s+)(Exhale:)/g, '\n$2')
        .trim();
      return finalText;
    }
  }

  return text
    .replace(/(\s+)(Inhale:)/g, '\n$2')
    .replace(/(\s+)(Exhale:)/g, '\n$2')
    .trim();
};

// Helper function to render formatted text (same as admin CMS)
const renderFormattedText = (text: string) => {
  if (!text) return null;

  const formattedText = formatAnswerText(text);
  if (!formattedText) return null;

  return formattedText.split('\n').map((line, index) => {
    const trimmedLine = line.trim();

    // Check for bullet points (▪️, •, -, *, ○, ●, ▸, ►)
    if (trimmedLine.match(/^[▪️•\-\*○●▸►]\s*/) || trimmedLine.startsWith('▪️')) {
      return (
        <div key={index} style={{
          marginLeft: '20px',
          marginBottom: '6px',
          position: 'relative',
          paddingLeft: '12px'
        }}>
          <span style={{
            position: 'absolute',
            left: '-12px',
            color: '#059669',
            fontWeight: 'bold'
          }}>•</span>
          {trimmedLine.replace(/^[▪️•\-\*○●▸►]\s*/, '')}
        </div>
      );
    }

    // Check for breathing patterns
    if (trimmedLine.match(/^(Inhale|Exhale):/)) {
      return (
        <div key={index} style={{
          marginTop: '8px',
          marginBottom: '8px',
          fontWeight: '600',
          color: '#7c3aed',
          fontSize: '14px'
        }}>
          {trimmedLine}
        </div>
      );
    }

    // Empty lines
    if (!trimmedLine) {
      return <div key={index} style={{ height: '8px' }} />;
    }

    // Regular lines
    return (
      <div key={index} style={{
        marginBottom: '6px',
        lineHeight: '1.6',
        color: '#374151'
      }}>
        {trimmedLine}
      </div>
    );
  });
};

const emotionIcons = {
  happy: { icon: <Smile className="w-4 h-4 text-green-500" />, label: 'Happy', color: 'bg-green-100 text-green-700' },
  sad: { icon: <Frown className="w-4 h-4 text-blue-500" />, label: 'Sad', color: 'bg-blue-100 text-blue-700' },
  angry: { icon: <AlertCircle className="w-4 h-4 text-red-500" />, label: 'Angry', color: 'bg-red-100 text-red-700' },
  grateful: { icon: <Heart className="w-4 h-4 text-pink-500" />, label: 'Grateful', color: 'bg-pink-100 text-pink-700' },
  fear: { icon: <AlertCircle className="w-4 h-4 text-orange-500" />, label: 'Fearful', color: 'bg-orange-100 text-orange-700' },
  surprise: { icon: <Eye className="w-4 h-4 text-purple-500" />, label: 'Surprised', color: 'bg-purple-100 text-purple-700' },
  confused: { icon: <HelpCircle className="w-4 h-4 text-yellow-600" />, label: 'Confused', color: 'bg-yellow-100 text-yellow-700' },
  urgent: { icon: <Zap className="w-4 h-4 text-red-600" />, label: 'Urgent', color: 'bg-red-100 text-red-700' },
  disgust: { icon: <Frown className="w-4 h-4 text-gray-500" />, label: 'Disgusted', color: 'bg-gray-100 text-gray-700' },
  neutral: { icon: <Meh className="w-4 h-4 text-gray-500" />, label: 'Neutral', color: 'bg-gray-100 text-gray-700' },
};

const EmotionTags = ({ emotions, className = "" }: { emotions: string[], className?: string }) => {
  if (!emotions || emotions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {emotions.slice(0, 3).map((emotion, index) => {
        const emotionData = emotionIcons[emotion as keyof typeof emotionIcons];
        if (!emotionData) return null;

        return (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${emotionData.color}`}
            title={`Detected emotion: ${emotionData.label}`}
          >
            {emotionData.icon}
            <span className="capitalize">{emotion}</span>
          </span>
        );
      })}
    </div>
  );
};

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';
  const [showEmotionDetails, setShowEmotionDetails] = useState(false);

  // Debug log
  if (message.emotionAnalysis) {
    console.log('💚 Message has emotionAnalysis:', message.emotionAnalysis);
  }

  // Debug recommendations
  if (!isUser && message.metadata) {
    console.log('🔍 Recommendations Debug:', {
      hasMetadata: !!message.metadata,
      hasRecommendations: !!message.metadata.recommendations,
      count: message.metadata.recommendations?.length || 0,
      recommendations: message.metadata.recommendations
    });
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-600" />
          </div>
        </div>
      )}

      <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          {/* Emotion badge for user messages */}
          {isUser && message.emotion && (
            <div className="mb-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm">
              {emotionIcons[message.emotion as keyof typeof emotionIcons]?.icon}
              <span className="capitalize">{message.emotion}</span>
            </div>
          )}

          {isUser ? (
            // User messages use regular text
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            // Assistant messages use custom formatting like admin CMS
            <>
              {/* Emotion badge for assistant messages */}
              {message.emotionTags?.responseEmotions && message.emotionTags.responseEmotions.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {message.emotionTags.responseEmotions.slice(0, 2).map((emotion, idx) => {
                    const emotionData = emotionIcons[emotion as keyof typeof emotionIcons];
                    return emotionData ? (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${emotionData.color}`}
                      >
                        {emotionData.icon}
                        <span className="capitalize">{emotion}</span>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              <div className="prose prose-sm max-w-none">
                {renderFormattedText(message.content)}
              </div>
            </>
          )}

          {/* Media Attachments */}
          {!isUser && (
            <div className="mt-2 space-y-2">
              {/* Show provided media if available */}
              {message.media && message.media.length > 0 ? (
                message.media.map((media, index) => (
                  <div key={index}>
                    {(media.type === 'image' || media.type === 'gif') && media.url && (
                      <div className="flex flex-col">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={media.url}
                          alt={media.caption || 'Attachment'}
                          className="rounded-lg max-w-full"
                          onError={(e) => {
                            // Fallback to default image if provided media fails to load
                            const target = e.target as HTMLImageElement;
                            const defaultImage = getDefaultImage(
                              message.emotion || message.emotionTags?.inputEmotions?.[0],
                              message.content
                            );
                            target.src = defaultImage.url;
                          }}
                        />
                        {media.caption && (
                          <div className="mt-1 text-xs text-gray-600 text-center">
                            {media.caption}
                          </div>
                        )}
                      </div>
                    )}
                    {media.type === 'video' && media.url && (
                      <div className="flex flex-col">
                        <video
                          src={media.url}
                          controls
                          className="rounded-lg max-w-full"
                          preload="metadata"
                        >
                          Your browser does not support the video tag.
                        </video>
                        {media.caption && (
                          <div className="mt-1 text-xs text-gray-600 text-center">
                            {media.caption}
                          </div>
                        )}
                      </div>
                    )}
                    {media.type === 'suggestion' && (
                      <div className="bg-white/10 rounded p-2 text-sm">
                        {media.content}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                /* Default image if no media provided */
                (() => {
                  const defaultImage = getDefaultImage(
                    message.emotion || message.emotionTags?.inputEmotions?.[0],
                    message.content
                  );
                  return (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={defaultImage.url}
                        alt={defaultImage.caption}
                        className="rounded-lg max-w-full opacity-90"
                        onError={(e) => {
                          // Fallback to a simple placeholder if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://picsum.photos/400/300?random=1';
                        }}
                      />
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        {/* Multiple Emotion Tags */}
        {(message.emotions || message.emotionTags || message.metadata?.emotionSummary) && (
          <div className="mt-2">
            {/* Emotion Toggle Button */}
            <button
              onClick={() => setShowEmotionDetails(!showEmotionDetails)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
            >
              {showEmotionDetails ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>
                {showEmotionDetails ? 'Hide emotion details' : 'Show emotion details'}
              </span>
            </button>

            {showEmotionDetails && (
              <>
                {/* User Input Emotions */}
                {message.emotionTags?.inputEmotions && message.emotionTags.inputEmotions.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">Input emotions:</div>
                    <EmotionTags emotions={message.emotionTags.inputEmotions} />
                  </div>
                )}

                {/* Response Emotions (for assistant messages) */}
                {!isUser && message.emotionTags?.responseEmotions && message.emotionTags.responseEmotions.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">Response style:</div>
                    <EmotionTags emotions={message.emotionTags.responseEmotions} />
                  </div>
                )}

                {/* Fallback to simple emotions array */}
                {message.emotions && !message.emotionTags && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">Detected emotions:</div>
                    <EmotionTags emotions={message.emotions} />
                  </div>
                )}

                {/* Text-based Emotion Summary */}
                {message.metadata?.emotionSummary && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 font-mono border-l-2 border-gray-300">
                      <div className="font-semibold text-gray-700 mb-1">📊 Emotion Analysis</div>
                      <div className="whitespace-pre-wrap">{message.metadata.emotionSummary}</div>
                    </div>
                  </div>
                )}

                {/* Response Style Text */}
                {!isUser && message.metadata?.responseStyleText && (
                  <div className="mb-2">
                    <div className="text-xs text-blue-600 bg-blue-50 rounded p-2 font-mono border-l-2 border-blue-300">
                      <div className="font-semibold text-blue-700 mb-1">🎯 Response Style</div>
                      <div className="whitespace-pre-wrap">{message.metadata.responseStyleText}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Source Citations */}
        {!isUser && message.metadata?.documents && message.metadata.documents.length > 0 && (
          <div className="mt-2 px-3 py-2 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg text-xs">
            <div className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <BookOpen className="w-4 h-4 text-green-600" />
              <span>📚 Sources & Citations</span>
            </div>
            <div className="space-y-2">
              {message.metadata.documents.map((doc: any, idx: number) => (
                <div key={idx} className="bg-white rounded p-2 border border-gray-200">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold text-gray-800">{doc.title}</div>

                      {/* Q&A Match */}
                      {message.metadata?.contextInfo?.qaMatch && doc.source && (
                        <div className="text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded">
                          <span className="font-medium">📝 Question:</span> {doc.source}
                        </div>
                      )}

                      {/* Document Match with Page */}
                      {doc.page && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">📄 Page:</span> {doc.page}
                          {doc.totalPages && ` of ${doc.totalPages}`}
                        </div>
                      )}

                      {/* Document Name */}
                      {doc.documentName && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">📖 Document:</span> {doc.documentName}
                        </div>
                      )}

                      {/* Excerpt */}
                      {doc.excerpt && (
                        <div className="text-xs text-gray-500 italic border-l-2 border-gray-300 pl-2 mt-1">
                          &ldquo;{doc.excerpt}&rdquo;
                        </div>
                      )}

                      {/* Relevance Score */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-green-700">
                          ✓ Relevance: {doc.relevanceScore}
                        </span>
                        {doc.matchType && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded capitalize">
                            {doc.matchType.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Source Display Summary */}
            {message.metadata.sourceDisplay && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                <span className="font-medium">💡 Source:</span> {message.metadata.sourceDisplay}
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {!isUser && message.metadata?.recommendations && message.metadata.recommendations.length > 0 && (
          <div className="mt-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg text-xs">
            <div className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span className="text-purple-600">💡</span> Related Resources
            </div>
            <div className="space-y-2">
              {message.metadata.recommendations.map((rec: any, idx: number) => (
                <div key={idx} className="bg-white rounded p-2 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-2">
                    {/* Icon based on type */}
                    <span className="flex-shrink-0 text-lg">
                      {rec.type === 'video' && '🎥'}
                      {rec.type === 'article' && '📄'}
                      {rec.type === 'past_answer' && '💬'}
                      {rec.type === 'document' && '📚'}
                    </span>

                    <div className="flex-1">
                      {/* Title with link */}
                      {rec.url ? (
                        <a
                          href={rec.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {rec.title}
                        </a>
                      ) : (
                        <div className="font-semibold text-gray-800">{rec.title}</div>
                      )}

                      {/* Description */}
                      {rec.description && (
                        <div className="text-xs text-gray-600 mt-1">{rec.description}</div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-2 mt-1">
                        {rec.source && (
                          <span className="text-xs text-gray-500">📍 {rec.source}</span>
                        )}
                        <span className="text-xs font-medium text-purple-700">
                          ✓ {rec.relevanceScore.toFixed(0)}% relevant
                        </span>
                        {rec.type && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded capitalize">
                            {rec.type.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail for videos */}
                    {rec.thumbnail && (
                      <img
                        src={rec.thumbnail}
                        alt={rec.title}
                        className="w-16 h-12 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500 text-center">
              💡 These resources are selected based on your query and emotional context
            </div>
          </div>
        )}

        {/* Emotion Analysis Details */}
        {message.emotionAnalysis && (
          <div className="mt-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg text-xs">
            <div className="font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
              <span className="text-blue-600">📊</span> Emotion Analysis
            </div>
            <div className="space-y-1 text-gray-700">
              <div className="flex items-center gap-2">
                <span className="font-medium">Primary emotion:</span>
                <span className="px-2 py-0.5 bg-white rounded font-semibold text-blue-700 capitalize">
                  {message.emotionAnalysis.primaryEmotion || message.emotion}
                </span>
              </div>
              {message.emotionAnalysis.intensity && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Intensity:</span>
                  <span className={`px-2 py-0.5 bg-white rounded font-semibold capitalize ${
                    message.emotionAnalysis.intensity === 'high' ? 'text-red-600' :
                    message.emotionAnalysis.intensity === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {message.emotionAnalysis.intensity}
                  </span>
                </div>
              )}
              {message.emotionAnalysis.confidence && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Confidence:</span>
                  <span className="px-2 py-0.5 bg-white rounded font-semibold text-purple-700">
                    {message.emotionAnalysis.confidence}%
                  </span>
                </div>
              )}
              {message.emotionAnalysis.aiEnhanced && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded font-semibold text-[10px]">
                    ✨ AI Enhanced
                  </span>
                </div>
              )}
              {message.emotionAnalysis.secondaryEmotions && message.emotionAnalysis.secondaryEmotions.length > 0 && (
                <div className="flex items-start gap-2 mt-1">
                  <span className="font-medium">Secondary:</span>
                  <div className="flex flex-wrap gap-1">
                    {message.emotionAnalysis.secondaryEmotions.map((emotion: string, idx: number) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-white rounded text-gray-600 capitalize">
                        {emotion}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>
            {message.timestamp && !isNaN(new Date(message.timestamp).getTime())
              ? format(new Date(message.timestamp), 'HH:mm')
              : '--:--'
            }
          </span>
          {/* Show single emotion icon for backward compatibility */}
          {message.emotion && emotionIcons[message.emotion as keyof typeof emotionIcons] && (
            <div className="flex items-center gap-1">
              {emotionIcons[message.emotion as keyof typeof emotionIcons].icon}
            </div>
          )}
          {message.confidence && !isUser && (
            <span className="text-gray-400">
              {Math.round(message.confidence)}% confidence
            </span>
          )}

          {/* Empathy Level Indicator */}
          {!isUser && message.emotionTags?.empathyLevel && message.emotionTags.empathyLevel !== 'low' && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              message.emotionTags.empathyLevel === 'high'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {message.emotionTags.empathyLevel} empathy
            </span>
          )}
          {/* Document Usage Indicator */}
          {!isUser && message.metadata?.documentsUsed && message.metadata.documentsUsed > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <BookOpen className="w-3 h-3" />
              <span>{message.metadata.documentsUsed} docs used</span>
            </div>
          )}
          {!isUser && message.metadata?.contextInfo && (
            <div className="group relative">
              <FileText className="w-3 h-3 text-blue-500 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                <p className="font-semibold mb-1">Knowledge Base Status:</p>
                <p>{message.metadata.contextInfo.message}</p>
                {message.metadata.documents && message.metadata.documents.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">Documents used:</p>
                    {message.metadata.documents.slice(0, 3).map((doc: any, idx: number) => (
                      <div key={idx} className="mt-1">
                        <p className="truncate">• {doc.title}</p>
                        <p className="text-gray-300">Relevance: {doc.relevanceScore}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
}