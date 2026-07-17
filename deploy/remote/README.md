# DigitalHuman GitHub Actions 到阿里云镜像仓库部署指南

这套机制使用 GitHub Actions 构建四个镜像，推送到阿里云 ACR，然后 SSH 到服务器执行 Docker Compose 部署。

## 一、阿里云镜像仓库

在同一个命名空间下创建四个镜像仓库：

- `digitalhuman-backend`
- `digitalhuman-ai-service`
- `digitalhuman-frontend-admin`
- `digitalhuman-frontend-visitor`

镜像地址格式为：

```text
ALIYUN_REGISTRY/ALIYUN_NAMESPACE/REPOSITORY:TAG
```

你的个人版实例当前示例：

```text
crpi-awzm63dqn5ugddo8.cn-hangzhou.personal.cr.aliyuncs.com/lukezhang/digitalhuman-backend:latest
```

阿里云 ACR 登录使用 Registry 独立密码，不是阿里云登录密码。官方文档示例也是先 `docker login`，再 `docker tag` 和 `docker push`。

## 二、服务器首次准备

服务器需要安装：

- Docker
- Docker Compose v2
- 能从服务器访问阿里云镜像仓库

创建部署目录：

```bash
sudo mkdir -p /opt/digitalhuman
sudo chown "$USER":"$USER" /opt/digitalhuman
```

把本目录中的文件放到服务器 `/opt/digitalhuman`。第一次可以手动复制，后续 GitHub Actions 会自动覆盖 `compose.prod.yml`、`deploy.sh` 和 `cleanup.sh`。

创建服务器环境文件：

```bash
cd /opt/digitalhuman
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，至少填写：

```bash
ALIYUN_REGISTRY=crpi-awzm63dqn5ugddo8.cn-hangzhou.personal.cr.aliyuncs.com
ALIYUN_NAMESPACE=lukezhang
MYSQL_ROOT_PASSWORD=数据库 root 密码
DB_PASSWORD=数据库密码
AI_SERVICE_ADMIN_TOKEN=一段长随机字符串
TTS_BASE_URL=http://你的域名或服务器IP
```

如果四个镜像仓库是公开仓库，服务器 `.env` 里的 `ALIYUN_USERNAME` 和 `ALIYUN_PASSWORD` 可以留空，部署脚本会匿名拉取镜像。GitHub Actions 推送镜像仍然需要在 GitHub Secrets 中配置 `ALIYUN_USERNAME` 和 `ALIYUN_PASSWORD`。

首次手动部署：

```bash
cd /opt/digitalhuman
chmod +x deploy.sh cleanup.sh
./deploy.sh
```

## 三、GitHub Secrets

在 GitHub 仓库进入 `Settings -> Secrets and variables -> Actions`，添加这些 GitHub Secrets：

```text
ALIYUN_REGISTRY
ALIYUN_NAMESPACE
ALIYUN_USERNAME
ALIYUN_PASSWORD
DEPLOY_HOST
DEPLOY_PORT
DEPLOY_USER
DEPLOY_SSH_KEY
DEPLOY_PATH
```

说明：

- `ALIYUN_REGISTRY` 示例：`registry.cn-hangzhou.aliyuncs.com`
- `ALIYUN_NAMESPACE` 是命名空间，不含镜像仓库名
- `DEPLOY_PATH` 建议为 `/opt/digitalhuman`
- `DEPLOY_SSH_KEY` 是能登录服务器的私钥全文
- 高德地图 Web Key 和 securityJsCode 不走 GitHub Secrets；部署后通过后台接口保存到数据库，游客端和管理端运行时读取

## 四、自动部署流程

推送到 `main` 后 GitHub Actions 会：

1. 运行部署配置校验
2. 构建并推送四个镜像
3. 把 `deploy/remote` 同步到服务器
4. 在服务器执行 `./deploy.sh`
5. 服务器执行 `docker compose pull`
6. 服务器执行 `docker compose up -d --remove-orphans`
7. 执行 `./cleanup.sh` 清理旧镜像和构建缓存

也可以在 GitHub Actions 页面手动点 `Run workflow` 触发。

## 五、回滚

默认部署 `latest`。如需回滚到某次提交镜像：

```bash
cd /opt/digitalhuman
sed -i 's/^DIGITALHUMAN_IMAGE_TAG=.*/DIGITALHUMAN_IMAGE_TAG=sha-提交SHA/' .env
./deploy.sh
```

如果只回滚某个服务，可以在 `.env` 里直接写完整镜像：

```bash
DIGITALHUMAN_BACKEND_IMAGE=registry.cn-hangzhou.aliyuncs.com/your-namespace/digitalhuman-backend:sha-提交SHA
```

## 六、清理策略

`cleanup.sh` 不删除 Docker volumes，所以 MySQL、Redis、Qdrant、知识库和 TTS 文件不会被清掉。

默认策略：

- `DIGITALHUMAN_IMAGE_KEEP=3`：每个业务镜像仓库保留最近 3 个非当前 tag
- `DIGITALHUMAN_PRUNE_UNTIL=168h`：清理 7 天前未被容器使用的旧镜像
- `DIGITALHUMAN_BUILDER_PRUNE_UNTIL=24h`：清理 24 小时前构建缓存

临时跳过清理：

```bash
DIGITALHUMAN_SKIP_CLEANUP=1 ./deploy.sh
```

## 七、常用检查

```bash
cd /opt/digitalhuman
docker compose --env-file .env -f compose.prod.yml ps
docker compose --env-file .env -f compose.prod.yml logs -f backend-java
docker compose --env-file .env -f compose.prod.yml logs -f ai-service
curl http://127.0.0.1:${FRONTEND_VISITOR_PORT:-80}/healthz
curl http://127.0.0.1:${FRONTEND_ADMIN_PORT:-8088}/healthz
curl http://127.0.0.1:${BACKEND_PORT:-8080}/api/tts/health
curl http://127.0.0.1:${AI_SERVICE_PORT:-18755}/health
```
