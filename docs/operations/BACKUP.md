# 数据备份、首次迁移与恢复

## 1. 数据位置与红线

开发机当前真实数据位于：

- SQLite：`backend/data/app.db`，运行时还可能存在 `app.db-wal`、`app.db-shm`。
- 媒体：`backend/uploads/`。

Docker 生产环境固定使用以下命名卷，名称不随 Compose 项目名改变：

- `docker_kb-data` → 容器 `/data` → `/data/app.db`
- `docker_kb-uploads` → 容器 `/uploads`

不要在数据库在线写入时只复制 `app.db`。安全选择是 SQLite `.backup` API，或按本文执行短暂停机备份并把数据库目录作为一个整体复制。任何 `docker compose down` 命令都不得附加 `-v`。

## 2. 首次迁移现有开发数据

以下命令仅供 Linux 服务器首次迁移使用，不会由应用自动执行。执行前必须停止本地 Go 服务，确保 SQLite 不再写入，并确认目标卷中没有已有生产数据。

```bash
cd /srv/boke
docker volume create docker_kb-data
docker volume create docker_kb-uploads

# 目标必须为空；若命令输出任何文件，停止迁移并人工核对。
docker run --rm -v docker_kb-data:/target:ro alpine:3.22 \
  sh -c 'find /target -mindepth 1 -maxdepth 1 -print'
docker run --rm -v docker_kb-uploads:/target:ro alpine:3.22 \
  sh -c 'find /target -mindepth 1 -maxdepth 1 -print'

# SQLite 已停机时整体复制 app.db、WAL、SHM（存在即复制）。
docker run --rm \
  -v "$PWD/backend/data:/source:ro" \
  -v docker_kb-data:/target \
  alpine:3.22 sh -ceu '
    test -f /source/app.db
    test -z "$(find /target -mindepth 1 -maxdepth 1 -print -quit)"
    cp -a /source/. /target/
  '

docker run --rm \
  -v "$PWD/backend/uploads:/source:ro" \
  -v docker_kb-uploads:/target \
  alpine:3.22 sh -ceu '
    test -z "$(find /target -mindepth 1 -maxdepth 1 -print -quit)"
    cp -a /source/. /target/
  '

# 使用镜像内的 app 账号修正卷权限；不会改写文件内容。
docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml \
  run --rm --no-deps --user root backend \
  sh -c 'chown -R app:app /data /uploads'
```

迁移后先比较源目录和卷内的文件数量、大小及 `sha256sum`，再启动生产服务。不要删除源数据；至少保留到生产验证和独立备份完成。

## 3. 生产停机一致性备份

该方案有短暂 API 写入中断，但不依赖容器内安装 SQLite CLI，对 WAL 模式是明确且可验证的安全基线。

```bash
cd /srv/boke
BACKUP_DIR="/srv/backups/boke_$(date +%Y%m%d_%H%M%S)"
install -d -m 700 "$BACKUP_DIR"

docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml stop backend

docker run --rm \
  -v docker_kb-data:/data:ro \
  -v docker_kb-uploads:/uploads:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:3.22 sh -ceu '
    test -f /data/app.db
    tar -C / -czf /backup/data.tar.gz data
    tar -C / -czf /backup/uploads.tar.gz uploads
    sha256sum /backup/data.tar.gz /backup/uploads.tar.gz > /backup/SHA256SUMS
  '

install -m 600 .env.production "$BACKUP_DIR/env.production"

docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml start backend

cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS
```

备份必须复制到另一块磁盘或远端受控存储。仅保存在同一台服务器上不构成灾难恢复。

## 4. 恢复

恢复会覆盖目标卷，只能在确认备份路径和卷名后执行。先保留故障现场副本，再停止整个应用；`down` 不得使用 `-v`。

```bash
cd /srv/boke
RESTORE_DIR=/srv/backups/boke_YYYYmmdd_HHMMSS
cd "$RESTORE_DIR" && sha256sum -c SHA256SUMS
cd /srv/boke

docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml down

docker run --rm \
  -v docker_kb-data:/data \
  -v docker_kb-uploads:/uploads \
  -v "$RESTORE_DIR:/backup:ro" \
  alpine:3.22 sh -ceu '
    find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    find /uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    tar -C / -xzf /backup/data.tar.gz
    tar -C / -xzf /backup/uploads.tar.gz
  '

docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml \
  run --rm --no-deps --user root backend \
  sh -c 'chown -R app:app /data /uploads'

docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml up -d
curl --fail http://127.0.0.1:8080/api/health
```

`ADMIN_PASSWORD` 只用于数据库中尚无用户时创建首个管理员。修改环境变量不会重置已有管理员密码；已有账号必须登录管理后台并提供原密码后修改。
