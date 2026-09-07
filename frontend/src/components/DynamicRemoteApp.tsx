import React, { Suspense, useMemo } from 'react';
import { ErrorBoundary } from '@code/common';
import { loadRemoteModule } from '../utils/moduleLoader';

interface DynamicRemoteAppProps {
  entry: string;
  moduleKey: string;
  title: string;
  isEmbedded?: boolean;
}

export const DynamicRemoteApp: React.FC<DynamicRemoteAppProps> = ({
  entry,
  moduleKey,
  title,
  isEmbedded = true,
}) => {
  const LazyApp = useMemo(() => {
    return React.lazy<React.ComponentType<{ isEmbedded?: boolean }>>(async () => {
      try {
        const mod = await loadRemoteModule(entry, './App');
        const Component = mod.default || mod.App || mod;
        return { default: Component };
      } catch (err: any) {
        console.error(`[DynamicRemoteApp] Failed to load module "${moduleKey}" from "${entry}":`, err);
        return {
          default: () => (
            <div style={{ padding: '6rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem' }}>⚠️</div>
              <h3 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.25rem' }}>
                加载 {title} 失败
              </h3>
              <p style={{ maxWidth: '500px', textAlign: 'center', margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                无法从 <code>{entry}</code> 加载远程微前端资源。请检查目标微服务是否正常启动且反向代理配置正确。
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '0.5rem' }}
                onClick={() => window.location.reload()}
              >
                刷新重试
              </button>
            </div>
          ),
        };
      }
    });
  }, [entry, moduleKey, title]);

  return (
    <ErrorBoundary key={`eb-${moduleKey}`}>
      <Suspense
        fallback={
          <div style={{ padding: '8rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', color: 'var(--text-secondary)' }}>
            <div className="spinner"></div>
            <span style={{ fontSize: '0.95rem' }}>正在加载 {title} 微应用...</span>
          </div>
        }
      >
        <LazyApp isEmbedded={isEmbedded} />
      </Suspense>
    </ErrorBoundary>
  );
};
