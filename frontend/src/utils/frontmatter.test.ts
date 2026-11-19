import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFrontmatterEntries,
  isMountedModuleRoute,
  normalizeModulePrefixes,
  parseFrontmatter,
  resolveMarkdownUrl,
} from './frontmatter.ts';

describe('parseFrontmatter (D-02 通用 YAML Frontmatter 剥离器)', () => {
  it('正常解析含多字段（中文引号、含冒号时间字符串、数字）的 Frontmatter 并返回干净正文', () => {
    const raw = [
      '---',
      'title: "order-service 系统架构与核心链路"',
      'repo: "order-service"',
      'subdir: "svc/order"',
      'doc_type: "system-architecture"',
      'doc_type_name: "系统架构与核心链路"',
      'doc_type_revision: 3',
      'doc_id: 42',
      'revision_no: 5',
      'ref_name: "master"',
      'commit_sha: "a1b2c3d4e5f6789012345678901234567890abcd"',
      'published_at: "2026-11-19T15:30:00+08:00"',
      'published_by: "张三：架构师"',
      'source_module: "archdoc"',
      '---',
      '',
      '# 1. 系统定位',
      '',
      '正文内容第一段。',
    ].join('\n');

    const result = parseFrontmatter(raw);
    assert.ok(result.metadata !== null, '应成功解析出 metadata');
    assert.equal(result.metadata.title, 'order-service 系统架构与核心链路');
    assert.equal(result.metadata.repo, 'order-service');
    assert.equal(result.metadata.subdir, 'svc/order');
    assert.equal(result.metadata.published_at, '2026-11-19T15:30:00+08:00');
    assert.equal(result.metadata.published_by, '张三：架构师');
    assert.equal(result.metadata.revision_no, '5');
    assert.equal(result.body, '# 1. 系统定位\n\n正文内容第一段。');
    assert.ok(!result.body.includes('source_module'), '正文不应包含 YAML Frontmatter 原文');

    const entries = formatFrontmatterEntries(result.metadata);
    const commitEntry = entries.find((e) => e.key === 'commit_sha');
    assert.equal(commitEntry?.value, 'a1b2c3d4');
    assert.equal(commitEntry?.fullValue, 'a1b2c3d4e5f6789012345678901234567890abcd');
  });

  it('无 Frontmatter 或首行非 --- 的存量文档（含正文内水平分割线 ---）100% 原样返回', () => {
    const legacyDoc = [
      '# 存量研发规范手册',
      '',
      '第一部分说明。',
      '',
      '---',
      '',
      '## 第二部分',
      '---',
      '结尾内容。',
    ].join('\n');

    const result = parseFrontmatter(legacyDoc);
    assert.equal(result.metadata, null);
    assert.equal(result.body, legacyDoc);
  });

  it('首行 --- 但未配对闭合或内容非合法 YAML 键值对时安全降级为原样返回', () => {
    const unclosed = '---\nnot closed heading\n# Title';
    assert.deepEqual(parseFrontmatter(unclosed), { metadata: null, body: unclosed });

    const invalidBlock = '---\n这不是键值对行\n---\n# Title';
    assert.deepEqual(parseFrontmatter(invalidBlock), { metadata: null, body: invalidBlock });
  });
});

describe('resolveMarkdownUrl (D-03 已挂载模块前缀 SPA 路由与存量零回归)', () => {
  const mountedPrefixes = normalizeModulePrefixes([
    '/shield',
    '/pipeline/',
    '/pdm',
    '/archdoc',
    '/docs',
    '/api',
    '',
  ]);

  it('命中已挂载模块前缀的链接返回 isPortalRoute: true 且不新开外链', () => {
    const deepLink = '/archdoc/docs/42/evidence?commit=abc1234&file=src%2Forder.cpp&lines=10-20';
    const res = resolveMarkdownUrl(deepLink, '90-docs/order-service/system-architecture.md', mountedPrefixes);
    assert.deepEqual(res, {
      href: deepLink,
      isExternal: false,
      isPortalRoute: true,
    });

    const otherModule = resolveMarkdownUrl('/shield/reports/9', 'guide/readme.md', mountedPrefixes);
    assert.deepEqual(otherModule, {
      href: '/shield/reports/9',
      isExternal: false,
      isPortalRoute: true,
    });

    // 防止兄弟前缀误匹配（/archdoc-other 不应命中 /archdoc）
    assert.equal(isMountedModuleRoute('/archdoc-other/page', mountedPrefixes), false);
  });

  it('/docs/、/api/、相对路径、附件、页内锚点与外链行为与改造前 100% 一致', () => {
    assert.deepEqual(
      resolveMarkdownUrl('/docs/foo.md', 'dir/a.md', mountedPrefixes),
      { href: '/docs/foo.md', isExternal: false }
    );

    assert.deepEqual(
      resolveMarkdownUrl('/api/docs/raw?path=a.png', 'dir/a.md', mountedPrefixes),
      { href: '/api/docs/raw?path=a.png', isExternal: true, isDownload: true }
    );

    assert.deepEqual(
      resolveMarkdownUrl('./rel.md', 'dir/sub/a.md', mountedPrefixes),
      { href: '/docs/dir/sub/rel.md', isExternal: false }
    );

    assert.deepEqual(
      resolveMarkdownUrl('../sibling.md#sec-1', 'dir/sub/a.md', mountedPrefixes),
      { href: '/docs/dir/sibling.md#sec-1', isExternal: false }
    );

    assert.deepEqual(
      resolveMarkdownUrl('./files/template.xlsx', 'dir/a.md', mountedPrefixes),
      { href: '/api/docs/raw?path=dir/files/template.xlsx', isExternal: true, isDownload: true }
    );

    assert.deepEqual(
      resolveMarkdownUrl('#section-1', 'dir/a.md', mountedPrefixes),
      { href: '#section-1', isExternal: false }
    );

    assert.deepEqual(
      resolveMarkdownUrl('https://example.com/spec', 'dir/a.md', mountedPrefixes),
      { href: 'https://example.com/spec', isExternal: true }
    );
  });
});
