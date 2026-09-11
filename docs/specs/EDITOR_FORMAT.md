# 编辑器内容格式

本文定义 `documents.content` 在 Tiptap 编辑器、数据库与公开阅读器之间的格式契约与数据流。实现事实以以下源码为准：

- `frontend/src/utils/htmlToMarkdown.ts`
- `frontend/src/utils/documentHtml.ts`
- `frontend/src/components/admin/tiptap/editorContentAdapter.ts`
- `frontend/src/components/admin/tiptap/TiptapEditor.tsx`
- `frontend/src/components/admin/tiptap/TiptapReadonlyDocument.tsx`
- `frontend/src/components/DocViewer.tsx`
- `frontend/src/pages/admin/AdminDocumentEditor.tsx`

## 持久化模型

`documents.content` 在数据库中为纯字符串字段，内容格式经过 `detectContentFormat` 判定为四种状态之一：`empty`、`markdown`、`html`、`mixed`。

- **存储标准**: 现代富文本与编辑后产物均以经过 `DOMPurify` 严格净化的规范 HTML 持久化。
- **历史兼容**: 原生或导入的 Markdown/GFM 字符串在未被用户主动编辑时保持原样存储，避免仅打开查看就重写历史数据；但在渲染和编辑时由 `editorContentAdapter.ts` 标准化为一致的 HTML 结构。
- **后端纯透传**: 后端只负责字符串存储并在保存时触发 FTS5 虚拟表及索引同步，不重写或二次解析 HTML；输入标准化与安全过滤完全由前端闭环保障。

## 数据流与渲染管道

```text
【数据库 stored content】
         │
         ▼
detectContentFormat() (empty / markdown / html / mixed)
         │
         ▼
prepareContentForEditor()
   ├─ HTML: sanitizeDocumentHtml()
   └─ Markdown/Mixed: markdownToEditorHtml() -> sanitizeDocumentHtml()
         │
         ▼
processDocumentHtml() (documentHtml.ts 单次 DOM 处理)
   ├─ 图片懒加载与历史防裂替换
   ├─ 链接属性标准化与自动链接
   └─ 标题唯一稳定 ID 计算 (用于 TOC 大纲跳转)
         │
    ┌────┴───────────────────────────┐
    ▼                                ▼
【后台编辑: TiptapEditor】       【前台阅读: DocViewer】
   │                                │
ProseMirror 文档模型           TiptapReadonlyDocument
   │                             (editable: false, 共享扩展集)
用户真实编辑触发 Dirty               │
   │                           安全展示于前台正文画布，
serializeEditorContent()        同时提取 h1~h5 构建实时目录
   │
sanitizeDocumentHtml()
   │
提交后端 API 保存
```

- **编辑会话保护 (`EditorContentSession`)**: 打开已有文档时，如果用户没有做任何实质性修改直接点击保存，系统自动保留原始存储字符串，不产生多余的 HTML 转换 Diff；只有用户产生真实编辑时，才将 ProseMirror 的最新文档序列化并清洗落盘。
- **单一渲染引擎一致性**: 前台阅读端废弃了传统的独立 Markdown/rehype 管道，统一由 `TiptapReadonlyDocument` 以只读模式直接复用 TipTap 的排版扩展，保证前台呈现效果与后台编辑画布 100% 视觉对齐。

## 允许的 HTML 标签结构

白名单标签集合严格由 `DOCUMENT_ALLOWED_TAGS` 约束：

- **文本与块级**: `p`、`div`、`h1`–`h6`、`blockquote`、`hr`、`br`
- **行内样式**: `span`、`mark`、`u`、`strong`、`em`、`del`、`code`、`a`
- **列表与任务**: `ul`、`ol`、`li` (支持包含任务项选框状态的 GFM 结构)
- **表格结构**: `table`、`thead`、`tbody`、`tr`、`th`、`td`
- **多媒体**: `img`、`video`、`source`、`iframe`
- **代码结构**: `pre`、`code`

允许的属性由 `DOCUMENT_ALLOWED_ATTR` 控制，包含 `class`、`id`、`src`、`alt`、`href`、`target`、`controls`、`style`、`rel`、`width`、`height`、`align`、`referrerpolicy`、`colspan`、`rowspan`、`loading`、`sandbox`、`allow`、`allowfullscreen`、`title`、`type`、`preload`、`poster` 等。

## 样式清洗规则

内联 CSS 样式由 `cleanInlineStyle` 与 `extractBlockStyle` 进行严格的正则白名单校验：

| 样式属性 | 允许范围 / 校验规则 | 备注 |
| :--- | :--- | :--- |
| `font-family` | 仅允许安全跨平台回退字体栈（sans-serif, pingfang, yahei, consolas, menlo 等） | 严格过滤引号注入 |
| `font-size` | 仅允许 10px ~ 72px 范围，或标准 rem/em/inherit | 防止字体过大撑破排版 |
| `color` | 仅允许 16 进制颜色、标准 rgb(a)/hsl(a) 或预设英文色名 | 文字颜色 |
| `background-color` | 仅允许 16 进制颜色、标准 rgb(a)/hsl(a) 或 transparent | 高亮背景 |
| `text-align` | 仅允许 `left`、`center`、`right`、`justify` | 块级对齐 |
| `line-height` | 仅允许无单位浮点数 `1.0` ~ `3.0`（步进 0.1） | 舒适排版行间距 |
| `width` / `max-width` | 仅允许像素值（如 `100px`）或百分比（如 `100%`、`auto`） | 媒体与表格宽度 |
| `float` | 仅允许 `left`、`right`、`none` | 环绕排版 |

**禁止项**: 任何包含 `url(`、`javascript:`、`expression(`、`@import`、`calc(`、`var(` 或 `eval(` 的属性值直接整条剔除，严禁保留。

## 媒体与外链规范

- **链接**: 仅放行 `http:`、`https:`、`mailto:`、`tel:` 协议；前台自动强制添加 `target="_blank"` 与 `rel="noopener noreferrer"`。
- **图片**: 仅放行 `http:`、`https:`、`blob:` 以及特定规范的 Base64 `data:image/*`；前台强制附加 `referrerpolicy="no-referrer"`；支持点击呼出大图画廊灯箱预览。
- **视频**: 仅放行 `http:`、`https:`、`blob:`；自动包裹响应式自适应样式。
- **IFrame**: 仅放行安全的 `https:` 协议（本地开发放行 localhost）；前台自动附加 `sandbox` 隔离属性。
- **外链图片本地化**: 后台保存文章前，会自动检测内容中的外部图片链接并调用 `/api/admin/media/save-external` 下载至本地持久化目录，防止外链失效裂图。

## 结构兼容与历史降级

- **Callout 提示框**: 兼容 GitHub 规范语法（`> [!NOTE]`、`> [!TIP]`、`> [!WARNING]` 等），在编辑和阅读端统一渲染为带有特定主题色徽章的现代提示卡片。
- **表格兼容**: 原生 GFM 简易表格和带复杂样式的 HTML 表格均可被正确解析与呈现，表格自动附带水平溢出滚动保护（`overflow-x: auto`）。
- **数学公式与图表说明**: 当前版本未内置 KaTeX 与 Mermaid 渲染依赖，数学公式和图表定义建议使用语法高亮代码块（如 ` ```latex `、` ```mermaid `）作为文本安全呈现，避免假定前端具有图形化渲染能力。

## 格式变更自检清单

涉及内容格式的修改必须完成以下验证：

1. 历史纯 Markdown、纯 HTML 及混合内容的文档能否被 TipTap 正常导入与展示。
2. 编辑保存后重新加载，关键语义（标题层级、粗体、代码块、列表、表格、图片、视频）是否 100% 保持。
3. `TiptapEditor`（编辑态）与 `TiptapReadonlyDocument`（只读态）的渲染效果是否完全一致。
4. `htmlToMarkdown.test.ts`、`editorCompatibility.test.ts` 等格式与安全自动化测试是否全量通过。
