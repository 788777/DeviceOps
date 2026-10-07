# DeviceOps 应用镜像
# 构建：docker build -t deviceops-app .
# 运行：docker compose up --build
#
# 注意：这里**故意不写** `# syntax=docker/dockerfile:1`。
# 该指令会让 BuildKit 去 Docker Hub 拉 docker/dockerfile 前端镜像，
# 在只能访问镜像加速器的网络环境下会直接构建失败；本 Dockerfile 没有用到
# heredoc 等 BuildKit 专有语法，去掉后改用内置前端即可。
#
FROM python:3.11-slim

# Python 运行环境优化 + 时区
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Shanghai \
    APP_HOME=/app

WORKDIR ${APP_HOME}

# 这里刻意不装任何 apt 包（不装 curl / tzdata）：
#   - python:3.11-slim 自带 /usr/share/zoneinfo，TZ=Asia/Shanghai 直接生效
#     （实测 `date` 输出 CST +0800，日志时间就是东八区）
#   - 健康检查改用镜像里已有的 python，不再需要 curl
# 好处：构建不依赖 deb.debian.org（国内经常超时），镜像更小，也避免构建机内存吃紧被 OOM。

# pip 源：国内直连 pypi.org 会 TLS 握手超时（实测 _ssl.c:999 handshake timed out），
# 默认改用清华镜像。换官方源构建：
#   docker compose build --build-arg PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 先只拷贝依赖清单，利用 Docker 层缓存：改代码不会触发重新装包
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# 再拷贝项目代码（.dockerignore 已排除 .venv / *.db / logs / .git 等）
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app
COPY pytest.ini ./pytest.ini
COPY tests ./tests

# 非 root 用户运行；logs 目录先建好并授权，named volume 首次挂载会继承该属主
RUN mkdir -p ${APP_HOME}/logs \
    && useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser ${APP_HOME}

USER appuser

EXPOSE 8000

# 容器自身健康检查（compose 的 healthcheck 会覆盖它）
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

# 先执行数据库迁移再启动服务：
#   - 首次启动 / 新建 MySQL 卷时自动建表
#   - 已是最新版本时 alembic 直接跳过，不影响启动速度
# 想跳过迁移（比如表由 DBA 管理），覆盖 command 即可：
#   docker compose run --rm app uvicorn app.main:app --host 0.0.0.0 --port 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
