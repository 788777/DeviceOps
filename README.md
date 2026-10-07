# DeviceOps 设备运维工单管理系统

![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.142-009688)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-38bdf8)
![Tests](https://img.shields.io/badge/tests-48%20passed-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

> 面向**车载定位终端**的运维管理平台。后端用 FastAPI 提供设备台账、工单流转、告警跟踪与统计接口，
> 前端用 Next.js 14 提供完整的运维控制台。前后端分离、接口契约统一，同仓管理。

## 目录

- [项目介绍](#项目介绍)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [Docker 一键启动](#docker-一键启动)
- [环境变量](#环境变量)
- [API 概览](#api-概览)
- [权限模型](#权限模型)
- [工单状态机](#工单状态机)
- [界面截图](#界面截图)
- [测试](#测试)
- [数据库迁移](#数据库迁移)
- [常见问题](#常见问题)
- [开发指南](#开发指南)
- [文档索引](#文档索引)
- [许可证](#许可证)

## 项目介绍

车载定位终端的运维团队，日常最重复的是三件事：设备台账不清楚、故障工单在群里口头流转、设备告警没人跟进。
DeviceOps 把这三件事收敛到一个平台上：

- **设备台账**：登记设备编号、型号、安装位置与在线状态，支持按编号/型号搜索与状态筛选；
- **工单流转**：从报障、指派、处理到关闭全流程留痕，状态只能按 `pending → processing → resolved → closed` 单向推进，杜绝跳级和回退；
- **告警跟踪**：记录设备离线、故障、超速、低电量等告警，支持标记误报，避免无效告警淹没真实问题；
- **运维看板**：设备在线率、工单状态分布、告警 TOP 设备，供值班人员与管理者快速掌握全局。

工程上，它是一套可以直接拿去改的前后端分离骨架：后端分层清晰（`api / crud / services / models / schemas`），
统一响应与全局异常处理、JWT 认证与角色权限、Alembic 迁移、pytest 自动化测试、Docker Compose 一键启动；
前端组件化路由、Axios 统一拦截器、深色优先的设计令牌与图表封装，开箱即可对接后端。

## 功能特性

### 后端 `deviceops/`

| 模块 | 能力 |
| --- | --- |
| 认证与用户 | 注册、表单登录（OAuth2 password flow）、`/me`、用户列表与角色调整 |
| 设备台账 | 分页列表、按编号/型号模糊搜索、按状态过滤、增删改（权限分级） |
| 工单流转 | 新建工单（固定 `pending`）、指派/转派、状态流转、评论列表与新增评论 |
| 告警跟踪 | 分页列表、按类型/设备/是否误报过滤、上报告警、标记或撤销误报 |
| 运维统计 | 总览（设备总数与在线率、工单分布、告警统计）、工单状态分布、告警 TOP 设备 |
| 工程能力 | 统一响应体、全局异常处理、`X-Request-ID` 请求链路日志、Alembic 迁移、48 个 pytest 用例、Docker Compose 编排 |

### 前端 `web/`

页面（`src/app`）：

| 页面 | 路由 | 能力 |
| --- | --- | --- |
| 登录 | `/login` | 用户名/密码登录，Token 存 `localStorage`，Token 失效自动跳回登录页并在登录后回到原页面 |
| 概览仪表盘 | `/dashboard` | 4 张统计卡片 + 设备状态环图 + 工单状态分布 + 告警 TOP 设备 + 近 14 天告警趋势 |
| 设备管理 | `/devices` | 表格分页、关键字搜索、状态筛选、新增/编辑/删除（按钮按角色显隐） |
| 告警管理 | `/alerts` | 告警列表与统计卡片、类型与误报过滤、上报告警、一键标记/撤销误报 |
| 工单管理 | `/tickets` | 工单列表与详情（设备、创建人、负责人、评论）、状态流转（只暴露合法下一步）、指派/转派、评论 |
| 系统设置 | `/settings` | 主题切换（深色/明亮/跟随系统）、后端连通性检测、技术栈信息 |

工程化：App Router 路由组 `(app)` 统一登录校验与外壳布局、React Context 管理登录态与主题、
Axios 拦截器统一附加 `Authorization` 与 401 处理、`useApi` 封装 loading/error/竞态/刷新、Sonner Toast 反馈。

## 技术栈

| 分层 | 选型 |
| --- | --- |
| 后端框架 | FastAPI + Uvicorn |
| ORM 与迁移 | SQLAlchemy 2.0（`Mapped` / `mapped_column`）+ Alembic |
| 数据校验 | Pydantic v2 + pydantic-settings |
| 数据库 | SQLite（本地开发）/ MySQL 8（生产与容器），由 `DATABASE_URL` 一处切换 |
| 缓存 | Redis 7（编排与配置已就绪，业务暂未读写） |
| 认证 | JWT（python-jose）+ passlib[bcrypt] |
| 后端测试 | pytest + httpx2（48 个用例，临时 SQLite 隔离） |
| 前端框架 | Next.js 14.2（App Router）+ React 18 + TypeScript 5 |
| 样式与组件 | Tailwind CSS 3 + shadcn/ui 风格组件（Radix UI 原语） |
| 图表与图标 | Recharts / Lucide React |
| 请求与状态 | Axios（统一实例 + 请求/响应拦截器）/ React Context |
| 主题与提示 | next-themes（默认深色）/ Sonner |
| 部署 | Dockerfile + docker-compose（app + mysql + redis） |

## 系统架构

```text
┌──────────────────────────────┐         ┌───────────────────────────────┐
│  浏览器                       │  HTTPS  │  FastAPI 后端                  │
│  Next.js 14 控制台            │ ──────► │  127.0.0.1:8000                │
│  localhost:3000              │  JSON   │  前缀 /api/v1                  │
│  App Router + Tailwind       │ ◄────── │  JWT 认证 + RBAC + 统一响应     │
└──────────────────────────────┘         └──────────────┬────────────────┘
                                                        │ SQLAlchemy 2.0
                                         ┌──────────────▼────────────────┐
                                         │  MySQL 8（生产）/ SQLite（开发）│
                                         │  Redis 7（已编排，预留）        │
                                         └───────────────────────────────┘
```

前后端只通过 HTTP + JSON 通信：所有业务接口返回统一结构 `{code, message, data}`，`code === 0` 表示成功；
前端 `src/lib/endpoints.ts` 与后端 `app/schemas` 一一对应，接口字段变更时两边同步修改即可。

## 目录结构

```text
device-ops-ticketing-system/
├── README.md                    # 本文件：项目总览
├── deviceops/                   # 后端：FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── main.py              # 应用入口、CORS、异常处理、请求日志中间件
│   │   ├── api/                 # 路由（v1: auth / users / devices / tickets / alerts / stats）
│   │   ├── core/                # 配置与安全（JWT、bcrypt）
│   │   ├── crud/                # 数据访问层
│   │   ├── db/                  # engine / session / Base
│   │   ├── models/              # SQLAlchemy 2.0 ORM 模型
│   │   ├── schemas/             # Pydantic v2 请求/响应模型
│   │   ├── services/            # 跨表业务逻辑（统计聚合）
│   │   └── utils/               # 统一响应、日志
│   ├── alembic/                 # 数据库迁移脚本
│   ├── tests/                   # pytest 用例（48 个）
│   ├── docs/images/             # 接口文档截图
│   ├── Dockerfile
│   ├── docker-compose.yml       # app + mysql + redis
│   ├── requirements.txt
│   └── .env.example
└── web/                         # 前端：Next.js 14 控制台
    ├── src/
    │   ├── app/                 # login + (app)/dashboard|devices|alerts|tickets|settings
    │   ├── components/          # charts / layout / providers / ui
    │   ├── hooks/               # use-api：请求状态与竞态处理
    │   └── lib/                 # api / endpoints / types / format / utils
    ├── docs/screenshots/        # 页面截图
    ├── package.json
    └── .env.local.example
```

更细的模块说明见 [deviceops/README.md](deviceops/README.md) 与 [web/README.md](web/README.md)。

## 快速开始

### 环境要求

| 组件 | 版本要求 | 说明 |
| --- | --- | --- |
| Python | 3.11+ | 后端运行环境（开发环境实测 3.14.7，容器使用 3.11-slim） |
| Node.js | 18.17+ | 前端运行环境（Next.js 14 要求） |
| Docker | 可选 | 只想一键起后端 + MySQL + Redis 时使用 |

### 1. 克隆仓库

```bash
# GitHub
git clone https://github.com/788777/DeviceOps.git

# 或 Gitee 镜像（国内网络更快）
git clone https://gitee.com/huatai788/device-ops-ticketing-system.git

cd DeviceOps   # Gitee 克隆出的目录名为 device-ops-ticketing-system
```

### 2. 启动后端

```powershell
cd deviceops

python -m venv .venv
.\.venv\Scripts\Activate.ps1           # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

Copy-Item .env.example .env            # 可选：不配置也能跑（默认 SQLite + 默认密钥，仅限本地）
alembic upgrade head                   # 建表：6 张业务表 + alembic_version
uvicorn app.main:app --reload          # 启动服务
```

启动后可访问：

| 地址 | 说明 |
| --- | --- |
| <http://127.0.0.1:8000/docs> | Swagger UI，右上角 Authorize 可直接调试 |
| <http://127.0.0.1:8000/redoc> | ReDoc 阅读视图 |
| <http://127.0.0.1:8000/health> | 健康检查 |
| <http://127.0.0.1:8000/api/v1/ping> | v1 连通性检查 |

### 3. 创建第一个管理员

新库没有账号，先注册一个管理员：

```powershell
curl.exe -s -X POST "http://127.0.0.1:8000/api/v1/auth/register" `
  -H "Content-Type: application/json" `
  --data-raw '{"username":"admin","password":"admin123","role":"admin"}'
```

### 4. 启动前端

```powershell
cd web
npm install
npm run dev
```

浏览器打开 <http://localhost:3000>，会自动跳转到 `/login`。前端默认请求 `http://localhost:8000`（前缀 `/api/v1`），
需要改地址时复制 `web/.env.local.example` 为 `.env.local` 并修改 `NEXT_PUBLIC_API_BASE_URL`。

### 5. 演示账号

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `admin123` | 管理员 |

> 生产构建：`npm run build` → `npm run start`（产物在 `web/.next/`）。

## Docker 一键启动

只想跑后端（含 MySQL 与 Redis）时，用 Compose 一条命令拉起三个服务，app 容器启动时会先执行 `alembic upgrade head`：

```powershell
cd deviceops
docker compose up --build
```

| 服务 | 容器名 | 宿主端口 | 容器端口 | 说明 |
| --- | --- | --- | --- | --- |
| app | deviceops-app | 8000 | 8000 | FastAPI + Swagger |
| mysql | deviceops-mysql | 3307 | 3306 | 默认避开本机已占用的 3306 |
| redis | deviceops-redis | 6379 | 6379 | 已读取 `REDIS_URL`，业务暂未读写 |

常用运维命令：

```powershell
docker compose ps                          # 查看状态（三个服务都应为 healthy）
docker compose logs -f app                 # 跟踪应用日志
docker compose exec app alembic current    # 查看迁移版本
docker compose down                        # 停止（保留数据卷）
docker compose down -v                     # 停止并删除数据卷
```

前置条件：Windows 需 Docker Desktop + WSL2；Linux 需 Docker Engine + Compose 插件。

## 环境变量

后端完整清单见 [deviceops/.env.example](deviceops/.env.example)，优先级为**环境变量 > `.env` > 代码默认值**。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PROJECT_NAME` / `VERSION` | `DeviceOps` / `0.1.0` | 服务名与版本号 |
| `DEBUG` | `true` | 调试开关（响应体始终不返回堆栈） |
| `API_V1_PREFIX` | `/api/v1` | API 前缀 |
| `DATABASE_URL` | `sqlite:///./deviceops.db` | 数据库连接串，切库只改这一项 |
| `SECRET_KEY` | 内置默认值 | JWT 签名密钥，**生产必须替换** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | 令牌有效期（分钟） |
| `CORS_ORIGINS` | `*` | 允许来源，逗号分隔 |
| `LOG_LEVEL` / `LOG_DIR` / `LOG_FILE_NAME` | `INFO` / `logs` / `app.log` | 日志配置 |
| `REDIS_URL` | 空 | Redis 地址（预留） |
| `APP_PORT` / `MYSQL_PORT` / `REDIS_PORT` | `8000` / `3307` / `6379` | 仅 docker-compose 使用的宿主端口映射 |
| `MYSQL_*` / `PIP_INDEX_URL` | 见示例文件 | 仅 docker-compose 使用的 MySQL 初始化参数与 pip 源 |

生成随机密钥：`python -c "import secrets; print(secrets.token_urlsafe(48))"`

切库示例：

```dotenv
# 开发：SQLite（默认，免安装数据库）
DATABASE_URL=sqlite:///./deviceops.db

# 生产：MySQL 8（pymysql 已在 requirements.txt 中）
DATABASE_URL=mysql+pymysql://deviceops:deviceops123@127.0.0.1:3306/deviceops?charset=utf8mb4
```

> 切库后需要重新执行 `alembic upgrade head`（迁移版本记录不跨库）。

前端变量见 [web/.env.local.example](web/.env.local.example)：

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 后端地址，构建时内联进客户端 bundle |
| `NEXT_PUBLIC_APP_NAME` | `DeviceOps 设备运维平台` | 站点名称（预留） |

## API 概览

后端共 **26 个对外接口**（另有 1 个仅供 Swagger Authorize 使用的隐藏端点 `/api/v1/auth/token`），
按业务分为 6 组。完整参数、示例与响应模型见 [deviceops/README.md](deviceops/README.md) 或启动后访问 `/docs`。

| 分组 | 前缀 | 主要接口 |
| --- | --- | --- |
| 系统 | `/` | `GET /health`、`GET /api/v1/ping` |
| 认证 | `/api/v1/auth` | `POST /register`、`POST /login`、`GET /me` |
| 用户 | `/api/v1/users` | `GET /users`、`PATCH /users/{id}/role`（仅 admin） |
| 设备 | `/api/v1/devices` | `GET/POST /devices`、`GET/PUT/DELETE /devices/{id}` |
| 工单 | `/api/v1/tickets` | `GET/POST /tickets`、`GET /tickets/{id}`、`PATCH /tickets/{id}/assign`、`PATCH /tickets/{id}/status`、`GET/POST /tickets/{id}/comments` |
| 告警 | `/api/v1/alerts` | `GET/POST /alerts`、`PATCH /alerts/{id}/false-positive` |
| 统计 | `/api/v1/stats` | `GET /stats/overview`、`GET /stats/tickets-by-status`、`GET /stats/alerts-top` |

统一响应与错误码：

```json
{"code": 0, "message": "success", "data": {}}
```

| code | 含义 |
| --- | --- |
| 0 | 成功 |
| 400 | 业务规则不满足（如非法状态流转） |
| 401 / 403 | 未登录或 Token 失效 / 已登录但权限不足 |
| 404 / 405 | 资源不存在 / 请求方法不允许 |
| 409 | 资源冲突（用户名、设备编号重复） |
| 422 | 请求参数校验失败 |
| 500 | 服务器内部错误（响应带 `request_id`，可据此在日志中定位） |

## 权限模型

三种角色：`admin`（管理员）、`engineer`（工程师）、`viewer`（只读用户）。

| 模块 | 公开 | 登录用户 | engineer / admin | 仅 admin |
| --- | --- | --- | --- | --- |
| 认证 | 注册、登录 | `me` | — | — |
| 用户 | — | — | — | 用户列表、修改角色 |
| 设备 | — | 列表、详情 | 创建、更新 | 删除 |
| 工单 | — | 列表、详情、创建、评论列表 | 指派/转派 | 状态流转（工单负责人或 admin） |
| 告警 | — | 列表 | 上报、标记误报 | — |
| 统计 | — | 总览、分布、TOP | — | — |

## 工单状态机

状态只能单向推进一步，禁止跳级、禁止回退，重复置为当前状态同样返回 400：

```text
pending ──► processing ──► resolved ──► closed
 待处理        处理中         已解决       已关闭
```

- 合法：`pending→processing`、`processing→resolved`、`resolved→closed`
- 非法：`pending→resolved`（跳级）、`resolved→pending`（回退）、`closed→*`（终态）

前端工单详情里只会展示当前状态对应的**合法下一步**按钮。

## 界面截图

以下截图取自本项目实际运行环境（Next.js 控制台 + FastAPI + MySQL），按 2 倍像素密度采集，
点击图片可查看原始分辨率（前端页面 3200×2000）。

### 登录页 `/login`

![登录页](web/docs/screenshots/01-login-dark.png)

深色优先的登录页，登录成功后 Token 与用户信息写入 `localStorage`。

### 概览仪表盘 `/dashboard`

![概览仪表盘](web/docs/screenshots/02-dashboard-top.png)

顶部为设备总数、活跃告警、待处理工单、设备在线率四张统计卡片。

![看板图表](web/docs/screenshots/03-dashboard-charts.png)

中下部为告警趋势、设备状态分布、工单状态分布、告警 TOP 设备四张图表，以及最近告警与最近工单列表。

### 设备管理 `/devices`

![设备管理](web/docs/screenshots/04-devices.png)

支持关键字搜索、状态筛选、分页，以及按角色显隐的新增/编辑/删除操作。

### 告警管理 `/alerts`

![告警管理](web/docs/screenshots/05-alerts.png)

顶部为告警总数、有效告警、已标记误报三张统计卡片，列表支持类型与误报状态过滤。

### 工单管理 `/tickets`

![工单管理](web/docs/screenshots/06-tickets.png)

列表支持状态与优先级过滤，详情内可指派、流转状态并记录处理评论。

### 系统设置 `/settings`

![系统设置](web/docs/screenshots/07-settings.png)

可在深色/明亮/跟随系统之间切换主题，并检测后端服务连通性。

### 接口文档 `/docs`

![Swagger 接口文档](deviceops/docs/images/01-swagger.png)

26 个接口按 `auth / users / devices / tickets / alerts / stats` 分组展示，点右上角 Authorize 登录后可直接调试。

## 测试

后端（48 个用例，使用系统临时目录下的独立 SQLite 库，不会影响本地 `deviceops.db`）：

```powershell
cd deviceops
pytest -q                 # 预期：48 passed
pytest -q tests/test_tickets.py    # 只跑某个模块
pytest -q -k "status"              # 按用例名过滤
```

前端：

```powershell
cd web
npm run lint              # ESLint 检查
npm run build             # 生产构建校验
```

## 数据库迁移

后端使用 Alembic 管理表结构（不要用 `create_all`）：

```powershell
cd deviceops
alembic upgrade head              # 升级到最新
alembic current                   # 查看当前版本
alembic history                   # 查看版本链
alembic check                     # 检测模型与数据库漂移（建议作为 CI 门禁）
alembic downgrade -1              # 回退一个版本
```

改了模型后生成新迁移：

```powershell
alembic revision --autogenerate -m "add device remark"
alembic upgrade head
```

## 常见问题

**1. 启动报 `no such table: users`**
还没建表，在 `deviceops/` 下执行 `alembic upgrade head`。

**2. 前端提示「网络请求失败，请确认后端服务已启动」**
后端未运行或地址不对：`curl http://localhost:8000/health` 自检，并确认 `.env.local` 中的 `NEXT_PUBLIC_API_BASE_URL`。

**3. 登录返回 401 用户名或密码错误**
账号不存在或密码不对。新库先调用 `/api/v1/auth/register` 注册管理员。

**4. 浏览器控制台报 CORS 错误**
后端 `CORS_ORIGINS` 默认是 `*`，一般无需处理；若被收紧，需把 `http://localhost:3000` 加入并重启后端。

**5. 修改 `web/.env.local` 不生效**
`NEXT_PUBLIC_*` 变量在构建时内联，必须重启 `npm run dev` 或重新 `npm run build`。

**6. 工单「开始处理」按钮点不动或报 403**
后端规定只有工单负责人本人或 admin 能流转状态；未指派的工单只有 admin 能操作。

**7. `alembic` 报 `UnicodeDecodeError: 'gbk' codec can't decode`**
`alembic.ini` 被 configparser 按系统 locale 读取，该文件必须保持纯 ASCII（注释只能写英文）。

**8. `docker compose up` 报端口占用**
3306 冲突已默认规避（映射到 3307）；若 8000 / 6379 被占用，改 `.env` 里的 `APP_PORT` / `REDIS_PORT` 后重启。

**9. 时间显示与数据库不一致**
SQLite 下 `created_at` 存 UTC 朴素时间，统计接口按 UTC 做时间窗口过滤；前端按本地时间解析展示，
容器里的 MySQL 通过 `--default-time-zone=+08:00` 与 `TZ` 对齐为东八区。

## 开发指南

在后端新增一个业务模块的顺序：

1. `app/models/xxx.py` 定义 ORM 模型，并在 `app/models/__init__.py` 导入；
2. `alembic revision --autogenerate -m "add xxx"` → `alembic upgrade head`；
3. `app/schemas/xxx.py` 定义 Pydantic 模型并导出；
4. `app/crud/xxx.py` 写数据访问；
5. `app/api/v1/xxx.py` 写路由（`Depends(get_db)` / `get_current_user` / `require_admin` 等）；
6. 在 `app/api/v1/router.py` 挂载路由；
7. `tests/test_xxx.py` 补用例并跑 `pytest -q`。

前端新增页面的顺序：在 `src/app/(app)/` 下建路由目录 → 用 `src/components/ui` 里的基础组件拼页面 →
在 `src/lib/endpoints.ts` 增加接口封装 → 用 `useApi` 拿数据 → 在 `src/components/layout/nav-config.ts` 注册导航。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [deviceops/README.md](deviceops/README.md) | 后端完整说明：接口明细、目录结构、日志、响应格式、常见问题、扩展方向 |
| [web/README.md](web/README.md) | 前端完整说明：页面结构、接口对接表、登录态与 401 处理、CORS、常见问题 |
| [deviceops/.env.example](deviceops/.env.example) | 后端环境变量清单与示例 |
| [web/.env.local.example](web/.env.local.example) | 前端环境变量示例 |
| [deviceops/LICENSE](deviceops/LICENSE) | MIT 许可证全文 |

## 许可证

本项目采用 [MIT License](deviceops/LICENSE) 开源：可自由用于学习、修改与二次分发，保留版权声明即可。
