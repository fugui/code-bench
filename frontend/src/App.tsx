import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  Brain, 
  Bot,
  Cpu,
  Database,
  Terminal,
  FolderGit2,
  Box,
  Wrench,
  Server,
  Gauge,
  Workflow,
  Globe,
  Bell,
  Code2,
  Package,
  Sun, 
  Moon, 
  Users, 
  UserCheck, 
  Activity, 
  MessageSquare, 
  ClipboardList, 
  BookOpen, 
  ScrollText, 
  Layers, 
  FileCode,
  LayoutGrid,
  Pin,
  PinOff,
  Search
} from 'lucide-react';
import Login from './Login';
import UserManagement from './pages/UserManagement';
import TeamManagement from './pages/TeamManagement';
import DeveloperDocs from './pages/DeveloperDocs';
import FeedbackCenter from './pages/FeedbackCenter';
import AuditManagement from './pages/AuditManagement';
import { ToastProvider } from './components/Toast';
import { DynamicRemoteApp } from './components/DynamicRemoteApp';
import { fetchActiveModules, loadRemoteModule, type ModuleMeta } from './utils/moduleLoader';
import { AppDrawer } from './components/AppDrawer';

// Set global environment flag for federated sub-applications
(window as any).__POWERED_BY_PORTAL__ = true;

import { ConfirmProvider, UserMenu, setupFetchInterceptor, VersionNotification } from '@code/common';

// Setup unified global fetch interceptor
setupFetchInterceptor();

interface AuthContextValue {
  user: any;
  isSuperAdmin: boolean;
}

export const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  isSuperAdmin: false,
});

export const useAuth = () => React.useContext(AuthContext);

export interface PinnedContextValue {
  pinnedKeys: string[];
  togglePin: (key: string) => void;
  openAppDrawer: () => void;
  closeAppDrawer: () => void;
  isAppDrawerOpen: boolean;
}

export const PinnedContext = React.createContext<PinnedContextValue>({
  pinnedKeys: [],
  togglePin: () => {},
  openAppDrawer: () => {},
  closeAppDrawer: () => {},
  isAppDrawerOpen: false,
});

export const usePinned = () => React.useContext(PinnedContext);

const ICON_MAP: Record<string, any> = {
  Shield,
  Activity,
  ClipboardList,
  FileCode,
  Brain,
  Bot,
  Cpu,
  Database,
  Terminal,
  FolderGit2,
  Box,
  Wrench,
  Server,
  Gauge,
  Workflow,
  Globe,
  Bell,
  Code2,
  Package,
  Layers,
  Users,
  MessageSquare,
  BookOpen,
  ScrollText,
};

export function getModuleIcon(iconName?: string) {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return Layers;
}

function NavLink({ to, icon: Icon, label, activePattern, onClick }: { to: string; icon: any; label: string; activePattern?: RegExp; onClick?: (e: React.MouseEvent) => void }) {
  const location = useLocation();
  const isActive = activePattern 
    ? activePattern.test(location.pathname) 
    : location.pathname === to;

  return (
    <Link to={to} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem',
      borderRadius: '10px', textDecoration: 'none',
      color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
      background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
      fontWeight: isActive ? 600 : 500,
      fontSize: '0.95rem',
      transition: 'all 0.25s ease',
      borderLeft: isActive ? '3px solid var(--primary-color)' : '3px solid transparent'
    }}>
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
}

function Home({ modules }: { modules: ModuleMeta[] }) {
  const { isSuperAdmin } = useAuth();
  const { pinnedKeys, togglePin, openAppDrawer } = usePinned();

  const visibleModules = modules.filter((mod) => {
    const isSuperAdminOnly = Boolean(mod.superAdminOnly || mod.key === 'gate');
    return !isSuperAdminOnly || isSuperAdmin;
  });

  return (
    <div style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '0.5rem' }}>欢迎使用 CodeBench 开发者综合工作台</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, margin: 0, maxWidth: '800px' }}>
            这里是您的一站式研发效能与安全管理中心。我们聚合了代码质量检测、持续构建流水线以及产品数据管理等核心业务系统。
          </p>
        </div>
        <button
          type="button"
          onClick={openAppDrawer}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            color: 'var(--text-color)',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-color)';
            e.currentTarget.style.color = 'var(--primary-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-color)';
          }}
        >
          <LayoutGrid size={18} color="var(--primary-color)" />
          <span>全部应用中心 ({visibleModules.length})</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {visibleModules.map((mod) => {
          const Icon = getModuleIcon(mod.icon);
          const isPinned = pinnedKeys.includes(mod.key);

          return (
            <div key={mod.key} className="portal-card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <Icon size={24} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>{mod.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePin(mod.key);
                  }}
                  title={isPinned ? '从侧边栏常用移除' : '钉选至侧边栏常用'}
                  style={{
                    background: isPinned ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-color)',
                    border: isPinned ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)',
                    color: isPinned ? 'var(--primary-color)' : 'var(--text-secondary)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                    e.currentTarget.style.color = 'var(--primary-color)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isPinned ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-color)';
                    e.currentTarget.style.color = isPinned ? 'var(--primary-color)' : 'var(--text-secondary)';
                  }}
                >
                  <Pin size={13} fill={isPinned ? 'currentColor' : 'none'} />
                  <span>{isPinned ? '已钉选' : '钉选'}</span>
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
                {mod.description || '一站式微前端业务应用系统。'}
              </p>
              <Link to={mod.path} className="card-btn">进入系统 &rarr;</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const subNavLinkStyle = (isActive: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.45rem 0.65rem',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '0.85rem',
  color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
  background: isActive ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
  fontWeight: isActive ? 600 : 500,
  transition: 'all 0.2s',
} as React.CSSProperties);

const renderSubIcon = (item: any, isActive: boolean) => {
  if (!item || !item.icon) return null;
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: isActive ? 1 : 0.65, flexShrink: 0 }}
    >
      <path d={item.icon} />
    </svg>
  );
};

interface ModuleNavSectionProps {
  module: ModuleMeta;
  menuData?: { items: any[]; groups: any[] };
  collapsed: boolean;
  onToggleCollapse: () => void;
  location: any;
  user: any;
  isSuperAdmin: boolean;
}

function ModuleNavSection({
  module,
  menuData,
  collapsed,
  onToggleCollapse,
  location,
  user,
  isSuperAdmin,
}: ModuleNavSectionProps) {
  const isModuleSuperAdminOnly = Boolean(module.superAdminOnly || (menuData as any)?.superAdminOnly || module.key === 'gate');
  if (isModuleSuperAdminOnly && !isSuperAdmin) {
    return null;
  }

  const modPath = module.path;
  const isMatch = location.pathname === modPath || location.pathname.startsWith(modPath + '/');
  const Icon = getModuleIcon(module.icon);

  let userRoles: string[] = [];
  if (user) {
    if (Array.isArray(user.roles)) {
      userRoles = user.roles;
    } else if (typeof user.roles === 'string') {
      try { userRoles = JSON.parse(user.roles); } catch (e) { userRoles = []; }
    }
  }
  const isModAdmin = isSuperAdmin || userRoles.includes(`${module.key}_admin`);

  const groups = menuData?.groups || [];
  const flatItems = menuData?.items || [];
  const hasSubmenu = groups.length > 0 || flatItems.length > 0;

  return (
    <>
      <NavLink
        to={modPath}
        icon={Icon}
        label={module.title}
        activePattern={new RegExp(`^${modPath}`)}
        onClick={(e) => {
          if (location.pathname.startsWith(modPath)) {
            e.preventDefault();
            onToggleCollapse();
          } else {
            onToggleCollapse();
          }
        }}
      />
      {isMatch && !collapsed && hasSubmenu && (
        <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          {groups.length > 0 ? (
            groups.map((group: any) => {
              if (group.superAdminOnly && !isSuperAdmin) return null;
              if (group.adminOnly && !isModAdmin) return null;

              const visibleItems = (group.items || []).filter((item: any) => {
                if (module.key === 'shield' && (item.path === '/admin/teams' || item.path === '/admin/users')) return false;
                if (item.superAdminOnly) return isSuperAdmin;
                if (item.adminOnly) return isModAdmin;
                return true;
              });

              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.6, padding: '0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {group.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.25rem' }}>
                    {visibleItems.map((item: any) => {
                      const fullPath = `${modPath}${item.path === '/' ? '' : item.path}`;
                      const isRoot = item.path === '/' || item.path === '/dashboard';
                      const isActive = isRoot
                        ? (location.pathname === modPath || location.pathname === `${modPath}/` || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'))
                        : (location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'));
                      return (
                        <Link
                          key={item.path}
                          to={fullPath}
                          style={subNavLinkStyle(isActive)}
                        >
                          {renderSubIcon(item, isActive)}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            flatItems.map((item: any) => {
              if (module.key === 'shield' && (item.path === '/admin/teams' || item.path === '/admin/users')) return false;
              if (item.superAdminOnly && !isSuperAdmin) return null;
              if (item.adminOnly && !isModAdmin) return null;

              const fullPath = `${modPath}${item.path === '/' ? '' : item.path}`;
              const isRoot = item.path === '/' || item.path === '/dashboard';
              const isActive = isRoot
                ? (location.pathname === modPath || location.pathname === `${modPath}/` || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'))
                : (location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'));
              return (
                <Link
                  key={item.path}
                  to={fullPath}
                  style={subNavLinkStyle(isActive)}
                >
                  {renderSubIcon(item, isActive)}
                  <span>{item.label}</span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

function MainLayout({ children, modules }: { children: React.ReactNode; modules: ModuleMeta[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moduleMenus, setModuleMenus] = React.useState<Record<string, { items: any[]; groups: any[] }>>({});
  const [collapsedState, setCollapsedState] = React.useState<Record<string, boolean>>({});
  const prevModuleRef = React.useRef<string>('');

  React.useEffect(() => {
    const activeMod = modules.find(m => location.pathname === m.path || location.pathname.startsWith(m.path + '/'));
    const currentKey = activeMod ? activeMod.key : '';
    if (currentKey !== prevModuleRef.current) {
      setCollapsedState(_prev => {
        const next: Record<string, boolean> = {};
        modules.forEach(m => {
          next[m.key] = m.key !== currentKey;
        });
        return next;
      });
      prevModuleRef.current = currentKey;
    }
  }, [location.pathname, modules]);

  const collapseAll = () => {
    setCollapsedState(_prev => {
      const next: Record<string, boolean> = {};
      modules.forEach(m => { next[m.key] = true; });
      return next;
    });
  };

  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('code-theme') as 'dark' | 'light') || 'light';
  });
  const [user, setUser] = React.useState<any>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const authConfigRef = React.useRef<any>(null);

  const portalFetch = (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('code_shield_token');
    const headers = {
      ...options.headers,
      'X-Portal-Request': 'true',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  const loadUser = () => {
    const token = localStorage.getItem('code_shield_token');
    if (!token) {
      setUser(null);
      setLoadingUser(false);
      return;
    }
    portalFetch('/api/me')
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem('code_shield_token');
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(data => {
        if (data) {
          setUser(data);

          const activeConfig = authConfigRef.current;
          if (activeConfig?.dept_api_url && !data.department_id && !sessionStorage.getItem('dept_synced')) {
            sessionStorage.setItem('dept_synced', 'true');
            console.log('[MainLayout] Syncing user department from api via proxy:', activeConfig.dept_api_url);
            portalFetch('/api/me/department-proxy')
              .then(res => {
                if (res.status === 403) {
                  const loginUrl = res.headers.get('x-login-url');
                  const service = res.headers.get('x-login-service');
                  const appid = res.headers.get('x-login-appid');
                  console.warn(`[MainLayout] Department sync API returned 403 Forbidden. Auth gateway info: url=${loginUrl}, service=${service}, appid=${appid}`);
                }
                return res.ok ? res.json() : null;
              })
              .then(deptData => {
                if (!deptData) return;
                const deptName = deptData?.data?.department;
                if (deptName) {
                  console.log('[MainLayout] Found department:', deptName, ', sending update to portal...');
                  portalFetch('/api/me/department', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ department: deptName })
                  })
                  .then(updateRes => {
                    if (updateRes.ok) {
                      console.log('[MainLayout] Department sync successful');
                      loadUser();
                    }
                  })
                  .catch(err => console.error('[MainLayout] Failed to update user department:', err));
                }
              })
              .catch(err => console.error('[MainLayout] Failed to proxy department fetch:', err));
          }
        } else {
          setUser(null);
        }
        setLoadingUser(false);
      })
      .catch(() => {
        setUser(null);
        setLoadingUser(false);
      });
  };

  React.useEffect(() => {
    loadUser();

    fetch('/api/auth/config', { headers: { 'X-Portal-Request': 'true' } })
      .then(res => res.json())
      .then(configData => {
        authConfigRef.current = configData;
        if (localStorage.getItem('code_shield_token')) {
          loadUser();
        }
      })
      .catch(err => console.error('Failed to load auth config in portal:', err));

    window.addEventListener('auth-change', loadUser);
    return () => window.removeEventListener('auth-change', loadUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('code_shield_token');
    sessionStorage.removeItem('sso_error_flag');
    sessionStorage.removeItem('dept_synced');
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
    navigate('/', { replace: true });
  };

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
    root.style.setProperty('--portal-header-height', '80px');
    root.style.setProperty('--portal-sidebar-width', '280px');
    localStorage.setItem('code-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  React.useEffect(() => {
    if (modules.length === 0 || !user) return;
    const unsubs: Array<() => void> = [];

    modules.forEach((mod) => {
      loadRemoteModule(mod.entry, './menu')
        .then((menuMod) => {
          const updateMenu = (cfg: any) => {
            let groups: any[] = [];
            let items: any[] = [];
            const c = cfg || menuMod.menuConfig || (menuMod.default?.groups ? menuMod.default : (menuMod[`${mod.key}MenuConfig`] || menuMod.default));
            if (c && Array.isArray(c.groups)) {
              groups = c.groups;
              items = c.groups.flatMap((g: any) => g.items || []);
            } else if (menuMod.menuGroups && Array.isArray(menuMod.menuGroups)) {
              groups = menuMod.menuGroups;
              items = menuMod.menuItems || groups.flatMap((g: any) => g.items || []);
            } else {
              const rawItems = menuMod.menuItems || menuMod.default || (Array.isArray(menuMod) ? menuMod : []);
              if (Array.isArray(rawItems)) items = rawItems;
            }
            setModuleMenus((prev) => ({
              ...prev,
              [mod.key]: { items, groups, superAdminOnly: c?.superAdminOnly },
            }));
          };

          updateMenu(menuMod);

          if (typeof menuMod.subscribeMenuChanges === 'function') {
            const unsub = menuMod.subscribeMenuChanges(updateMenu);
            if (typeof unsub === 'function') unsubs.push(unsub);
          }
        })
        .catch((err) => {
          console.warn(`[MainLayout] Failed to dynamically load menu for ${mod.key}:`, err);
          let fallbackItems: any[] = [{ path: '/', label: '控制中心' }];
          if (mod.key === 'shield') {
            fallbackItems = [
              { path: '/reports', label: '报告概览' },
              { path: '/analysis/ut', label: '测试有效性' },
              { path: '/admin/scan', label: '扫描任务', adminOnly: true },
              { path: '/admin/task-types', label: '任务类型', adminOnly: true },
              { path: '/admin/teams', label: '团队与代码仓', adminOnly: true },
              { path: '/admin/users', label: '用户管理', adminOnly: true },
              { path: '/admin/activity', label: '执行日志', adminOnly: true }
            ];
          }
          setModuleMenus((prev) => ({
            ...prev,
            [mod.key]: { items: fallbackItems, groups: [] },
          }));
        });
    });

    const handleShieldChanged = () => {
      const shieldMod = modules.find((m) => m.key === 'shield');
      if (!shieldMod || !user) return;
      loadRemoteModule(shieldMod.entry, './menu')
        .then((mod) => {
          if (mod && typeof mod.fetchShieldMenuConfig === 'function') {
            mod.fetchShieldMenuConfig().then((cfg: any) => {
              if (cfg && Array.isArray(cfg.groups)) {
                setModuleMenus((prev) => ({
                  ...prev,
                  shield: { items: cfg.groups.flatMap((g: any) => g.items || []), groups: cfg.groups },
                }));
              }
            }).catch(() => {});
          }
        })
        .catch(() => {});
    };
    window.addEventListener('shield-task-types-changed', handleShieldChanged);

    return () => {
      unsubs.forEach((fn) => fn());
      window.removeEventListener('shield-task-types-changed', handleShieldChanged);
    };
  }, [modules, user]);

  let userRoles: string[] = [];
  if (user) {
    if (Array.isArray(user.roles)) {
      userRoles = user.roles;
    } else if (typeof user.roles === 'string') {
      try { userRoles = JSON.parse(user.roles); } catch (e) { userRoles = []; }
    }
  }
  const isSuperAdmin = !!(user && userRoles.includes('super_admin'));
  const canManageTeams = !!(user && (isSuperAdmin || userRoles.includes('bench_admin')));

  const usernameOrId = user?.username || user?.preferred_username || user?.id || (user ? 'user' : 'guest');
  const storageKey = `code_bench_pinned_modules_${usernameOrId}`;

  const [isAppDrawerOpen, setIsAppDrawerOpen] = React.useState(false);
  const [pinnedKeys, setPinnedKeys] = React.useState<string[]>([]);

  // Accessible modules for current user
  const accessibleModules = React.useMemo(() => {
    return modules.filter((mod) => {
      const isModuleSuperAdminOnly = Boolean(mod.superAdminOnly || (moduleMenus[mod.key] as any)?.superAdminOnly || mod.key === 'gate');
      return !isModuleSuperAdminOnly || isSuperAdmin;
    });
  }, [modules, moduleMenus, isSuperAdmin]);

  // Synchronize pinnedKeys with localStorage for the current user
  React.useEffect(() => {
    if (modules.length === 0) return;

    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPinnedKeys(parsed);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse pinned modules from localStorage', e);
      }
    }

    // Default Fallback: If user has never set preference
    const defaultPinned = accessibleModules
      .filter(m => m.defaultPinned)
      .map(m => m.key);

    const initialKeys = defaultPinned.length > 0
      ? defaultPinned
      : accessibleModules.slice(0, 4).map(m => m.key);

    setPinnedKeys(initialKeys);
    try {
      localStorage.setItem(storageKey, JSON.stringify(initialKeys));
    } catch (e) {
      console.warn('Failed to save default pinned modules', e);
    }
  }, [storageKey, modules, accessibleModules]);

  const togglePin = React.useCallback((key: string) => {
    setPinnedKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist pinned modules to localStorage', e);
      }
      return next;
    });
  }, [storageKey]);

  // Current pinned modules (filtered by current user accessibility)
  const pinnedModules = React.useMemo(() => {
    return accessibleModules.filter((mod) => pinnedKeys.includes(mod.key));
  }, [accessibleModules, pinnedKeys]);

  // Temporary highlight for unpinned module when visited via direct URL or card click
  const temporaryActiveModule = React.useMemo(() => {
    const currentPath = location.pathname;
    const currentMod = accessibleModules.find((m) => currentPath === m.path || currentPath.startsWith(m.path + '/'));
    if (currentMod && !pinnedKeys.includes(currentMod.key)) {
      return currentMod;
    }
    return null;
  }, [accessibleModules, pinnedKeys, location.pathname]);

  const isPublicRoute = location.pathname.startsWith('/shield/public/');

  if (isPublicRoute) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
        {children}
      </div>
    );
  }

  // Enforce authentication gate
  if (loadingUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b1120', color: '#64748b', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .spinner { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(59,130,246,0.2); border-top: 2px solid #3b82f6; animation: spin 0.8s linear infinite; }
        `}</style>
        <div className="spinner"></div>
        <span style={{ marginLeft: '12px', fontSize: '0.95rem', fontWeight: 500 }}>正在验证身份...</span>
      </div>
    );
  }

  if (!user && location.pathname !== '/oauth2/callback') {
    return <Login onLoginSuccess={loadUser} />;
  }

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin }}>
      <PinnedContext.Provider value={{
        pinnedKeys,
        togglePin,
        openAppDrawer: () => setIsAppDrawerOpen(true),
        closeAppDrawer: () => setIsAppDrawerOpen(false),
        isAppDrawerOpen,
      }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
        {/* Sidebar */}
        <aside style={{ width: '280px', background: 'var(--card-bg)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
          <div style={{ height: '80px', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.25rem', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
              CB
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '1.05rem', color: 'var(--text-color)', fontWeight: 700, letterSpacing: '0.5px' }}>CodeBench</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>开发者工作台</span>
            </div>
          </div>

          <nav style={{ padding: '1.5rem 0.5rem 1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
            <NavLink to="/" icon={LayoutDashboard} label="首页" onClick={collapseAll} />

            {/* 全部应用入口 */}
            <button
              type="button"
              onClick={() => setIsAppDrawerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderRadius: '10px',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                background: isAppDrawerOpen ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: isAppDrawerOpen ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: 500,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                borderLeft: isAppDrawerOpen ? '3px solid var(--primary-color)' : '3px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (!isAppDrawerOpen) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                  e.currentTarget.style.color = 'var(--text-color)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAppDrawerOpen) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <LayoutGrid size={20} />
              <span style={{ flex: 1 }}>全部应用</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--primary-color)',
                fontWeight: 600
              }}>
                {accessibleModules.length}
              </span>
            </button>

            {/* 分组标题：我的常用 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.75rem 0.25rem 0.5rem',
              marginTop: '0.5rem',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.85rem'
            }}>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                opacity: 0.7,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                我的常用
              </span>
              <button
                type="button"
                onClick={() => setIsAppDrawerOpen(true)}
                title="管理常用钉选"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: 'var(--primary-color)',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontWeight: 500
                }}
              >
                <Pin size={11} fill="currentColor" />
                <span>管理 ({pinnedModules.length})</span>
              </button>
            </div>

            {/* 钉选微前端应用列表 */}
            {pinnedModules.length === 0 ? (
              <div style={{
                padding: '0.75rem 0.75rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.5
              }}>
                暂无钉选应用，点击上方的「全部应用」进行钉选
              </div>
            ) : (
              pinnedModules.map((mod) => {
                const menuData = moduleMenus[mod.key];
                return (
                  <ModuleNavSection
                    key={mod.key}
                    module={mod}
                    menuData={menuData}
                    collapsed={collapsedState[mod.key] ?? false}
                    onToggleCollapse={() => {
                      setCollapsedState((prev) => ({
                        ...prev,
                        [mod.key]: !(prev[mod.key] ?? false),
                      }));
                    }}
                    location={location}
                    user={user}
                    isSuperAdmin={isSuperAdmin}
                  />
                );
              })
            )}

            {/* 非钉选路由访问临时高亮呈现 (Temporary Highlight) */}
            {temporaryActiveModule && (
              <div style={{
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px dashed var(--border-color)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.2rem 0.75rem 0.4rem 0.5rem',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--primary-color)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)' }}></span>
                    当前访问 (未钉选)
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePin(temporaryActiveModule.key)}
                    title="钉选到我的常用"
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      fontWeight: 600
                    }}
                  >
                    <Pin size={11} />
                    <span>钉选</span>
                  </button>
                </div>
                <ModuleNavSection
                  key={temporaryActiveModule.key}
                  module={temporaryActiveModule}
                  menuData={moduleMenus[temporaryActiveModule.key]}
                  collapsed={collapsedState[temporaryActiveModule.key] ?? false}
                  onToggleCollapse={() => {
                    setCollapsedState((prev) => ({
                      ...prev,
                      [temporaryActiveModule.key]: !(prev[temporaryActiveModule.key] ?? false),
                    }));
                  }}
                  location={location}
                  user={user}
                  isSuperAdmin={isSuperAdmin}
                />
              </div>
            )}

          {user && (canManageTeams || isSuperAdmin) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.6, paddingLeft: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                系统管理
              </div>
              {canManageTeams && (
                <NavLink to="/admin/teams" icon={Users} label="团队与代码仓" activePattern={/^\/admin\/teams/} onClick={collapseAll} />
              )}
              {isSuperAdmin && (
                <>
                  <NavLink to="/admin/users" icon={UserCheck} label="用户管理" activePattern={/^\/admin\/users/} onClick={collapseAll} />
                  <NavLink to="/admin/audit" icon={ScrollText} label="操作审计" activePattern={/^\/admin\/audit/} onClick={collapseAll} />
                </>
              )}
            </div>
          )}
        </nav>
        {user && (
          <div style={{ padding: '1.25rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <NavLink to="/docs" icon={BookOpen} label="开发人员手册" activePattern={/^\/docs/} onClick={collapseAll} />
            <NavLink to="/feedback" icon={MessageSquare} label="改进建议与反馈" activePattern={/^\/feedback/} onClick={collapseAll} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ 
          height: '80px',
          minHeight: '80px', 
          background: 'var(--card-bg)', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 2.5rem', 
          justifyContent: 'space-between', 
          zIndex: 'var(--z-index-header, 1100)' as any,
          position: 'sticky',
          top: 0
        }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600, color: 'var(--text-color)' }}>
            {(() => {
              const pathname = location.pathname;
              if (pathname === '/') return '首页';
              if (pathname.startsWith('/docs')) return '开发人员手册';
              if (pathname.startsWith('/feedback')) return '产品改进与建议反馈中心';
              if (pathname.startsWith('/admin/teams')) return '团队与代码仓管理';
              if (pathname.startsWith('/admin/users')) return '用户管理';
              if (pathname.startsWith('/admin/audit')) return '全局操作审计';
              if (pathname.startsWith('/modelgate')) return '大模型网关 (ModelGate)';

              for (const mod of modules) {
                if (pathname.startsWith(mod.path)) {
                  const menuData = moduleMenus[mod.key];
                  const isModSuperAdminOnly = Boolean(mod.superAdminOnly || (menuData as any)?.superAdminOnly || mod.key === 'gate');
                  if (isModSuperAdminOnly && !isSuperAdmin) {
                    return '开发者综合工作台';
                  }
                  const items = menuData?.items || [];
                  const matchedItem = items.find((item: any) => {
                    const fullPath = `${mod.path}${item.path === '/' ? '' : item.path}`;
                    return pathname === fullPath || pathname.startsWith(fullPath + '/');
                  });
                  if (matchedItem) {
                    return matchedItem.headerTitle || matchedItem.label;
                  }
                  return mod.title;
                }
              }

              return '开发者综合工作台';
            })()}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <button 
              type="button"
              onClick={() => setIsAppDrawerOpen(true)} 
              style={{ 
                background: 'var(--bg-color)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                height: '36px',
                padding: '0 0.75rem',
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.45rem',
                cursor: 'pointer', 
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 500,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' 
              }}
              title="全部应用中心 (App Drawer)"
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.color = 'var(--primary-color)';
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-color)';
                e.currentTarget.style.background = 'var(--bg-color)';
              }}
            >
              <LayoutGrid size={16} />
              <span>全部应用</span>
            </button>

            <button 
              onClick={toggleTheme} 
              style={{ 
                background: 'var(--bg-color)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                width: '36px', 
                height: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                color: 'var(--text-color)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' 
              }}
              title={theme === 'dark' ? "切换为明亮模式" : "切换为暗黑模式"}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.color = 'var(--primary-color)';
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-color)';
                e.currentTarget.style.background = 'var(--bg-color)';
              }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

            {user ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <Link 
                to="/shield/login" 
                style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--primary-color)', 
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                登录系统
              </Link>
            )}
          </div>
        </header>

        <main className="portal-content" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-color)', position: 'relative' }}>
          {children}
          {/* 微前端工作区抽屉专用挂载锚点 */}
          <div id="portal-workspace-overlay-root" />
        </main>
      </div>

      {/* 应用中心抽屉 (App Drawer) */}
      <AppDrawer
        open={isAppDrawerOpen}
        onClose={() => setIsAppDrawerOpen(false)}
        modules={accessibleModules}
        pinnedKeys={pinnedKeys}
        onTogglePin={togglePin}
        getModuleIcon={getModuleIcon}
      />
    </div>
    </PinnedContext.Provider>
    </AuthContext.Provider>
  );
}

function PlaceholderView({ title, icon: Icon, color }: { title: string; icon: any; color: string }) {
  return (
    <div style={{ padding: '8rem 2rem 4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1.5rem' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: `rgba(${color}, 0.1)`, color: `rgb(${color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
        <Icon size={40} />
      </div>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)', margin: '0 0 0.5rem 0' }}>{title}</h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '500px', lineHeight: 1.6 }}>
          此应用模块目前正在建设中。主门户已预留其微前端接入锚点，部署完成后将通过模块联邦技术无缝呈现于此。
        </p>
      </div>
    </div>
  );
}

function OAuthCallback() {
  const navigate = useNavigate();
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('code_shield_token', token);
      sessionStorage.removeItem('sso_error_flag');
      sessionStorage.removeItem('dept_synced');
      window.dispatchEvent(new Event('auth-change'));
      navigate('/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b1120', color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 1rem', border: '3px solid rgba(59,130,246,0.2)', borderTop: '3px solid #3b82f6', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '0.95rem' }}>正在完成登录凭证处理...</span>
      </div>
    </div>
  );
}

function ModuleRouteGuard({ isSuperAdminOnly, children }: { isSuperAdminOnly: boolean; children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  if (isSuperAdminOnly && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [modules, setModules] = React.useState<ModuleMeta[]>([]);

  React.useEffect(() => {
    fetchActiveModules().then(setModules);
  }, []);

  return (
    <BrowserRouter>
      <ConfirmProvider>
        <ToastProvider>
          <MainLayout modules={modules}>
            <Routes>
              <Route path="/" element={<Home modules={modules} />} />
              <Route path="/docs/*" element={<DeveloperDocs />} />
              <Route path="/feedback/*" element={<FeedbackCenter />} />
              <Route path="/oauth2/callback" element={<OAuthCallback />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/audit" element={<AuditManagement />} />
              <Route path="/admin/teams" element={<TeamManagement />} />
              <Route path="/admin/teams/:tab" element={<TeamManagement />} />
              <Route path="/modelgate/*" element={<PlaceholderView title="大模型网关 (ModelGate)" icon={Brain} color="168, 85, 247" />} />

              {modules.map((mod) => {
                const isSuperAdminOnly = Boolean(mod.superAdminOnly || mod.key === 'gate');
                return (
                  <Route
                    key={mod.key}
                    path={`${mod.path}/*`}
                    element={
                      <ModuleRouteGuard isSuperAdminOnly={isSuperAdminOnly}>
                        <DynamicRemoteApp
                          entry={mod.entry}
                          moduleKey={mod.key}
                          title={mod.title}
                          isEmbedded={true}
                        />
                      </ModuleRouteGuard>
                    }
                  />
                );
              })}
            </Routes>
          </MainLayout>
          <VersionNotification />
        </ToastProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
}

