# 安全模型

本文定义长期安全边界和配置要求。当前安全问题及验证状态见 [CODEX_PROJECT_STATE.md](CODEX_PROJECT_STATE.md)。

## 信任边界

- 访客只能使用公开 GET API；公开文档查询必须在仓储层限制为 `published`。
- 管理写操作位于 `/api/admin/*`，由 Bearer JWT 中间件保护。
- 宿主 Nginx 是外部 HTTPS 边界；前端容器仅绑定 `127.0.0.1:8080`，后端只在 Compose 网络暴露 `8090`。
- SQLite、上传目录、生产环境文件和备份不得由 Web 静态目录直接暴露。

## 认证

- 管理员密码使用 bcrypt 哈希。
- JWT 固定使用 HS256，解析时要求允许的方法、issuer `feishu-kb` 和过期时间。
- 生产环境要求非默认且至少 32 字符的 `JWT_SECRET`；`JWT_EXPIRE_HOURS` 必须为 1–168。
- 管理端 Token 当前保存在 localStorage，退出接口不维护服务端撤销列表。因此内容净化和管理端 XSS 防护是认证安全的一部分。
- `ADMIN_PASSWORD` 只在数据库没有用户时用于创建首个管理员，不会重置已有账号。

## 请求与浏览器边界

- CORS 只回显 `CORS_ALLOWED_ORIGINS` 中的来源；生产环境拒绝通配来源。
- `TRUSTED_PROXIES` 必须列出真实反向代理，生产环境拒绝信任全部地址。
- 全局响应设置 nosniff、frame、referrer、permissions 和 CSP 头；上传附件使用更严格的 sandbox CSP。
- 登录、搜索和公开外部图片代理使用进程内 IP 限流。该限流器不是多实例共享配额。
- 公开外部图片代理仅允许源码白名单中的 HTTPS 主机、端口和路径，限制重定向、MIME 与响应大小。

## 内容安全

文档允许 Markdown 与有限 HTML，因此所有内容入口和渲染出口必须保持同一安全模型：

1. `htmlToMarkdown.ts` 对粘贴和编辑内容执行标签、属性、URL 协议和 CSS 属性白名单清洗。
2. `DocViewer` 的 Markdown 管道在 `rehypeRaw` 后执行 URL/CSS 加固与 `rehype-sanitize`。
3. 外链使用 `noopener noreferrer`；图片使用 `no-referrer`；iframe 使用 sandbox、lazy loading 与 no-referrer。
4. 禁止脚本、事件处理器、危险 URL 协议以及 `url()`、`expression()`、`javascript:`、`calc()`、`var()` 等 CSS 表达式。

调整标签、属性、CSS 或 URL 白名单时，必须同时检查编辑器、序列化、Tiptap 适配、只读渲染与安全测试。格式细节见 [编辑器内容格式](docs/specs/EDITOR_FORMAT.md)。

## 上传与文件

- 上传服务限制总大小和图片、视频、附件的分类大小。
- 扩展名必须在允许集合内，并通过文件头/MIME 内容检测；SVG、HTML/XML 和可执行扩展名不得上传。
- 文件名由服务端安全生成，存储路径经 `filepath.Clean`、绝对路径和 `filepath.Rel` 校验，禁止逃逸上传根目录。
- 删除媒体前检查文档引用；上传数据库记录与物理文件失败时必须避免留下不一致状态。
- 管理端外链保存和文档图片本地化属于远程取回功能，必须保持管理员鉴权、响应大小和图片内容校验。

## 数据与部署

- SQL 必须参数化；跨多表或“数据库 + 文件”的操作应显式处理事务与失败清理。
- 生产配置缺少安全值时，应用必须在打开数据库前拒绝启动。
- 容器保持非 root、`no-new-privileges`、资源/PID 限制和日志轮转。
- 不修改或覆盖宿主既有 Nginx、3X-UI、Xray 及其他服务；新增站点使用独立配置。
- 备份包含数据库、WAL/SHM（若存在）、上传文件和生产环境配置，并保存到独立故障域。具体流程见 [备份与恢复](docs/operations/BACKUP.md)。

## 漏洞处理

安全问题按影响数据机密性、完整性、可用性和管理权限的程度分级。修复应覆盖根因、受影响入口及回归测试；已解决事项进入 `CHANGELOG.md`，尚未解决且对当前维护有价值的事项进入 `CODEX_PROJECT_STATE.md`，不在本文保留一次性审计记录。
