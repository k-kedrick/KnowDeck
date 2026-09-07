export interface FontFamilyOption {
  label: string;
  value: string;
  css: string;
  desc: string;
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  { label: '默认字体', value: 'default', css: '', desc: '系统默认无衬线' },
  { label: '黑体 (现代)', value: 'sans', css: "'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif", desc: '现代无衬线' },
  { label: '宋体 (典雅)', value: 'serif', css: "Songti SC, SimSun, 'Source Han Serif SC', STSong, serif", desc: '经典衬线体' },
  { label: '楷体 (手书)', value: 'kaiti', css: "Kaiti SC, KaiTi, STKaiti, BiauKai, cursive", desc: '文雅手写体' },
  { label: '仿宋 (公文)', value: 'fangsong', css: "FangSong, STFangsong, SimSun, serif", desc: '典雅公文体' },
  { label: '等宽代码', value: 'mono', css: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", desc: '程序代码体' },
];

export interface FontSizeOption {
  label: string;
  value: string;
}

export const FONT_SIZES: FontSizeOption[] = [
  { label: '12px (小标注)', value: '12px' },
  { label: '13px (次要说明)', value: '13px' },
  { label: '14px (小正文)', value: '14px' },
  { label: '15px (正文默认)', value: '15px' },
  { label: '16px (增强正文)', value: '16px' },
  { label: '18px (小标题/强调)', value: '18px' },
  { label: '20px (中标题)', value: '20px' },
  { label: '24px (大标题)', value: '24px' },
  { label: '28px (特大号)', value: '28px' },
  { label: '32px (巨大展板字)', value: '32px' },
];

export interface TextColorOption {
  label: string;
  value: string;
  isDefault?: boolean;
}

export const TEXT_COLORS: TextColorOption[] = [
  { label: '默认黑/灰', value: '#1e293b', isDefault: true },
  { label: '红色', value: '#ef4444' },
  { label: '绿色', value: '#10b981' },
  { label: '蓝色', value: '#3b82f6' },
  { label: '紫色', value: '#8b5cf6' },
  { label: '橙黄', value: '#f59e0b' },
];

export interface HighlightColorOption {
  label: string;
  value: string;
  border?: string;
  isDefault?: boolean;
}

export const HIGHLIGHT_COLORS: HighlightColorOption[] = [
  { label: '无背景', value: 'transparent', isDefault: true },
  { label: '黄色高亮', value: '#fef08a', border: '#fde047' },
  { label: '绿色高亮', value: '#dcfce7', border: '#86efac' },
  { label: '蓝色高亮', value: '#dbeafe', border: '#93c5fd' },
  { label: '粉红高亮', value: '#fce7f3', border: '#f9a8d4' },
];

export interface LineHeightOption {
  label: string;
  value: string;
}

export const LINE_HEIGHTS: LineHeightOption[] = [
  { label: '默认 (1.75)', value: 'default' },
  { label: '1.0 倍行距', value: '1.0' },
  { label: '1.1 倍行距', value: '1.1' },
  { label: '1.2 倍行距', value: '1.2' },
  { label: '1.3 倍行距', value: '1.3' },
  { label: '1.4 倍行距', value: '1.4' },
  { label: '1.5 倍行距', value: '1.5' },
  { label: '1.6 倍行距', value: '1.6' },
  { label: '1.7 倍行距', value: '1.7' },
  { label: '1.8 倍行距', value: '1.8' },
  { label: '1.9 倍行距', value: '1.9' },
  { label: '2.0 倍行距', value: '2.0' },
  { label: '2.2 倍行距', value: '2.2' },
  { label: '2.5 倍行距', value: '2.5' },
  { label: '3.0 倍行距', value: '3.0' },
];
