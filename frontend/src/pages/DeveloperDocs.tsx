import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Folder, FolderOpen, FileText, Search, ChevronRight, ChevronDown, Clock, Copy, Check, AlertTriangle, FileQuestion } from 'lucide-react';

interface DocNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: DocNode[];
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function DeveloperDocs() {
  const location = useLocation();
  const navigate = useNavigate();

  const [tree, setTree] = useState<DocNode[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [treeMessage, setTreeMessage] = useState<string>('');
  const [loadingTree, setLoadingTree] = useState<boolean>(true);

  const [selectedPath, setSelectedPath] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [docName, setDocName] = useState<string>('');
  const [modTime, setModTime] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [contentError, setContentError] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<Record<string, boolean>>({});
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  // Encode document path for URL while preserving slashes '/'
  const encodeDocPath = (path: string) => {
    return path.split('/').map(seg => encodeURIComponent(seg)).join('/');
  };

  // Decode document path from URL pathname (/docs/01-规范/代码.md -> 01-规范/代码.md)
  const getDocPathFromUrl = (pathname: string) => {
    const prefix = '/docs/';
    if (pathname.startsWith(prefix)) {
      const rawRel = pathname.substring(prefix.length);
      if (rawRel) {
        return rawRel.split('/').map(seg => decodeURIComponent(seg)).join('/');
      }
    }
    return '';
  };

  // Fetch document tree on mount
  useEffect(() => {
    fetchTree();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('code_shield_token') || localStorage.getItem('token') || '';
    return {
      'X-Portal-Request': 'true',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const fetchTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetch('/api/docs/tree', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setConfigured(data.configured);
        setTree(data.tree || []);
        if (data.message) {
          setTreeMessage(data.message);
        }
      } else {
        setTreeMessage(data.error || '获取文档树失败');
      }
    } catch (err: any) {
      setTreeMessage('无法连接到服务端: ' + err.message);
    } finally {
      setLoadingTree(false);
    }
  };

  // Sync selectedPath with URL pathname and tree
  useEffect(() => {
    if (tree.length === 0) return;
    const urlDocPath = getDocPathFromUrl(location.pathname);
    if (urlDocPath) {
      setSelectedPath(urlDocPath);
      expandParentFolders(tree, urlDocPath);
    } else {
      const firstDoc = findFirstDocPath(tree);
      if (firstDoc) {
        setSelectedPath(firstDoc);
        expandParentFolders(tree, firstDoc);
        navigate(`/docs/${encodeDocPath(firstDoc)}`, { replace: true });
      }
    }
  }, [location.pathname, tree]);

  // Fetch doc content whenever selectedPath changes
  useEffect(() => {
    if (!selectedPath) return;
    fetchDocContent(selectedPath);
  }, [selectedPath]);

  // Auto-scroll to anchor hash once document content is rendered
  useEffect(() => {
    if (!loadingContent && docContent && location.hash) {
      const targetId = decodeURIComponent(location.hash.substring(1));
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    }
  }, [loadingContent, docContent, location.hash]);

  const fetchDocContent = async (path: string) => {
    setLoadingContent(true);
    setContentError('');
    try {
      const res = await fetch(`/api/docs/content?path=${encodeURIComponent(path)}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setDocContent(data.content || '');
        setDocName(data.name || '');
        setModTime(data.mod_time || '');
      } else {
        setContentError(data.error || '加载文档内容失败');
      }
    } catch (err: any) {
      setContentError('读取文档出错: ' + err.message);
    } finally {
      setLoadingContent(false);
    }
  };

  const findFirstDocPath = (nodes: DocNode[]): string | null => {
    for (const node of nodes) {
      if (!node.is_dir) return node.path;
      if (node.children && node.children.length > 0) {
        const found = findFirstDocPath(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const expandParentFolders = (nodes: DocNode[], targetPath: string, currentParents: string[] = []) => {
    for (const node of nodes) {
      if (node.is_dir) {
        const newParents = [...currentParents, node.path];
        if (targetPath.startsWith(node.path + '/')) {
          setExpandedFolderPaths(prev => {
            const updated = { ...prev };
            newParents.forEach(p => { updated[p] = true; });
            return updated;
          });
        }
        if (node.children) {
          expandParentFolders(node.children, targetPath, newParents);
        }
      }
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolderPaths(prev => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Filter tree nodes by search query
  const filterTree = (nodes: DocNode[], query: string): DocNode[] => {
    if (!query.trim()) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes.reduce<DocNode[]>((acc, node) => {
      if (node.is_dir) {
        const filteredChildren = node.children ? filterTree(node.children, query) : [];
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerQuery)) {
          acc.push({ ...node, children: filteredChildren });
        }
      } else {
        if (node.name.toLowerCase().includes(lowerQuery) || node.path.toLowerCase().includes(lowerQuery)) {
          acc.push(node);
        }
      }
      return acc;
    }, []);
  };

  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery]);

  // Extract Table of Contents from Markdown Content
  const tocList = useMemo<TocItem[]>(() => {
    if (!docContent) return [];
    const lines = docContent.split('\n');
    const items: TocItem[] = [];

    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2].trim().replace(/[*_~`]/g, '');
        const id = rawText.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');
        items.push({ id, text: rawText, level });
      }
    });

    return items;
  }, [docContent]);

  // Copy code to clipboard handler
  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Syntax highlighter for C/C++, Java, Python, Yaml, JSON, Go, TS/JS, etc.
  const renderHighlightedCode = (codeText: string, lang: string): React.ReactNode => {
    const norm = (lang || '').toLowerCase().trim();

    // Dark theme palette (One Dark / VS Code Dark Plus inspired)
    const colors = {
      keyword: '#c678dd',     // Purple / Pink (const, return, if, class, etc.)
      string: '#98c379',      // Green ("string", 'string', `string`)
      comment: '#7f848e',     // Muted Grey (italic)
      number: '#d19a66',      // Orange / Amber (123, 3.14)
      function: '#61afef',    // Bright Blue (funcName)
      key: '#e06c75',         // Soft Red / Coral (JSON / YAML Key)
      directive: '#e5c07b',   // Amber (#include, #define)
    };

    const lines = codeText.split('\n');

    return lines.map((line, lineIdx) => {
      const tokens: React.ReactNode[] = [];
      let keyIdx = 0;

      const isJson = ['json'].includes(norm);
      const isYaml = ['yaml', 'yml'].includes(norm);

      let tokenRegex: RegExp;
      if (isJson) {
        tokenRegex = /("(?:\\.|[^\\"])*")\s*(?=:)|("(?:\\.|[^\\"])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
      } else if (isYaml) {
        tokenRegex = /(#.*$)|(^[\t ]*(?:[a-zA-Z0-9_\-\.]+|"[^"]+"|'[^']+')\s*)(?=:)|("(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*')|\b(true|false|null|yes|no)\b|(-?\d+(?:\.\d+)?)/g;
      } else {
        tokenRegex = /(#.*$|\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'|`(?:\\.|[^\\`])*`)|(^#(?:include|define|ifdef|ifndef|endif|pragma|else|elif)\b\S*)|(\b(?:int|long|short|char|float|double|void|bool|boolean|unsigned|signed|const|struct|union|class|public|private|protected|virtual|override|return|if|else|elif|for|while|do|switch|case|default|break|continue|typedef|using|namespace|new|delete|template|typename|auto|sizeof|static|extern|inline|throw|try|catch|finally|import|export|from|package|func|def|self|extends|implements|interface|type|val|var|let|async|await|yield|True|False|None|true|false|null|nil|undefined|go|defer|make|range|select)\b)|(\b[a-zA-Z_]\w*)(?=\s*\()|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)/g;
      }

      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          tokens.push(line.substring(lastIndex, match.index));
        }

        const matchText = match[0];

        if (isJson) {
          if (match[1]) { // JSON Key
            tokens.push(<span key={keyIdx++} style={{ color: colors.key, fontWeight: 600 }}>{matchText}</span>);
          } else if (match[2]) { // JSON String
            tokens.push(<span key={keyIdx++} style={{ color: colors.string }}>{matchText}</span>);
          } else if (match[3]) { // JSON Bool/Null
            tokens.push(<span key={keyIdx++} style={{ color: colors.keyword, fontWeight: 600 }}>{matchText}</span>);
          } else if (match[4]) { // JSON Number
            tokens.push(<span key={keyIdx++} style={{ color: colors.number }}>{matchText}</span>);
          } else {
            tokens.push(matchText);
          }
        } else if (isYaml) {
          if (match[1]) { // YAML Comment
            tokens.push(<span key={keyIdx++} style={{ color: colors.comment, fontStyle: 'italic' }}>{matchText}</span>);
          } else if (match[2]) { // YAML Key
            tokens.push(<span key={keyIdx++} style={{ color: colors.key, fontWeight: 600 }}>{matchText}</span>);
          } else if (match[3]) { // YAML String
            tokens.push(<span key={keyIdx++} style={{ color: colors.string }}>{matchText}</span>);
          } else if (match[4]) { // YAML Bool/Null
            tokens.push(<span key={keyIdx++} style={{ color: colors.keyword, fontWeight: 600 }}>{matchText}</span>);
          } else if (match[5]) { // YAML Number
            tokens.push(<span key={keyIdx++} style={{ color: colors.number }}>{matchText}</span>);
          } else {
            tokens.push(matchText);
          }
        } else {
          // C, C++, Java, Python, Go, TS, JS
          if (match[1]) { // Comment
            tokens.push(<span key={keyIdx++} style={{ color: colors.comment, fontStyle: 'italic' }}>{matchText}</span>);
          } else if (match[2]) { // String
            tokens.push(<span key={keyIdx++} style={{ color: colors.string }}>{matchText}</span>);
          } else if (match[3]) { // Directive (#include, #define)
            tokens.push(<span key={keyIdx++} style={{ color: colors.directive, fontWeight: 600 }}>{matchText}</span>);
          } else if (match[4]) { // Keyword / Type
            tokens.push(<span key={keyIdx++} style={{ color: colors.keyword, fontWeight: 600 }}>{matchText}</span>);
          } else if (match[5]) { // Function Call
            tokens.push(<span key={keyIdx++} style={{ color: colors.function }}>{matchText}</span>);
          } else if (match[6]) { // Number
            tokens.push(<span key={keyIdx++} style={{ color: colors.number }}>{matchText}</span>);
          } else {
            tokens.push(matchText);
          }
        }

        lastIndex = tokenRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        tokens.push(line.substring(lastIndex));
      }

      return (
        <div key={lineIdx} style={{ minHeight: '1.4em' }}>
          {tokens.length > 0 ? tokens : ' '}
        </div>
      );
    });
  };

  // Custom Markdown parser for core formatting
  const renderMarkdown = (markdownText: string) => {
    if (!markdownText) return null;

    const lines = markdownText.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let codeBlockCount = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks (```lang ... ```)
      if (line.trim().startsWith('```')) {
        const lang = line.trim().replace(/^```/, '').trim();
        let codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        const codeText = codeLines.join('\n');
        const currentIndex = codeBlockCount++;

        elements.push(
          <div key={`code-${i}`} style={{
            margin: '1.25rem 0',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            background: 'var(--code-bg, #1e1e2e)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.4rem 1rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              <span>{lang || 'code'}</span>
              <button
                onClick={() => handleCopyCode(codeText, currentIndex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'none',
                  border: 'none',
                  color: copiedCodeIndex === currentIndex ? '#10b981' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {copiedCodeIndex === currentIndex ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCodeIndex === currentIndex ? '已复制' : '复制'}</span>
              </button>
            </div>
            <pre style={{
              margin: 0,
              padding: '1rem',
              overflowX: 'auto',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#e2e8f0',
              fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
            }}>
              <code>{renderHighlightedCode(codeText, lang)}</code>
            </pre>
          </div>
        );
        continue;
      }

      // Headings (#, ##, ###)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');

        const styleMap: Record<number, React.CSSProperties> = {
          1: { fontSize: '1.75rem', fontWeight: 700, margin: '1.75rem 0 1rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' },
          2: { fontSize: '1.35rem', fontWeight: 600, margin: '1.5rem 0 0.85rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.35rem' },
          3: { fontSize: '1.15rem', fontWeight: 600, margin: '1.25rem 0 0.75rem 0' },
          4: { fontSize: '1rem', fontWeight: 600, margin: '1rem 0 0.5rem 0' },
        };

        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        elements.push(
          <Tag id={id} key={`h-${i}`} style={{ ...styleMap[level], color: 'var(--text-color)', scrollMarginTop: '100px' }}>
            {parseInlineMarkdown(text)}
          </Tag>
        );
        i++;
        continue;
      }

      // GitHub Blockquote / Alerts (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION])
      if (line.trim().startsWith('>')) {
        let quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        const fullQuote = quoteLines.join('\n');
        const alertMatch = fullQuote.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*([\s\S]*)$/i);

        if (alertMatch) {
          const type = alertMatch[1].toUpperCase();
          const alertBody = alertMatch[2];
          const alertConfig: Record<string, { bg: string; border: string; color: string; label: string }> = {
            NOTE: { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', color: '#3b82f6', label: '注意' },
            TIP: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', color: '#10b981', label: '提示' },
            WARNING: { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', color: '#f59e0b', label: '警告' },
            IMPORTANT: { bg: 'rgba(139, 92, 246, 0.08)', border: '#8b5cf6', color: '#8b5cf6', label: '重要' },
            CAUTION: { bg: 'rgba(239, 68, 68, 0.08)', border: '#ef4444', color: '#ef4444', label: '危险' }
          };
          const cfg = alertConfig[type] || alertConfig.NOTE;

          elements.push(
            <div key={`alert-${i}`} style={{
              margin: '1.25rem 0',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              background: cfg.bg,
              borderLeft: `4px solid ${cfg.border}`,
              color: 'var(--text-color)',
              fontSize: '0.9rem',
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, color: cfg.color, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                {cfg.label}
              </div>
              <div>{parseInlineMarkdown(alertBody)}</div>
            </div>
          );
        } else {
          elements.push(
            <blockquote key={`quote-${i}`} style={{
              margin: '1rem 0',
              padding: '0.75rem 1.25rem',
              borderLeft: '4px solid var(--primary-color, #3b82f6)',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0 8px 8px 0',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              lineHeight: 1.6
            }}>
              {parseInlineMarkdown(fullQuote)}
            </blockquote>
          );
        }
        continue;
      }

      // Horizontal Rule (---)
      if (line.trim().match(/^(---|[*]{3,}|_{3,})$/)) {
        elements.push(
          <hr key={`hr-${i}`} style={{
            margin: '2rem 0',
            border: 'none',
            borderTop: '1px solid var(--border-color)',
            opacity: 0.6
          }} />
        );
        i++;
        continue;
      }

      // Lists (- or * or 1.)
      if (line.trim().match(/^([-*]|\d+\.)\s+/)) {
        let listItems: React.ReactNode[] = [];
        while (i < lines.length && lines[i].trim().match(/^([-*]|\d+\.)\s+/)) {
          const itemText = lines[i].trim().replace(/^([-*]|\d+\.)\s+/, '');
          listItems.push(
            <li key={`li-${i}`} style={{ marginBottom: '0.35rem', lineHeight: 1.6 }}>
              {parseInlineMarkdown(itemText)}
            </li>
          );
          i++;
        }
        elements.push(
          <ul key={`ul-${i}`} style={{ margin: '0.75rem 0', paddingLeft: '1.5rem', color: 'var(--text-color)' }}>
            {listItems}
          </ul>
        );
        continue;
      }

      // Tables (| header |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerCols = tableLines[0].split('|').slice(1, -1).map(c => c.trim());
          // check if second line is separator
          const isSep = tableLines[1].split('|').slice(1, -1).every(c => c.trim().match(/^:?-+:?$/));
          const dataRows = isSep ? tableLines.slice(2) : tableLines.slice(1);

          elements.push(
            <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '1.25rem 0' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
                border: '1px solid var(--border-color)'
              }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                    {headerCols.map((col, idx) => (
                      <th key={idx} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-color)' }}>
                        {parseInlineMarkdown(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((r, rIdx) => {
                    const cols = r.split('|').slice(1, -1).map(c => c.trim());
                    return (
                      <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)', background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }}>
                        {cols.map((c, cIdx) => (
                          <td key={cIdx} style={{ padding: '0.5rem 1rem', color: 'var(--text-color)' }}>
                            {parseInlineMarkdown(c)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Regular Paragraphs
      if (line.trim() !== '') {
        elements.push(
          <p key={`p-${i}`} style={{ margin: '0.75rem 0', lineHeight: 1.7, color: 'var(--text-color)', fontSize: '0.95rem' }}>
            {parseInlineMarkdown(line)}
          </p>
        );
      }
      i++;
    }

    return elements;
  };

  // Helper for inline markdown: bold, italic, code, links
  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // Process code blocks first `code`
    const parts = text.split(/(`[^`]+`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            fontSize: '0.85em',
            color: 'var(--primary-color, #60a5fa)',
            fontFamily: 'Consolas, Monaco, monospace'
          }}>
            {part.slice(1, -1)}
          </code>
        );
      }

      // Process **bold** and *italic*
      let subContent = part;
      // Bold
      subContent = subContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic
      subContent = subContent.replace(/\*(.*?)\*/g, '<em>$1</em>');

      return <span key={index} dangerouslySetInnerHTML={{ __html: subContent }} />;
    });
  };

  const handleSelectDoc = (path: string) => {
    setSelectedPath(path);
    navigate(`/docs/${encodeDocPath(path)}`);
  };

  // Render doc tree recursively
  const renderTreeNodes = (nodes: DocNode[], depth = 0) => {
    return nodes.map((node) => {
      if (node.is_dir) {
        const isExpanded = expandedFolderPaths[node.path] ?? (searchQuery.length > 0);
        return (
          <div key={node.path} style={{ marginLeft: depth > 0 ? '0.75rem' : '0' }}>
            <div
              onClick={() => toggleFolder(node.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                color: 'var(--text-color)',
                fontSize: '0.875rem',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {isExpanded ? <ChevronDown size={16} color="var(--text-secondary)" /> : <ChevronRight size={16} color="var(--text-secondary)" />}
              {isExpanded ? <FolderOpen size={16} color="#60a5fa" /> : <Folder size={16} color="#60a5fa" />}
              <span style={{ fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.name}
              </span>
            </div>
            {isExpanded && node.children && (
              <div style={{ borderLeft: '1px solid var(--border-color)', marginLeft: '1.1rem', paddingTop: '0.2rem' }}>
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      const isSelected = selectedPath === node.path;
      return (
        <div
          key={node.path}
          onClick={() => handleSelectDoc(node.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.75rem',
            marginLeft: depth > 0 ? '0.25rem' : '0',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
            background: isSelected ? 'var(--primary-color, #3b82f6)' : 'transparent',
            fontWeight: isSelected ? 600 : 400,
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'transparent';
          }}
        >
          <FileText size={15} opacity={isSelected ? 1 : 0.7} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.name}
          </span>
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', background: 'var(--bg-color, #0f172a)', overflow: 'hidden' }}>
      {/* Left Sidebar: Document Tree */}
      <div style={{
        width: '280px',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        {/* Header & Search */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <BookOpen size={18} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-color)' }}>手册目录</h3>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="搜索文档规范..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem 0.4rem 2rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-color)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Tree Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.5rem' }}>
          {loadingTree ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              正在加载文档树...
            </div>
          ) : !configured ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#f59e0b', fontSize: '0.85rem' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem auto' }} />
              <div>{treeMessage || '文档仓库路径未配置'}</div>
            </div>
          ) : filteredTree.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {searchQuery ? '没有找到匹配的文档' : '目录下暂无 Markdown 文档'}
            </div>
          ) : (
            renderTreeNodes(filteredTree)
          )}
        </div>
      </div>

      {/* Center: Main Markdown Reader */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '2rem 3rem' }}>
        {loadingContent ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            载入文档内容中...
          </div>
        ) : contentError ? (
          <div style={{
            padding: '2.5rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            color: '#ef4444',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '2rem auto'
          }}>
            <FileQuestion size={36} style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>无法查看该文档</h4>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>{contentError}</p>
          </div>
        ) : !selectedPath ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            <BookOpen size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>请在左侧选择需要阅读的指导文档</p>
          </div>
        ) : (
          <div style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
            {/* Header info */}
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--primary-color, #60a5fa)', marginBottom: '0.4rem' }}>
                {selectedPath}
              </div>
              <h1 style={{ fontSize: '1.8rem', margin: '0 0 0.75rem 0', fontWeight: 700, color: 'var(--text-color)' }}>
                {docName.replace(/\.(md|markdown)$/i, '')}
              </h1>
              {modTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Clock size={14} />
                  <span>最近更新于 {new Date(modTime).toLocaleString('zh-CN')}</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ color: 'var(--text-color)' }}>
              {renderMarkdown(docContent)}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar: Table of Contents */}
      {tocList.length > 0 && (
        <div style={{
          width: '220px',
          borderLeft: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          padding: '1.5rem 1rem',
          flexShrink: 0,
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.7, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>
            本页大纲
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {tocList.map((item, idx) => (
              <a
                key={idx}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (selectedPath) {
                    navigate(`/docs/${encodeDocPath(selectedPath)}#${encodeURIComponent(item.id)}`, { replace: true });
                  }
                  const el = document.getElementById(item.id);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  paddingLeft: `${(item.level - 1) * 0.75}rem`,
                  lineHeight: 1.4,
                  transition: 'color 0.15s',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-color, #60a5fa)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {item.text}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
