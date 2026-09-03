"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { ChatMessage } from '@/services/chat.service';

interface ChatBubbleProps {
    message: ChatMessage;
    agentIcon?: string | null;
}

// Helper to construct image URL
const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5010';
    return `${API_URL}${path}`;
};

// Regex to detect URLs in text
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Parse message text and convert URLs into clickable <a> tags.
 * Everything else stays as plain text, preserving whitespace.
 */
function renderMessageContent(text: string) {
    const parts = text.split(URL_REGEX);
    if (parts.length === 1) return text; // No URLs found

    return parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
            // Reset lastIndex since we reuse the regex
            URL_REGEX.lastIndex = 0;
            
            // Determine a friendly link text
            let linkText = "📎 Ver enlace";
            const lowerPart = part.toLowerCase();
            if (
                lowerPart.includes('.pdf') || 
                lowerPart.includes('.xlsx') || 
                lowerPart.includes('.xls') || 
                lowerPart.includes('/report') || 
                lowerPart.includes('download')
            ) {
                linkText = "📎 Descargar Reporte";
            } else {
                try {
                    const urlObj = new URL(part);
                    linkText = `🔗 ${urlObj.hostname}`;
                } catch (e) {
                    linkText = "🔗 Enlace";
                }
            }

            return (
                <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 dark:text-amber-400 hover:text-amber-500 underline underline-offset-2 transition-colors font-semibold"
                    style={{ wordBreak: 'break-all' }}
                >
                    {linkText}
                </a>
            );
        }
        // Reset lastIndex for next iteration
        URL_REGEX.lastIndex = 0;
        return part;
    });
}

export function ChatBubble({ message, agentIcon }: ChatBubbleProps) {
    const isUser = message.role === 'user';
    const hasAnimated = React.useRef(false);
    const [displayText, setDisplayText] = React.useState(
        isUser || message.isLoading ? message.content : ''
    );

    React.useEffect(() => {
        if (isUser || message.isLoading) {
            setDisplayText(message.content);
            return;
        }

        // Check if it's already animated
        if (hasAnimated.current) {
            setDisplayText(message.content);
            return;
        }

        hasAnimated.current = true;
        let index = 0;
        const text = message.content;
        setDisplayText('');

        const interval = setInterval(() => {
            if (index < text.length) {
                // Type chunks of 3 characters for responsive feel
                const nextChunk = text.slice(index, index + 3);
                setDisplayText(prev => prev + nextChunk);
                index += 3;
            } else {
                clearInterval(interval);
            }
        }, 15);

        return () => clearInterval(interval);
    }, [message.content, message.isLoading, isUser]);

    return (
        <div
            className={cn(
                "flex gap-3 mb-4",
                isUser ? "flex-row-reverse" : "flex-row"
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden",
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                )}
            >
                {isUser ? (
                    <User className="w-4 h-4" />
                ) : (
                    agentIcon ? (
                        <img
                            src={getImageUrl(agentIcon) || ''}
                            alt="AI"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Bot className="w-4 h-4" />
                    )
                )}
            </div>

            {/* Message Content */}
            <div
                className={cn(
                    "flex flex-col min-w-0 max-w-[80%]",
                    isUser ? "items-end" : "items-start"
                )}
            >
                <div
                    className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm leading-relaxed overflow-hidden",
                        isUser
                            ? "bg-primary text-primary-foreground rounded-tr-md"
                            : "bg-muted/80 text-foreground rounded-tl-md"
                    )}
                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                >
                    {message.isLoading ? (
                        <div className="flex flex-col gap-2">
                            <div className="text-xs text-muted-foreground/80 font-medium whitespace-pre-wrap">
                                {message.content || 'Escribiendo...'}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 bg-amber-500/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2.5 h-2.5 bg-amber-500/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2.5 h-2.5 bg-amber-500/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                            {renderMessageContent(displayText)}
                        </div>
                    )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>
                        {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    {!isUser && message.agentUsed && (
                        <>
                            <span>•</span>
                            <span className="capitalize">{message.agentUsed}</span>
                        </>
                    )}
                    {!isUser && message.confidence !== undefined && (
                        <>
                            <span>•</span>
                            <span>{Math.round(message.confidence * 100)}%</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ChatBubbleSkeleton() {
    return (
        <div className="flex gap-3 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted animate-pulse" />
            <div className="flex flex-col gap-2 max-w-[70%]">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
        </div>
    );
}

