import { sshToHttps } from '@code/common';

export { sshToHttps };

/**
 * 将 HTTPS 或 HTTP URL 转换为标准 SSH 克隆地址 (git@host:group/project.git)
 */
export function httpsToSsh(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('git@') || trimmed.startsWith('ssh://')) {
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

  return `git@${host}:${repoPath}`;
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
