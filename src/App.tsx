import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Brain, Network, AlertCircle, RefreshCw, Sun, Moon } from 'lucide-react';

// Set global environment flag for federated sub-applications
(window as any).__POWERED_BY_PORTAL__ = true;

// Error Boundary for chunk/remote load failures
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Micro-frontend integration error caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: '2.5rem', background: 'var(--card-bg)', borderRadius: '12px',
          border: '1px solid #ef4444', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '1.25rem', maxWidth: '500px', margin: '4rem auto', textAlign: 'center'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={24} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-color)' }}>子应用加载失败</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              无法连接到对应的子系统模块。这可能是由于子服务未启动或网络连接问题导致的。
            </p>
          </div>
          <button
            onClick={this.handleReset}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem',
              background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            <RefreshCw size={16} />
            重试加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function NavLink({ to, icon: Icon, label, activePattern }: { to: string; icon: any; label: string; activePattern?: RegExp }) {
  const location = useLocation();
  const isActive = activePattern 
    ? activePattern.test(location.pathname) 
    : location.pathname === to;

  return (
    <Link to={to} style={{
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

function Home() {
  return (
    <div style={{ padding: '2.5rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '1rem' }}>欢迎使用 CodeBench 开发者综合工作台</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '800px' }}>
        这里是您的一站式研发效能与安全管理中心。我们聚合了代码质量、大模型网关、接口集成等核心业务系统。
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
              <Brain size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>模型网关 (ModelGate)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
            大模型集成接入网关。支持多模型分流、调用量审计、提示词安全过滤以及 API key 分发管理。
          </p>
          <Link to="/modelgate" className="card-btn">进入系统 &rarr;</Link>
        </div>

        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Network size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>接口管理系统 (ProtoHub)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
            接口与协议统一管理中心。提供 API 设计、Mock 服务联调、契约测试以及多协议数据网关服务。
          </p>
          <Link to="/protohub" className="card-btn">进入系统 &rarr;</Link>
        </div>
      </div>
    </div>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [shieldMenu, setShieldMenu] = React.useState<any[]>([]);
  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('portal_theme') as 'dark' | 'light') || 'dark';
  });
  const [user, setUser] = React.useState<any>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({ oldPassword: '', newPassword: '' });

  const portalFetch = (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('code_shield_token');
    const finalUrl = url.startsWith('/api') ? `/shield${url}` : url;
    const headers = {
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    return fetch(finalUrl, { ...options, headers });
  };

  React.useEffect(() => {
    portalFetch('/api/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setUser(data); })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('code_shield_token');
    window.location.href = '/shield/login';
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await portalFetch('/api/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: passwordForm.oldPassword, new_password: passwordForm.newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert('密码修改成功，即将退出登录并重新登录！');
        setShowPasswordModal(false);
        handleLogout();
      } else {
        alert(data.error || '修改密码失败');
      }
    } catch (err) {
      console.error(err);
      alert('发生网络错误');
    }
  };

  React.useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
    localStorage.setItem('portal_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  React.useEffect(() => {
    // Dynamically load remote menu metadata from code-shield micro-frontend
    // @ts-ignore
    import('shield/menu')
      .then(mod => {
        // Robust module resolution checking all compiled shapes (named, default, or unwrapped array)
        const items = mod && (mod.menuItems || mod.default || (Array.isArray(mod) ? mod : null));
        if (items && Array.isArray(items)) {
          setShieldMenu(items);
        } else {
          throw new Error("Invalid menu structure resolved");
        }
      })
      .catch(err => {
        console.warn("Failed to dynamically load shield menu, using robust fallback:", err);
        // Fallback static menu for resilience
        setShieldMenu([
          { path: '/tasks', label: '任务中心' },
          { path: '/issues', label: '问题清单' },
          { path: '/opensource', label: '开源管理' },
          { path: '/teams', label: '团队管理' },
          { path: '/config', label: '系统管理' }
        ]);
      });
  }, []);

  // Hide portal layout completely for nested sub-app login pages
  if (location.pathname.endsWith('/login')) {
    return <>{children}</>;
  }

  const subNavLinkStyle = (isActive: boolean) => ({
    display: 'block',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '0.85rem',
    color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
    background: isActive ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.2s',
  } as React.CSSProperties);

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

        <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavLink to="/" icon={LayoutDashboard} label="首页" />
          <NavLink to="/shield" icon={Shield} label="代码质量 (Code Shield)" activePattern={/^\/shield/} />
          {location.pathname.startsWith('/shield') && shieldMenu.length > 0 && (
            <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
              {shieldMenu.map((item: any) => {
                const fullPath = `/shield${item.path}`;
                return (
                  <Link
                    key={item.path}
                    to={fullPath}
                    style={subNavLinkStyle(
                      location.pathname === fullPath ||
                      location.pathname.startsWith(fullPath + '/')
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
          <NavLink to="/modelgate" icon={Brain} label="大模型网关 (ModelGate)" activePattern={/^\/modelgate/} />
          <NavLink to="/protohub" icon={Network} label="接口管理系统 (ProtoHub)" activePattern={/^\/protohub/} />
        </nav>
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
              if (location.pathname === '/') return '首页';
              if (location.pathname.startsWith('/shield/tasks')) return '任务中心';
              if (location.pathname.startsWith('/shield/issues')) return '问题清单';
              if (location.pathname.startsWith('/shield/opensource')) return '开源管理';
              if (location.pathname.startsWith('/shield/teams')) return '团队组织架构与代码仓配置';
              if (location.pathname.startsWith('/shield/config')) return '系统管理';
              if (location.pathname.startsWith('/modelgate')) return '大模型网关 (ModelGate)';
              if (location.pathname.startsWith('/protohub')) return '接口管理系统 (ProtoHub)';
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(!showDropdown);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent',
                    border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px',
                    transition: 'background-color 0.2s', outline: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-color)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)', 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                  }}>
                    {(user.name || user.username).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-color)' }}>{user.name || user.username}</span>
                    {user.is_admin && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>管理员</span>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '0.25rem', transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {showDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '180px',
                    background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 100
                  }}>
                    <div style={{ padding: '0.5rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDropdown(false); setShowPasswordModal(true); }}
                        style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-color)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        修改密码
                      </button>
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }}></div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                        style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '400px', maxWidth: '90%', padding: '2rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-color)' }}>修改密码</h3>
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)' }}>当前密码</label>
                <input required type="password" value={passwordForm.oldPassword} onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)' }}>新密码</label>
                <input required type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowPasswordModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.5rem 1rem' }}>取消</button>
                <button type="submit" className="btn" style={{ padding: '0.5rem 1.5rem', border: 'none', background: 'var(--primary-color)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>确认修改</button>
              </div>
            </form>
          </div>
        </div>
      )}
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

export default function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shield/*" element={
            <ErrorBoundary>
              <Suspense fallback={
                <div style={{ padding: '8rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', color: 'var(--text-secondary)' }}>
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
          <Route path="/protohub/*" element={<PlaceholderView title="接口管理系统 (ProtoHub)" icon={Network} color="16, 185, 129" />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}
