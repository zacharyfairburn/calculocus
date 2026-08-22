import React, { useMemo } from 'react';
import katex from 'katex';

interface MathDisplayProps {
  latex?: string;
  math?: string;
  displayMode?: boolean;
  className?: string;
}

export const MathDisplay: React.FC<MathDisplayProps> = ({
  latex,
  math,
  displayMode = false,
  className = '',
}) => {
  const content = latex !== undefined ? latex : (math !== undefined ? math : '');
  const html = useMemo(() => {
    if (!content) return '';
    try {
      return katex.renderToString(content, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return content;
    }
  }, [content, displayMode]);

  return (
    <span
      className={`inline-block font-serif ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // If text does not contain dollar signs, render directly
  if (!text.includes('$')) {
    return <span className={className}>{text}</span>;
  }

  // Split by $...$ inline math delimiters
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const innerLatex = part.slice(1, -1);
          return (
            <MathDisplay
              key={index}
              latex={innerLatex}
              displayMode={false}
              className="px-0.5 align-baseline"
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};
