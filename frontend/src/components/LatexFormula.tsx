import React, { useState, useMemo } from 'react';
import katex from 'katex';
import { Check, Copy, AlertTriangle, Sigma } from 'lucide-react';

interface LatexFormulaProps {
  formula: string;
  displayMode?: boolean;
  isLightTheme?: boolean;
  className?: string;
}

/**
 * 辅助工具函数：直接将 LaTeX 字符串编译为 KaTeX HTML
 */
export const renderLatexToHtml = (formula: string, displayMode = false): { html: string; error?: string } => {
  try {
    const html = katex.renderToString(formula.trim(), {
      displayMode,
      throwOnError: true,
      output: 'htmlAndMathml',
      strict: false,
    });
    return { html };
  } catch (err: any) {
    try {
      // 容错重试：throwOnError=false 模式
      const fallbackHtml = katex.renderToString(formula.trim(), {
        displayMode,
        throwOnError: false,
        output: 'htmlAndMathml',
        strict: false,
      });
      return { html: fallbackHtml, error: err?.message || '公式语法解析异常' };
    } catch {
      return { html: '', error: err?.message || '公式语法解析异常' };
    }
  }
};

export const LatexFormula: React.FC<LatexFormulaProps> = ({
  formula,
  displayMode = false,
  isLightTheme = false,
  className = '',
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const { html, error } = useMemo(() => {
    return renderLatexToHtml(formula, displayMode);
  }, [formula, displayMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 块级独立公式卡片 (Display Mode)
  if (displayMode) {
    return (
      <div
        className={`code-katex-block ${className}`}
        style={{
          margin: '1.25rem 0',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          background: isLightTheme ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* 顶部工具栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.35rem 0.85rem',
            background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--primary-color, #3b82f6)',
                fontSize: '0.72rem',
              }}
            >
              <Sigma size={12} />
              公式
            </span>
            {error && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#ef4444',
                  fontSize: '0.72rem',
                }}
              >
                <AlertTriangle size={12} />
                解析预警
              </span>
            )}
          </div>

          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'none',
              border: 'none',
              color: copied ? '#10b981' : 'var(--text-secondary)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              padding: '0.15rem 0.4rem',
              borderRadius: '4px',
            }}
            title="复制 LaTeX 源码"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? '已复制' : '复制公式'}</span>
          </button>
        </div>

        {/* 公式渲染主体 */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowX: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '48px',
            color: isLightTheme ? '#1e293b' : '#f1f5f9',
          }}
        >
          {html ? (
            <div
              style={{ maxWidth: '100%', overflowX: 'auto' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', fontFamily: 'monospace' }}>
              {formula}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 行内公式 (Inline Mode)
  if (!html) {
    return <code style={{ color: '#ef4444', fontSize: '0.9em' }}>{formula}</code>;
  }

  return (
    <span
      className={`code-katex-inline ${className}`}
      style={{
        padding: '0 0.15rem',
        display: 'inline-block',
        verticalAlign: 'middle',
        color: isLightTheme ? '#0f172a' : '#f8fafc',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
