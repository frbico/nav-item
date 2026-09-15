# Nav-Item

基于 Vue 3、Express 和 SQLite 的导航站，由 [frbico/nav-item](https://github.com/frbico/nav-item) 独立维护。源码、安装脚本、发行包、容器镜像和工作流均由本仓库提供。

- 前台：分类和子分类、卡片搜索、广告位、友情链接、响应式布局。
- 后台：`/admin` 登录，管理菜单、子菜单、卡片、广告、友情链接、管理员密码和登录记录。
- 安全：强制配置密码及 JWT 密钥、登录限流、会话撤销、受保护的图片上传、图片重新编码、参数检查、SQLite 外键约束。
- 镜像：`ghcr.io/frbico/nav-item:latest`，支持 **linux/amd64** 和 **linux/arm64**，按宿主架构自动选择；不包含 ARM 32 位。

[发行下载](https://github.com/frbico/nav-item/releases) · [镜像](https://github.com/frbico/nav-item/pkgs/container/nav-item) · [构建状态](https://github.com/frbico/nav-item/actions) · [问题反馈](https://github.com/frbico/nav-item/issues) · [安全审计](docs/SECURITY-AUDIT.md)

## 部署方式

完整保留源码、Docker、Docker Compose、容器托管平台、serv00／ct8／Hostuno 五类部署方式。普通 VPS 推荐 Compose；共享主机使用专用发行包。

### 1. Docker Compose（推荐）

要求 Docker Engine 和 Compose 插件，以下命令在 Linux / macOS 的 shell 中执行：

```bash
mkdir nav-item && cd nav-item
curl -fL https://raw.githubusercontent.com/frbico/nav-item/main/docker-compose.yml -o docker-compose.yml
umask 077
printf 'ADMIN_USERNAME=admin\nADMIN_PASSWORD=%s\nJWT_SECRET=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose pull
docker compose up -d
docker compose logs --tail=100 nav-item
```

访问 `http://服务器IP:3000`，后台为 `/admin`。管理员密码保存在当前目录 `.env`，请私下查看并妥善保存。数据库和图片分别存入 `nav-database`、`nav-uploads` 命名卷（实际名称带 Compose 项目前缀）。在同一目录管理项目；不要执行 `docker compose down -v`，否则会删除数据卷。

需要固定发行版本时，将 Compose 中镜像标签从 `latest` 改为 [Releases](https://github.com/frbico/nav-item/releases) 中已发布的版本标签（如 `v1.1.0`）。修改对外端口只需调整 `ports` 左侧数字，例如 `8080:3000`。

### 2. Docker 命令部署

先创建受保护的环境文件，再创建持久化卷：

```bash
mkdir nav-item && cd nav-item
umask 077
printf 'PORT=3000\nADMIN_USERNAME=admin\nADMIN_PASSWORD=%s\nJWT_SECRET=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker volume create nav-database
docker volume create nav-uploads
docker run -d --name nav-item --restart unless-stopped \
  --env-file .env -p 3000:3000 \
  --security-opt no-new-privileges --cap-drop ALL \
  -v nav-database:/app/database \
  -v nav-uploads:/app/uploads \
  ghcr.io/frbico/nav-item:latest
docker logs --tail=100 nav-item
```

访问方式同上。镜像以 UID/GID `1000:1000` 运行。若改用宿主目录挂载，先创建 `database`、`uploads` 并执行 `sudo chown -R 1000:1000 database uploads`；数据库与上传目录必须可写。空命名卷会自动取得镜像中目录的初始内容和权限。

### 3. 源码部署（Node.js）

要求 Git、Node.js **22.13+**（推荐 24 LTS）、npm。Linux 原生依赖需要预编译包或 Python 3、make、C++ 编译器；Debian/Ubuntu 可安装 `python3 make g++`。发行包的便携模式见第 5 节。

```bash
git clone https://github.com/frbico/nav-item.git
cd nav-item
npm ci
npm --prefix web ci
npm --prefix web run build
node scripts/configure-env.cjs
npm start
```

生成器使用随机强密码和随机密钥创建权限为 `0600` 的 `.env`，已有文件时拒绝覆盖。可在运行前通过环境变量传入 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`JWT_SECRET`。访问 `http://服务器IP:3000` 和 `/admin`。

生产环境应使用专用非 root 用户和 systemd / 进程管理器常驻运行，工作目录必须为项目根目录。systemd 示例（按实际路径和用户名修改）：

```ini
# /etc/systemd/system/nav-item.service
[Unit]
Description=Nav-Item
After=network.target
[Service]
User=nav-item
Group=nav-item
WorkingDirectory=/opt/nav-item
ExecStart=/usr/bin/node /opt/nav-item/app.js
Restart=on-failure
Environment=NODE_ENV=production
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
```

将项目和数据目录授权给 `nav-item` 用户；用 `command -v node` 确认 `ExecStart` 路径，然后执行 `sudo systemctl daemon-reload && sudo systemctl enable --now nav-item`。日志使用 `journalctl -u nav-item -n 100` 查看。`.env` 由应用从工作目录读取。

开发前端可执行 `npm --prefix web run dev`，生产部署必须先构建 `web/dist`。

### 4. 容器托管平台

在支持 OCI/Docker 镜像和持久磁盘的平台选择“从镜像部署”：

| 设置 | 填写内容 |
| --- | --- |
| 镜像 | `ghcr.io/frbico/nav-item:latest` 或已发布版本标签 |
| 架构 | Linux amd64 或 arm64 |
| 容器端口 / HTTP 服务端口 | `3000` |
| 启动命令 | 保持镜像默认值 `node app.js` |
| 环境变量 | `PORT=3000`、`ADMIN_USERNAME=admin`、独立生成的 `ADMIN_PASSWORD` 和 `JWT_SECRET` |
| 持久卷 1 | 挂载 `/app/database`，UID 1000 可写 |
| 持久卷 2 | 挂载 `/app/uploads`，UID 1000 可写 |
| HTTP 健康检查 | `GET /api/menus`，启动宽限至少 60 秒 |
| 域名 | 平台分配域名或自己的域名，并启用 HTTPS |
| 实例数量 | **1**，SQLite 文件不能由多个副本共享写入 |

若平台自动注入 `PORT`，HTTP 路由目标端口必须一致。不提供持久磁盘的平台仅适合试用，重新部署会丢失数据库和上传文件。平台若只能挂载一个目录，可将一个持久磁盘的两个子目录分别映射到上述路径；不能覆盖整个 `/app`。

无需从原作者的 Docker Hub 拉取镜像；本项目当前发布渠道是 GHCR。

### 5. serv00 / ct8 / Hostuno 共享主机

要求平台账户具备 SSH、`devil`、Node.js 22.13+、匹配的 npm、curl、unzip、tar 和足够配额。请先在面板启用运行自定义程序所需权限。使用预构建前端的发行包，无须在共享主机上构建 Vue。

便携模式使用 Node 内置 SQLite 和 sharp 的 WebAssembly 包，不需要在 FreeBSD 编译 SQLite / 图像原生扩展。**已在 Linux 对便携模式进行功能回归，尚未在真实的三家共享主机账户上实测；平台权限、Node 路径和域名配置仍须按账户实际情况核对。**

登录共享主机 SSH 后执行：

```bash
curl -fL https://github.com/frbico/nav-item/releases/download/v1.1.0/install.sh -o nav-item-install.sh
# 可先查看脚本内容；随后执行
bash nav-item-install.sh
```

默认域名识别：serv00 → `用户名.serv00.net`；ct8 → `用户名.ct8.pl`；Hostuno → `用户名.useruno.com`。若主机名无法识别，显式传入域名。三种平台的自定义域名用法一致：

```bash
DOMAIN=nav.example.com bash nav-item-install.sh
```

Node / npm 路径不同则指定：

```bash
DOMAIN=nav.example.com NODE_BIN=/usr/local/bin/node24 NPM_BIN=/usr/local/bin/npm24 \
  bash nav-item-install.sh
```

脚本从 **frbico/nav-item 的 v1.1.0 Release** 下载 `nav.zip` 和 `SHA256SUMS`，验证压缩包校验值，在临时目录安装便携依赖并检查 SQLite / 图片处理，然后创建 Node 网站。域名已绑定非 Node 网站或目标目录已有安装时会停止，避免覆盖已有站点。它不会删除面板站点、修改 shell 配置或重置 npm 配置。

安装位置：`~/domains/你的域名/public_nodejs`；管理员凭据位于该目录 `.env`。密码随机生成，不存在统一默认密码。首次安装也可传入 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`JWT_SECRET`，长度要求见下表。后台为 `https://你的域名/admin`。

自定义域名须在 DNS 服务商将 A/AAAA/CNAME 记录指向托管平台提供的地址，并在托管面板配置证书与 HTTPS。不要照抄其他账户 IP。重启：`devil www restart 你的域名`；运行日志从托管面板及该域名日志目录查看。

手动安装（面板已经创建 Node 网站时）：下载同一 Release 的 `nav.zip`、`SHA256SUMS`，用 `sha256 nav.zip`（FreeBSD）或 `sha256sum nav.zip`（Linux）与清单对照，解压到**新的空应用目录**；确保 `node` 与 npm 对应，然后运行：

```bash
npm ci --omit=dev --omit=optional --ignore-scripts
NAV_SQLITE_DRIVER=builtin node scripts/configure-env.cjs
NAV_SQLITE_DRIVER=builtin node -e "require('./sqlite'); require('sharp'); console.log('dependencies ready')"
# 面板将启动文件设为 app.js，并重启对应 Node 网站
```

不要使用历史版本的共享主机压缩包；旧发行入口 `ct8-and-serv00` 的资产也已替换为本仓库修复版。

## 环境变量与数据

| 变量 | 默认 / 要求 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 应用监听端口 |
| `ADMIN_USERNAME` | `admin` | 仅空数据库时创建的管理员用户名 |
| `ADMIN_PASSWORD` | 必填，至少 12 字符且最多 72 字节 | 仅首次建库时设置密码；以后在后台修改，改环境变量不会覆盖既有密码 |
| `JWT_SECRET` | 必填，至少 32 字节 | 每个实例独立随机生成；变更会使已有令牌失效 |
| `NODE_ENV` | 容器为 `production` | 生产运行环境 |
| `NAV_SQLITE_DRIVER` | Linux 默认原生驱动，FreeBSD 使用内置驱动 | 便携依赖安装后设为 `builtin`；需要 Node 22.13+ |

`.env.example` 仅为格式示例，必须替换占位符。不要把真实 `.env`、数据库、备份或上传文件提交 Git。数据库为 `database/nav.db`，用户图片为 `uploads/`；源码运行时路径相对项目目录，容器内位于 `/app`。

## HTTPS、备份、升级与回滚

公开访问时在反向代理或托管平台终止 HTTPS，将请求转发到应用端口。单机反代可将 Docker 端口绑定改为 `127.0.0.1:3000:3000`。后端不信任任意 `X-Forwarded-For`，代理后登录记录可能显示代理地址，登录限流也可能由多个用户共享；不要直接开放任意代理信任。

**Compose 备份：** 在项目目录停止写入，备份数据库、上传目录和 `.env`，完成后启动。以下命令会创建只对当前用户可读的备份目录：

```bash
umask 077
backup="backup-$(date +%Y%m%d-%H%M%S)"
mkdir "$backup"
docker compose stop nav-item
cid=$(docker compose ps -aq nav-item)
docker cp "$cid:/app/database" "$backup/database"
docker cp "$cid:/app/uploads" "$backup/uploads"
cp .env "$backup/.env"
docker compose start nav-item
```

Docker 命令部署时将 `docker compose stop/start nav-item` 改为 `docker stop/start nav-item`，`cid=nav-item`。停止中的容器仍支持 `docker cp`。备份失败也要及时启动服务，并检查磁盘空间。

**镜像升级：** 备份后，Compose 执行 `docker compose pull && docker compose up -d`；Docker 命令部署执行 `docker pull ghcr.io/frbico/nav-item:latest`，停止并删除旧容器（保留卷），按原 `docker run` 命令重建。验证首页、后台登录和图片上传后再删除旧备份。

**源码升级：** 停止应用，备份 `database/`、`uploads/`、`.env`；`git pull --ff-only`，重新执行 `npm ci`、`npm --prefix web ci`、`npm --prefix web run build`，再启动。保留原 `.env`，不要再次运行生成器。

**共享主机升级：** 安装脚本只负责新安装。先在面板停用网站进程，完整备份应用目录；将新 Release 解压到一个新目录，运行便携依赖安装命令，复制旧 `database/`、`uploads/`、`.env` 到新目录（覆盖图片目录时保留新包默认图标），确认配置满足要求后，通过面板切换应用目录，或在停用状态替换原目录，再启用并重启网站。不要把旧 `node_modules` 复制进新版本。若面板无法停止进程或切换目录，请使用平台维护流程，避免运行中复制 SQLite 数据文件。

**回滚：** 停止服务，切回之前的版本标签或代码及依赖，并恢复与该版本配套的数据库、上传目录和配置备份，再启动。不要只回退二进制却使用已迁移的数据库。

旧数据库不会重置密码、删除用户数据或自动清理已有导航链接。升级前请在后台更换旧弱密码，检查历史卡片中的第三方链接，并清理不再需要的旧上传文件；历史非图片上传不再对外提供。

## 自行构建与发布

```bash
git clone https://github.com/frbico/nav-item.git
cd nav-item
docker buildx create --use --name nav-builder
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/frbico/nav-item:自定义标签 --push .
```

推送需要对 `frbico/nav-item` 镜像仓库的写权限，并提前登录 GHCR；其他用户应改为自己的命名空间。跨架构构建需要宿主配置 QEMU/binfmt 或对应原生构建节点。仓库的 GitHub Actions 已自动配置 QEMU、运行安全回归测试、构建两种架构并分别启动验证；推送 `main` 发布 `latest`，推送 `v*` 标签发布版本镜像，每次保留完整提交 SHA 标签。

发行包在项目根目录执行 `bash scripts/build-release.sh` 生成，要求 Node/npm、zip、sha256sum；产物位于 `release/`，包含预构建前端及锁定依赖清单，不含用户数据库、凭据、已安装依赖。发布新版本时同时更新安装脚本和本文的固定版本号。

## 常见问题

- 启动报告密码 / 密钥缺失：检查 `.env`、工作目录或容器环境变量；容器不会自动读取宿主 `.env`，必须用 Compose 变量传递或 `--env-file`。
- 数据目录只读：检查卷挂载及 UID 1000 权限，不要对整个项目 `chmod 777`。
- 登录返回 429：等待限流窗口（15 分钟）后重试；检查反代后是否共用 IP。
- 上传失败：仅已登录管理员可上传，最大 2 MiB、最多 1600 万像素，支持 PNG/JPEG/GIF/WebP，保存时重新编码为 PNG。
- 端口可访问但无页面：源码部署确认已构建 `web/dist`；容器查看日志及平台端口映射。
- 共享主机缺少 `node:sqlite`：选择平台提供的更新 Node 版本（22.13+，推荐 24）。镜像无需自行安装 Node。

## 许可证与来源

依照仓库的 [Apache License 2.0](LICENSE) 分发，原始项目署名保留在 [NOTICE](NOTICE) 和 Git 历史中。部署不下载或调用原作者的仓库、镜像、脚本、演示站或私有资源。默认导航仍包含通用第三方网站链接及其图标；这些是导航内容，可在后台修改。
