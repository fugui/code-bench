import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pagination, usePagination, Modal } from '@code/common';
import { useToast } from '../components/Toast';
import {
  MessageSquare, Plus, Search, Filter, Upload, Image as ImageIcon,
  X, CheckCircle2, Clock, AlertCircle, XCircle, Sparkles,
  ChevronDown, ChevronUp, RefreshCw, Send, Zap, Bug,
  Lightbulb, Palette, Layers, Trash2, Maximize2, ShieldCheck, Tag, Flag,
  Copy, Check, Code, Info
} from 'lucide-react';
import { AUTH_TOKEN_KEY } from '../config';

export interface VersionMeta {
  appName: string;
  version: string;
  gitHash: string;
  buildTime: string;
  timestamp?: number;
}

export interface FeedbackUser {
  id: number;
  name?: string;
  username: string;
  email?: string;
}

export interface FeedbackItem {
  id: number;
  user_id: number;
  user?: FeedbackUser;
  category: 'bug' | 'feature' | 'ux' | 'performance' | 'other';
  module: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  content: string;
  images: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  reply?: string;
  created_at: string;
  updated_at: string;
}

interface ImageFile {
  id: string;
  url: string;
  name: string;
  size?: number;
  uploading?: boolean;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  bug: { label: '缺陷 Bug 汇报', icon: Bug, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  feature: { label: '新功能与需求', icon: Lightbulb, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  ux: { label: '交互与 UI 优化', icon: Palette, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  performance: { label: '性能与稳定性', icon: Zap, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  other: { label: '其他意见反馈', icon: MessageSquare, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
};

const MODULE_MAP: Record<string, string> = {
  portal: '综合门户 (Portal)',
  shield: '代码质量卫士 (Code Shield)',
  pipeline: '持续构建流水线 (Code Pipeline)',
  pdm: '产品数据管理 (PDM)',
  modelgate: '大模型网关 (ModelGate)',
  arch: '架构设计与资产',
  other: '其他公共组件',
};

const PRIORITY_MAP: Record<string, { label: string; color: string; badge: string }> = {
  low: { label: '低优先级', color: '#64748b', badge: '🟢 低' },
  medium: { label: '中优先级', color: '#3b82f6', badge: '🔵 中' },
  high: { label: '高优先级', color: '#f59e0b', badge: '🟠 高' },
  urgent: { label: '紧急处理', color: '#ef4444', badge: '🔴 紧急' },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: '待处理', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', icon: Clock },
  processing: { label: '处理中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: RefreshCw },
  resolved: { label: '已采纳/解决', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: CheckCircle2 },
  rejected: { label: '暂不考虑', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: XCircle },
};

export default function FeedbackCenter() {
  const [activeTab, setActiveTab] = useState<'submit' | 'history' | 'admin'>('submit');
  const [user, setUser] = useState<FeedbackUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Submit Form States
  const [category, setCategory] = useState<'bug' | 'feature' | 'ux' | 'performance' | 'other'>('feature');
  const [module, setModule] = useState<string>('portal');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachedImages, setAttachedImages] = useState<ImageFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // History & Filter States
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);
  const { page, pageSize, setPage } = usePagination({ defaultPageSize: 15 });
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Admin Reply State
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyStatus, setReplyStatus] = useState<string>('pending');
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Version Metadata States
  const [portalVersion, setPortalVersion] = useState<VersionMeta | null>(null);
  const [copiedVersion, setCopiedVersion] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取门户自身版本
  useEffect(() => {
    fetch(`/version.json?_t=${Date.now()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setPortalVersion(data);
      })
      .catch(() => {});
  }, []);

  const handleCopyVersion = () => {
    const text = `【Code Bench 现网环境信息】\n- 版本: v${portalVersion?.version || '—'} (Commit: ${portalVersion?.gitHash || 'unknown'})\n- 构建时间: ${portalVersion?.buildTime || '—'}\n- 客户端 UA: ${navigator.userAgent}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedVersion(true);
      setTimeout(() => setCopiedVersion(false), 2000);
    }).catch(() => {});
  };

  // Tab 切换处理逻辑：当进入管理员处理面板时，默认筛选状态为“待处理” (pending)
  const handleTabChange = (tab: 'submit' | 'history' | 'admin') => {
    setActiveTab(tab);
    if (tab === 'admin') {
      setFilterStatus('pending');
    } else if (tab === 'history') {
      setFilterStatus('');
    }
  };

  // Fetch current logged in user details
  useEffect(() => {
    fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setUser(data);
          let roles: string[] = [];
          if (Array.isArray(data.roles)) roles = data.roles;
          else if (typeof data.roles === 'string') {
            try { roles = JSON.parse(data.roles); } catch (e) { roles = []; }
          }
          if (roles.includes('super_admin') || roles.includes('bench_admin')) {
            setIsAdmin(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch feedbacks
  const fetchFeedbacks = useCallback(async () => {
    setIsLoadingFeedbacks(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());
      if (filterCategory) params.append('category', filterCategory);
      if (filterModule) params.append('module', filterModule);
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (searchQuery) params.append('q', searchQuery);

      const res = await fetch(`/api/feedbacks?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbacks(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to fetch feedbacks:', e);
    } finally {
      setIsLoadingFeedbacks(false);
    }
  }, [page, pageSize, filterCategory, filterModule, filterStatus, filterPriority, searchQuery]);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'admin') {
      fetchFeedbacks();
    }
  }, [activeTab, fetchFeedbacks]);

  // Upload single image file
  const uploadFile = async (file: File) => {
    if (attachedImages.length >= 5) {
      setErrorMsg('最多只能上传 5 张贴图附件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('单张图片大小不能超过 10MB');
      return;
    }

    const tempId = Math.random().toString(36).substring(2);
    setAttachedImages(prev => [
      ...prev,
      { id: tempId, url: URL.createObjectURL(file), name: file.name || 'clipboard_screenshot.png', size: file.size, uploading: true }
    ]);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/feedbacks/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setAttachedImages(prev => prev.map(img => img.id === tempId ? { ...img, url: data.url, uploading: false } : img));
        setErrorMsg('');
      } else {
        setErrorMsg(data.error || '上传贴图失败');
        setAttachedImages(prev => prev.filter(img => img.id !== tempId));
      }
    } catch (err) {
      setErrorMsg('网络通信失败，贴图上传未成功');
      setAttachedImages(prev => prev.filter(img => img.id !== tempId));
    }
  };

  // Clipboard paste listener (Ctrl+V screenshot support)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          uploadFile(file);
        }
      }
    }
  }, [attachedImages]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(file => {
        if (file.type.startsWith('image/')) {
          uploadFile(file);
        }
      });
    }
  };

  // File input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        if (file.type.startsWith('image/')) {
          uploadFile(file);
        }
      });
      e.target.value = '';
    }
  };

  // Remove image
  const removeImage = (id: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== id));
  };

  // Submit Feedback Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      setErrorMsg('标题至少需要 5 个字符');
      return;
    }
    if (content.trim().length < 10) {
      setErrorMsg('建议详情至少需要 10 个字符以描述细节');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const imageUrls = attachedImages.filter(img => !img.uploading).map(img => img.url);

    let submitContent = content.trim();
    if (portalVersion) {
      submitContent += `\n\n---\n> 📌 **提报环境元数据**：Code Bench v${portalVersion.version} (${portalVersion.gitHash}) · 构建于 ${portalVersion.buildTime}`;
    }

    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
        },
        body: JSON.stringify({
          category,
          module,
          priority,
          title: title.trim(),
          content: submitContent,
          images: imageUrls
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('🎉 感谢您的宝贵建议！我们已收到您的反馈并正在处理。');
        setTitle('');
        setContent('');
        setAttachedImages([]);
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setErrorMsg(data.error || '提交反馈失败，请稍后重试');
      }
    } catch (err) {
      setErrorMsg('连接后端服务失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Reply Handler
  const handleAdminReplySubmit = async (id: number) => {
    setIsSubmittingReply(true);
    try {
      const res = await fetch(`/api/feedbacks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
        },
        body: JSON.stringify({
          status: replyStatus,
          reply: replyText.trim()
        })
      });
      if (res.ok) {
        setReplyingId(null);
        fetchFeedbacks(page);
      }
    } catch (e) {
      console.error('Failed to reply:', e);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Expand toggle
  const toggleExpand = (id: number) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to parse images array
  const parseImages = (imagesStr: string): string[] => {
    if (!imagesStr) return [];
    try {
      const parsed = JSON.parse(imagesStr);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      if (typeof imagesStr === 'string' && imagesStr.trim().startsWith('/')) {
        return [imagesStr.trim()];
      }
    }
    return [];
  };

  return (
    <div onPaste={handlePaste} style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 顶部 Header Card */}
      <div style={{
        padding: '2.5rem',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(168, 85, 247, 0.08) 50%, rgba(16, 185, 129, 0.12) 100%)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'var(--primary-color)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
            }}>
              <MessageSquare size={24} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)' }}>
              产品改进与建议反馈中心
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            倾听每一位开发者的真实声音！如果您在 Code Bench 使用过程中遇到 Bug、认为某些交互不够顺手，或有新功能构想，欢迎在此反馈。
            <strong style={{ color: 'var(--primary-color)', marginLeft: '6px' }}>支持截图直接粘贴（Ctrl+V）！</strong>
          </p>
        </div>

        {/* 顶部 Tab 切换控制 */}
        <div style={{ display: 'flex', background: 'var(--card-bg)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => handleTabChange('submit')}
            style={{
              padding: '0.625rem 1.25rem', border: 'none', borderRadius: '10px',
              background: activeTab === 'submit' ? 'var(--primary-color)' : 'transparent',
              color: activeTab === 'submit' ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <Plus size={16} /> 提报建议与反馈
          </button>
          <button
            onClick={() => handleTabChange('history')}
            style={{
              padding: '0.625rem 1.25rem', border: 'none', borderRadius: '10px',
              background: activeTab === 'history' ? 'var(--primary-color)' : 'transparent',
              color: activeTab === 'history' ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <Clock size={16} /> 我的反馈与进度
          </button>
          {isAdmin && (
            <button
              onClick={() => handleTabChange('admin')}
              style={{
                padding: '0.625rem 1.25rem', border: 'none', borderRadius: '10px',
                background: activeTab === 'admin' ? 'var(--primary-color)' : 'transparent',
                color: activeTab === 'admin' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
              }}
            >
              <ShieldCheck size={16} /> 管理员处理面板
            </button>
          )}
        </div>
      </div>

      {/* Tab 内容区 1: 提报改进建议 */}
      {activeTab === 'submit' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {successMsg && (
            <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, fontSize: '0.925rem' }}>
              <CheckCircle2 size={20} />
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, fontSize: '0.925rem' }}>
              <AlertCircle size={20} />
              {errorMsg}
            </div>
          )}

          {/* 1. 分类选择器 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={16} color="var(--primary-color)" /> 反馈与建议类型
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
                const IconComp = cat.icon;
                const isSelected = category === key;
                return (
                  <div
                    key={key}
                    onClick={() => setCategory(key as any)}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      background: isSelected ? cat.bg : 'var(--card-bg)',
                      border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.875rem',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected ? `0 8px 20px -6px ${cat.color}40` : 'none'
                    }}
                  >
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: isSelected ? cat.color : 'rgba(255,255,255,0.05)',
                      color: isSelected ? 'white' : cat.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <IconComp size={20} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? cat.color : 'var(--text-color)' }}>
                      {cat.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 模块与优先级选择器 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            
            {/* 所涉功能模块 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={16} color="var(--primary-color)" /> 所涉功能模块
              </label>
              <select
                value={module}
                onChange={e => setModule(e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                  border: '1px solid var(--border-color)', background: 'var(--card-bg)',
                  color: 'var(--text-color)', outline: 'none', fontSize: '0.9rem', fontWeight: 500
                }}
              >
                {Object.entries(MODULE_MAP).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            {/* 优先级 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flag size={16} color="var(--primary-color)" /> 期望处理优先级
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {Object.entries(PRIORITY_MAP).map(([key, item]) => {
                  const isSelected = priority === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setPriority(key as any)}
                      style={{
                        flex: 1, padding: '0.625rem 0.5rem', borderRadius: '8px',
                        border: isSelected ? `2px solid ${item.color}` : '1px solid var(--border-color)',
                        background: isSelected ? `${item.color}15` : 'var(--card-bg)',
                        color: isSelected ? item.color : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer', outline: 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {item.badge}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. 建议标题 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)' }}>
              建议简述 / 标题 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              required
              type="text"
              placeholder="一句话清晰描述您的建议或遇到的问题（例如：流水线执行日志页面希望增加快捷全屏按钮）"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%', padding: '0.875rem 1rem', borderRadius: '10px',
                border: '1px solid var(--border-color)', background: 'var(--card-bg)',
                color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none', fontSize: '0.925rem'
              }}
            />
          </div>

          {/* 4. 详情描述输入区 (支持粘贴监听) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)' }}>
                具体反馈细节描述 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                已输入 {content.length} 字
              </span>
            </div>
            <textarea
              required
              rows={7}
              placeholder="请详细描述具体场景、复现步骤或期望的改善逻辑。如需附带界面截图，在此处按 Ctrl+V 即可直接上传截图贴图！"
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{
                width: '100%', padding: '1rem', borderRadius: '12px',
                border: '1px solid var(--border-color)', background: 'var(--card-bg)',
                color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none',
                resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, fontSize: '0.9rem'
              }}
            />
          </div>

          {/* 5. 贴图与图片附件区 (支持 Drag&Drop, Paste, Click Upload) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={16} color="var(--primary-color)" /> 问题截图与参考贴图 (可选，最多5张)
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                快捷键: 截图后在此页面直接按 <kbd style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + V</kbd> 粘贴
              </span>
            </div>

            {/* 拖拽与上传触发框 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '1.75rem',
                borderRadius: '12px',
                border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
                background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--card-bg)',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              <Upload size={28} color="var(--primary-color)" />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                点击选择图片，或将图片文件拖拽至此处
              </div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                支持 PNG, JPG, GIF, WEBP 格式（单张不超过 10MB）
              </div>
            </div>

            {/* 贴图缩略图展示列表 */}
            {attachedImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                {attachedImages.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      width: '120px', height: '120px', borderRadius: '10px',
                      border: '1px solid var(--border-color)', background: 'var(--card-bg)',
                      position: 'relative', overflow: 'hidden', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    
                    {img.uploading ? (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem' }}>
                        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : (
                      <>
                        {/* 放大预览 */}
                        <div
                          onClick={() => setLightboxImage(img.url)}
                          style={{
                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                            cursor: 'pointer', transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                        >
                          <Maximize2 size={20} />
                        </div>
                        {/* 删除按钮 */}
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          style={{
                            position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px',
                            borderRadius: '50%', background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 提交按钮栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.775rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
              <Info size={14} />
              <span>当前运行版本: v{portalVersion?.version || '0.2.0'} ({portalVersion?.gitHash || '未知'} · {portalVersion?.buildTime || '—'})</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', border: 'none', background: 'var(--primary-color)',
                color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 600,
                fontSize: '0.95rem', boxShadow: '0 8px 20px -4px rgba(59, 130, 246, 0.4)'
              }}
            >
              {isSubmitting ? (
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send size={18} />
              )}
              {isSubmitting ? '提交中...' : '提交建议与反馈'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 内容区 2 & 3: 我的反馈历史 / 管理员大盘 */}
      {(activeTab === 'history' || activeTab === 'admin') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 筛选与搜索工具条 */}
          <div style={{
            padding: '1.25rem', borderRadius: '14px', background: 'var(--card-bg)',
            border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap',
            gap: '1rem', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
              
              {/* 关键词搜索框 */}
              <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
                <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="搜索反馈标题或内容..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                    color: 'var(--text-color)', outline: 'none', fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* 分类筛选 */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="">全部分类</option>
                {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* 模块筛选 */}
              <select
                value={filterModule}
                onChange={e => setFilterModule(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="">全部模块</option>
                {Object.entries(MODULE_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {/* 状态筛选 */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="">全部状态</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* 优先级筛选 */}
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="">全部优先级</option>
                {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.badge}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchFeedbacks(1)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
                borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                color: 'var(--text-color)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}
            >
              <RefreshCw size={14} /> 刷新
            </button>
          </div>

          {/* 反馈列表记录 */}
          {isLoadingFeedbacks ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
              <span>正在加载反馈数据...</span>
            </div>
          ) : feedbacks.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <Sparkles size={40} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>暂无符合条件的反馈记录哦~</p>
              <button
                onClick={() => handleTabChange('submit')}
                style={{ marginTop: '1rem', padding: '0.5rem 1.25rem', border: 'none', background: 'var(--primary-color)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                去提第一个建议 &rarr;
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {feedbacks.map(item => {
                const catObj = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;
                const CatIcon = catObj.icon;
                const statusObj = STATUS_MAP[item.status] || STATUS_MAP.pending;
                const StatusIcon = statusObj.icon;
                const priorityObj = PRIORITY_MAP[item.priority] || PRIORITY_MAP.medium;
                const imgList = parseImages(item.images);

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '1.5rem',
                      borderRadius: '14px',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}
                  >
                    {/* Header line */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {/* 分类 Badge */}
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          fontSize: '0.775rem', fontWeight: 600, padding: '0.3rem 0.6rem',
                          borderRadius: '6px', background: catObj.bg, color: catObj.color
                        }}>
                          <CatIcon size={14} /> {catObj.label}
                        </span>

                        {/* 模块 Pill */}
                        <span style={{ fontSize: '0.775rem', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          {MODULE_MAP[item.module] || item.module}
                        </span>

                        {/* 优先级 */}
                        <span style={{ fontSize: '0.775rem', fontWeight: 600, color: priorityObj.color, background: `${priorityObj.color}12`, padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                          {priorityObj.badge}
                        </span>

                        {/* 提报人信息 */}
                        {item.user && (
                          <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                            由 <strong style={{ color: 'var(--text-color)' }}>{item.user.name || item.user.username}</strong> 提报
                          </span>
                        )}
                      </div>

                      {/* 状态 Badge */}
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem',
                        borderRadius: '8px', background: statusObj.bg, color: statusObj.color
                      }}>
                        <StatusIcon size={14} /> {statusObj.label}
                      </span>
                    </div>

                    {/* 标题 */}
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)', lineHeight: 1.4 }}>
                      {item.title}
                    </div>

                    {/* 详细描述 */}
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {item.content}
                    </p>

                    {/* 贴图展示区 */}
                    {imgList.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                        {imgList.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => setLightboxImage(imgUrl)}
                            style={{
                              width: '90px', height: '90px', borderRadius: '8px',
                              overflow: 'hidden', border: '1px solid var(--border-color)',
                              cursor: 'pointer', position: 'relative'
                            }}
                          >
                            <img src={imgUrl} alt={`screenshot_${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 官方答复 Card */}
                    {item.reply && (
                      <div style={{
                        padding: '1rem 1.25rem', borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.05)',
                        borderLeft: '4px solid var(--primary-color)',
                        display: 'flex', flexDirection: 'column', gap: '0.35rem'
                      }}>
                        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ShieldCheck size={16} /> 官方答复与处理说明：
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-color)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {item.reply}
                        </div>
                      </div>
                    )}

                    {/* 管理员处理按钮与编辑表单 */}
                    {isAdmin && activeTab === 'admin' && (
                      <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                        {replyingId === item.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '1rem', borderRadius: '10px', background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>更新处理状态:</span>
                              <select
                                value={replyStatus}
                                onChange={e => setReplyStatus(e.target.value)}
                                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.85rem', outline: 'none' }}
                              >
                                <option value="pending">待处理</option>
                                <option value="processing">处理中</option>
                                <option value="resolved">已采纳/已解决</option>
                                <option value="rejected">暂不考虑</option>
                              </select>
                            </div>
                            <textarea
                              rows={3}
                              placeholder="撰写官方处理答复/采纳说明..."
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none', fontSize: '0.85rem' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                              <button
                                onClick={() => setReplyingId(null)}
                                style={{ padding: '0.4rem 1rem', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                取消
                              </button>
                              <button
                                disabled={isSubmittingReply}
                                onClick={() => handleAdminReplySubmit(item.id)}
                                style={{ padding: '0.4rem 1.25rem', border: 'none', background: 'var(--primary-color)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                              >
                                {isSubmittingReply ? '保存中...' : '提交答复'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                setReplyingId(item.id);
                                setReplyStatus(item.status);
                                setReplyText(item.reply || '');
                              }}
                              style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--primary-color)', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.825rem' }}
                            >
                              {item.reply ? '编辑官方答复' : '处理/答复此反馈'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 脚部时间印记 */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, textAlign: 'right' }}>
                      提交于 {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 分页组件 */}
          {totalCount > 0 && (
            <Pagination totalItems={totalCount} defaultPageSize={15} />
          )}
        </div>
      )}

      {/* 页面底部极简微注 (Subtle Footer) */}
      <footer style={{
        marginTop: '2.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--text-secondary)',
        fontSize: '0.75rem',
        opacity: 0.8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Code size={13} style={{ opacity: 0.8 }} />
            <span>Code Bench v{portalVersion?.version || '0.2.0'} ({portalVersion?.gitHash || '未知'})</span>
          </span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={13} style={{ opacity: 0.8 }} />
            <span>构建时间: {portalVersion?.buildTime || '—'}</span>
          </span>
          <button
            type="button"
            onClick={handleCopyVersion}
            title="复制当前环境版本与构建信息"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.725rem',
              transition: 'all 0.2s'
            }}
          >
            {copiedVersion ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
            <span>{copiedVersion ? '已复制' : '复制环境信息'}</span>
          </button>
        </div>
      </footer>

      {/* 图片 Lightbox 模态框 */}
      <Modal
        open={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        title="截图大图预览"
        width="lg"
        footer={null}
      >
        {lightboxImage && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.5rem' }}>
            <img
              src={lightboxImage}
              alt="enlarged_screenshot"
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
        )}
      </Modal>

    </div>
  );
}
