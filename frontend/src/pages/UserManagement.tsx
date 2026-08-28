import React, { useState, useEffect } from 'react';
import { Pagination, usePagination, useConfirm, Modal, EmptyState } from '@code/common';


import { useToast } from '../components/Toast';
import { AUTH_TOKEN_KEY } from '../config';

function UserManagement() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<any[]>([]);
  const AVAILABLE_ROLES = [
    { key: 'super_admin', label: '超级管理员 (全系统)' },
    { key: 'pdm_admin', label: 'PDM 管理员' },
    { key: 'pipeline_admin', label: 'Pipeline 管理员' },
    { key: 'shield_admin', label: 'CodeShield 管理员' },
    { key: 'bench_admin', label: 'CodeBench 管理员' }
  ];

  const [newUserForm, setNewUserForm] = useState({ email: '', name: '', password: '', employee_id: '', unique_id: '', employee_type: '', roles: [] as string[], department_id: '' as string | number });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', employee_id: '', unique_id: '', employee_type: '', roles: [] as string[], password: '', department_id: '' as string | number });
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);

  // Pagination states
  const { page, pageSize, setPage } = usePagination({ defaultPageSize: 25 });
  const [totalItems, setTotalItems] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);

    fetch('/api/users/import', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` },
      body: form
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) showToast(`导入失败: ${data.error}`, 'error');
        else {
          showToast(data.message || '导入成功', 'success');
          fetchUsers(page, pageSize);
        }
      })
      .catch(err => {
        console.error(err);
        showToast('网络或发生未知错误', 'error');
      })
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState<string | number>('');
  const [sortBy, setSortBy] = useState<string>('last_login');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const fetchUsers = async (currentPage = page, currentPageSize = pageSize, currentSortBy = sortBy, currentOrder = order) => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: currentPageSize.toString(),
        sort_by: currentSortBy,
        order: currentOrder,
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (filterDept) {
        params.append('department_id', filterDept.toString());
      }
      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setUsers(data.users);
          setTotalItems(data.total || 0);
        } else {
          setUsers(data.items || []);
          setTotalItems(data.total || 0);
        }
      } else if (res.status === 403) {
        setUsers([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleSort = (field: string) => {
    let nextOrder: 'asc' | 'desc' = 'desc';
    if (sortBy === field) {
      nextOrder = order === 'desc' ? 'asc' : 'desc';
    } else {
      if (field === 'email' || field === 'name') {
        nextOrder = 'asc';
      } else {
        nextOrder = 'desc';
      }
    }
    setSortBy(field);
    setOrder(nextOrder);
    fetchUsers(1, pageSize, field, nextOrder);
    setPage(1);
  };

  const renderSortHeader = (label: string, field: string) => {
    const isCurrent = sortBy === field;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          userSelect: 'none',
          color: isCurrent ? 'var(--primary-color)' : '#64748b',
          transition: 'color 0.2s',
        }}
        title={`按 ${label} 排序`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>{label}</span>
          <span style={{ fontSize: '0.75rem', opacity: isCurrent ? 1 : 0.4 }}>
            {isCurrent ? (order === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  useEffect(() => {
    fetchUsers(page, pageSize);
  }, [page, pageSize, searchQuery, filterDept]);

  useEffect(() => {
    fetch('/api/departments', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }
    })
      .then(res => res.json())
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Failed to fetch departments:', err);
        setDepartments([]);
      });
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.email || !newUserForm.password) return;
    if (!newUserForm.department_id) {
      showToast('用户必须选择归属部门', 'error');
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
        },
        body: JSON.stringify({
          ...newUserForm,
          department_id: Number(newUserForm.department_id)
        })
      });
      if (res.ok) {
        setNewUserForm({ email: '', name: '', password: '', employee_id: '', unique_id: '', employee_type: '', roles: [], department_id: '' });
        setIsUserModalOpen(false);
        fetchUsers(1, pageSize);
        setPage(1);
      } else {
        const error = await res.json();
        showToast('新建用户失败: ' + error.error, 'error');
      }
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  const handleEditUser = (user: any) => {
    let initialRoles: string[] = [];
    if (Array.isArray(user.roles)) {
      initialRoles = user.roles;
    } else if (typeof user.roles === 'string') {
      try { initialRoles = JSON.parse(user.roles); } catch (e) {}
    }
    if (user.is_admin && !initialRoles.includes('super_admin')) {
      initialRoles.push('super_admin');
    }

    setEditingUser(user);
    setEditUserForm({
      name: user.name || '',
      email: user.email || '',
      employee_id: user.employee_id || '',
      unique_id: user.unique_id || '',
      employee_type: user.employee_type || '',
      roles: initialRoles,
      password: '',
      department_id: user.department_id || ''
    });
    setIsEditUserModalOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserForm.department_id) {
      showToast('用户必须选择归属部门', 'error');
      return;
    }
    try {
      const payload: any = {
        name: editUserForm.name,
        email: editUserForm.email,
        employee_id: editUserForm.employee_id,
        unique_id: editUserForm.unique_id,
        employee_type: editUserForm.employee_type,
        roles: editUserForm.roles,
        department_id: Number(editUserForm.department_id)
      };
      if (editUserForm.password) payload.password = editUserForm.password;
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsEditUserModalOpen(false);
        setEditingUser(null);
        fetchUsers(page, pageSize);
        showToast('用户信息已更新', 'success');
      } else {
        const d = await res.json();
        showToast('更新失败: ' + d.error, 'error');
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateUserStatus = async (id: number, isActive: boolean) => {
    const ok = await confirm({
      title: `确认要${isActive ? '启用' : '禁用'}该用户吗？`,
      content: isActive ? '启用后用户将恢复正常访问权限。' : '禁用后该用户将无法登录系统。',
      type: isActive ? 'info' : 'warning',
      confirmText: isActive ? '确认启用' : '确认禁用',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
        },
        body: JSON.stringify({ is_active: isActive })
      });
      if (res.ok) fetchUsers(page, pageSize);
      else {
        const d = await res.json();
        showToast('更新失败: ' + d.error, 'error');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (id: number) => {
    const ok = await confirm({
      title: '确认删除该用户吗？',
      content: '此操作不可逆，用户数据及其关联权限将被清理。',
      type: 'danger',
      confirmText: '确认删除',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }
      });
      if (res.ok) {
        const nextUsersLength = users.length - 1;
        if (nextUsersLength === 0 && page > 1) {
          setPage(page - 1);
        } else {
          fetchUsers(page, pageSize);
        }
      }
      else {
        const d = await res.json();

        showToast('删除失败: ' + d.error, 'error');
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex-col gap-lg w-full" style={{ padding: '2rem' }}>
      <div className="flex-between flex-wrap gap-md">
        <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        <div className="flex-center gap-md">
          <input
            type="text"
            placeholder="搜索姓名、工号、邮箱..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="code-input"
            style={{ width: 220 }}
          />
          <select
            value={filterDept}
            onChange={e => {
              setFilterDept(e.target.value);
              setPage(1);
            }}
            className="code-select"
          >
            <option value="">全部部门</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-center gap-sm">
          <button type="button" className="btn btn-primary" onClick={() => setIsUserModalOpen(true)}>+ 分配新系统账号</button>
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>批量导入</button>
          <button type="button" className="btn btn-secondary" onClick={() => {
            fetch('/api/users/export', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }
            })
              .then(res => res.blob())
              .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'users.csv';
                a.click();
                URL.revokeObjectURL(url);
              })
              .catch(() => showToast('导出失败', 'error'));
          }}>批量导出</button>
        </div>
      </div>

      <div className="code-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="code-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>系统 ID</th>
                {renderSortHeader('登录邮箱', 'email')}
                {renderSortHeader('姓名', 'name')}
                {renderSortHeader('工号', 'employee_id')}
                <th>归属部门</th>
                <th>录入方式</th>
                {renderSortHeader('角色标识', 'roles')}
                {renderSortHeader('账号状态', 'is_active')}
                {renderSortHeader('最近登录', 'last_login')}
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <EmptyState
                  inTable
                  colSpan={10}
                  type="permission"
                  title="无法获取人员列表或暂无数据"
                  description="可能当前登录用户非管理员权限，或系统尚未录入任何账号。"
                  action={
                    <button type="button" className="btn btn-primary" onClick={() => setIsUserModalOpen(true)}>
                      分配新账号
                    </button>
                  }
                />
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td className="text-secondary">#{u.id}</td>
                    <td style={{ fontWeight: 500 }}>{u.email || u.username}</td>
                    <td>{u.name || '-'}</td>
                    <td>{u.employee_id || <span className="text-muted">-</span>}</td>
                    <td>{u.department?.name || <span className="text-muted">-</span>}</td>
                    <td>
                      {u.reg_method === 'sso' ? (
                        <span className="code-badge code-badge--primary">SSO 单点</span>
                      ) : u.reg_method === 'imported' ? (
                        <span className="code-badge code-badge--muted">被动导入</span>
                      ) : (
                        <span className="code-badge code-badge--success">本地录入</span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        let rList: string[] = [];
                        if (Array.isArray(u.roles)) rList = u.roles;
                        else if (typeof u.roles === 'string') {
                          try { rList = JSON.parse(u.roles); } catch (e) {}
                        }
                        if (rList.includes('super_admin')) {
                          return <span className="code-badge code-badge--warning">超级管理员</span>;
                        }

                        if (rList.length === 0) {
                          return <span className="code-badge code-badge--muted">普通骨干</span>;
                        }

                        const roleMap: Record<string, { label: string; badge: string }> = {
                          pdm_admin: { label: 'PDM管理员', badge: 'code-badge--primary' },
                          pipeline_admin: { label: 'Pipeline管理员', badge: 'code-badge--warning' },
                          shield_admin: { label: 'Shield管理员', badge: 'code-badge--success' },
                          bench_admin: { label: 'Bench管理员', badge: 'code-badge--danger' }
                        };

                        return (
                          <div className="flex-center gap-xs flex-wrap" style={{ justifyContent: 'flex-start' }}>
                            {rList.map((rk: string) => {
                              const info = roleMap[rk] || { label: rk, badge: 'code-badge--muted' };
                              return (
                                <span key={rk} className={`code-badge ${info.badge}`}>
                                  {info.label}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <span className={`code-badge ${u.is_active ? 'code-badge--success' : 'code-badge--danger'}`}>
                        {u.is_active ? '正常使用' : '已被禁用'}
                      </span>
                    </td>
                    <td className="text-secondary" style={{ fontSize: '0.8125rem' }}>
                      <div>{u.last_login ? new Date(u.last_login).toLocaleString() : <span className="text-muted">从未登录</span>}</div>
                      {u.last_ip ? (
                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>IP: {u.last_ip}</div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex-center gap-xs" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          title="编辑用户"
                          onClick={() => handleEditUser(u)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button
                          type="button"
                          title={u.is_active ? '封禁用户' : '解封用户'}
                          onClick={() => handleUpdateUserStatus(u.id, !u.is_active)}
                          className={`btn ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '4px 6px' }}
                        >
                          {u.is_active ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                          )}
                        </button>
                        <button
                          type="button"
                          title="注销用户"
                          onClick={() => handleDeleteUser(u.id)}
                          className="btn btn-danger"
                          style={{ padding: '4px 6px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <Pagination totalItems={totalItems} />
      )}

      {/* 分配新账号 Modal */}
      <Modal
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}

        title="分配新系统账号"
        width="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button type="button" onClick={() => setIsUserModalOpen(false)} style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
            <button type="button" onClick={handleCreateUser} className="btn" style={{ padding: '0.5rem 1.25rem' }}>确认创建</button>
          </div>
        }
      >
        <form onSubmit={handleCreateUser} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>真实姓名</label>
              <input required value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} placeholder="如: 张三" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>员工工号</label>
              <input value={newUserForm.employee_id} onChange={e => setNewUserForm({ ...newUserForm, employee_id: e.target.value })} placeholder="如: 00124" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>邮箱地址（登录账号）</label>
              <input required type="email" autoComplete="off" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} placeholder="如: zhangsan@company.com" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>初始密码</label>
              <input required type="password" autoComplete="new-password" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} placeholder="不少于6位" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>员工类型</label>
              <input value={newUserForm.employee_type} onChange={e => setNewUserForm({ ...newUserForm, employee_type: e.target.value })} placeholder="如: 正式员工" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>所属部门</label>
              <select required value={newUserForm.department_id} onChange={e => setNewUserForm({ ...newUserForm, department_id: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
                <option value="">请选择部门</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>分配系统管理权限</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }}>
              {AVAILABLE_ROLES.map(role => (
                <label key={role.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-color)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newUserForm.roles.includes(role.key)}
                    onChange={e => {
                      const checked = e.target.checked;
                      setNewUserForm(prev => ({
                        ...prev,
                        roles: checked
                          ? [...prev.roles, role.key]
                          : prev.roles.filter(r => r !== role.key)
                      }));
                    }}
                  />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* 编辑用户 Modal */}
      <Modal
        open={isEditUserModalOpen && !!editingUser}
        onClose={() => { setIsEditUserModalOpen(false); setEditingUser(null); }}
        title="编辑用户"
        width="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button type="button" onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }} style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
            <button type="button" onClick={handleSaveEditUser} className="btn" style={{ padding: '0.5rem 1.25rem' }}>保存修改</button>
          </div>
        }
      >
        <form onSubmit={handleSaveEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>登录邮箱</label>
            <input required type="email" value={editUserForm.email} onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })} placeholder="如: zhangsan@company.com" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>真实姓名</label>
              <input required value={editUserForm.name} onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })} placeholder="如: 张三" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>员工工号</label>
              <input value={editUserForm.employee_id} onChange={e => setEditUserForm({ ...editUserForm, employee_id: e.target.value })} placeholder="如: 00124" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>员工类型</label>
              <input value={editUserForm.employee_type} onChange={e => setEditUserForm({ ...editUserForm, employee_type: e.target.value })} placeholder="如: 正式员工" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>所属部门</label>
              <select required value={editUserForm.department_id} onChange={e => setEditUserForm({ ...editUserForm, department_id: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
                <option value="">请选择部门</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>重置密码 <span style={{ color: '#94a3b8', fontWeight: 400 }}>(留空表示不修改)</span></label>
            <input type="password" value={editUserForm.password} onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })} placeholder="输入新密码" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
          </div>
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-color)', fontWeight: 500 }}>分配系统管理权限</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }}>
              {AVAILABLE_ROLES.map(role => (
                <label key={role.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-color)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editUserForm.roles.includes(role.key)}
                    onChange={e => {
                      const checked = e.target.checked;
                      setEditUserForm(prev => ({
                        ...prev,
                        roles: checked
                          ? [...prev.roles, role.key]
                          : prev.roles.filter(r => r !== role.key)
                      }));
                    }}
                  />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default UserManagement;


