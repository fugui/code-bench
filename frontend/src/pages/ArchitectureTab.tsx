import React, { useEffect, useState, useRef } from 'react';
import { useToast } from '../components/Toast';
import MemberSearchSelect from '../components/MemberSearchSelect';
import { AUTH_TOKEN_KEY } from '../config';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit, 
  Trash2, 
  Folder, 
  FolderOpen, 
  FileCode, 
  Cpu,
  Search,
  User,
  GitBranch,
  BookOpen
} from 'lucide-react';

const inputStyle: React.CSSProperties = { 
  width: '100%', 
  padding: '0.625rem 0.75rem', 
  borderRadius: '6px', 
  border: '1px solid var(--border-color)', 
  background: 'var(--bg-color)', 
  color: 'var(--text-color)', 
  boxSizing: 'border-box', 
  fontSize: '0.875rem', 
  transition: 'border-color 0.2s',
  outline: 'none'
};
const labelStyle: React.CSSProperties = { 
  display: 'block', 
  marginBottom: '0.375rem', 
  fontSize: '0.8rem', 
  color: '#64748b', 
  fontWeight: 500 
};

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  employee_id?: string;
}

interface Repository {
  id: number;
  name: string;
  url: string;
  description?: string;
  last_commit_hash?: string;
}

interface ArchElement {
  id: number;
  identifier: string;
  name_cn: string;
  name_en: string;
  type: 'subsystem' | 'group' | 'module';
  parent_id: number | null;
  owner_id: number | null;
  repo_id: number | null;
  subdirectory: string;
  description: string;
  owner?: User;
  repo?: Repository;
  children?: ArchElement[];
}

function ArchitectureTab() {
  const { showToast } = useToast();
  const [elements, setElements] = useState<ArchElement[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedNode, setSelectedNode] = useState<ArchElement | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer state
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit' | null>(null);
  const [formData, setFormData] = useState({
    identifier: '',
    name_cn: '',
    name_en: '',
    type: 'subsystem' as 'subsystem' | 'group' | 'module',
    parent_id: '' as number | '',
    owner_id: '' as number | '',
    repo_id: '' as number | '',
    subdirectory: '',
    description: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const authFetch = (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
      }
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resElements, resRepos] = await Promise.all([
        authFetch('/api/arch-elements'),
        authFetch('/api/repos?pageSize=1000')
      ]);

      if (resElements.ok) {
        const rawData = await resElements.json();
        setElements(rawData || []);
      }
      if (resRepos.ok) {
        const repoData = await resRepos.json();
        setRepos(repoData.items || []);
      }
    } catch (err) {
      console.error(err);
      showToast('获取架构数据失败', 'error');
    }
  };

  // Build tree hierarchy locally
  const buildTree = (list: ArchElement[]): ArchElement[] => {
    const idMap: Record<number, ArchElement & { children: ArchElement[] }> = {};
    list.forEach(item => {
      idMap[item.id] = { ...item, children: [] };
    });

    const roots: ArchElement[] = [];
    list.forEach(item => {
      const node = idMap[item.id];
      if (item.parent_id && idMap[item.parent_id]) {
        idMap[item.parent_id].children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const treeData = buildTree(elements);

  // Auto-expand nodes containing search query match and highlight paths
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const toExpand: Record<number, boolean> = {};
    
    const findAndExpand = (node: ArchElement, path: number[]): boolean => {
      const match = node.name_cn.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    node.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    node.identifier.toLowerCase().includes(searchQuery.toLowerCase());
      
      let childMatch = false;
      if (node.children) {
        node.children.forEach(c => {
          if (findAndExpand(c, [...path, node.id])) {
            childMatch = true;
          }
        });
      }

      if (match || childMatch) {
        path.forEach(id => {
          toExpand[id] = true;
        });
        return true;
      }
      return false;
    };

    treeData.forEach(root => findAndExpand(root, []));
    setExpandedNodes(prev => ({ ...prev, ...toExpand }));
  }, [searchQuery, elements]);

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectNode = (node: ArchElement) => {
    // Resolve full details (including repo/owner which might be dynamically changed)
    const fresh = elements.find(el => el.id === node.id);
    setSelectedNode(fresh || node);
  };

  // Find path from root to current node (breadcrumbs)
  const getBreadcrumb = (node: ArchElement | null): ArchElement[] => {
    if (!node) return [];
    const path: ArchElement[] = [];
    let current: ArchElement | undefined = node;
    while (current) {
      path.unshift(current);
      if (current.parent_id) {
        current = elements.find(el => el.id === current!.parent_id);
      } else {
        break;
      }
    }
    return path;
  };

  const breadcrumbs = getBreadcrumb(selectedNode);

  // Delete handler
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除架构元素 "${name}" 吗？该操作不可恢复。`)) return;

    try {
      const res = await authFetch(`/api/arch-elements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('架构元素已成功删除', 'success');
        if (selectedNode && selectedNode.id === id) {
          setSelectedNode(null);
        }
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || '删除失败', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('网络错误，删除失败', 'error');
    }
  };

  // Form setup for add/edit
  const openAdd = (parentId: number | null = null, typeSuggestion?: 'subsystem' | 'group' | 'module') => {
    let resolvedType: 'subsystem' | 'group' | 'module' = 'subsystem';
    
    if (parentId) {
      const parent = elements.find(el => el.id === parentId);
      if (parent) {
        resolvedType = parent.type === 'subsystem' ? 'group' : 'module';
      }
    }

    if (typeSuggestion) {
      resolvedType = typeSuggestion;
    }

    setEditingId(null);
    setFormData({
      identifier: '',
      name_cn: '',
      name_en: '',
      type: resolvedType,
      parent_id: parentId || '',
      owner_id: '',
      repo_id: '',
      subdirectory: '',
      description: ''
    });
    setDrawerMode('add');
  };

  const openEdit = (node: ArchElement) => {
    setEditingId(node.id);
    setFormData({
      identifier: node.identifier || '',
      name_cn: node.name_cn || '',
      name_en: node.name_en || '',
      type: node.type,
      parent_id: node.parent_id || '',
      owner_id: node.owner_id || '',
      repo_id: node.repo_id || '',
      subdirectory: node.subdirectory || '',
      description: node.description || ''
    });
    setDrawerMode('edit');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Force Identifier validation to Uppercase
    const cleanIdentifier = formData.identifier.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(cleanIdentifier)) {
      showToast('标识名称必须由大写英文字母、数字、下划线或连字符组成。', 'error');
      return;
    }

    const payload = {
      identifier: cleanIdentifier,
      name_cn: formData.name_cn.trim(),
      name_en: formData.name_en.trim(),
      type: formData.type,
      parent_id: formData.parent_id ? Number(formData.parent_id) : null,
      owner_id: formData.owner_id ? Number(formData.owner_id) : null,
      repo_id: formData.repo_id ? Number(formData.repo_id) : null,
      subdirectory: formData.subdirectory.trim(),
      description: formData.description.trim()
    };

    const url = editingId ? `/api/arch-elements/${editingId}` : '/api/arch-elements';
    const method = editingId ? 'PATCH' : 'POST';

    try {
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        showToast(editingId ? '基本信息更新成功' : '新增架构元素成功', 'success');
        setDrawerMode(null);
        fetchData();
        
        // Auto-select or update select node
        if (editingId) {
          if (selectedNode && selectedNode.id === editingId) {
            setSelectedNode(data);
          }
        } else {
          setSelectedNode(data);
        }
      } else {
        const data = await res.json();
        showToast(data.error || '保存数据失败', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('保存数据发生网络错误', 'error');
    }
  };

  // Node icon resolver
  const getNodeIcon = (type: 'subsystem' | 'group' | 'module', isExpanded?: boolean) => {
    switch (type) {
      case 'subsystem':
        return <Cpu size={16} className="text-primary-color" style={{ color: 'var(--primary-color)' }} />;
      case 'group':
        return isExpanded 
          ? <FolderOpen size={16} style={{ color: '#eab308' }} /> 
          : <Folder size={16} style={{ color: '#eab308' }} />;
      case 'module':
        return <FileCode size={16} style={{ color: '#10b981' }} />;
      default:
        return null;
    }
  };

  // Node type badge translator
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'subsystem':
        return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}>子系统</span>;
      case 'group':
        return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}>功能组</span>;
      case 'module':
        return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>功能模块</span>;
      default:
        return null;
    }
  };

  // Recursive tree node renderer
  const renderTreeNode = (node: ArchElement, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedNode?.id === node.id;

    // Filter node matching search query
    const match = !searchQuery.trim() || 
                  node.name_cn.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  node.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  node.identifier.toLowerCase().includes(searchQuery.toLowerCase());

    const hasMatchingDescendant = (n: ArchElement): boolean => {
      if (!n.children) return false;
      return n.children.some(c => 
        c.name_cn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hasMatchingDescendant(c)
      );
    };

    const shouldShow = match || hasMatchingDescendant(node);
    if (!shouldShow) return null;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          onClick={() => selectNode(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            paddingLeft: `${depth * 1.25 + 0.75}rem`,
            borderRadius: '6px',
            cursor: 'pointer',
            background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            transition: 'background 0.2s',
            userSelect: 'none',
            justifyContent: 'space-between',
            position: 'relative'
          }}
          onMouseEnter={e => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-color)';
            const hoverMenu = e.currentTarget.querySelector('.hover-actions') as HTMLElement;
            if (hoverMenu) hoverMenu.style.opacity = '1';
          }}
          onMouseLeave={e => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            const hoverMenu = e.currentTarget.querySelector('.hover-actions') as HTMLElement;
            if (hoverMenu) hoverMenu.style.opacity = '0';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
            {/* Collapse indicator */}
            <span 
              onClick={(e) => toggleExpand(node.id, e)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: '18px', 
                height: '18px', 
                color: '#64748b',
                cursor: 'pointer',
                opacity: hasChildren ? 1 : 0,
                pointerEvents: hasChildren ? 'auto' : 'none'
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>

            {getNodeIcon(node.type, isExpanded)}
            
            <span style={{ 
              fontSize: '0.875rem', 
              color: 'var(--text-color)', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              fontWeight: isSelected ? 600 : 500
            }}>
              {node.name_cn}
              <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.3rem', fontFamily: 'monospace' }}>
                [{node.identifier}]
              </span>
            </span>
          </div>

          {/* Quick actions shown on hover */}
          <div 
            className="hover-actions" 
            style={{ 
              display: 'flex', 
              gap: '0.3rem', 
              opacity: 0, 
              transition: 'opacity 0.2s',
              background: isSelected ? 'rgba(30, 41, 59, 0.95)' : 'var(--card-bg)',
              paddingLeft: '0.5rem',
              borderRadius: '4px'
            }}
          >
            {node.type !== 'module' && (
              <button 
                title="新增子节点" 
                onClick={(e) => { e.stopPropagation(); openAdd(node.id); }} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
              >
                <Plus size={14} />
              </button>
            )}
            <button 
              title="编辑" 
              onClick={(e) => { e.stopPropagation(); openEdit(node); }} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#eab308', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
            >
              <Edit size={14} />
            </button>
            <button 
              title="删除" 
              onClick={(e) => { e.stopPropagation(); handleDelete(node.id, node.name_cn); }} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        {/* Child nodes container */}
        {hasChildren && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children!.map(c => renderTreeNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get direct children of selected node
  const getDirectChildren = (node: ArchElement | null): ArchElement[] => {
    if (!node) return [];
    return elements.filter(el => el.parent_id === node.id);
  };

  const directChildren = getDirectChildren(selectedNode);

  // Filters for potential parents to prevent cycle and node self selection
  const getPotentialParents = (): ArchElement[] => {
    if (!editingId) return elements.filter(el => el.type !== 'module');
    
    // Cycle check: exclude node itself and all of its descendants
    const descendants = new Set<number>();
    const findDescendants = (id: number) => {
      elements.forEach(el => {
        if (el.parent_id === id) {
          descendants.add(el.id);
          findDescendants(el.id);
        }
      });
    };
    findDescendants(editingId);

    return elements.filter(el => 
      el.id !== editingId && 
      !descendants.has(el.id) &&
      el.type !== 'module'
    );
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: '600px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
      
      {/* LEFT: Arch tree panel */}
      <div style={{ width: '300px', borderRight: '1px solid var(--border-color)', paddingRight: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-color)' }}>架构元素数</h3>
          <button 
            className="btn" 
            onClick={() => openAdd(null, 'subsystem')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Plus size={14} /> 新建子系统
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="搜索架构元素..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.5rem 0.5rem 0.5rem 2rem', 
              borderRadius: '6px', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-color)', 
              color: 'var(--text-color)', 
              boxSizing: 'border-box', 
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        </div>

        {/* Tree Render area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '550px' }}>
          {treeData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>暂无架构数据</div>
          ) : (
            treeData.map(root => renderTreeNode(root))
          )}
        </div>
      </div>

      {/* RIGHT: Detail and Child table panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
        
        {/* Breadcrumb path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#64748b' }}>
          <span style={{ fontWeight: 500 }}>架构根节点</span>
          {breadcrumbs.map(crumb => (
            <React.Fragment key={crumb.id}>
              <span>/</span>
              <span 
                onClick={() => selectNode(crumb)}
                style={{ cursor: 'pointer', color: selectedNode?.id === crumb.id ? 'var(--primary-color)' : '#64748b', fontWeight: selectedNode?.id === crumb.id ? 600 : 400 }}
              >
                {crumb.name_cn}
              </span>
            </React.Fragment>
          ))}
        </div>

        {selectedNode ? (
          <>
            {/* Card: Details view */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-color)' }}>
                    {selectedNode.name_cn}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {selectedNode.identifier}
                  </span>
                  {getTypeBadge(selectedNode.type)}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" onClick={() => openEdit(selectedNode)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Edit size={14} /> 编辑属性
                  </button>
                  <button className="btn" onClick={() => handleDelete(selectedNode.id, selectedNode.name_cn)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Trash2 size={14} /> 删除节点
                  </button>
                </div>
              </div>

              {/* Grid: Properties */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>中文名称</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 500 }}>{selectedNode.name_cn}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>英文名称</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 500 }}>{selectedNode.name_en || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>责任人</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={14} style={{ color: '#64748b' }} />
                    {selectedNode.owner ? `${selectedNode.owner.name} (${selectedNode.owner.employee_id || selectedNode.owner.id})` : <span style={{ color: '#64748b', fontStyle: 'italic' }}>未分配</span>}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>关联代码仓</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <GitBranch size={14} style={{ color: '#64748b' }} />
                    {selectedNode.repo ? (
                      <a href={selectedNode.repo.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.textDecoration='underline'} onMouseLeave={e => e.currentTarget.style.textDecoration='none'}>
                        {selectedNode.repo.name}
                      </a>
                    ) : <span style={{ color: '#64748b', fontStyle: 'italic' }}>无</span>}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>子目录路径</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 500, fontFamily: 'monospace' }}>
                    {selectedNode.subdirectory ? selectedNode.subdirectory : <span style={{ color: '#64748b', fontStyle: 'italic' }}>无</span>}
                  </span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>功能描述</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', lineHeight: 1.5 }}>
                    {selectedNode.description || <span style={{ color: '#64748b', fontStyle: 'italic' }}>暂无描述</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Children elements Table */}
            {selectedNode.type !== 'module' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-color)' }}>
                    下级架构元素 ({directChildren.length})
                  </h4>
                  <button 
                    className="btn" 
                    onClick={() => openAdd(selectedNode.id)}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Plus size={14} /> 添加下级元素
                  </button>
                </div>

                <div className="card" style={{ padding: 0, overflowY: 'auto', flex: 1 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>标识</th>
                        <th>中文名称</th>
                        <th>英文名称</th>
                        <th>类型</th>
                        <th>责任人</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directChildren.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            该架构下暂无子级元素
                          </td>
                        </tr>
                      ) : (
                        directChildren.map(child => (
                          <tr key={child.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{child.identifier}</td>
                            <td>
                              <span 
                                onClick={() => selectNode(child)}
                                style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 500 }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                              >
                                {child.name_cn}
                              </span>
                            </td>
                            <td>{child.name_en}</td>
                            <td>{getTypeBadge(child.type)}</td>
                            <td>
                              {child.owner ? (
                                <span>{child.owner.name} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({child.owner.employee_id || child.owner.id})</span></span>
                              ) : '-'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => openEdit(child)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>编辑</button>
                                <button className="btn" onClick={() => handleDelete(child.id, child.name_cn)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>删除</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: '#64748b', gap: '1.25rem', background: 'var(--bg-color)', borderRadius: '12px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={28} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-color)', fontSize: '1.05rem', fontWeight: 600 }}>请在左侧选择或创建一个架构元素</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: '360px', lineHeight: 1.5 }}>
                软件架构由子系统、功能组和功能模块构成，您可以通过层级树快速梳理软件体系，并绑定代码仓和责任人。
              </p>
            </div>
            <button className="btn" onClick={() => openAdd(null, 'subsystem')} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
              新增顶层子系统
            </button>
          </div>
        )}
      </div>

      {/* DRAWER: Add/Edit Panel */}
      {drawerMode && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerMode(null)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 999,
              animation: 'fadeIn 0.2s ease'
            }}
          />
          {/* Drawer panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px', maxWidth: '95vw',
            background: 'var(--card-bg)', borderLeft: '1px solid var(--border-color)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.25s ease'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)' }}>
                {drawerMode === 'edit' ? '编辑架构元素' : '新增架构元素'}
              </h3>
              <button
                onClick={() => setDrawerMode(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-color)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleFormSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>标识名称 (Identifier)</label>
                <input 
                  required 
                  type="text" 
                  placeholder="例如: SEC, AUTH, API (只允许大写字母、数字、连字符、下划线)" 
                  value={formData.identifier} 
                  onChange={e => setFormData({ ...formData, identifier: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div>
                <label style={labelStyle}>中文名称 (Chinese Name)</label>
                <input 
                  required 
                  type="text" 
                  placeholder="例如: 安全管理" 
                  value={formData.name_cn} 
                  onChange={e => setFormData({ ...formData, name_cn: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div>
                <label style={labelStyle}>英文名称 (English Name)</label>
                <input 
                  required 
                  type="text" 
                  placeholder="例如: Security Management" 
                  value={formData.name_en} 
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div>
                <label style={labelStyle}>节点类型 (Node Type)</label>
                <select 
                  required 
                  value={formData.type} 
                  onChange={e => setFormData({ ...formData, type: e.target.value as 'subsystem' | 'group' | 'module' })} 
                  style={inputStyle}
                  disabled={formData.parent_id === '' && drawerMode === 'add'} // Root must be subsystem
                >
                  <option value="subsystem">子系统 (Subsystem)</option>
                  <option value="group">功能组 (Function Group)</option>
                  <option value="module">功能模块 (Function Module)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>父级架构元素 (Parent Node)</label>
                <select 
                  value={formData.parent_id} 
                  onChange={e => setFormData({ ...formData, parent_id: e.target.value ? Number(e.target.value) : '' })} 
                  style={inputStyle}
                  disabled={formData.type === 'subsystem' && drawerMode === 'add'} // Subsystems at root suggestion
                >
                  <option value="">-- 无 (设置为顶级节点) --</option>
                  {getPotentialParents().map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name_cn} [{parent.identifier}] ({parent.type === 'subsystem' ? '子系统' : '功能组'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>责任人 (Owner)</label>
                <MemberSearchSelect 
                  value={formData.owner_id} 
                  onChange={id => setFormData({ ...formData, owner_id: id || '' })} 
                />
              </div>

              <div>
                <label style={labelStyle}>关联代码仓 (Linked Repo)</label>
                <select 
                  value={formData.repo_id} 
                  onChange={e => setFormData({ ...formData, repo_id: e.target.value ? Number(e.target.value) : '' })} 
                  style={inputStyle}
                >
                  <option value="">-- 不关联代码仓 --</option>
                  {repos.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>子目录路径 (Subdirectory Path)</label>
                <input 
                  type="text" 
                  placeholder="例如: src/components/security (代码仓内子路径, 选填)" 
                  value={formData.subdirectory} 
                  onChange={e => setFormData({ ...formData, subdirectory: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div>
                <label style={labelStyle}>功能描述 (Description)</label>
                <textarea 
                  placeholder="输入此架构元素的详细描述..." 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  style={{ ...inputStyle, height: '80px', resize: 'vertical' }} 
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
                <button type="button" onClick={() => setDrawerMode(null)} style={{ flex: 1, padding: '0.625rem', border: '1px solid var(--border-color)', background: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', color: '#64748b' }}>取消</button>
                <button type="submit" className="btn" style={{ flex: 1, padding: '0.625rem', fontSize: '0.875rem' }}>
                  {drawerMode === 'edit' ? '保存修改' : '确认新增'}
                </button>
              </div>
            </form>
          </div>

          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

export default ArchitectureTab;
