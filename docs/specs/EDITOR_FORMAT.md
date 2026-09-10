# 编辑器内容格式

本文定义 `documents.content` 在 Tiptap 编辑器、数据库和公开阅读器之间的兼容边界。实现事实以以下文件为准：

- `frontend/src/utils/htmlToMarkdown.ts`
- `frontend/src/components/admin/tiptap/editorContentAdapter.ts`
- `frontend/src/components/DocViewer.tsx`
- `frontend/src/pages/admin/AdminDocumentEditor.tsx`

## 持久化模型

`documents.content` 是字符串字段，可保存四种检测状态：`empty`、`markdown`、`html`、`mixed`。

- 标题、强调、列表、引用、链接、代码和普通表格优先使用 Markdown/GFM。
- 需要样式或富媒体结构时保留经过清洗的 HTML，例如字体、字号、颜色、行距、对齐、图片尺寸、富表格、视频和 iframe。
- 后端不重新解释格式，只存储字符串并同步 FTS5；前端负责输入标准化和输出清洗。

不要把内容格式描述为纯 Markdown，也不要假设 HTML 能无条件透传。

## 数据流

### TiptapEditor

唯一编辑器。

```text
stored content
  -> detectContentFormat
  -> prepareContentForEditor
  -> ProseMirror document
  -> sanitizeDocumentHtml(editor.getHTML())
  -> API -> documents.content
```

`EditorContentSession` 在没有真实文档修改时保留原始字符串，避免仅打开并保存就把历史 Markdown 改写为 HTML；用户实际编辑后保存清洗过的 HTML。

### 公开阅读器

- HTML 型内容：先执行 `sanitizeDocumentHtml`，再作为受控 DOM 呈现。
- Markdown/mixed 内容：`remark-gfm`、按需 math、`remark-breaks` -> `rehype-raw` -> `rehypeHardenDocument` -> `rehype-sanitize` -> 按需 KaTeX -> `rehype-slug`。
- 阅读器从最终标题 DOM 生成大纲；标题标签和 id 必须保持稳定。

## 允许结构

核心标签集合包括：

- 文本与块：`p`、`div`、`h1`–`h6`、`blockquote`、`hr`、`br`
- 行内：`span`、`mark`、`u`、`strong`、`em`、`del`、`code`、`a`
- 列表与表格：`ul`、`ol`、`li`、`table`、`thead`、`tbody`、`tr`、`th`、`td`
- 媒体：`img`、`video`、`source`、`iframe`
- 代码：`pre`、`code`

允许属性由 `DOCUMENT_ALLOWED_ATTR` 控制，包括必要的 class/id、链接/媒体 URL、尺寸、对齐、表格跨度、加载和 iframe 限制属性。新增标签或属性必须同时更新编辑输入与公开渲染的白名单和测试。

## 样式规则

`cleanInlineStyle` 和块级样式提取器只保留受控属性和值。当前主要语义：

| 样式 | 作用域 | 持久化 |
| --- | --- | --- |
| font family/size | 行内，必要时作用于选区 | 安全 `span style` |
| color/highlight | 行内 | 安全 `span/mark style` |
| text align/line height | 段落、标题、引用、列表项、单元格 | 块元素 style |
| width/max-width/margins/display/float | 图片、视频、表格等受支持结构 | 清洗后的 style |
| font weight/text decoration | 行内 | Markdown 语义或清洗后的 style |

危险或未开放属性被丢弃；值中出现 `url(`、`javascript:`、`expression(`、`@import`、`calc(`、`var(` 或 `eval(` 时不得保留。实际数值范围与字体栈允许集合以 `htmlToMarkdown.ts` 为准，避免在文档中复制易过期的正则。

## URL 与媒体

- 相对 URL 可用于站内内容。
- 链接仅允许 HTTP(S)、mailto 和 tel。
- 图片允许 HTTP(S)、blob 和限定格式的 data-image。
- 视频/source 允许 HTTP(S) 与 blob。
- iframe 允许 HTTPS；HTTP 仅限本机地址，并在阅读端强制 sandbox、no-referrer 与 lazy loading。
- 链接在阅读端强制新窗口和 `noopener noreferrer`，图片强制 `no-referrer`。

正式保存前，编辑页会尝试调用管理 API 将外链或临时图片本地化。该步骤失败不会阻止文档保存，因此内容仍必须能安全处理外链。

## 结构兼容

- 普通 GFM 表格可以保留为 Markdown；包含图片、视频、iframe、复杂块或 `feishu-rich-table` 标记的表格保留 HTML 结构。
- Callout 使用 `> [!NOTE]`、`> [!TIP]`、`> [!WARNING]` 等引用语法或兼容 HTML 节点。
- 空可编辑块使用 `<p><br /></p>` 保留光标位置和段落边界。
- 旧 Markdown 在未编辑时不应被无意义重写；发生真实编辑后允许转换为当前规范格式。

## 变更要求

涉及格式的修改至少检查：

1. 历史 Markdown、HTML、mixed 输入能否重新编辑。
2. 保存前后语义与视觉结构是否保持。
3. 默认编辑器和 Tiptap 的格式适配是否一致。
4. 公开阅读器是否仍能清洗并渲染。
5. FTS 搜索和标题大纲是否仍可用。
6. 现有格式与安全回归测试是否覆盖该行为。

具体执行哪些验证由 `CODEX_PROJECT_STATE.md` 缓存和变化范围决定，不固定要求每次运行完整生命周期测试。
