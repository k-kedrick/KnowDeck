# 安全模型

本文定义当前系统的长期安全边界与配置要求。当前安全状态、测试与风险记录见 [CODEX_PROJECT_STATE.md](CODEX_PROJECT_STATE.md)。

## 信任边界

- **公开端隔离**: 访客仅可使用 `/api/public/*` 旗下的 GET 只读接口；所有涉及文章的公开查询在仓储层强制限制为 `status = 'published'`。
- **管理端隔离**: 所有写操作与后台查询必须挂载在 `/api/admin/*` 路径下，受到 Bearer JWT 认证中间件与 `RequireAdmin` 角色守卫双重保护。
- **管理路由非安全边界**: 管理页面路径 `/wang/*` 仅为前端路由展示层，并非物理安全边界。真实鉴权边界完全依赖后端的 Bearer JWT 校验；任何通过网络请求的非法调用均会在后端被 401/403 拦截。
- **服务网络隔离**: 前端 Nginx 容器对外暴露 `${APP_PORT:-8080}`；后端 Go 服务仅在 Compose 内部网络暴露 `8090`，严禁直接映射宿主端口。
- **持久化目录隔离**: SQLite 数据库目录、物理上传文件目录与生产配置严禁由静态 Web 服务直接遍历；物理文件通过专用 Nginx 配置与严格安全响应头提供受控访问。

## 认证与授权

- **密码安全**: 所有管理员与会员密码均使用 `golang.org/x/crypto/bcrypt` 强哈希算法存储。
- **JWT 鉴权规范**: 签名算法固定使用 HS256，严格校验签发者（Issuer `feishu-kb`）、算法合法性与过期时间（默认 72 小时，范围 1–168 小时）。
- **生产环境 Secret 保护**: 生产模式拒绝占位符与长度小于 32 字符的弱密钥；未显式配置时由后端首次启动通过 `crypto/rand` 自动生成强随机密钥并以 `0600` 权限持久化至 `/data/.jwt_secret`。
- **会话版本即时失效机制 (`auth_version`)**:
  - `users.auth_version` 随 JWT Payload 签发。
  - 认证中间件每次请求比对数据库最新版本，一旦检测到用户被禁用、删除或 `auth_version` 不匹配，即刻拒绝该 Token。
  - 触发递增版本的操作包括：管理员修改凭据、会员自主修改密码、管理员重置用户密码、管理员切换用户状态或角色。幂等请求（状态未发生实际改变）不递增版本。
- **首发管理员与防重置**: `ADMIN_PASSWORD` 环境变量仅在数据库无任何用户时播种首个管理员账号，启动后修改环境变量绝不会覆盖数据库已有管理员密码。
- **防自封锁与最后管理员保护**: 管理端事务逻辑严格阻断管理员自我禁用、自我降级为 member，以及禁用或降级系统中最后一个活跃管理员账号。
- **会员前台认证与改密**:
  - 会员注册仅支持通过有效邀请码完成，角色不可指定，默认且固定为 `member`。
  - 会员登录失败采用模糊报错，不泄露用户名是否存在。
  - 会员自主修改密码（`PATCH /api/auth/password`）要求严格比对原密码，新密码必须达到 12 字符安全长度；修改成功后递增 `auth_version` 并签发包含新版本的有效 Token，保证当前操作设备无缝续期而旧设备会话立即失效。

## 内容安全 (Content Security)

文档允许 Markdown 格式与受限的排版 HTML 混合输入，因此编辑器、存储层与阅读渲染端必须维持统一的安全防线：

1. **输入与粘贴清洗**: 粘贴内容与外部 HTML 导入经 `frontend/src/utils/htmlToMarkdown.ts` 规范化，通过 `DOMPurify.sanitize` 执行白名单过滤。
   - 标签白名单由 `DOCUMENT_ALLOWED_TAGS` 控制，绝对禁止 `<script>`、`<style>`、`<object>`、`<embed>`、`<form>` 等高危标签。
   - 属性白名单由 `DOCUMENT_ALLOWED_ATTR` 控制，严格剔除 `onload`、`onerror`、`onclick` 等所有内联事件监听。
   - 样式过滤由 `cleanInlineStyle` 与 `extractBlockStyle` 控制，只放行受控字体、字号、颜色、行距、对齐与边距；绝对阻断 `url()`、`expression()`、`javascript:`、`@import`、`calc()`、`var()` 等 CSS 注入表达式。
   - 协议白名单由 `isSafeDocumentUrl` 严格限制：链接仅允许 `http:`、`https:`、`mailto:`、`tel:`；媒体仅允许 `http:`、`https:`、`blob:` 以及特定图片的 `data:`；iframe 仅允许安全的 `https:` 来源。
2. **编辑器双向无损校验**:
   - `TiptapEditor` 通过 ProseMirror 模式加载结构化节点。
   - 在用户未进行修改时，通过 `EditorContentSession` 保留原存储字符串，杜绝重写历史内容；
   - 发生保存时，通过 `serializeEditorContent` 对编辑器输出的 HTML 进行二次 `DOMPurify` 清洗后再提交后端存储。
3. **前台阅读器只读沙箱**:
   - `DocViewer` 统一调用只读 TipTap 实例（`TiptapReadonlyDocument`，`editable: false`），与编辑器共享相同的节点与属性扩展。
   - 渲染前通过 `documentHtml.ts` 进行安全单次 DOM 遍历：站外链接强制附加 `target="_blank"` 与 `rel="noopener noreferrer"`；图片强制附加 `referrerpolicy="no-referrer"`；视频与 iframe 施加受控样式与 `sandbox` 限制。
   - 彻底废除了传统的第三方 `rehype` / `remark` 渲染管道，全链路单一安全引擎。

## 媒体与文件上传安全

- **尺寸限制**: 实施严格的全局上传上限（`MAX_UPLOAD_MB`，默认 1024MB）以及图片（`MAX_IMAGE_MB` 20MB）、视频（`MAX_VIDEO_MB` 1024MB）、附件（`MAX_FILE_MB` 100MB）分类上限，禁止分类上限超出总限制。
- **扩展名与内容指纹校验**:
  - 严格实行扩展名白名单制度；禁止上传可执行文件、脚本、HTML/XML 以及包含潜在 XSS 向量的 SVG 文件。
  - 上传服务读取文件头执行 MIME 内容探测（`mimetype.DetectReader`），确保实际内容与扩展名一致。
- **存储沙箱与路径防穿越**:
  - 文件名由服务端基于时间戳与安全随机数统一生成，禁止使用客户端原始文件名直接落盘。
  - 存储路径严格经过 `filepath.Clean`、绝对路径计算与 `filepath.Rel` 边界校验，确保绝对无法逃逸出设定的上传根目录。
- **分片上传安全 (Chunked Upload Sessions)**:
  - 分片上传初始化必须验证目标文件名与文件类型。
  - 每个分片上传需携带对应的会话 ID 与分片索引，临时切片存放在受限临时目录中。
  - 完成合并时执行最终文件大小校验与内容格式验证；未完成或异常的会话支持定期清理与磁盘安全回收。
- **删除保护与引用防悬挂**:
  - 媒体表与文档建立多对多关系 (`media_document_refs`)。
  - 当媒体资产被任意已存在文档引用（`reference_count > 0`）时，后端单删接口阻断删除并提示引用列表；批量删除接口自动过滤并保留被引用的文件。
  - 提供 `POST /api/admin/media/rebuild-references` 幂等重建引用接口，防止历史引用数据遗漏。

## 网络、请求与浏览器加固

- **CORS 策略**: 仅放行 `CORS_ALLOWED_ORIGINS` 配置中的指定来源；生产环境明确阻断通配符 `*`。
- **受信任代理 (Trusted Proxies)**: Compose 生产部署默认仅信任内部 Docker 网段 (`172.16.0.0/12`)，严禁在生产环境配置通配符 `*` 或 `0.0.0.0/0`。
- **多层安全响应头**:
  - 后端 Gin 与前端 Nginx 均默认注入 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: strict-origin-when-cross-origin` 与现代 CSP。
  - Nginx 对 `/uploads/` 与 `/uploads/files/` 静态媒体目录注入更严格的 `sandbox` CSP 头：`Content-Security-Policy: default-src 'none'; sandbox`，彻底阻断任何通过上传文件触发的跨站脚本执行。
- **进程内限流保护**:
  - 登录接口：10 次 / 分钟。
  - 全文搜索接口：60 次 / 分钟。
  - 外部图片代理接口：300 次 / 分钟（仅允许拉取特定白名单来源图片）。

## 数据权限边界 (Document ACL)

- 文章设立 `access_level` 字段：`public`（公开）与 `authenticated`（会员专享）。
- 权限判定由后端强行把关，前端仅作为交互展现。
- 未认证用户请求专享文章时，后端擦除正文并仅返回 `locked: true` 元信息；全文搜索前置排除正文匹配片段；Sitemap 自动剔除专享文章。

## 已知安全设计权衡 (Known Security Trade-offs)

根据真实业务需求与系统现状，客观记录如下安全设计权衡：

1. **邀请码明文存储与展示**:
   - **设计现状**: 数据库表 `invite_codes` 既存储了用于快速比对验证的 `code_hash`，也保留了明文 `code` 字段；管理员邀请码管理接口在列表中直接返回明文，以方便管理员 1 键复制、多行批量复制与直接查阅分发。
   - **威胁模型与防护**:
     - 该接口受到 `AuthMiddleware` 与 `RequireAdmin` 强力保护，非管理员无法访问。
     - 邀请码仅用于注册控制，并非长期认证凭据；注册成功后创建的用户固定为低权限 `member`，无法利用邀请码获得管理权限。
     - 数据库部署于非公开挂载的私有命名卷中，无公网暴露面。
2. **管理端 Token 暂存于 LocalStorage**:
   - **设计现状**: 管理员 Bearer JWT 暂存于浏览器 `localStorage` 中。
   - **补偿措施**: 全站实施严格的 DOMPurify 白名单清洗与 Nginx Sandbox CSP，防止 XSS 攻击窃取 Token；凭据变更立即通过 `auth_version` 机制在服务端使该 Token 作废。
