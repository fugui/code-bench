import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, 
  Search, 
  X, 
  Pin, 
  PinOff, 
  ArrowRight, 
  Check, 
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { Drawer } from '@code/common';
import type { ModuleMeta } from '../utils/moduleLoader';

export interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
  modules: ModuleMeta[];
  pinnedKeys: string[];
  onTogglePin: (key: string) => void;
  getModuleIcon: (iconName?: string) => any;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  open,
  onClose,
  modules,
  pinnedKeys,
  onTogglePin,
  getModuleIcon,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pinned' | 'unpinned'>('all');

  // 当抽屉关闭时可重置搜索
  React.useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setFilterType('all');
    }
  }, [open]);

  // 搜索和 Tab 过滤
  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return modules.filter((mod) => {
      // 搜索词过滤
      const matchesQuery = !q || (
        mod.title.toLowerCase().includes(q) ||
        mod.key.toLowerCase().includes(q) ||
        (mod.description && mod.description.toLowerCase().includes(q))
      );
      if (!matchesQuery) return false;

      // 标签过滤
      const isPinned = pinnedKeys.includes(mod.key);
      if (filterType === 'pinned') return isPinned;
      if (filterType === 'unpinned') return !isPinned;
      return true;
    });
  }, [modules, searchQuery, filterType, pinnedKeys]);

  const pinnedCount = useMemo(() => {
    return modules.filter(m => pinnedKeys.includes(m.key)).length;
  }, [modules, pinnedKeys]);

  const handleCardClick = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="md"
      scope="fullscreen"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
            flexShrink: 0
          }}>
            <LayoutGrid size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-color)' }}>
              全部应用中心
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
              微前端应用全景与侧边栏钉选管理
            </div>
          </div>
        </div>
      }
      extra={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          padding: '0.3rem 0.75rem',
          borderRadius: '9999px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          color: 'var(--primary-color)',
          fontWeight: 600
        }}>
          <Pin size={13} fill="currentColor" />
          <span>常用钉选 {pinnedCount} / {modules.length}</span>
        </div>
      }
      bodyStyle={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        overflowY: 'auto'
      }}
      footer={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={14} color="#3b82f6" />
            点击卡片右上角钉选图标可实时在侧边栏增减应用
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-color)',
              cursor: 'pointer',
              fontSize: '0.825rem',
              fontWeight: 500
            }}
          >
            完成并关闭
          </button>
        </div>
      }
    >
      {/* 搜索栏与分类切换 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--text-secondary)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="搜索系统名称、描述或模块英文标识..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 2.25rem 0.65rem 2.5rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-color)',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-color)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
              title="清空搜索"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* 标签栏过滤 */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {[
            { id: 'all', label: '全部应用', count: modules.length },
            { id: 'pinned', label: '已钉选', count: pinnedCount },
            { id: 'unpinned', label: '未钉选', count: modules.length - pinnedCount }
          ].map((tab) => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: isActive ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-color)',
                  color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--primary-color)' : 'rgba(128, 128, 128, 0.15)',
                  color: isActive ? '#fff' : 'inherit'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 应用网格列表 */}
      {filteredModules.length === 0 ? (
        <div style={{
          padding: '3rem 1rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(128, 128, 128, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            {filterType === 'pinned' ? <PinOff size={24} /> : <Search size={24} />}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-color)' }}>
            {filterType === 'pinned' ? '暂无已钉选的微前端应用' : '未找到匹配的应用系统'}
          </div>
          <div style={{ fontSize: '0.8rem', maxWidth: '320px', lineHeight: 1.5 }}>
            {filterType === 'pinned' 
              ? '请切换至「全部应用」标签，点击卡片右上角的大头针图标将其钉选到侧边栏。'
              : '尝试调整搜索关键词或重置筛选条件。'}
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                marginTop: '0.5rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--primary-color)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              清除搜索词
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
        }}>
          {filteredModules.map((mod) => {
            const Icon = getModuleIcon(mod.icon);
            const isPinned = pinnedKeys.includes(mod.key);

            return (
              <div
                key={mod.key}
                onClick={() => handleCardClick(mod.path)}
                style={{
                  background: 'var(--card-bg)',
                  border: isPinned ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: isPinned ? '0 2px 10px rgba(59, 130, 246, 0.05)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isPinned ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-color)';
                  e.currentTarget.style.boxShadow = isPinned ? '0 2px 10px rgba(59, 130, 246, 0.05)' : 'none';
                }}
              >
                {/* 顶部标题与钉选操作 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: '0.975rem',
                        fontWeight: 600,
                        color: 'var(--text-color)',
                        lineHeight: 1.3
                      }}>
                        {mod.title}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace',
                        marginTop: '2px'
                      }}>
                        {mod.path}
                      </div>
                    </div>
                  </div>

                  {/* 显式钉选按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(mod.key);
                    }}
                    title={isPinned ? '从侧边栏常用移除' : '钉选到侧边栏常用'}
                    style={{
                      background: isPinned ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-color)',
                      border: isPinned ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)',
                      color: isPinned ? 'var(--primary-color)' : 'var(--text-secondary)',
                      borderRadius: '8px',
                      padding: '0.35rem 0.55rem',
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

                {/* 描述信息 */}
                <div style={{
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  minHeight: '2.5rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {mod.description || '微前端标准化插件子系统。'}
                </div>

                {/* 底部进入与权限提示 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.65rem',
                  marginTop: 'auto',
                  fontSize: '0.78rem'
                }}>
                  <div>
                    {mod.superAdminOnly && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        fontWeight: 600,
                        fontSize: '0.7rem'
                      }}>
                        <ShieldAlert size={11} /> 仅超管
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--primary-color)',
                    fontWeight: 600
                  }}>
                    <span>打开应用</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
};
