import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface HighlightableTextProps {
  text: string;
  sectionId: string;
  activeSectionId: string | null;
  activeCharIndex: number;
  isReading: boolean;
  className?: string;
}

interface WordToken {
  word: string;
  prefix: string;
  startIndex: number;
  endIndex: number;
}

export const HighlightableText: React.FC<HighlightableTextProps> = ({
  text,
  sectionId,
  activeSectionId,
  activeCharIndex,
  isReading,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = isReading && activeSectionId === sectionId;
  const [, setMaxReadWordIndex] = useState<number>(-1);

  // Reset max read index when section changes or reading stops
  useEffect(() => {
    if (!isActive) {
      setMaxReadWordIndex(-1);
    }
  }, [isActive]);

  // Parse text into precise word tokens with whitespace preserved
  const tokens: WordToken[] = useMemo(() => {
    const list: WordToken[] = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    let lastEnd = 0;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const word = match[0];
      const end = start + word.length;
      const prefix = text.slice(lastEnd, start);
      list.push({
        word,
        prefix,
        startIndex: start,
        endIndex: end,
      });
      lastEnd = end;
    }
    return list;
  }, [text]);

  // Calculate current active word index based on exact character offset
  const activeTokenIndex = useMemo(() => {
    if (!isActive || activeCharIndex < 0 || tokens.length === 0) return -1;

    // Direct match: character index is within word bounds
    for (let i = 0; i < tokens.length; i++) {
      if (activeCharIndex >= tokens[i].startIndex && activeCharIndex < tokens[i].endIndex) {
        return i;
      }
    }

    // Whitespace match: find first word that begins at or after character index
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].startIndex >= activeCharIndex) {
        return i;
      }
    }

    return tokens.length - 1;
  }, [isActive, activeCharIndex, tokens]);

  // Ensure reading sequence progresses forward
  useEffect(() => {
    if (isActive && activeTokenIndex >= 0) {
      setMaxReadWordIndex((prev) => Math.max(prev, activeTokenIndex));
    }
  }, [isActive, activeTokenIndex]);

  // Smoothly keep the reading section and active line in viewport
  useEffect(() => {
    if (isActive && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  if (!text) return null;

  return (
    <div
      ref={containerRef}
      className={`relative transition-all duration-300 leading-relaxed ${className} ${
        isActive
          ? 'bg-amber-100/60 p-2.5 rounded-xl border border-amber-300/80 shadow-xs'
          : ''
      }`}
    >
      {tokens.map((token, idx) => {
        const isCurrentWord = isActive && idx === activeTokenIndex;
        const isPastWord = isActive && idx < activeTokenIndex;

        return (
          <React.Fragment key={idx}>
            {token.prefix}
            {isCurrentWord ? (
              <span className="inline-block bg-[#d97706] text-white px-1.5 py-0.5 mx-0.5 rounded font-semibold shadow-xs scale-105 transition-all duration-100 ease-out">
                {token.word}
              </span>
            ) : isPastWord ? (
              <span className="text-[#241a14] font-medium transition-colors duration-150">
                {token.word}
              </span>
            ) : (
              <span className={isActive ? 'text-[#6b5b4e] transition-colors' : ''}>
                {token.word}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
