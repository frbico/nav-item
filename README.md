# Nav-item：个人导航站

基于 [eooce/nav-item](https://github.com/eooce/nav-item)，保留上游提交历史、标签及 LICENSE。
当前版本修复认证绕过、匿名上传、改密崩溃、会话吊销、输入校验和数据级联等问题，并支持 Linux AMD64 / ARM64 镜像。

## Docker Compose 部署

```bash
git clone https://github.com/frbico/nav-item.git
cd nav-item
cp .env.example .env
openssl rand -hex 32
```

编辑 `.env`：将上述随机值填入 `JWT_SECRET`，设置至少 12 个字符、最多 72 UTF-8 字节的 `ADMIN_PASSWORD`，以及可选的 `ADMIN_USERNAME`。
`CHANGE_ME` 占位符不能直接启动服务。不要提交 `.env`。

```bash
docker compose up -d
```

访问 `http://服务器地址:3000`，后台 `/admin`。生产环境应由反向代理终止 HTTPS。
镜像：`ghcr.io/frbico/nav-item:latest`，Docker 自动选择 `linux/amd64` 或 `linux/arm64`。

## 从旧版本升级

1. 备份 SQLite 数据库和 uploads。停止旧容器后再迁移数据。
2. 配置新的随机 JWT_SECRET；旧版硬编码密钥签发的所有令牌都会失效。
3. 新镜像使用 UID/GID 1000 运行。命名卷会初始化权限；已有宿主机绑定目录需由管理员设置为 UID/GID 1000 可写。
4. 首次连接数据库会增加 `users.token_version`，并开启外键约束。历史孤立记录不会自动删除，请先检查并清理；现有有效数据会保留。
5. `ADMIN_PASSWORD` 仅用于创建空数据库中的初始管理员，不会重置已有账号口令。已有账号需要在后台改密；修改后会撤销该账号全部会话。
6. 旧 HTML/SVG 上传链接不再提供服务。允许 PNG/JPEG/GIF/WebP，文件最大 2 MiB，图片最多 1600 万像素，服务端转换成最大 2048×2048 的 PNG。

登录每个来源 IP 每 15 分钟最多 10 次；上传每个来源 IP 每分钟最多 20 次。不直接信任客户端 `X-Forwarded-For`，反向代理后的来源限制会按代理地址共享；如需真实客户端限速，请在受信任的边缘代理实施。

## 本地源码运行

需要 Node.js 24、npm 和 SQLite 原生模块安装所需工具。

```bash
npm ci
cd web && npm ci && npm run build
cd ..
# 在启动前设置 .env（变量同上）
npm start
npm test
```

## 构建和测试

GitHub Actions 在发布前运行安全回归测试，然后构建两个架构并验证各自的首页和菜单 API。
主分支发布 `latest` 和 `sha-<完整提交SHA>`；`v*` 标签发布对应版本。

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/frbico/nav-item:latest --push .
```

详见 [安全修复说明](SECURITY.md)。上游 `ct8-and-serv00` Release 的附件是为历史可追溯而原样保留的旧版材料，**不包含这些修复，不应作为当前安装入口**。
