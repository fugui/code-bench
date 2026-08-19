import React, { useEffect, useState, useRef } from 'react';
import { Pagination, usePagination, Drawer, useConfirm, EmptyState } from '@code/common';

import { useToast } from '../components/Toast';
import { sshToHttps, httpsToSsh, detectRepoProtocol } from '../utils/urlUtils';
import MemberSearchSelect from '../components/MemberSearchSelect';
import MultiMemberSearchSelect from '../components/MultiMemberSearchSelect';
import { AUTH_TOKEN_KEY } from '../config';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-color)',
  color: 'var(--text-color)',
  boxSizing: 'border-box',
  fontSize: '0.875rem',
  transition: 'all 0.2s ease',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.375rem',
  fontSize: '0.8rem',
  color: '#64748b',
  fontWeight: 500,
};

const cardSectionStyle: React.CSSProperties = {
  padding: '1rem 1.125rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary, rgba(248, 250, 252, 0.6))',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.875rem',
};

const getRepoNameFromUrl = (url: string) => {
  if (!url) return '';
  let trimmed = url.trim().replace(/\/+$/, '');
  let lastSegment = trimmed.split(/[/: ]+/).pop();
  if (!lastSegment) return '';
  if (lastSegment.toLowerCase().endsWith('.git')) {
    lastSegment = lastSegment.slice(0, -4);
  }
  return lastSegment;
};

const getServiceGroupFromUrl = (url: string) => {
  if (!url) return '';
  let trimmed = url.trim().replace(/\/+$/, '');
  let segments = trimmed.split(/[/: ]+/);
  if (segments.length >= 2) {
    let secondLast = segments[segments.length - 2];
    if (secondLast && secondLast !== 'http' && secondLast !== 'https' && !secondLast.includes('@')) {
      return secondLast.toUpperCase();
    }
  }
  return '';
};

function Repositories() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const repoFetch = (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
      }
    });
  };

  const [repos, setRepos] = useState<any[]>([]);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit' | null>(null);
  const [editingRepoId, setEditingRepoId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 表单状态扩充，显式维护 http_url 与 project_id
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    http_url: '',
    owner_id: '' as string | number,
    branch: 'master',
    department_id: 0,
    service_group: '',
    project_id: '',
    related_members: [] as string[]
  });

  const [teams, setTeams] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [filterServiceGroup, setFilterServiceGroup] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterName, setFilterName] = useState<string>('');
  const [subsystems, setSubsystems] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const { page, pageSize, setPage } = usePagination({ defaultPageSize: 15 });
  const [totalItems, setTotalItems] = useState<number>(0);

  useEffect(() => {
    fetchRepos();
  }, [page, filterTeam, filterServiceGroup, filterOwner, filterName]);

  useEffect(() => {
    repoFetch('/api/departments')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || []);
        setTeams(list);
        if (list.length > 0) {
          setFormData(prev => ({ ...prev, department_id: prev.department_id === 0 ? list[0].id : prev.department_id }));
        }
      })
      .catch(console.error);
    repoFetch('/api/users?pageSize=1000')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || []);
        setMembers(list);
        if (list.length > 0) {
          setFormData(prev => ({ ...prev, owner_id: prev.owner_id === '' ? list[0].id : prev.owner_id }));
        }
      })
      .catch(console.error);
    repoFetch('/api/arch-elements')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        const subs = list.filter((el: any) => el.type === 'subsystem');
        subs.sort((a: any, b: any) => (a.name_cn || '').localeCompare(b.name_cn || ''));
        setSubsystems(subs);
      })
      .catch(console.error);
  }, []);

  const fetchRepos = () => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (filterTeam) params.append('department_id', filterTeam);
    if (filterServiceGroup) params.append('service_group', filterServiceGroup);
    if (filterOwner) params.append('owner', filterOwner);
    if (filterName) params.append('name', filterName);

    repoFetch(`/api/repos?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setRepos(data.items || []);
          setTotalItems(data.total || (data.items ? data.items.length : 0));
        } else {
          setRepos([]);
          setTotalItems(0);
        }
      })
      .catch(console.error);
  };

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setPage(1);
  };

  const openAddDrawer = () => {
    setFormData({
      name: '',
      url: '',
      http_url: '',
      owner_id: members.length > 0 ? members[0].id : '',
      branch: 'master',
      department_id: teams.length > 0 ? teams[0].id : 0,
      service_group: '',
      project_id: '',
      related_members: []
    });
    setEditingRepoId(null);
    setDrawerMode('add');
  };

  const openEditDrawer = (repo: any) => {
    const rawUrl = repo.url || '';
    const rawHttpUrl = repo.http_url || (rawUrl ? sshToHttps(rawUrl) : '');
    setFormData({
      name: repo.name || '',
      url: rawUrl,
      http_url: rawHttpUrl,
      owner_id: repo.owner_id || '',
      branch: repo.branch || 'master',
      department_id: repo.department_id || (teams.length > 0 ? teams[0].id : 0),
      service_group: repo.service_group || '',
      project_id: repo.project_id || '',
      related_members: Array.isArray(repo.related_members) ? repo.related_members : []
    });
    setEditingRepoId(repo.id);
    setDrawerMode('edit');
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setEditingRepoId(null);
    setSubmitting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drawerMode === 'edit' && editingRepoId) {
      handleEditRepo();
    } else {
      handleAddRepo();
    }
  };

  const handleAddRepo = () => {
    setSubmitting(true);
    repoFetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        url: formData.url,
        http_url: formData.http_url,
        owner_id: Number(formData.owner_id) || undefined,
        branch: formData.branch,
        department_id: Number(formData.department_id),
        service_group: formData.service_group,
        project_id: formData.project_id || undefined,
        related_members: formData.related_members
      })
    })
    .then(async res => {
      if (res.ok) {
        closeDrawer();
        fetchRepos();
        showToast('成功录入代码仓', 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || '录入代码仓失败', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('网络错误，录入失败', 'error');
    })
    .finally(() => setSubmitting(false));
  };

  const handleEditRepo = () => {
    setSubmitting(true);
    repoFetch(`/api/repos/${editingRepoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        url: formData.url,
        http_url: formData.http_url,
        owner_id: Number(formData.owner_id) || undefined,
        branch: formData.branch,
        department_id: Number(formData.department_id),
        service_group: formData.service_group,
        project_id: formData.project_id,
        related_members: formData.related_members
      })
    })
    .then(async res => {
      if (res.ok) {
        closeDrawer();
        fetchRepos();
        showToast('代码仓信息已更新', 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || '更新代码仓失败', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('网络错误，更新失败', 'error');
    })
    .finally(() => setSubmitting(false));
  };

  // 输入 URL 时的智能推导与双协议解析
  const handleMainUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const protocol = detectRepoProtocol(rawVal);
    
    let nextSsh = formData.url;
    let nextHttps = formData.http_url;

    if (protocol === 'ssh') {
      nextSsh = rawVal;
      nextHttps = sshToHttps(rawVal);
    } else if (protocol === 'https') {
      nextHttps = rawVal;
      nextSsh = httpsToSsh(rawVal);
    } else {
      nextSsh = rawVal;
      nextHttps = rawVal ? sshToHttps(rawVal) : '';
    }

    const autoName = getRepoNameFromUrl(rawVal);
    const autoServiceGroup = getServiceGroupFromUrl(rawVal);

    setFormData(prev => ({
      ...prev,
      url: nextSsh,
      http_url: nextHttps,
      name: autoName || prev.name,
      service_group: autoServiceGroup || prev.service_group
    }));
  };

  const handleOwnerChange = (id: number | '', selectedUser?: any) => {
    let deptId = 0;
    if (selectedUser) {
      deptId = selectedUser.department_id || selectedUser.department?.id || 0;
    } else {
      const found = members.find(m => m.id === id);
      deptId = found?.department_id || found?.department?.id || 0;
    }
    setFormData(prev => ({
      ...prev,
      owner_id: id,
      department_id: deptId || prev.department_id
    }));
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      showToast('已复制到剪贴板', 'success');
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    }).catch(() => {
      showToast('复制失败，请手动复制', 'error');
    });
  };

  const handleDeleteRepo = async (id: number, name: string) => {
    const ok = await confirm({
      title: `确定要删除代码仓 "${name}" 吗？`,
      content: '删除后所有历史任务记录和扫描数据将同步清理，此操作不可恢复。',
      type: 'danger',
      confirmText: '彻底删除',
    });
    if (!ok) return;

    try {
      const res = await repoFetch(`/api/repos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRepos();
        showToast('成功删除代码仓', 'success');
      } else {
        showToast('删除代码仓失败', 'error');
      }
    } catch (err) {
      console.error('Failed to delete repo', err);
      showToast('网络错误，删除失败', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    repoFetch('/api/repos/import', {
      method: 'POST',
      body: data,
    })
    .then(async res => {
      if (res.ok) {
        const json = await res.json();
        showToast(json.message || '导入成功！', 'success');
        fetchRepos();
      } else {
        const json = await res.json();
        showToast(json.error || '导入失败，请检查CSV格式。', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('网络错误，导入失败。', 'error');
    })
    .finally(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });
  };

  const detectedProtocol = detectRepoProtocol(formData.url || formData.http_url);
  const commonBranches = ['master', 'main', 'dev', 'release'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <button className="btn" onClick={openAddDrawer}>新增代码仓</button>
          <button 
            className="btn" 
            style={{ background: 'var(--success-color)', borderColor: 'var(--success-color)', color: 'white' }}
            onClick={() => fileInputRef.current?.click()}
          >
            批量导入
          </button>
          <button 
            className="btn" 
            style={{ background: 'var(--success-color)', borderColor: 'var(--success-color)', color: 'white' }}
            onClick={() => {
              repoFetch('/api/repos/export')
                .then(res => res.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'repositories.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => showToast('导出失败', 'error'));
            }}
          >
            批量导出
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filterTeam} onChange={e => handleFilterChange(setFilterTeam, e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
          <option value="">全部部门</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterServiceGroup} onChange={e => handleFilterChange(setFilterServiceGroup, e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-color)', cursor: 'pointer' }}>
          <option value="">全部子系统</option>
          {subsystems.map(sub => (
            <option key={sub.id} value={sub.name_cn}>{sub.name_cn}</option>
          ))}
        </select>
        <input type="text" placeholder="按名称过滤..." value={filterName} onChange={e => handleFilterChange(setFilterName, e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        <input type="text" placeholder="按责任人过滤..." value={filterOwner} onChange={e => handleFilterChange(setFilterOwner, e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>归属部门</th>
              <th>负责人</th>
              <th>分支</th>
              <th>子系统</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {repos.length === 0 ? (
              <EmptyState
                inTable
                colSpan={6}
                type="data"
                title="暂无匹配的代码仓记录"
                description="录入代码仓后即可开展架构关联、自动化巡检与质量分析。"
                action={
                  <button className="btn" onClick={openAddDrawer} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                    录入新代码仓
                  </button>
                }
              />
            ) : repos.map(repo => {
              const targetUrl = repo.http_url || (repo.url ? sshToHttps(repo.url) : '');
              return (
                <tr key={repo.id}>
                  <td style={{ fontWeight: 500 }}>
                    {targetUrl ? (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        title={repo.url || repo.http_url}
                      >
                        {repo.name}
                        {repo.project_id && <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.3rem', fontWeight: 'normal' }}>(ID: {repo.project_id})</span>}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ) : (
                      <span style={{ color: 'var(--primary-color)' }}>{repo.name}</span>
                    )}
                  </td>
                  <td>{repo.department?.name || '未知'}</td>
                  <td>
                    {repo.owner ? (
                      <span title={repo.owner.id}>{repo.owner.name}<span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.3rem' }}>({repo.owner.employee_id || repo.owner.id})</span></span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>{repo.owner_id || '-'}</span>
                    )}
                  </td>
                  <td><span className="badge" style={{ background: 'var(--border-color)', color: 'white' }}>{repo.branch}</span></td>
                  <td>{repo.service_group}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" onClick={() => openEditDrawer(repo)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }}>编辑</button>
                    <button className="btn" onClick={() => handleDeleteRepo(repo.id, repo.name)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>删除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalItems > 0 && (
        <Pagination totalItems={totalItems} defaultPageSize={15} />
      )}

      {/* 重新设计的新增/编辑抽屉 (宽幅 md: 640px) */}
      <Drawer
        open={!!drawerMode}
        onClose={closeDrawer}
        title={drawerMode === 'edit' ? '编辑代码仓' : '新增代码仓'}
        subtitle={drawerMode === 'edit' ? `配置 ${formData.name || '代码仓'} 的克隆地址、协议及组织关联` : '录入新代码仓并配置克隆协议、主干分支及归属团队'}
        width="md"
        footer={
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={closeDrawer}
              disabled={submitting}
              style={{
                padding: '0.625rem 1.25rem',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-color, white)',
                color: 'var(--text-color, #64748b)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn"
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {drawerMode === 'edit' ? (submitting ? '保存中...' : '保存修改') : (submitting ? '录入中...' : '确认录入')}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* 区块一：代码仓地址与协议 */}
          <div style={cardSectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                仓库地址与协议解析
              </span>
              {detectedProtocol !== 'unknown' && (
                <span
                  className="badge"
                  style={{
                    background: detectedProtocol === 'ssh' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: detectedProtocol === 'ssh' ? '#2563eb' : '#059669',
                    border: `1px solid ${detectedProtocol === 'ssh' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px'
                  }}
                >
                  {detectedProtocol === 'ssh' ? 'SSH 协议识别' : 'HTTPS 协议识别'}
                </span>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                <span>快捷输入 Git 仓库地址 <span style={{ color: '#ef4444' }}>*</span></span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>支持粘贴 SSH 或 HTTPS 格式</span>
              </label>
              <input
                required
                type="text"
                placeholder="例如: git@code.example.com:group/project.git 或 https://code.example.com/group/project.git"
                value={formData.url || formData.http_url}
                onChange={handleMainUrlChange}
                style={inputStyle}
              />
            </div>

            {/* 双协议展示与复制栏 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
              
              {/* SSH URL 行 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.65rem', padding: '0.05rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>SSH</span>
                    SSH 克隆地址 (用于 Pipeline 自动化拉代码)
                  </span>
                  {formData.url && (
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.url, 'ssh')}
                      style={{ background: 'none', border: 'none', color: copiedKey === 'ssh' ? '#10b981' : 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                    >
                      {copiedKey === 'ssh' ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          已复制
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          一键复制
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="git@host:group/project.git"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem', padding: '0.45rem 0.65rem', background: 'var(--bg-color)' }}
                />
              </div>

              {/* HTTPS URL 行 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ background: '#10b981', color: '#fff', fontSize: '0.65rem', padding: '0.05rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>HTTPS</span>
                    HTTPS 访问/克隆地址 (用于网页直达与 Webhook)
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {formData.http_url && (
                      <a
                        href={formData.http_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary-color)', fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        浏览器直达
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    )}
                    {formData.http_url && (
                      <button
                        type="button"
                        onClick={() => handleCopy(formData.http_url, 'https')}
                        style={{ background: 'none', border: 'none', color: copiedKey === 'https' ? '#10b981' : 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                      >
                        {copiedKey === 'https' ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            一键复制
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="https://host/group/project.git"
                  value={formData.http_url}
                  onChange={e => setFormData({ ...formData, http_url: e.target.value })}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem', padding: '0.45rem 0.65rem', background: 'var(--bg-color)' }}
                />
              </div>

              {/* 项目 ID (Project ID) */}
              <div style={{ marginTop: '0.2rem' }}>
                <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>
                  <span>托管平台项目 ID (Project ID) <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>(选填，用于 API 对接)</span></span>
                </label>
                <input
                  type="text"
                  placeholder="例如: 10425 (系统通常会在同步或录入时自动推导识别)"
                  value={formData.project_id}
                  onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                  style={{ ...inputStyle, padding: '0.45rem 0.65rem', fontSize: '0.825rem' }}
                />
              </div>

            </div>
          </div>

          {/* 区块二：基础属性 */}
          <div style={cardSectionStyle}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              基础属性与分支
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>
                  <span>代码仓名称 <span style={{ color: '#ef4444' }}>*</span></span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="例如: auth-service"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <span>主干分支 <span style={{ color: '#ef4444' }}>*</span></span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="例如: master 或 main"
                  value={formData.branch}
                  onChange={e => setFormData({ ...formData, branch: e.target.value })}
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>常用:</span>
                  {commonBranches.map(b => (
                    <span
                      key={b}
                      onClick={() => setFormData({ ...formData, branch: b })}
                      style={{
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        background: formData.branch === b ? 'var(--primary-color)' : 'var(--border-color)',
                        color: formData.branch === b ? '#fff' : 'var(--text-color)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 区块三：组织架构与责任人 */}
          <div style={cardSectionStyle}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              归属组织与项目责任人
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>
                  <span>归属部门 <span style={{ color: '#ef4444' }}>*</span></span>
                </label>
                <select
                  required
                  value={formData.department_id}
                  onChange={e => setFormData({ ...formData, department_id: Number(e.target.value) })}
                  style={inputStyle}
                >
                  {teams.length === 0 && <option value="" disabled>无可用部门</option>}
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  <span>归属子系统 <span style={{ color: '#ef4444' }}>*</span></span>
                </label>
                <select
                  required
                  value={formData.service_group}
                  onChange={e => setFormData({ ...formData, service_group: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">-- 请选择归属子系统 --</option>
                  {subsystems.map(sub => (
                    <option key={sub.id} value={sub.name_cn}>{sub.name_cn}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                <span>项目责任人 (田主) <span style={{ color: '#ef4444' }}>*</span></span>
              </label>
              <MemberSearchSelect value={formData.owner_id} onChange={handleOwnerChange} />
            </div>

            <div>
              <label style={labelStyle}>
                <span>相关人员 (最多20人)</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>质量分析与安全巡检结果将抄送给他们</span>
              </label>
              <MultiMemberSearchSelect value={formData.related_members} onChange={ids => setFormData({ ...formData, related_members: ids })} />
            </div>
          </div>

        </form>
      </Drawer>
    </div>
  );
}

export default Repositories;
