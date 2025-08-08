'use client';

import { Message } from '@/store/chatStore';
import { User, Bot, Heart, Frown, Smile, AlertCircle, BookOpen, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';

interface MessageItemProps {
  message: Message;
}

const emotionIcons = {
  happy: <Smile className="w-4 h-4 text-green-500" />,
  sad: <Frown className="w-4 h-4 text-blue-500" />,
  angry: <AlertCircle className="w-4 h-4 text-red-500" />,
  grateful: <Heart className="w-4 h-4 text-pink-500" />,
  neutral: null,
};

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

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
          <ReactMarkdown
            className="prose prose-sm max-w-none"
            components={{
              code({ className, children, ...props }: any) {
                const inline = (props as any).inline || false;
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match[1]}
                    PreTag="div"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>

          {/* Media Attachments */}
          {message.media && message.media.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.media.map((media, index) => (
                <div key={index}>
                  {media.type === 'image' && media.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.url}
                      alt={media.caption || 'Attachment'}
                      className="rounded-lg max-w-full"
                    />
                  )}
                  {media.type === 'suggestion' && (
                    <div className="bg-white/10 rounded p-2 text-sm">
                      {media.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
          {message.emotion && emotionIcons[message.emotion as keyof typeof emotionIcons]}
          {message.confidence && !isUser && (
            <span className="text-gray-400">
              {Math.round(message.confidence)}% confidence
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