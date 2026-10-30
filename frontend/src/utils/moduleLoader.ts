import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactRouterDom from 'react-router-dom';

export interface RemoteContainer {
  init: (shareScope: any) => Promise<void> | void;
  get: (module: string) => Promise<() => any>;
}

export interface ModuleMeta {
  key: string;
  path: string;
  entry: string;
  title: string;
  icon?: string;
  description?: string;
  superAdminOnly?: boolean;
}

export const DEFAULT_FALLBACK_MODULES: ModuleMeta[] = [];

function getSharedScope() {
  const defaultScope = {
    react: {
      '18.2.0': {
        get: () => Promise.resolve(() => React),
        loaded: 1,
        scope: 'default',
      },
    },
    'react-dom': {
      '18.2.0': {
        get: () => Promise.resolve(() => ReactDOM),
        loaded: 1,
        scope: 'default',
      },
    },
    'react-router-dom': {
      '6.22.3': {
        get: () => Promise.resolve(() => ReactRouterDom),
        loaded: 1,
        scope: 'default',
      },
    },
  };

  if (!(globalThis as any).__federation_shared__) {
    (globalThis as any).__federation_shared__ = {};
  }
  const shared = (globalThis as any).__federation_shared__;
  shared.default = {
    ...defaultScope,
    ...(shared.default || {}),
  };

  return shared.default;
}

const containerCache = new Map<string, Promise<RemoteContainer>>();
const moduleCache = new Map<string, Promise<any>>();

export async function loadRemoteContainer(entryUrl: string): Promise<RemoteContainer> {
  if (containerCache.has(entryUrl)) {
    return containerCache.get(entryUrl)!;
  }

  const promise = (async () => {
    // 动态拉取远程微前端入口模块
    const container = (await import(/* @vite-ignore */ entryUrl)) as RemoteContainer;

    if (!container || typeof container.init !== 'function' || typeof container.get !== 'function') {
      throw new Error(`Remote entry at "${entryUrl}" does not satisfy the Module Federation container contract.`);
    }

    const sharedScope = getSharedScope();
    try {
      await container.init(sharedScope);
    } catch (err) {
      console.warn(`[ModuleLoader] container.init warning for "${entryUrl}":`, err);
    }

    return container;
  })().catch((err) => {
    containerCache.delete(entryUrl);
    throw err;
  });

  containerCache.set(entryUrl, promise);
  return promise;
}

export async function loadRemoteModule<T = any>(entryUrl: string, exposePath: string): Promise<T> {
  const cacheKey = `${entryUrl}::${exposePath}`;
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey)!;
  }

  const promise = (async () => {
    const container = await loadRemoteContainer(entryUrl);
    const factory = await container.get(exposePath);
    if (typeof factory !== 'function') {
      throw new Error(`Factory for "${exposePath}" in "${entryUrl}" is not a function.`);
    }
    const mod = factory();
    return mod;
  })().catch((err) => {
    moduleCache.delete(cacheKey);
    throw err;
  });

  moduleCache.set(cacheKey, promise);
  return promise;
}

export async function fetchActiveModules(): Promise<ModuleMeta[]> {
  try {
    const res = await fetch('/api/modules', { headers: { 'X-Portal-Request': 'true' } });
    if (!res.ok) {
      throw new Error(`Failed to fetch modules: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (Array.isArray(data.modules)) {
      return data.modules;
    }
    return DEFAULT_FALLBACK_MODULES;
  } catch (err) {
    console.warn('[ModuleLoader] Failed to fetch active modules:', err);
    return DEFAULT_FALLBACK_MODULES;
  }
}
