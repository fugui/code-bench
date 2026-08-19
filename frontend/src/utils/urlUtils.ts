import { sshToHttps } from '@code/common';

export { sshToHttps };

/**
 * 将 HTTPS 或 HTTP URL (或 SCP 格式) 转换为标准 SSH URI 克隆地址 (ssh://git@host/group/project.git)
 */
export function httpsToSsh(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('ssh://')) {
    return trimmed;
  }

  // 若输入为 SCP 格式 git@host:path/repo.git，统一转为标准 URI 风格 ssh://git@host/path/repo.git
  if (trimmed.startsWith('git@')) {
    const scpMatch = trimmed.match(/^git@([^:]+):(?:\d+\/)?(.+)$/);
    if (scpMatch) {
      const host = scpMatch[1];
      let repoPath = scpMatch[2].replace(/\/+$/, '');
      if (!repoPath.toLowerCase().endsWith('.git')) {
        repoPath = `${repoPath}.git`;
      }
      return `ssh://git@${host}/${repoPath}`;
    }
    return trimmed;
  }

  // 匹配 http:// 或 https:// 开头的 URL
  const match = trimmed.match(/^https?:\/\/([^/:]+)(?::\d+)?\/(.+)$/);
  if (!match) return trimmed;

  const host = match[1];
  let repoPath = match[2].replace(/\/+$/, '');
  if (!repoPath.toLowerCase().endsWith('.git')) {
    repoPath = `${repoPath}.git`;
  }

  return `ssh://git@${host}/${repoPath}`;
}

/**
 * 提取仓库的完整路径（去除 host、前导 / 和末尾的 .git）
 * 例如: ssh://git@host/group/subgroup/project.git -> group/subgroup/project
 * 例如: git@host:group/subgroup/project.git -> group/subgroup/project
 * 例如: https://host/group/project.git -> group/project
 */
export function extractRepoPath(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();

  // 优先统一通过 sshToHttps 规范化后提取域名后的 Path
  const httpsUrl = sshToHttps(trimmed);
  if (httpsUrl && /^https?:\/\//i.test(httpsUrl)) {
    const stripped = httpsUrl.replace(/^https?:\/\/[^/]+\/?/i, '');
    const cleanPath = stripped.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
    if (cleanPath) return cleanPath;
  }

  // SCP 格式兜底: git@host:path/repo.git
  const scpMatch = trimmed.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
  if (scpMatch) {
    return scpMatch[1].replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  }

  // 标准 URL 格式兜底
  const urlMatch = trimmed.match(/^https?:\/\/[^/]+\/(.+)$/i);
  if (urlMatch) {
    return urlMatch[1].replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  }

  return trimmed.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
}

/**
 * 判断 URL 的协议类型
 */
export function detectRepoProtocol(url: string): 'ssh' | 'https' | 'unknown' {
  if (!url) return 'unknown';
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('git@') || trimmed.startsWith('ssh://') || trimmed.startsWith('ssh:')) {
    return 'ssh';
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return 'https';
  }
  return 'unknown';
}
