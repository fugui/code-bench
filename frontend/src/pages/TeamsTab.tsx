import React, { useEffect, useState, useRef } from 'react';
import { useToast } from '../components/Toast';
import { useConfirm, Modal, EmptyState } from '@code/common';
import MemberSearchSelect from '../components/MemberSearchSelect';


import { AUTH_TOKEN_KEY } from '../config';

function TeamsTab() {
  const [teams, setTeams] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', leader_id: '' as string | number });
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = () => {
    repoFetch('/api/departments')
      .then(res => res.json())
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error(err);
        setTeams([]);
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/departments/${editingId}` : '/api/departments';
    const method = editingId ? 'PATCH' : 'POST';

    repoFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        leader_id: formData.leader_id ? Number(formData.leader_id) : null
      })
    })
    .then(res => {
      if (res.ok) {
        setShowModal(false);
        fetchTeams();
      } else {
        res.json().then(err => showToast(err.error || '保存失败', 'error'));
      }
    })
    .catch(console.error);
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: `确认删除部门 "${name}" 吗？`,
      content: '删除后该部门下绑定的代码仓和成员关联关系将需要重新分配。',
      type: 'danger',
      confirmText: '确认删除',
    });
    if (!ok) return;

    try {
      const res = await repoFetch(`/api/departments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('部门已删除', 'success');
        fetchTeams();
      } else {
        const data = await res.json();
        showToast(data.error || '删除失败', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };


  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: '', leader_id: '' });
    setShowModal(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setFormData({ name: t.name, leader_id: t.leader_id || '' });
    setShowModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    repoFetch('/api/departments/import', {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          showToast(`导入失败: ${data.error}`, 'error');
        } else {
          showToast(data.message || '导入成功', 'success');
          fetchTeams();
        }
      })
      .catch(err => {
        console.error(err);
        showToast('导入请求出错', 'error');
      })
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <button className="btn" onClick={openAdd}>新增部门</button>
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
              repoFetch('/api/departments/export')
                .then(res => res.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'departments.csv';
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>序号</th>
              <th>部门名称</th>
              <th>部门人数</th>
              <th>代码仓数</th>
              <th>部门负责人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <EmptyState
                inTable
                colSpan={6}
                type="data"
                title="暂未录入任何部门"
                description="部门用于组织管理代码仓、架构节点与成员权限。"
                action={
                  <button className="btn" onClick={openAdd} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                    新增部门
                  </button>
                }
              />
            ) : teams.map((t, idx) => (

              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{idx + 1}</td>
                <td>{t.name}</td>
                <td>{t.user_count || 0} 人</td>
                <td>{t.repo_count || 0} 个</td>
                <td>{t.leader ? `${t.leader.name} (${t.leader.employee_id || t.leader.id})` : t.leader_id || <span style={{ color: '#aaa' }}>未配置</span>}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" onClick={() => openEdit(t)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>编辑</button>
                  <button className="btn" onClick={() => handleDelete(t.id, t.name)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 部门新增/编辑 Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? '编辑部门' : '新增部门'}
        width="sm"
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">取消</button>
            <button type="button" onClick={handleSubmit} className="btn btn-primary">{editingId ? '保存' : '确认录入'}</button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>部门名称</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>部门负责人</label>
            <MemberSearchSelect 
              value={formData.leader_id} 
              onChange={(id) => setFormData({...formData, leader_id: id})} 
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TeamsTab;

