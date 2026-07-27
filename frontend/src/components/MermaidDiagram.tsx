import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Check, Copy, Code, Eye, AlertTriangle } from 'lucide-react';

interface MermaidDiagramProps {
  chart: string;
  isLightTheme?: boolean;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  isLightTheme = false,
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');
  const [copied, setCopied] = useState<boolean>(false);
  const [rendering, setRendering] = useState<boolean>(true);

  const containerIdRef = useRef<string>(
    `mermaid-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`
  );

  useEffect(() => {
    let isMounted = true;
    setRendering(true);
    setRenderError(null);

    const renderChart = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isLightTheme ? 'default' : 'dark',
          securityLevel: 'loose',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          themeVariables: isLightTheme
            ? {
                primaryColor: '#e0e7ff',
                primaryTextColor: '#1e1b4b',
                primaryBorderColor: '#6366f1',
                lineColor: '#64748b',
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#ffffff',
              }
            : {
                primaryColor: '#1e293b',
                primaryTextColor: '#f8fafc',
                primaryBorderColor: '#3b82f6',
                lineColor: '#94a3b8',
                secondaryColor: '#0f172a',
                tertiaryColor: '#1e1e2e',
              },
        });

        // Use mermaid.render with unique ID
        const id = containerIdRef.current;
        // Strip any trailing backticks or clean code string
        const cleanChart = chart.trim();

        const { svg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvgContent(svg);
          setRenderError(null);
          setRendering(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Mermaid render error:', err);
          const errMsg = err?.message || 'Mermaid 语法格式无法解析';
          setRenderError(errMsg);
          setRendering(false);
          // Clean up phantom element inserted by mermaid if any
          const phantom = document.getElementById(containerIdRef.current);
          if (phantom) phantom.remove();
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      const phantom = document.getElementById(containerIdRef.current);
      if (phantom) phantom.remove();
    };
  }, [chart, isLightTheme]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: '1.25rem 0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        background: isLightTheme ? '#ffffff' : 'var(--code-bg, #1a1c23)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.45rem 1rem',
          background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              fontSize: '0.72rem',
              letterSpacing: '0.02em',
            }}
          >
            Mermaid
          </span>
          {renderError && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                color: '#ef4444',
                fontSize: '0.72rem',
              }}
            >
              <AlertTriangle size={13} /> 解析异常
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Toggle view mode */}
          <div
            style={{
              display: 'flex',
              background: isLightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setViewMode('diagram')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '3px',
                border: 'none',
                background: viewMode === 'diagram' ? 'var(--primary-color, #3b82f6)' : 'transparent',
                color: viewMode === 'diagram' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="查看渲染图表"
            >
              <Eye size={12} /> 图表
            </button>
            <button
              onClick={() => setViewMode('code')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '3px',
                border: 'none',
                background: viewMode === 'code' ? 'var(--primary-color, #3b82f6)' : 'transparent',
                color: viewMode === 'code' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="查看 Mermaid 源码"
            >
              <Code size={12} /> 源码
            </button>
          </div>

          {/* Copy code button */}
          <button
            onClick={handleCopyCode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'none',
              border: 'none',
              color: copied ? '#10b981' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: '1rem', position: 'relative' }}>
        {viewMode === 'code' || renderError ? (
          <div>
            {renderError && (
              <div
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                }}
              >
                <strong>图表语法解析失败：</strong>
                <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {renderError}
                </div>
              </div>
            )}
            <pre
              style={{
                margin: 0,
                padding: '0.75rem',
                borderRadius: '6px',
                background: isLightTheme ? '#f6f8fa' : 'rgba(0, 0, 0, 0.3)',
                overflowX: 'auto',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: isLightTheme ? '#24292e' : '#e2e8f0',
                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
              }}
            >
              <code>{chart}</code>
            </pre>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '80px',
              overflowX: 'auto',
            }}
          >
            {rendering ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                图表渲染中...
              </div>
            ) : (
              <div
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
