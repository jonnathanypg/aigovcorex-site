'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

// Configure marked options
marked.setOptions({
    gfm: true,
    breaks: true,
});

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const sanitizedHtml = useMemo(() => {
        if (!content) return '';
        try {
            const rawHtml = marked.parse(content) as string;
            return DOMPurify.sanitize(rawHtml, {
                ADD_ATTR: ['target', 'rel'],
                FORCE_BODY: true,
            });
        } catch (e) {
            console.error('Error parsing markdown in Chat:', e);
            return content;
        }
    }, [content]);

    return (
        <div
            className={`prose dark:prose-invert max-w-none break-words leading-relaxed text-neutral-900 dark:text-white
                prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-sm prose-p:text-neutral-900 dark:prose-p:text-white
                prose-headings:font-bold prose-headings:leading-snug prose-headings:text-neutral-950 dark:prose-headings:text-white
                prose-h1:text-base prose-h2:text-sm prose-h3:text-xs
                prose-strong:font-bold prose-strong:text-neutral-950 dark:prose-strong:text-white
                prose-ul:list-disc prose-ul:my-1.5 prose-ul:pl-4 prose-ul:text-neutral-900 dark:prose-ul:text-white
                prose-ol:list-decimal prose-ol:my-1.5 prose-ol:pl-4 prose-ol:text-neutral-900 dark:prose-ol:text-white
                prose-li:my-0.5 prose-li:text-sm prose-li:leading-relaxed prose-li:text-neutral-900 dark:prose-li:text-white
                prose-pre:bg-muted/80 prose-pre:text-foreground dark:prose-pre:text-zinc-100 prose-pre:p-2.5 prose-pre:rounded-lg prose-pre:text-xs prose-pre:my-2
                prose-code:bg-muted/60 dark:prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-code:before:content-none prose-code:after:content-none dark:prose-code:text-zinc-100
                prose-a:text-amber-600 dark:text-amber-400 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-amber-500
                prose-blockquote:border-l-2 prose-blockquote:border-amber-500/50 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:my-1.5 prose-blockquote:text-neutral-800 dark:prose-blockquote:text-zinc-200
                ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
    );
}
