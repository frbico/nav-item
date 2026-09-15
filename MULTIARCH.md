# 多架构镜像

当前部署步骤、必需环境变量及升级注意事项以 [README](README.md) 为准。

公共镜像 `ghcr.io/frbico/nav-item:latest` 同时支持 `linux/amd64`、`linux/arm64`。
镜像以 Node.js 24 / Debian 13 为基础，前端在构建机架构编译，后端原生依赖按目标架构安装，运行时使用非 root 用户。
工作流使用 GITHUB_TOKEN 推送 GHCR，无需 Docker Hub 密码；PR 只构建和验证，不发布。
