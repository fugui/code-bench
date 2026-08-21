import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Brain, Sun, Moon, Users, UserCheck, Activity, MessageSquare, ClipboardList, BookOpen, ScrollText } from 'lucide-react';
import Login from './Login';
import UserManagement from './pages/UserManagement';
import TeamManagement from './pages/TeamManagement';
import DeveloperDocs from './pages/DeveloperDocs';
import FeedbackCenter from './pages/FeedbackCenter';
import AuditManagement from './pages/AuditManagement';
import { ToastProvider } from './components/Toast';

// Set global environment flag for federated sub-applications
(window as any).__POWERED_BY_PORTAL__ = true;

import { ErrorBoundary, ConfirmProvider, UserMenu, setupFetchInterceptor, VersionNotification } from '@code/common';

// Setup unified global fetch interceptor
setupFetchInterceptor();
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




// Lazy loading remote App from module federation
// @ts-ignore
const ShieldApp = React.lazy(() => import('shield/App'));
// @ts-ignore
const ProtoApp = React.lazy(() => import('proto/App'));
// @ts-ignore
const PipelineApp = React.lazy(() => import('pipeline/App'));
// @ts-ignore
const PdmApp = React.lazy(() => import('pdm/App'));

function Home() {
  return (
    <div style={{ padding: '2.5rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '1rem' }}>欢迎使用 CodeBench 开发者综合工作台</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '800px' }}>
        这里是您的一站式研发效能与安全管理中心。我们聚合了代码质量检测、持续构建流水线以及产品数据管理等核心业务系统。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <Shield size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>代码质量 (Code Shield)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
            码盾守护代码质量与资产安全。支持自动化代码评审、敏感信息扫描、合规性审计等功能。
          </p>
          <Link to="/shield" className="card-btn">进入系统 &rarr;</Link>
        </div>

        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
              <Activity size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>持续构建 (Code Pipeline)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
            自动化持续构建与流水线管理。支持代码仓同步、流水线配置、多方案执行以及看板状态大屏呈现。
          </p>
          <Link to="/pipeline" className="card-btn">进入系统 &rarr;</Link>
        </div>

        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <ClipboardList size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>产品数据管理 (PDM)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
            规范物理产品大类与设备ID档案。支持按规则下拉过滤、设备ID首字母/后缀拼合生成及资产 spreadsheet 数据导出。
          </p>
          <Link to="/pdm" className="card-btn">进入系统 &rarr;</Link>
        </div>
      </div>
    </div>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [shieldMenu, setShieldMenu] = React.useState<any[]>([]);
  const [shieldMenuGroups, setShieldMenuGroups] = React.useState<any[]>([]);
  const [pipelineMenu, setPipelineMenu] = React.useState<any[]>([]);
  const [pipelineMenuGroups, setPipelineMenuGroups] = React.useState<any[]>([]);
  const [pdmMenu, setPdmMenu] = React.useState<any[]>([]);
  const [pdmMenuGroups, setPdmMenuGroups] = React.useState<any[]>([]);
  const [shieldMenuCollapsed, setShieldMenuCollapsed] = React.useState(true);
  const [pipelineMenuCollapsed, setPipelineMenuCollapsed] = React.useState(true);
  const [pdmMenuCollapsed, setPdmMenuCollapsed] = React.useState(true);
  const prevModuleRef = React.useRef<string>('');

  React.useEffect(() => {
    const getModule = (path: string) => {
      if (path.startsWith('/shield')) return 'shield';
      if (path.startsWith('/proto')) return 'proto';
      if (path.startsWith('/pipeline')) return 'pipeline';
      if (path.startsWith('/pdm')) return 'pdm';
      return 'other';
    };

    const currentModule = getModule(location.pathname);
    const prevModule = prevModuleRef.current;

    if (currentModule !== prevModule) {
      if (currentModule === 'shield') {
        setShieldMenuCollapsed(false);
        setPipelineMenuCollapsed(true);
        setPdmMenuCollapsed(true);
      } else if (currentModule === 'pipeline') {
        setPipelineMenuCollapsed(false);
        setShieldMenuCollapsed(true);
        setPdmMenuCollapsed(true);
      } else if (currentModule === 'pdm') {
        setPdmMenuCollapsed(false);
        setShieldMenuCollapsed(true);
        setPipelineMenuCollapsed(true);
      } else {
        setShieldMenuCollapsed(true);
        setPipelineMenuCollapsed(true);
        setPdmMenuCollapsed(true);
      }
      prevModuleRef.current = currentModule;
    }
  }, [location.pathname]);

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

          // 自动拉取并同步部门信息逻辑
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
                      loadUser(); // 重新加载用户状态以刷新界面上的部门显示
                    }
                  })
                  .catch(err => console.error('[MainLayout] Failed to update user department:', err));
                } else {
                  console.warn('[MainLayout] Department field empty in API response:', deptData);
                }
              })
              .catch(err => console.error('[MainLayout] Failed to fetch department from API:', err));
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

    // 拉取 auth/config 以缓存 dept_api_url
    fetch('/api/auth/config', { headers: { 'X-Portal-Request': 'true' } })
      .then(res => res.json())
      .then(configData => {
        authConfigRef.current = configData;
        // 如果在此之前 loadUser 已经执行完，且 user 已经拿到但未绑定部门，手动触发一次拉取
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
    localStorage.setItem('code-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  React.useEffect(() => {
    // Dynamically load remote menu metadata from code-shield micro-frontend
    const updateShieldMenu = (config: any) => {
      if (config && Array.isArray(config.groups)) {
        setShieldMenuGroups(config.groups);
        setShieldMenu(config.groups.flatMap((g: any) => g.items));
      } else if (config && Array.isArray(config)) {
        setShieldMenu(config);
      }
    };

    // @ts-ignore
    import('shield/menu')
      .then(async mod => {
        if (mod) {
          const config = mod.shieldMenuConfig || (mod.default && mod.default.groups ? mod.default : null);
          if (config) {
            updateShieldMenu(config);
          }
          if (typeof mod.fetchShieldMenuConfig === 'function') {
            try {
              const dynamicConfig = await mod.fetchShieldMenuConfig();
              updateShieldMenu(dynamicConfig);
            } catch (e) {
              console.warn("Failed to fetch dynamic shield menu:", e);
            }
          }
          if (typeof mod.subscribeMenuChanges === 'function') {
            mod.subscribeMenuChanges(updateShieldMenu);
          }
        }
      })
      .catch(err => {
        console.warn("Failed to dynamically load shield menu, using robust fallback:", err);
        setShieldMenu([
          { path: '/reports', label: '报告概览' },
          { path: '/analysis/ut', label: '测试有效性' },
          { path: '/admin/scan', label: '扫描任务', adminOnly: true },
          { path: '/admin/task-types', label: '任务类型', adminOnly: true },
          { path: '/admin/teams', label: '团队与代码仓', adminOnly: true },
          { path: '/admin/users', label: '用户管理', adminOnly: true },
          { path: '/admin/activity', label: '执行日志', adminOnly: true }
        ]);
      });

    const handleShieldChanged = () => {
      // @ts-ignore
      import('shield/menu').then(mod => {
        if (mod && typeof mod.fetchShieldMenuConfig === 'function') {
          mod.fetchShieldMenuConfig().then(updateShieldMenu).catch(() => {});
        }
      }).catch(() => {});
    };
    window.addEventListener('shield-task-types-changed', handleShieldChanged);

    // Dynamically load remote menu metadata from code-pipeline micro-frontend
    // @ts-ignore
    import('pipeline/menu')
      .then(mod => {
        if (mod) {
          const config = mod.pipelineMenuConfig || (mod.default && mod.default.groups ? mod.default : null);
          if (config && Array.isArray(config.groups)) {
            setPipelineMenuGroups(config.groups);
            setPipelineMenu(config.groups.flatMap((g: any) => g.items));
          } else {
            if (mod.menuGroups && Array.isArray(mod.menuGroups)) {
              setPipelineMenuGroups(mod.menuGroups);
            }
            const items = mod.menuItems || mod.default || (Array.isArray(mod) ? mod : null);
            if (items && Array.isArray(items)) {
              setPipelineMenu(items);
            }
          }
        }
      })
      .catch(err => {
        console.warn("Failed to dynamically load pipeline menu, using robust fallback:", err);
        setPipelineMenu([
          { path: '/dashboard', label: '控制中心' },
          { path: '/repos', label: '仓库配置' }
        ]);
      });

    // Dynamically load remote menu metadata from code-pdm micro-frontend
    // @ts-ignore
    import('pdm/menu')
      .then(mod => {
        if (mod) {
          const config = mod.pdmMenuConfig || (mod.default && mod.default.groups ? mod.default : null);
          if (config && Array.isArray(config.groups)) {
            setPdmMenuGroups(config.groups);
            setPdmMenu(config.groups.flatMap((g: any) => g.items));
          } else {
            if (mod.menuGroups && Array.isArray(mod.menuGroups)) {
              setPdmMenuGroups(mod.menuGroups);
            }
            const items = mod.menuItems || mod.default || (Array.isArray(mod) ? mod : null);
            if (items && Array.isArray(items)) {
              setPdmMenu(items);
            }
          }
        }
      })
      .catch(err => {
        console.warn("Failed to dynamically load pdm menu, using fallback:", err);
        setPdmMenu([
          { path: '/device-type', label: '设备类型管理' },
          { path: '/device', label: '设备ID管理' }
        ]);
      });

    return () => {
      window.removeEventListener('shield-task-types-changed', handleShieldChanged);
    };
  }, []);

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
  const isShieldAdmin = !!(user && (isSuperAdmin || userRoles.includes('shield_admin')));

  return (
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
          <NavLink to="/" icon={LayoutDashboard} label="首页" onClick={() => { setShieldMenuCollapsed(true); setPipelineMenuCollapsed(true); setPdmMenuCollapsed(true); }} />
          <NavLink 
            to="/shield" 
            icon={Shield} 
            label="代码质量 (Code Shield)" 
            activePattern={/^\/shield/} 
            onClick={(e) => {
              if (location.pathname.startsWith('/shield')) {
                e.preventDefault();
                setShieldMenuCollapsed(!shieldMenuCollapsed);
              } else {
                setShieldMenuCollapsed(false);
                setPipelineMenuCollapsed(true);
                setPdmMenuCollapsed(true);
              }
            }}
          />
          {location.pathname.startsWith('/shield') && !shieldMenuCollapsed && (shieldMenuGroups.length > 0 || shieldMenu.length > 0) && (
            <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              {shieldMenuGroups.length > 0 ? (
                // Grouped Menu Layout
                shieldMenuGroups
                  .filter((group: any) => {
                    if (group.adminOnly) {
                      return isShieldAdmin;
                    }
                    return true;
                  })
                  .map((group: any) => {
                    const visibleItems = (group.items || []).filter((item: any) => {
                      if (item.path === '/admin/teams' || item.path === '/admin/users') {
                        return false;
                      }
                      if (item.adminOnly) {
                        return isShieldAdmin;
                      }
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
                            const fullPath = `/shield${item.path}`;
                            const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
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
                // Flat Menu Fallback Layout
                shieldMenu
                  .filter((item: any) => {
                    if (item.path === '/admin/teams' || item.path === '/admin/users') {
                      return false;
                    }
                    if (item.adminOnly || item.path === '/config' || item.path?.startsWith('/admin')) {
                      return isShieldAdmin;
                    }
                    return true;
                  })
                  .map((item: any) => {
                    const fullPath = `/shield${item.path}`;
                    const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
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


          <>
            <NavLink 
              to="/pipeline" 
              icon={Activity} 
              label="持续构建(Code Pipeline)" 
              activePattern={/^\/pipeline/} 
              onClick={(e) => {
                if (location.pathname.startsWith('/pipeline')) {
                  e.preventDefault();
                  setPipelineMenuCollapsed(!pipelineMenuCollapsed);
                } else {
                  setPipelineMenuCollapsed(false);
                  setShieldMenuCollapsed(true);
                  setPdmMenuCollapsed(true);
                }
              }}
            />
            {location.pathname.startsWith('/pipeline') && !pipelineMenuCollapsed && (pipelineMenuGroups.length > 0 || pipelineMenu.length > 0) && (
              <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                {pipelineMenuGroups.length > 0 ? (
                  pipelineMenuGroups.map((group: any) => (
                    <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.6, padding: '0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {group.title}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.25rem' }}>
                        {group.items.map((item: any) => {
                          const fullPath = `/pipeline${item.path === '/' ? '' : item.path}`;
                          const isDashboard = item.path === '/' || item.path === '/dashboard';
                          const isActive = isDashboard
                            ? (location.pathname === '/pipeline' || location.pathname === '/pipeline/' || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'))
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
                  ))
                ) : (
                  pipelineMenu.map((item: any) => {
                    const fullPath = `/pipeline${item.path === '/' ? '' : item.path}`;
                    const isDashboard = item.path === '/' || item.path === '/dashboard';
                    const isActive = isDashboard
                      ? (location.pathname === '/pipeline' || location.pathname === '/pipeline/' || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'))
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

          {/* 产品数据管理 (PDM) */}
          <NavLink 
            to="/pdm" 
            icon={ClipboardList} 
            label="产品数据管理 (PDM)" 
            activePattern={/^\/pdm/} 
            onClick={(e) => {
              if (location.pathname.startsWith('/pdm')) {
                e.preventDefault();
                setPdmMenuCollapsed(!pdmMenuCollapsed);
              } else {
                setPdmMenuCollapsed(false);
                setShieldMenuCollapsed(true);
                setPipelineMenuCollapsed(true);
              }
            }}
          />
          {location.pathname.startsWith('/pdm') && !pdmMenuCollapsed && (pdmMenuGroups.length > 0 || pdmMenu.length > 0) && (
            <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              {pdmMenuGroups.length > 0 ? (
                pdmMenuGroups.map((group: any) => (
                  <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.6, padding: '0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {group.title}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.25rem' }}>
                      {group.items.map((item: any) => {
                        const fullPath = `/pdm${item.path === '/' ? '' : item.path}`;
                        const isDefault = item.path === '/device-type';
                        const isActive = isDefault
                          ? (location.pathname === '/pdm' || location.pathname === '/pdm/' || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'))
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
                ))
              ) : (
                pdmMenu.map((item: any) => {
                  const fullPath = `/pdm${item.path === '/' ? '' : item.path}`;
                  const isDefault = item.path === '/device-type';
                  const isActive = isDefault
                    ? (location.pathname === '/pdm' || location.pathname === '/pdm/' || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/'))
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
          {user && (canManageTeams || isSuperAdmin) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.6, paddingLeft: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                系统管理
              </div>
              {canManageTeams && (
                <NavLink to="/admin/teams" icon={Users} label="团队与代码仓" activePattern={/^\/admin\/teams/} onClick={() => { setShieldMenuCollapsed(true); setPipelineMenuCollapsed(true); setPdmMenuCollapsed(true); }} />
              )}
              {isSuperAdmin && (
                <>
                  <NavLink to="/admin/users" icon={UserCheck} label="用户管理" activePattern={/^\/admin\/users/} onClick={() => { setShieldMenuCollapsed(true); setPipelineMenuCollapsed(true); setPdmMenuCollapsed(true); }} />
                  <NavLink to="/admin/audit" icon={ScrollText} label="操作审计" activePattern={/^\/admin\/audit/} onClick={() => { setShieldMenuCollapsed(true); setPipelineMenuCollapsed(true); setPdmMenuCollapsed(true); }} />
                </>
              )}
            </div>
          )}
        </nav>
        {user && (
          <div style={{ padding: '1.25rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <NavLink to="/docs" icon={BookOpen} label="开发人员手册" activePattern={/^\/docs/} onClick={() => { setShieldMenuCollapsed(true); setPipelineMenuCollapsed(true); setPdmMenuCollapsed(true); }} />
            <NavLink to="/feedback" icon={MessageSquare} label="改进建议与反馈" activePattern={/^\/feedback/} onClick={() => { setShieldMenuCollapsed(true); setPipelineMenuCollapsed(true); setPdmMenuCollapsed(true); }} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ 
          height: '80px', 
          background: 'var(--card-bg)', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 2.5rem', 
          justifyContent: 'space-between', 
          zIndex: 10 
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

              const modulesMap: Array<{ prefix: string; menu: any[]; defaultTitle: string }> = [
                { prefix: '/pipeline', menu: pipelineMenu, defaultTitle: '持续构建 (Code Pipeline)' },
                { prefix: '/shield', menu: shieldMenu, defaultTitle: '代码质量 (Code Shield)' },
                { prefix: '/pdm', menu: pdmMenu, defaultTitle: '产品数据管理 (PDM)' },
              ];

              for (const mod of modulesMap) {
                if (pathname.startsWith(mod.prefix)) {
                  const matchedItem = mod.menu.find((item: any) => {
                    const fullPath = `${mod.prefix}${item.path === '/' ? '' : item.path}`;
                    return pathname === fullPath || pathname.startsWith(fullPath + '/');
                  });
                  if (matchedItem) {
                    return matchedItem.headerTitle || matchedItem.label;
                  }
                  if (mod.prefix === '/pdm' && (pathname === '/pdm' || pathname === '/pdm/')) {
                    const defaultItem = mod.menu.find((item: any) => item.path === '/device-type');
                    if (defaultItem) return defaultItem.headerTitle || defaultItem.label;
                  }
                  return mod.defaultTitle;
                }
              }

              return '开发者综合工作台';
            })()}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-color)' }}>
          {children}
        </main>
      </div>
    </div>
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

export default function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <ToastProvider>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/docs/*" element={<DeveloperDocs />} />
              <Route path="/feedback/*" element={<FeedbackCenter />} />
              <Route path="/oauth2/callback" element={<OAuthCallback />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/audit" element={<AuditManagement />} />
              <Route path="/admin/teams" element={<TeamManagement />} />
              <Route path="/admin/teams/:tab" element={<TeamManagement />} />
              <Route path="/shield/*" element={
                <ErrorBoundary key="shield-eb">
                  <Suspense fallback={
                    <div style={{ padding: '8rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-secondary)' }}>
                      <div className="spinner"></div>
                      <span style={{ fontSize: '0.95rem' }}>正在加载代码质量微应用...</span>
                    </div>
                  }>
                    {/* @ts-ignore */}
                    <ShieldApp isEmbedded={true} />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="/modelgate/*" element={<PlaceholderView title="大模型网关 (ModelGate)" icon={Brain} color="168, 85, 247" />} />
              <Route path="/pipeline/*" element={
                <ErrorBoundary key="pipeline-eb">
                  <Suspense fallback={
                    <div style={{ padding: '8rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-secondary)' }}>
                      <div className="spinner"></div>
                      <span style={{ fontSize: '0.95rem' }}>正在加载流水线微应用...</span>
                    </div>
                  }>
                    {/* @ts-ignore */}
                    <PipelineApp isEmbedded={true} />
                  </Suspense>
                </ErrorBoundary>
              } />

              <Route path="/pdm/*" element={
                <ErrorBoundary key="pdm-eb">
                  <Suspense fallback={
                    <div style={{ padding: '8rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-secondary)' }}>
                      <div className="spinner"></div>
                      <span style={{ fontSize: '0.95rem' }}>正在加载产品数据管理微应用...</span>
                    </div>
                  }>
                    {/* @ts-ignore */}
                    <PdmApp isEmbedded={true} />
                  </Suspense>
                </ErrorBoundary>
              } />
            </Routes>
          </MainLayout>
          <VersionNotification />
        </ToastProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
}

