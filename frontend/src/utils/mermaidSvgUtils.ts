/**
 * Mermaid SVG 安全解析、交互式视口计算与导出工具集
 * 纯原生浏览器 API 实现，零额外第三方依赖。
 */

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;
export const WHEEL_ZOOM_FACTOR = 0.12;
export const EXPORT_PADDING = 24;

const MAX_CANVAS_EDGE = 8192;
const MAX_CANVAS_PIXELS = 24_000_000;

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const FORBIDDEN_TAGS = new Set(['script', 'iframe', 'object', 'embed']);

export interface SvgDimensions {
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface ViewBoxRect {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface StandaloneSvgResult {
  svgString: string;
  width: number;
  height: number;
}

export type ExportFormat = 'png' | 'svg';

/**
 * 将缩放比例限制在 [MIN_ZOOM, MAX_ZOOM] 区间，并消除浮点漂移
 */
export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) {
    return 1;
  }
  const bounded = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  return Math.round(bounded * 100) / 100;
}

export function zoomIn(scale: number): number {
  return clampZoom(scale + ZOOM_STEP);
}

export function zoomOut(scale: number): number {
  return clampZoom(scale - ZOOM_STEP);
}

export function zoomByWheel(scale: number, deltaY: number): number {
  if (deltaY === 0) {
    return clampZoom(scale);
  }
  const factor = deltaY < 0 ? 1 + WHEEL_ZOOM_FACTOR : 1 - WHEEL_ZOOM_FACTOR;
  return clampZoom(scale * factor);
}

export function formatZoomPercent(scale: number): string {
  return `${Math.round(clampZoom(scale) * 100)}%`;
}

/**
 * 以光标相对画布中心坐标为锚点计算缩放后的新平移偏移，确保缩放时目标内容点保持在光标下方。
 */
export function calculateZoomTowardsPoint(
  currentPan: Point2D,
  oldScale: number,
  newScale: number,
  cursorFromCenter: Point2D
): Point2D {
  if (!Number.isFinite(oldScale) || oldScale <= 0 || !Number.isFinite(newScale) || newScale <= 0) {
    return currentPan;
  }
  const ratio = newScale / oldScale;
  return {
    x: Math.round((cursorFromCenter.x - (cursorFromCenter.x - currentPan.x) * ratio) * 100) / 100,
    y: Math.round((cursorFromCenter.y - (cursorFromCenter.y - currentPan.y) * ratio) * 100) / 100,
  };
}

/**
 * 计算图表适应当前视口的推荐缩放比例：
 * - 小图保持 100%（不强行拉伸失真）
 * - 超宽或超高大图等比缩小以完整呈现，最低不低于 MIN_ZOOM
 */
export function calculateFitScale(
  naturalSize: SvgDimensions,
  viewportSize: SvgDimensions,
  padding = 32
): number {
  if (
    naturalSize.width <= 0 ||
    naturalSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return 1;
  }
  const availableWidth = Math.max(64, viewportSize.width - padding * 2);
  const availableHeight = Math.max(64, viewportSize.height - padding * 2);
  const scaleX = availableWidth / naturalSize.width;
  const scaleY = availableHeight / naturalSize.height;
  const fit = Math.min(1, scaleX, scaleY);
  return clampZoom(fit);
}

/**
 * 切换至 1:1 原始尺寸时的友好初始定位：
 * - 若图表高于视口，优先对齐图表顶部（留出 topPadding），方便从流程图/时序图顶端开始阅读
 * - 否则居中显示
 */
export function calculateActualSizePan(
  naturalSize: SvgDimensions,
  viewportSize: SvgDimensions,
  topPadding = 24
): Point2D {
  const y =
    naturalSize.height > viewportSize.height
      ? Math.round((naturalSize.height - viewportSize.height) / 2 - topPadding)
      : 0;
  return { x: 0, y };
}

/**
 * 解析 SVG viewBox 字符串
 */
export function parseViewBox(viewBox: string | null): ViewBoxRect | null {
  if (!viewBox) {
    return null;
  }
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map((token) => Number.parseFloat(token));
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) {
    return null;
  }
  const [minX, minY, width, height] = parts;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { minX, minY, width, height };
}

function parsePixelLength(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.endsWith('%')) {
    return null;
  }
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * 从 viewBox 或 width/height 属性提取 SVG 原始像素尺寸
 */
export function extractDimensionsFromAttributes(
  viewBoxAttr: string | null,
  widthAttr: string | null,
  heightAttr: string | null,
  fallback: SvgDimensions = { width: 800, height: 480 }
): SvgDimensions {
  const vb = parseViewBox(viewBoxAttr);
  if (vb) {
    return {
      width: Math.ceil(vb.width),
      height: Math.ceil(vb.height),
    };
  }
  const parsedW = parsePixelLength(widthAttr);
  const parsedH = parsePixelLength(heightAttr);
  if (parsedW && parsedH) {
    return {
      width: Math.ceil(parsedW),
      height: Math.ceil(parsedH),
    };
  }
  return {
    width: Math.max(1, Math.ceil(parsedW ?? fallback.width)),
    height: Math.max(1, Math.ceil(parsedH ?? fallback.height)),
  };
}

/**
 * 提取已解析 SVGSVGElement 的自然像素尺寸
 */
export function extractSvgDimensions(svgElement: SVGSVGElement): SvgDimensions {
  const rect = svgElement.getBoundingClientRect?.();
  const fallback: SvgDimensions =
    rect && rect.width > 0 && rect.height > 0
      ? { width: rect.width, height: rect.height }
      : { width: 800, height: 480 };

  return extractDimensionsFromAttributes(
    svgElement.getAttribute('viewBox'),
    svgElement.getAttribute('width'),
    svgElement.getAttribute('height'),
    fallback
  );
}

/**
 * 判断属性名是否为内联事件处理器（如 onclick / onerror）
 */
export function isDangerousAttrName(attrName: string): boolean {
  return /^on[a-z]+$/i.test(attrName.trim());
}

/**
 * 判断 URL 是否为危险协议（javascript: / vbscript: / data:text/html）
 */
export function isDangerousUrl(urlValue: string): boolean {
  const normalized = urlValue.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html')
  );
}

/**
 * 将 Mermaid 通过 HTML DOM 序列化出的非严格 XML 片段（如未自闭合的 <br>、<hr>、&nbsp;）
 * 规范化为合法 XML 1.0，兼容 image/svg+xml 解析与独立 SVG/PNG 导出。
 */
export function normalizeSvgXml(svgMarkup: string): string {
  return svgMarkup
    .replace(/<(br|hr|img)(\s[^<>]*?)?>/gi, (match, tag: string, attrs?: string) => {
      if (match.endsWith('/>')) {
        return match;
      }
      const safeAttrs = attrs ? attrs.replace(/\s+$/, '') : '';
      return `<${tag}${safeAttrs}/>`;
    })
    .replace(/&nbsp;/gi, '&#160;');
}

/**
 * 使用 DOMParser 安全解析 Mermaid SVG 并做纵深 XSS 净化，避免使用 innerHTML / dangerouslySetInnerHTML。
 * 优先按 image/svg+xml 解析；若含 Mermaid foreignObject 中的其他 HTML5 语法导致 XML 解析失败，
 * 自动回退至浏览器原生惰性 text/html 解析器（不执行脚本且完整保留 SVG/XHTML 命名空间）。
 */
export function parseAndSanitizeSvg(svgMarkup: string): SVGSVGElement | null {
  const parser = new DOMParser();
  const normalizedXml = normalizeSvgXml(svgMarkup);

  let root: Element | null = null;
  const xmlDoc = parser.parseFromString(normalizedXml, 'image/svg+xml');
  if (
    !xmlDoc.querySelector('parsererror') &&
    xmlDoc.documentElement &&
    xmlDoc.documentElement.tagName.toLowerCase() === 'svg'
  ) {
    root = xmlDoc.documentElement;
  } else {
    const htmlDoc = parser.parseFromString(svgMarkup, 'text/html');
    root = htmlDoc.body.querySelector('svg') ?? htmlDoc.querySelector('svg');
  }

  if (!root || root.tagName.toLowerCase() !== 'svg') {
    return null;
  }

  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (isDangerousAttrName(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'href' || name === 'xlink:href') && isDangerousUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return document.importNode(root, true) as unknown as SVGSVGElement;
}

/**
 * 计算安全的 PNG 导出超采样倍率：
 * - 普通图表使用 3x Retina 超采样，大图使用 2x
 * - 超大图自动降采样，避免超过浏览器 Canvas 单边/总像素限制导致导出空白
 */
export function calculateSafeExportScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return 1;
  }
  const desired = Math.max(width, height) <= 1400 ? 3 : 2;
  const maxByEdge = Math.min(MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height);
  const maxByArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  const safe = Math.min(desired, maxByEdge, maxByArea);
  if (!Number.isFinite(safe) || safe < 1) {
    return 1;
  }
  return Math.floor(safe * 100) / 100;
}

/**
 * 生成安全的固定前缀导出文件名（不含任何外部输入）
 */
export function buildExportFilename(format: ExportFormat, now: Date = new Date()): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    '-',
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join('');
  return `mermaid-diagram-${stamp}.${format}`;
}

/**
 * UTF-8 字符串安全编码为 Base64（兼容中文与特殊符号，避免 btoa 报错）
 */
export function encodeUtf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * 克隆 SVG 并构造自包含、带留白与背景色的独立 SVG 字符串
 */
export function buildStandaloneSvg(
  svgElement: SVGSVGElement,
  backgroundColor: string,
  padding = EXPORT_PADDING
): StandaloneSvgResult {
  const cloned = svgElement.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute('xmlns', SVG_NS);
  cloned.setAttribute('xmlns:xlink', XLINK_NS);

  const dims = extractSvgDimensions(svgElement);
  const existingVb = parseViewBox(cloned.getAttribute('viewBox'));
  const vb: ViewBoxRect = existingVb ?? {
    minX: 0,
    minY: 0,
    width: dims.width,
    height: dims.height,
  };

  const outX = vb.minX - padding;
  const outY = vb.minY - padding;
  const outWidth = Math.ceil(vb.width + padding * 2);
  const outHeight = Math.ceil(vb.height + padding * 2);

  cloned.setAttribute('viewBox', `${outX} ${outY} ${outWidth} ${outHeight}`);
  cloned.setAttribute('width', String(outWidth));
  cloned.setAttribute('height', String(outHeight));
  cloned.style.removeProperty('max-width');
  cloned.style.removeProperty('width');
  cloned.style.removeProperty('height');
  cloned.style.backgroundColor = backgroundColor;
  cloned.style.fontFamily =
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // 确保 foreignObject 内的 HTML 直接子节点携带标准 XHTML 命名空间，防止离线打开或转 Canvas 时文字缺失
  const foreignObjects = cloned.querySelectorAll('foreignObject');
  foreignObjects.forEach((fo) => {
    Array.from(fo.children).forEach((child) => {
      if (!child.getAttribute('xmlns')) {
        child.setAttribute('xmlns', XHTML_NS);
      }
    });
  });

  // 插入背景底色矩形，位于 defs / style 之后、绘图节点之前
  const bgRect = document.createElementNS(SVG_NS, 'rect');
  bgRect.setAttribute('x', String(outX));
  bgRect.setAttribute('y', String(outY));
  bgRect.setAttribute('width', String(outWidth));
  bgRect.setAttribute('height', String(outHeight));
  bgRect.setAttribute('fill', backgroundColor);

  let insertBeforeNode: ChildNode | null = cloned.firstChild;
  while (
    insertBeforeNode &&
    insertBeforeNode.nodeType === Node.ELEMENT_NODE &&
    ['defs', 'style', 'title', 'desc'].includes(
      (insertBeforeNode as Element).tagName.toLowerCase()
    )
  ) {
    insertBeforeNode = insertBeforeNode.nextSibling;
  }
  cloned.insertBefore(bgRect, insertBeforeNode);

  const serialized = normalizeSvgXml(new XMLSerializer().serializeToString(cloned));
  const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;

  return {
    svgString,
    width: outWidth,
    height: outHeight,
  };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * 导出为无损 SVG 文件
 */
export function downloadSvgDiagram(
  svgElement: SVGSVGElement,
  backgroundColor: string
): void {
  const { svgString } = buildStandaloneSvg(svgElement, backgroundColor);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerBlobDownload(blob, buildExportFilename('svg'));
}

/**
 * 将 SVG 渲染为高清 PNG Blob（采用 UTF-8 Base64 Data URL 避免 foreignObject 触发 Canvas 污染）
 */
export function renderSvgToPngBlob(
  svgElement: SVGSVGElement,
  backgroundColor: string
): Promise<Blob> {
  const { svgString, width, height } = buildStandaloneSvg(svgElement, backgroundColor);
  const scale = calculateSafeExportScale(width, height);
  const dataUrl = `data:image/svg+xml;base64,${encodeUtf8ToBase64(svgString)}`;

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法初始化画布上下文'));
          return;
        }
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('PNG 图像编码失败'));
            }
          },
          'image/png',
          1
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error('导出 PNG 失败'));
      }
    };

    img.onerror = () => {
      reject(new Error('图表图像加载失败，建议改用 SVG 格式下载'));
    };

    img.src = dataUrl;
  });
}

/**
 * 导出为高清 PNG 图片文件
 */
export async function downloadPngDiagram(
  svgElement: SVGSVGElement,
  backgroundColor: string
): Promise<void> {
  const blob = await renderSvgToPngBlob(svgElement, backgroundColor);
  triggerBlobDownload(blob, buildExportFilename('png'));
}

export class ClipboardImageUnsupportedError extends Error {
  constructor() {
    super('当前浏览器或非 HTTPS 环境不支持直接复制图片，请点击下载 PNG');
    this.name = 'ClipboardImageUnsupportedError';
  }
}

/**
 * 将高清 PNG 复制到系统剪贴板
 */
export async function copyPngToClipboard(
  svgElement: SVGSVGElement,
  backgroundColor: string
): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    throw new ClipboardImageUnsupportedError();
  }

  const blobPromise = renderSvgToPngBlob(svgElement, backgroundColor);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
  } catch {
    const blob = await blobPromise;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }
}

/**
 * 复制纯文本（兼容 HTTPS Clipboard API 与内网 HTTP 降级方案）
 */
export async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级到只读 textarea 复制方案
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
