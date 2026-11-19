import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoom,
  zoomIn,
  zoomOut,
  zoomByWheel,
  formatZoomPercent,
  calculateZoomTowardsPoint,
  calculateFitScale,
  calculateActualSizePan,
  parseViewBox,
  extractDimensionsFromAttributes,
  calculateSafeExportScale,
  buildExportFilename,
  isDangerousAttrName,
  isDangerousUrl,
  encodeUtf8ToBase64,
  normalizeSvgXml,
} from '../src/utils/mermaidSvgUtils.ts';

test('clampZoom 限制缩放区间并消除浮点漂移', () => {
  assert.equal(clampZoom(0.05), MIN_ZOOM);
  assert.equal(clampZoom(0), MIN_ZOOM);
  assert.equal(clampZoom(-0.5), MIN_ZOOM);
  assert.equal(clampZoom(10), MAX_ZOOM);
  assert.equal(clampZoom(Number.NaN), 1);
  assert.equal(clampZoom(Number.POSITIVE_INFINITY), 1);
  assert.equal(clampZoom(1.0000000000000002), 1);
  assert.equal(clampZoom(1.33333), 1.33);
});

test('zoomIn / zoomOut / zoomByWheel 按预期步进且不越界', () => {
  assert.equal(zoomIn(1), 1.25);
  assert.equal(zoomIn(MAX_ZOOM), MAX_ZOOM);
  assert.equal(zoomOut(1), 0.75);
  assert.equal(zoomOut(MIN_ZOOM), MIN_ZOOM);

  const zoomedIn = zoomByWheel(1, -100);
  assert.ok(zoomedIn > 1 && zoomedIn <= MAX_ZOOM);

  const zoomedOut = zoomByWheel(1, 100);
  assert.ok(zoomedOut < 1 && zoomedOut >= MIN_ZOOM);

  assert.equal(formatZoomPercent(0.678), '68%');
  assert.equal(formatZoomPercent(1), '100%');
});

test('calculateZoomTowardsPoint 保证缩放后鼠标指向的内容点不变', () => {
  const cursor = { x: 120, y: -60 };
  const oldPan = { x: 30, y: -20 };
  const oldScale = 1;
  const newScale = 2;

  const nextPan = calculateZoomTowardsPoint(oldPan, oldScale, newScale, cursor);

  // 缩放前内容坐标: cx = (120 - 30) / 1 = 90, cy = (-60 - (-20)) / 1 = -40
  // 缩放后应满足: nextPan.x + 90 * 2 === 120 => nextPan.x = -60
  // nextPan.y + (-40) * 2 === -60 => nextPan.y = 20
  assert.equal(nextPan.x, -60);
  assert.equal(nextPan.y, 20);
});

test('calculateFitScale 小图不强行放大，大图完整适应视口', () => {
  // 小图：自然尺寸小于视口 -> 保持 1:1
  assert.equal(
    calculateFitScale({ width: 400, height: 220 }, { width: 900, height: 500 }),
    1
  );

  // 超宽大图：受宽度约束
  const wideScale = calculateFitScale(
    { width: 2000, height: 500 },
    { width: 1000, height: 600 },
    0
  );
  assert.equal(wideScale, 0.5);

  // 超高大图：受高度约束
  const tallScale = calculateFitScale(
    { width: 500, height: 1600 },
    { width: 1000, height: 800 },
    0
  );
  assert.equal(tallScale, 0.5);

  // 极大图下限不低于 MIN_ZOOM
  const hugeScale = calculateFitScale(
    { width: 10000, height: 8000 },
    { width: 800, height: 600 },
    0
  );
  assert.equal(hugeScale, MIN_ZOOM);
});

test('calculateActualSizePan 高图切换 1:1 时置顶对齐，小图居中', () => {
  assert.deepEqual(
    calculateActualSizePan({ width: 400, height: 300 }, { width: 800, height: 500 }),
    { x: 0, y: 0 }
  );

  const tallPan = calculateActualSizePan(
    { width: 600, height: 1200 },
    { width: 800, height: 500 },
    24
  );
  // (1200 - 500) / 2 - 24 = 326
  assert.equal(tallPan.x, 0);
  assert.equal(tallPan.y, 326);
});

test('parseViewBox 与 extractDimensionsFromAttributes 正确解析 SVG 尺寸', () => {
  assert.deepEqual(parseViewBox('0 0 1280.5 640'), {
    minX: 0,
    minY: 0,
    width: 1280.5,
    height: 640,
  });
  assert.deepEqual(parseViewBox('-10 -20 400 300'), {
    minX: -10,
    minY: -20,
    width: 400,
    height: 300,
  });
  assert.equal(parseViewBox('invalid'), null);
  assert.equal(parseViewBox('0 0 0 100'), null);

  // 优先 viewBox
  assert.deepEqual(
    extractDimensionsFromAttributes('0 0 1200 450', '100%', '450px'),
    { width: 1200, height: 450 }
  );

  // 无 viewBox 时回退 width/height 属性
  assert.deepEqual(
    extractDimensionsFromAttributes(null, '640px', '320px'),
    { width: 640, height: 320 }
  );

  // 百分比 width 时使用兜底值
  assert.deepEqual(
    extractDimensionsFromAttributes(null, '100%', null, { width: 800, height: 400 }),
    { width: 800, height: 400 }
  );
});

test('calculateSafeExportScale 自动为普通图提供高清倍率并为超大图降采样防溢出', () => {
  // 普通图 -> 3x 超采样
  assert.equal(calculateSafeExportScale(800, 500), 3);
  // 中大图 -> 2x 超采样
  assert.equal(calculateSafeExportScale(2000, 1200), 2);
  // 极宽图（超过单边上限 8192）-> 自动限制倍率
  const scale = calculateSafeExportScale(6000, 1000);
  assert.ok(scale >= 1 && 6000 * scale <= 8192);
});

test('buildExportFilename 生成安全规范的文件名', () => {
  const fixedDate = new Date(2026, 10, 19, 9, 5, 8); // 2026-11-19 09:05:08
  const pngName = buildExportFilename('png', fixedDate);
  const svgName = buildExportFilename('svg', fixedDate);

  assert.equal(pngName, 'mermaid-diagram-20261119-090508.png');
  assert.equal(svgName, 'mermaid-diagram-20261119-090508.svg');
  assert.ok(!pngName.includes('..') && !pngName.includes('/'));
});

test('安全净化检测能识别事件属性与危险协议 URL', () => {
  assert.equal(isDangerousAttrName('onclick'), true);
  assert.equal(isDangerousAttrName('ONERROR'), true);
  assert.equal(isDangerousAttrName('onmouseover'), true);
  assert.equal(isDangerousAttrName('class'), false);
  assert.equal(isDangerousAttrName('viewBox'), false);

  assert.equal(isDangerousUrl('javascript:alert(1)'), true);
  assert.equal(isDangerousUrl('  JaVaScRiPt:void(0)'), true);
  assert.equal(isDangerousUrl('data:text/html,<script>alert(1)</script>'), true);
  assert.equal(isDangerousUrl('vbscript:msgbox(1)'), true);
  assert.equal(isDangerousUrl('#arrowhead'), false);
  assert.equal(isDangerousUrl('https://example.com/docs'), false);
});

test('encodeUtf8ToBase64 正确编码包含中文的 SVG 字符串', () => {
  const svg = '<svg><text>架构拓扑图 - CodeBench</text></svg>';
  const encoded = encodeUtf8ToBase64(svg);
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  assert.equal(decoded, svg);
});

test('normalizeSvgXml 将 HTML5 风格空标签与实体规范为合法 XML SVG', () => {
  const mermaidHtmlSvg =
    '<svg viewBox="0 0 800 400"><foreignObject width="200" height="80">' +
    '<div xmlns="http://www.w3.org/1999/xhtml"><p>pkg/crosrpc<br>24B 公共头<br class="x">V01&nbsp;&amp;&nbsp;V05<hr><br/><br /><br ></p></div>' +
    '</foreignObject></svg>';

  const normalized = normalizeSvgXml(mermaidHtmlSvg);
  assert.ok(normalized.includes('<br/>24B 公共头'));
  assert.ok(normalized.includes('<br class="x"/>V01'));
  assert.ok(normalized.includes('<hr/>'));
  assert.ok(normalized.includes('&#160;&amp;&#160;'));
  assert.ok(normalized.includes('<br/><br /><br/>'));
  // 已自闭合标签不被破坏为 <br//>
  assert.ok(!normalized.includes('<br//>'));
  assert.ok(!normalized.includes('&nbsp;'));
});

