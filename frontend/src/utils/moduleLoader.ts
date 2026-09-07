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
}

export const DEFAULT_FALLBACK_MODULES: ModuleMeta[] = [
  {
    key: 'shield',
    path: '/shield',
    entry: '/shield/assets/remoteEntry.js',
    title: '代码质量 (Code Shield)',
    icon: 'Shield',
    description: '码盾守护代码质量与资产安全。支持自动化代码评审、敏感信息扫描、合规性审计等功能。',
  },
  {
    key: 'pipeline',
    path: '/pipeline',
    entry: '/pipeline/assets/remoteEntry.js',
    title: '持续构建 (Code Pipeline)',
    icon: 'Activity',
    description: '自动化持续构建与流水线管理。支持代码仓同步、流水线配置、多方案执行以及看板状态大屏呈现。',
  },
  {
    key: 'pdm',
    path: '/pdm',
    entry: '/pdm/assets/remoteEntry.js',
    title: '产品数据管理 (PDM)',
    icon: 'ClipboardList',
    description: '规范物理产品大类与设备ID档案。支持按规则下拉过滤、设备ID首字母/后缀拼合生成及资产数据导出。',
  },
];

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
    const res = await fetch('/api/modules');
    if (!res.ok) {
      throw new Error(`Failed to fetch modules: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (Array.isArray(data.modules) && data.modules.length > 0) {
      return data.modules;
    }
    return DEFAULT_FALLBACK_MODULES;
  } catch (err) {
    console.warn('[ModuleLoader] Failed to fetch active modules, using default fallback:', err);
    return DEFAULT_FALLBACK_MODULES;
  }
}
