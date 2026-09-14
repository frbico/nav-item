# 多架构镜像

目标镜像：`ghcr.io/frbico/nav-item:latest`（首次 GitHub Actions 构建成功后可用）。

支持 `linux/amd64` 与 `linux/arm64`，Docker 会自动选择主机对应的架构。
推送 main、v 开头的标签或手动运行 Build and Push Docker Image 工作流会发布镜像。
PR 仅验证构建，不登录镜像仓库、不推送。
工作流使用仓库自带的 GITHUB_TOKEN，无需配置 Docker Hub 密码。

```bash
docker run -d --name nav-item \
  -p 3000:3000 \
  -v nav-database:/app/database \
  -v nav-uploads:/app/uploads \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='请替换为自己的密码' \
  -e JWT_SECRET='请替换为自己的随机密钥' \
  --restart unless-stopped \
  ghcr.io/frbico/nav-item:latest
```

访问 http://localhost:3000，管理地址 /admin。

本地构建并发布：

```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/frbico/nav-item:latest --push .
```

原作者代码、LICENSE、README 与 Git 历史保留；新增配置使用 Node.js 22，
前端在构建机器架构运行，后端原生依赖在目标架构安装。
发布工作流检查镜像清单，并分别启动两个架构检查首页与菜单 API。
