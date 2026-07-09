import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Brain, Network, AlertCircle, RefreshCw, Sun, Moon, Users, UserCheck, Activity, MessageSquare, ClipboardList, Loader2 } from 'lucide-react';
import Login from './Login';
import UserManagement from './pages/UserManagement';
import TeamManagement from './pages/TeamManagement';
import { ToastProvider } from './components/Toast';

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

function SidebarActionButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem',
      borderRadius: '10px', width: '100%', border: 'none', textAlign: 'left',
      color: 'var(--text-secondary)',
      background: 'transparent',
      fontWeight: 500,
      fontSize: '0.95rem',
      cursor: 'pointer',
      transition: 'all 0.25s ease',
      borderLeft: '3px solid transparent',
      outline: 'none'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.color = 'var(--text-color)';
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.color = 'var(--text-secondary)';
      e.currentTarget.style.background = 'transparent';
    }}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}


// Lazy loading remote App from module federation
// @ts-ignore
const ShieldApp = React.lazy(() => import('shield/App'));
// @ts-ignore
const ProtoApp = React.lazy(() => import('proto/App'));
// @ts-ignore
const PipelineApp = React.lazy(() => import('pipeline/App'));

function Home() {
  return (
    <div style={{ padding: '2.5rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '1rem' }}>欢迎使用 CodeBench 开发者综合工作台</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '800px' }}>
        这里是您的一站式研发效能与安全管理中心。我们聚合了代码质量、持续构建、接口集成等核心业务系统。
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
              <Network size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: 600 }}>接口管理系统 (Proto)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '4.8rem' }}>
            接口与协议统一管理中心。提供 API 设计、Mock 服务联调、契约测试以及多协议数据网关服务。
          </p>
          <Link to="/proto" className="card-btn">进入系统 &rarr;</Link>
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
  const [protoMenu, setProtoMenu] = React.useState<any[]>([]);
  const [protoMenuGroups, setProtoMenuGroups] = React.useState<any[]>([]);
  const [pipelineMenu, setPipelineMenu] = React.useState<any[]>([]);
  const [pipelineMenuGroups, setPipelineMenuGroups] = React.useState<any[]>([]);
  const [shieldMenuCollapsed, setShieldMenuCollapsed] = React.useState(true);
  const [protoMenuCollapsed, setProtoMenuCollapsed] = React.useState(true);
  const [pipelineMenuCollapsed, setPipelineMenuCollapsed] = React.useState(true);
  const prevModuleRef = React.useRef<string>('');

  React.useEffect(() => {
    const getModule = (path: string) => {
      if (path.startsWith('/shield')) return 'shield';
      if (path.startsWith('/proto')) return 'proto';
      if (path.startsWith('/pipeline')) return 'pipeline';
      return 'other';
    };

    const currentModule = getModule(location.pathname);
    const prevModule = prevModuleRef.current;

    if (currentModule !== prevModule) {
      if (currentModule === 'shield') {
        setShieldMenuCollapsed(false);
        setProtoMenuCollapsed(true);
        setPipelineMenuCollapsed(true);
      } else if (currentModule === 'proto') {
        setProtoMenuCollapsed(false);
        setShieldMenuCollapsed(true);
        setPipelineMenuCollapsed(true);
      } else if (currentModule === 'pipeline') {
        setPipelineMenuCollapsed(false);
        setShieldMenuCollapsed(true);
        setProtoMenuCollapsed(true);
      } else {
        setShieldMenuCollapsed(true);
        setProtoMenuCollapsed(true);
        setPipelineMenuCollapsed(true);
      }
      prevModuleRef.current = currentModule;
    }
  }, [location.pathname]);

  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('code-theme') as 'dark' | 'light') || 'light';
  });
  const [user, setUser] = React.useState<any>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({ oldPassword: '', newPassword: '' });
  const [showFeedbackModal, setShowFeedbackModal] = React.useState(false);
  const [feedbackTab, setFeedbackTab] = React.useState<'create' | 'history'>('create');
  const [feedbackForm, setFeedbackForm] = React.useState({ module: 'portal', title: '', content: '' });
  const [feedbacks, setFeedbacks] = React.useState<any[]>([]);
  const [feedbacksPage, setFeedbacksPage] = React.useState(1);
  const [feedbacksTotalPages, setFeedbacksTotalPages] = React.useState(1);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = React.useState(false);
  const [isFetchingFeedbacks, setIsFetchingFeedbacks] = React.useState(false);
  const [feedbackSuccessMessage, setFeedbackSuccessMessage] = React.useState('');
  const [feedbackErrorMessage, setFeedbackErrorMessage] = React.useState('');
  const [editingFeedbackId, setEditingFeedbackId] = React.useState<number | null>(null);
  const [replyStatus, setReplyStatus] = React.useState<string>('pending');
  const [replyText, setReplyText] = React.useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = React.useState(false);
  const authConfigRef = React.useRef<any>(null);

  const handleReplySubmit = async (feedbackId: number) => {
    setIsSubmittingReply(true);
    try {
      const res = await portalFetch(`/api/feedbacks/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: replyStatus,
          reply: replyText.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingFeedbackId(null);
        setReplyText('');
        fetchFeedbacks(feedbacksPage);
      } else {
        alert(data.error || '提交回复失败，请重试');
      }
    } catch (err) {
      console.error(err);
      alert('网络错误，请稍后再试');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const fetchFeedbacks = React.useCallback((page: number = 1) => {
    setIsFetchingFeedbacks(true);
    portalFetch(`/api/feedbacks?page=${page}&pageSize=5`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setFeedbacks(data.items || []);
          setFeedbacksPage(data.page || 1);
          setFeedbacksTotalPages(data.totalPages || 1);
        }
      })
      .catch(err => console.error('Failed to fetch feedbacks:', err))
      .finally(() => setIsFetchingFeedbacks(false));
  }, []);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackErrorMessage('');
    setFeedbackSuccessMessage('');

    if (feedbackForm.title.trim().length < 5) {
      setFeedbackErrorMessage('标题字数过短，至少需要5个字符');
      return;
    }
    if (feedbackForm.content.trim().length < 10) {
      setFeedbackErrorMessage('反馈建议详情过短，至少需要10个字符以描述细节');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const res = await portalFetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: feedbackForm.module,
          title: feedbackForm.title.trim(),
          content: feedbackForm.content.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackSuccessMessage(data.message || '提报成功！感谢您的宝贵建议。');
        setFeedbackForm({ module: 'portal', title: '', content: '' });
        fetchFeedbacks(1);
        setTimeout(() => {
          setFeedbackTab('history');
          setFeedbackSuccessMessage('');
        }, 1500);
      } else {
        setFeedbackErrorMessage(data.error || '提交反馈失败，请重试');
      }
    } catch (err) {
      console.error(err);
      setFeedbackErrorMessage('发生网络错误，请稍后再试');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  React.useEffect(() => {
    if (showFeedbackModal && feedbackTab === 'history') {
      fetchFeedbacks(1);
    }
  }, [showFeedbackModal, feedbackTab, fetchFeedbacks]);

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
    localStorage.setItem('code-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  React.useEffect(() => {
    // Dynamically load remote menu metadata from code-shield micro-frontend
    // @ts-ignore
    import('shield/menu')
      .then(mod => {
        // Robust module resolution checking both grouped and flat lists
        if (mod) {
          if (mod.menuGroups && Array.isArray(mod.menuGroups)) {
            setShieldMenuGroups(mod.menuGroups);
          }
          const items = mod.menuItems || mod.default || (Array.isArray(mod) ? mod : null);
          if (items && Array.isArray(items)) {
            setShieldMenu(items);
          }
        }
      })
      .catch(err => {
        console.warn("Failed to dynamically load shield menu, using robust fallback:", err);
        // Fallback static menu for resilience matching new layout paths
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

    // Dynamically load remote menu metadata from code-proto micro-frontend
    // @ts-ignore
    import('proto/menu')
      .then(mod => {
        if (mod) {
          if (mod.menuGroups && Array.isArray(mod.menuGroups)) {
            setProtoMenuGroups(mod.menuGroups);
          }
          const items = mod.menuItems || mod.default || (Array.isArray(mod) ? mod : null);
          if (items && Array.isArray(items)) {
            setProtoMenu(items);
          }
        }
      })
      .catch(err => {
        console.warn("Failed to dynamically load proto menu, using robust fallback:", err);
        setProtoMenu([
          { path: '/mr', label: 'MR 推送事件' }
        ]);
      });

    // Dynamically load remote menu metadata from code-pipeline micro-frontend
    // @ts-ignore
    import('pipeline/menu')
      .then(mod => {
        if (mod) {
          if (mod.menuGroups && Array.isArray(mod.menuGroups)) {
            setPipelineMenuGroups(mod.menuGroups);
          }
          const items = mod.menuItems || mod.default || (Array.isArray(mod) ? mod : null);
          if (items && Array.isArray(items)) {
            setPipelineMenu(items);
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

        <nav style={{ padding: '1.5rem 0.5rem 1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
          <NavLink to="/" icon={LayoutDashboard} label="首页" onClick={() => { setShieldMenuCollapsed(true); setProtoMenuCollapsed(true); setPipelineMenuCollapsed(true); }} />
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
                setProtoMenuCollapsed(true);
                setPipelineMenuCollapsed(true);
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
                      return user && !!user.is_admin;
                    }
                    return true;
                  })
                  .map((group: any) => {
                    const visibleItems = (group.items || []).filter((item: any) => {
                      if (item.path === '/admin/teams' || item.path === '/admin/users') {
                        return false;
                      }
                      if (item.adminOnly) {
                        return user && !!user.is_admin;
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
                      return user && !!user.is_admin;
                    }
                    return true;
                  })
                  .map((item: any) => {
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
                  })
              )}
            </div>
          )}
          {user && user.is_admin && (
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
                    setProtoMenuCollapsed(true);
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
                                {item.label}
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
                          {item.label}
                        </Link>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
          {user && user.is_admin && (
            <>
              <NavLink 
                to="/proto" 
                icon={Network} 
                label="接口管理系统 (Proto)" 
                activePattern={/^\/proto/} 
                onClick={(e) => {
                  if (location.pathname.startsWith('/proto')) {
                    e.preventDefault();
                    setProtoMenuCollapsed(!protoMenuCollapsed);
                  } else {
                    setProtoMenuCollapsed(false);
                    setShieldMenuCollapsed(true);
                    setPipelineMenuCollapsed(true);
                  }
                }}
              />
              {location.pathname.startsWith('/proto') && !protoMenuCollapsed && (protoMenuGroups.length > 0 || protoMenu.length > 0) && (
                <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  {protoMenuGroups.length > 0 ? (
                    protoMenuGroups
                      .filter((group: any) => {
                        if (group.adminOnly) {
                          return user && !!user.is_admin;
                        }
                        return true;
                      })
                      .map((group: any) => {
                        const visibleItems = (group.items || []).filter((item: any) => {
                          if (item.adminOnly) {
                            return user && !!user.is_admin;
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
                                const fullPath = `/proto${item.path}`;
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
                          </div>
                        );
                      })
                  ) : (
                    protoMenu
                      .filter((item: any) => {
                        if (item.adminOnly) {
                          return user && !!user.is_admin;
                        }
                        return true;
                      })
                      .map((item: any) => {
                        const fullPath = `/proto${item.path}`;
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
                      })
                  )}
                </div>
              )}
            </>
          )}
          {user && user.is_admin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.6, paddingLeft: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                系统管理
              </div>
              <NavLink to="/admin/teams" icon={Users} label="团队与代码仓" activePattern={/^\/admin\/teams/} onClick={() => { setShieldMenuCollapsed(true); setProtoMenuCollapsed(true); setPipelineMenuCollapsed(true); }} />
              <NavLink to="/admin/users" icon={UserCheck} label="用户管理" activePattern={/^\/admin\/users/} onClick={() => { setShieldMenuCollapsed(true); setProtoMenuCollapsed(true); setPipelineMenuCollapsed(true); }} />
            </div>
          )}
          {user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <SidebarActionButton icon={MessageSquare} label="改进建议反馈" onClick={() => { setShowFeedbackModal(true); setFeedbackTab('create'); }} />
            </div>
          )}
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
              if (location.pathname.startsWith('/shield/reports') || location.pathname.startsWith('/shield/tasks')) return '报告中心';
              if (location.pathname.startsWith('/shield/analysis/ut') || location.pathname.startsWith('/shield/issues')) return '测试有效性分析';
              if (location.pathname.startsWith('/shield/admin/scan')) return '扫描任务管理';
              if (location.pathname.startsWith('/shield/admin/task-types')) return '任务类型管理';
              if (location.pathname.startsWith('/shield/admin/teams') || location.pathname.startsWith('/shield/teams')) return '团队与代码仓管理';
              if (location.pathname.startsWith('/shield/admin/users')) return '用户管理';
              if (location.pathname.startsWith('/shield/admin/activity')) return '执行日志';
              if (location.pathname.startsWith('/shield/config')) return '管理中心';
              if (location.pathname.startsWith('/modelgate')) return '大模型网关 (ModelGate)';
              if (location.pathname.startsWith('/proto')) return '接口管理系统 (Proto)';
              if (location.pathname.startsWith('/pipeline')) return '持续构建与检查流水线';
              if (location.pathname.startsWith('/admin/teams')) return '团队与代码仓管理';
              if (location.pathname.startsWith('/admin/users')) return '用户管理';
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

      {showFeedbackModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowFeedbackModal(false)}>
          <div className="glass-card" style={{ width: '600px', maxWidth: '95%', padding: '2rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '85vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={22} color="var(--primary-color)" />
                产品改进与建议反馈
              </h3>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', outline: 'none' }}
              >
                &times;
              </button>
            </div>

            {/* Tab 选择器 */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
              <button
                onClick={() => setFeedbackTab('create')}
                style={{
                  padding: '0.75rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: feedbackTab === 'create' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  borderBottom: feedbackTab === 'create' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  fontWeight: feedbackTab === 'create' ? 600 : 500, fontSize: '0.9rem', outline: 'none'
                }}
              >
                提出改进建议
              </button>
              <button
                onClick={() => setFeedbackTab('history')}
                style={{
                  padding: '0.75rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: feedbackTab === 'history' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  borderBottom: feedbackTab === 'history' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  fontWeight: feedbackTab === 'history' ? 600 : 500, fontSize: '0.9rem', outline: 'none'
                }}
              >
                我的建议历史
              </button>
            </div>

            {/* 内容区域 */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {feedbackTab === 'create' ? (
                <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {feedbackSuccessMessage && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(52, 211, 153, 0.1)', color: '#10b981', borderRadius: '8px', fontSize: '0.875rem', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                      {feedbackSuccessMessage}
                    </div>
                  )}
                  {feedbackErrorMessage && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.875rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      {feedbackErrorMessage}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-color)' }}>所涉功能模块</label>
                    <select
                      value={feedbackForm.module}
                      onChange={e => setFeedbackForm({ ...feedbackForm, module: e.target.value })}
                      style={{
                        width: '100%', padding: '0.625rem', borderRadius: '8px',
                        border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                        color: 'var(--text-color)', outline: 'none'
                      }}
                    >
                      <option value="portal">综合门户工作台 (Portal)</option>
                      <option value="shield">代码质量卫士 (Code Shield)</option>
                      <option value="pipeline">持续构建流水线 (Code Pipeline)</option>
                      <option value="proto">接口管理系统 (Proto)</option>
                      <option value="other">其他建议与反馈</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-color)' }}>建议简述（标题）</label>
                    <input
                      required
                      type="text"
                      placeholder="请用一句话简要概括您的建议（至少5个字符）"
                      value={feedbackForm.title}
                      onChange={e => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                      style={{
                        width: '100%', padding: '0.625rem', borderRadius: '8px',
                        border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                        color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>建议详情描述</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                        已输入 {feedbackForm.content.length} 字
                      </span>
                    </label>
                    <textarea
                      required
                      rows={6}
                      placeholder="请详细阐述您遇到的问题，或具体的改进想法（例如期待怎样的交互、如何减少您的操作步骤等，至少需要10个字符）"
                      value={feedbackForm.content}
                      onChange={e => setFeedbackForm({ ...feedbackForm, content: e.target.value })}
                      style={{
                        width: '100%', padding: '0.75rem', borderRadius: '8px',
                        border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                        color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none',
                        resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(false)}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                        cursor: 'pointer', padding: '0.625rem 1.25rem', fontSize: '0.875rem'
                      }}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="btn"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.625rem 1.5rem', border: 'none', background: 'var(--primary-color)',
                        color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      {isSubmittingFeedback && (
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      )}
                      {isSubmittingFeedback ? '提交中...' : '提交建议'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {isFetchingFeedbacks ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', color: 'var(--text-secondary)', gap: '0.5rem', flexDirection: 'column' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid rgba(59,130,246,0.2)', borderTop: '3px solid #3b82f6', animation: 'spin 0.8s linear infinite' }} />
                      <span>正在加载反馈记录...</span>
                    </div>
                  ) : feedbacks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
                      <ClipboardList size={36} style={{ marginBottom: '1rem', opacity: 0.5, marginLeft: 'auto', marginRight: 'auto' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>您目前还没有提交过改进建议哦。</p>
                      <button
                        onClick={() => setFeedbackTab('create')}
                        style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                      >
                        立刻提第一个建议 &rarr;
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {feedbacks.map((item) => {
                        const moduleCn = {
                          portal: '综合门户 (Portal)',
                          shield: '代码质量 (Shield)',
                          pipeline: '持续构建 (Pipeline)',
                          proto: '接口管理 (Proto)',
                          other: '其他建议'
                        }[item.module] || item.module;

                        const statusStyle = {
                          pending: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', text: '待处理' },
                          processing: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', text: '处理中' },
                          resolved: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', text: '已采纳/已解决' },
                          rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', text: '暂不考虑' }
                        }[item.status] || { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', text: item.status };

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '1.25rem', borderRadius: '10px',
                              background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                              display: 'flex', flexDirection: 'column', gap: '0.75rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                  {moduleCn}
                                </span>
                                {user && user.is_admin && item.user && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                    提报人: {item.user.name || item.user.username}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: statusStyle.bg, color: statusStyle.color, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                {statusStyle.text}
                              </span>
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.925rem' }}>
                              {item.title}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              {item.content}
                            </p>
                            {editingFeedbackId === item.id ? (
                              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-color)' }}>处理状态:</span>
                                  <select
                                    value={replyStatus}
                                    onChange={e => setReplyStatus(e.target.value)}
                                    style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.8rem', outline: 'none' }}
                                  >
                                    <option value="pending">待处理</option>
                                    <option value="processing">处理中</option>
                                    <option value="resolved">已采纳/已解决</option>
                                    <option value="rejected">暂不考虑</option>
                                  </select>
                                </div>
                                <textarea
                                  rows={3}
                                  placeholder="请填写官方答复内容..."
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none', fontSize: '0.825rem', fontFamily: 'inherit', resize: 'vertical' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => setEditingFeedbackId(null)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSubmittingReply}
                                    onClick={() => handleReplySubmit(item.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 1rem', border: 'none', background: 'var(--primary-color)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                                  >
                                    {isSubmittingReply && (
                                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid white', animation: 'spin 0.8s linear infinite' }} />
                                    )}
                                    {isSubmittingReply ? '保存中...' : '提交答复'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {item.reply && (
                                  <div style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.04)', borderLeft: '3px solid var(--primary-color)', borderRadius: '0 6px 6px 0', fontSize: '0.825rem', color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>官方答复：</span>
                                    <span style={{ lineHeight: 1.5 }}>{item.reply}</span>
                                  </div>
                                )}
                                {user && user.is_admin && (
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                    <button
                                      onClick={() => {
                                        setEditingFeedbackId(item.id);
                                        setReplyStatus(item.status || 'pending');
                                        setReplyText(item.reply || '');
                                      }}
                                      style={{ background: 'rgba(59, 130, 246, 0.08)', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                                    >
                                      {item.reply ? '修改答复' : '处理/答复此反馈'}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '0.25rem', textAlign: 'right' }}>
                              提交于 {new Date(item.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}

                      {/* 分页组件 */}
                      {feedbacksTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                          <button
                            disabled={feedbacksPage <= 1}
                            onClick={() => fetchFeedbacks(feedbacksPage - 1)}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', cursor: feedbacksPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: feedbacksPage <= 1 ? 0.5 : 1 }}
                          >
                            上一页
                          </button>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            第 {feedbacksPage} / {feedbacksTotalPages} 页
                          </span>
                          <button
                            disabled={feedbacksPage >= feedbacksTotalPages}
                            onClick={() => fetchFeedbacks(feedbacksPage + 1)}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', cursor: feedbacksPage >= feedbacksTotalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: feedbacksPage >= feedbacksTotalPages ? 0.5 : 1 }}
                          >
                            下一页
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
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
      <ToastProvider>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/oauth2/callback" element={<OAuthCallback />} />
            <Route path="/admin/users" element={<UserManagement />} />
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
            <Route path="/proto/*" element={
              <ErrorBoundary key="proto-eb">
                <Suspense fallback={
                  <div style={{ padding: '8rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-secondary)' }}>
                    <div className="spinner"></div>
                    <span style={{ fontSize: '0.95rem' }}>正在加载接口管理微应用...</span>
                  </div>
                }>
                  {/* @ts-ignore */}
                  <ProtoApp isEmbedded={true} />
                </Suspense>
              </ErrorBoundary>
            } />
          </Routes>
        </MainLayout>
      </ToastProvider>
    </BrowserRouter>
  );
}
