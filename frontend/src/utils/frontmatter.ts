/**
 * 通用 Markdown YAML Frontmatter 解析器与平台模块前缀路由解析工具（D-02 / D-03）。
 * 保持 100% 通用文档能力，不含任何特定业务模块逻辑。
 */

export interface FrontmatterResult {
  metadata: Record<string, string> | null;
  body: string;
}

export interface FrontmatterDisplayEntry {
  key: string;
  label: string;
  value: string;
  fullValue?: string;
  monospace?: boolean;
}

export interface ResolvedMarkdownUrl {
  href: string;
  isExternal: boolean;
  isDownload?: boolean;
  isPortalRoute?: boolean;
}

const KEY_LINE_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;
const CLOSING_FENCE_RE = /^---[ \t]*$/;
const HEX_SHA_RE = /^[0-9a-fA-F]{40}$/;

const STANDARD_METADATA_LABELS: Record<string, { label: string; monospace?: boolean; order: number }> = {
  repo: { label: '代码仓', monospace: true, order: 10 },
  subdir: { label: '子目录', monospace: true, order: 20 },
  doc_type_name: { label: '文档类型', order: 30 },
  doc_type: { label: '类型标识', monospace: true, order: 35 },
  ref_name: { label: '分支', monospace: true, order: 40 },
  version: { label: '版本', monospace: true, order: 45 },
  revision_no: { label: '修订号', monospace: true, order: 50 },
  commit_sha: { label: '提交哈希', monospace: true, order: 60 },
  author: { label: '作者', order: 70 },
  published_by: { label: '发布人', order: 75 },
  published_at: { label: '发布时间', order: 80 },
  updated_at: { label: '更新时间', order: 85 },
  source_module: { label: '来源模块', monospace: true, order: 90 },
};

const HIDDEN_METADATA_KEYS = new Set<string>(['title', 'doc_id', 'doc_type_revision']);

function parseYamlScalar(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1);
    return inner.replace(/\\(["\\ntr])/g, (_match, ch: string) => {
      switch (ch) {
        case '"':
          return '"';
        case '\\':
          return '\\';
        case 'n':
          return '\n';
        case 't':
          return '\t';
        case 'r':
          return '\r';
        default:
          return ch;
      }
    });
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/**
 * 通用 YAML Frontmatter 剥离器（D-02）：
 * - 仅当文档严格以第 1 行 `---` 开头且存在配对结束 `---` 行、内部为合法键值对时生效；
 * - 存量无 Frontmatter 文档（含正文内 `---` 水平分割线）或非法 Frontmatter 100% 原样降级返回。
 */
export function parseFrontmatter(rawMarkdown: string): FrontmatterResult {
  if (!rawMarkdown) {
    return { metadata: null, body: rawMarkdown };
  }

  const normalized = rawMarkdown.startsWith('\uFEFF') ? rawMarkdown.slice(1) : rawMarkdown;
  const lineBreakMatch = normalized.match(/\r\n|\n|\r/);
  if (!lineBreakMatch || lineBreakMatch.index === undefined) {
    return { metadata: null, body: rawMarkdown };
  }

  const firstLine = normalized.slice(0, lineBreakMatch.index);
  if (!CLOSING_FENCE_RE.test(firstLine)) {
    return { metadata: null, body: rawMarkdown };
  }

  const lines = normalized.split(/\r\n|\n|\r/);
  let closingIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (CLOSING_FENCE_RE.test(lines[i])) {
      closingIdx = i;
      break;
    }
  }

  if (closingIdx <= 1) {
    return { metadata: null, body: rawMarkdown };
  }

  const metadata: Record<string, string> = {};
  let entryCount = 0;

  for (let i = 1; i < closingIdx; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const match = line.match(KEY_LINE_RE);
    if (!match) {
      // 非合法 YAML 键值对块：安全降级，原样返回正文
      return { metadata: null, body: rawMarkdown };
    }
    const key = match[1].trim();
    const val = parseYamlScalar(match[2]);
    metadata[key] = val;
    entryCount++;
  }

  if (entryCount === 0) {
    return { metadata: null, body: rawMarkdown };
  }

  // 剥离 Frontmatter 块及紧随其后的首段空行，保持正文其余换行完全不变
  let bodyStartIdx = closingIdx + 1;
  while (bodyStartIdx < lines.length && lines[bodyStartIdx].trim() === '') {
    bodyStartIdx++;
  }
  const body = lines.slice(bodyStartIdx).join('\n');
  return { metadata, body };
}

/**
 * 将解析后的通用 Frontmatter 元数据整理为有序、易读的元信息栏展示条目。
 */
export function formatFrontmatterEntries(metadata: Record<string, string>): FrontmatterDisplayEntry[] {
  const entries: Array<FrontmatterDisplayEntry & { order: number }> = [];
  const hasDocTypeName = Boolean(metadata.doc_type_name);

  for (const [key, rawVal] of Object.entries(metadata)) {
    const val = rawVal.trim();
    if (!val || HIDDEN_METADATA_KEYS.has(key)) {
      continue;
    }
    if (key === 'doc_type' && hasDocTypeName) {
      continue;
    }

    const std = STANDARD_METADATA_LABELS[key];
    let displayValue = val;
    let fullValue: string | undefined;

    if (HEX_SHA_RE.test(val)) {
      displayValue = val.slice(0, 8);
      fullValue = val;
    } else if (key === 'revision_no' && /^\d+$/.test(val)) {
      displayValue = `v${val}`;
    } else if (key === 'published_at' || key === 'updated_at') {
      const parsedDate = new Date(val);
      if (!Number.isNaN(parsedDate.getTime())) {
        displayValue = parsedDate.toLocaleString('zh-CN');
        fullValue = val;
      }
    }

    entries.push({
      key,
      label: std ? std.label : key,
      value: displayValue,
      fullValue,
      monospace: std?.monospace,
      order: std ? std.order : 200,
    });
  }

  entries.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.key.localeCompare(b.key)));
  return entries.map(({ key, label, value, fullValue, monospace }) => ({
    key,
    label,
    value,
    fullValue,
    monospace,
  }));
}

/**
 * 规范化门户已挂载模块的路径前缀集合（源自 /api/modules 返回的 ModuleMeta.path）。
 */
export function normalizeModulePrefixes(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const prefixes: string[] = [];

  for (const raw of paths) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const clean = withSlash.replace(/\/+$/, '');
    if (!clean || clean === '/' || clean === '/docs' || clean === '/api') {
      continue;
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      prefixes.push(clean);
    }
  }
  return prefixes;
}

/**
 * 判断目标 URL 是否命中任意已挂载门户模块前缀（精确段边界匹配，防止 /foo-bar 误命中 /foo）。
 */
export function isMountedModuleRoute(url: string, mountedPrefixes: readonly string[]): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }
  for (const prefix of mountedPrefixes) {
    if (!prefix) continue;
    if (
      trimmed === prefix ||
      trimmed.startsWith(`${prefix}/`) ||
      trimmed.startsWith(`${prefix}?`) ||
      trimmed.startsWith(`${prefix}#`)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 通用 Markdown 链接解析器（D-03）：
 * 严格保持既有优先级：外链 -> 页内锚点 -> /api/ -> /docs/ -> 已挂载模块前缀 (isPortalRoute) -> 相对文档/附件路径。
 */
export function resolveMarkdownUrl(
  url: string,
  baseDocPath: string,
  mountedPrefixes: readonly string[] = []
): ResolvedMarkdownUrl {
  const trimmed = url.trim();

  // 0. Block dangerous script/data URI schemes
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return { href: '#', isExternal: false };
  }

  // 1. External links
  if (/^(https?:\/\/|mailto:|ftp:\/\/|\/\/)/i.test(trimmed)) {
    return { href: trimmed, isExternal: true };
  }

  // 2. Anchor links (#section-id)
  if (trimmed.startsWith('#')) {
    return { href: trimmed, isExternal: false };
  }

  // 3. Raw API links (/api/docs/raw...)
  if (trimmed.startsWith('/api/')) {
    return { href: trimmed, isExternal: true, isDownload: true };
  }

  // 4. Absolute docs links (/docs/...)
  if (trimmed.startsWith('/docs/')) {
    return { href: trimmed, isExternal: false };
  }

  // 5. Mounted portal module routes (e.g. /<module_key>/...) -> SPA navigation
  if (mountedPrefixes.length > 0 && isMountedModuleRoute(trimmed, mountedPrefixes)) {
    return { href: trimmed, isExternal: false, isPortalRoute: true };
  }

  // 6. Relative or absolute document/file paths (e.g. ./01-规范/代码.md, ./files/template.xlsx)
  let rawPath = trimmed;
  let hash = '';
  const hashIdx = rawPath.indexOf('#');
  if (hashIdx !== -1) {
    hash = rawPath.substring(hashIdx);
    rawPath = rawPath.substring(0, hashIdx);
  }

  if (rawPath.startsWith('/')) {
    rawPath = rawPath.substring(1);
  } else if (baseDocPath) {
    const dirParts = baseDocPath.split('/').slice(0, -1);
    const targetParts = rawPath.split('/');

    for (const part of targetParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        if (dirParts.length > 0) dirParts.pop();
      } else {
        dirParts.push(part);
      }
    }
    rawPath = dirParts.join('/');
  }

  // Check if path points to a non-markdown file (attachment / template download)
  const ext = rawPath.includes('.') ? rawPath.substring(rawPath.lastIndexOf('.')).toLowerCase() : '';
  const isDocFile = ext === '' || ext === '.md' || ext === '.markdown';

  const encodedPath = rawPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  if (!isDocFile) {
    return {
      href: `/api/docs/raw?path=${encodedPath}`,
      isExternal: true,
      isDownload: true,
    };
  }

  return { href: `/docs/${encodedPath}${hash}`, isExternal: false };
}
