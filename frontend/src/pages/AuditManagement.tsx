import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AuditStatsCard,
  AuditLogTable,
  AuditDiffDrawer,
  Modal,
  useToast,
  useConfirm,
} from '@code/common';
import type { SysAuditLog, AuditStats } from '@code/common';

export default function AuditManagement() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [logs, setLogs] = useState<SysAuditLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);

  // 抽屉详情
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<SysAuditLog | null>(null);

  // 清理模态框状态
  const [cleanDays, setCleanDays] = useState<number>(30);
  const [cleaning, setCleaning] = useState<boolean>(false);
  const [cleanModalOpen, setCleanModalOpen] = useState<boolean>(false);

  const { showToast } = useToast();
  const confirm = useConfirm();

  // 1. 获取统计数据
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/audit-logs/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // 2. 获取日志列表
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const queryStr = searchParams.toString();
      const res = await fetch(`/api/audit-logs?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      showToast('获取审计日志列表失败', 'error');
    } finally {
      setLoadingLogs(false);
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 3. 查看详情
  const handleViewDetail = (record: SysAuditLog) => {
    setSelectedLog(record);
    setDrawerVisible(true);
  };

  // 4. 清理审计日志
  const handleExecuteClean = async () => {
    if (cleanDays <= 0) {
      showToast('保留天数必须大于 0', 'warning');
      return;
    }
    setCleaning(true);
    try {
      const res = await fetch('/api/audit-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: cleanDays }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || '清理完成', 'success');
        setCleanModalOpen(false);
        fetchStats();
        fetchLogs();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || '清理历史日志失败', 'error');
      }
    } catch (err) {
      showToast('请求失败，请稍后重试', 'error');
    } finally {
      setCleaning(false);
    }
  };

  // 5. 导出审计日志
  const handleExport = () => {
    const queryStr = searchParams.toString();
    window.open(`/api/audit-logs/export?${queryStr}`, '_blank');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* 头部标题与快捷操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-color)', margin: '0 0 0.25rem 0' }}>
            全局操作审计 (Audit Trail)
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            全平台（Portal / Shield / Pipeline / PDM）写操作统一留痕、变更对比与全链路安全追溯。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-color)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            导出 CSV
          </button>
          <button
            onClick={() => setCleanModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            历史日志清理
          </button>
        </div>
      </div>

      {/* 统计概览大屏卡片 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <AuditStatsCard stats={stats} loading={loadingStats} />
      </div>

      {/* 审计日志列表表格 */}
      <AuditLogTable
        logs={logs}
        total={total}
        loading={loadingLogs}
        onViewDetail={handleViewDetail}
        onRefresh={() => {
          fetchStats();
          fetchLogs();
        }}
      />

      {/* Diff 与二级下钻抽屉 */}
      <AuditDiffDrawer
        visible={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedLog(null);
        }}
        auditLog={selectedLog}
      />

      {/* 日志清理确认模态框 Modal */}
      <Modal
        open={cleanModalOpen}
        onClose={() => !cleaning && setCleanModalOpen(false)}
        maskClosable={!cleaning}
        keyboard={!cleaning}
        title="清理历史审计日志"
        width="sm"
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setCleanModalOpen(false)}
              disabled={cleaning}
              style={{
                padding: '0.55rem 1.1rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                borderRadius: '6px',
                background: 'transparent',
                color: 'var(--text-color)',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleExecuteClean}
              disabled={cleaning}
              style={{
                padding: '0.55rem 1.1rem',
                border: 'none',
                borderRadius: '6px',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: 600,
                cursor: cleaning ? 'not-allowed' : 'pointer',
                opacity: cleaning ? 0.7 : 1,
              }}
            >
              {cleaning ? '正在清理...' : '确认执行清理'}
            </button>
          </div>
        )}
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
          清理将永久物理删除指定天数之前的操作审计日志。该项维护操作本身将作为一条 <strong>P0 级极高危自审计记录</strong> 写入日志库。
        </p>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-color)', marginBottom: '0.5rem' }}>
            保留最近天数：
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              min="1"
              max="3650"
              value={cleanDays}
              onChange={(e) => setCleanDays(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                flex: 1,
                padding: '0.6rem 0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                borderRadius: '6px',
                background: 'var(--bg-color, #f8fafc)',
                color: 'var(--text-color)',
                fontSize: '0.9rem',
              }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>天以前的日志将被删除</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
