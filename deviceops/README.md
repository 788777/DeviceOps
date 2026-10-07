# DeviceOps 设备运维工单管理系统

![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.142-009688)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red)
![Pydantic](https://img.shields.io/badge/Pydantic-v2-e92063)
![Tests](https://img.shields.io/badge/tests-48%20passed-brightgreen)
[![CI](https://github.com/788777/DeviceOps/actions/workflows/ci.yml/badge.svg)](https://github.com/788777/DeviceOps/actions/workflows/ci.yml)
[![Gitee](https://img.shields.io/badge/Gitee-%E9%95%9C%E5%83%8F%E4%BB%93%E5%BA%93-c71d23?logo=gitee&logoColor=white)](https://gitee.com/huatai788/device-ops-ticketing-system)

## 项目介绍

DeviceOps 是面向**车载定位终端**的运维管理后端。它解决的是运维团队日常最重复的三件事：设备台账不清楚、故障工单在群里口头流转、设备告警没人跟进。

系统把这三件事拉到一个平台上：

- **设备台账**：登记设备编号、型号、安装位置与在线状态，支持按编号/型号搜索与状态筛选；
- **工单流转**：从报障、指派、处理到关闭全流程留痕，状态只能按 `pending→processing→resolved→closed` 单向推进，杜绝跳级和回退；
- **告警跟踪**：记录设备离线、故障、超速、低电量等告警，支持标记误报，避免无效告警淹没真实问题；
- **运维看板**：设备在线率、工单状态分布、告警 TOP 设备，供值班和管理者快速掌握全局。

工程上它是一套可以直接拿去改的 FastAPI 骨架：分层清晰（api / crud / services / models / schemas）、统一响应与全局异常处理、JWT 认证与角色权限、Alembic 迁移、pytest 自动化测试、Docker Compose 一键启动（app + MySQL + Redis）。

## 目录

- [项目介绍](#项目介绍)
- [技术栈](#技术栈)
- [功能与权限](#功能与权限)
- [工单状态机](#工单状态机)
- [目录结构](#目录结构)
- [环境变量](#环境变量)
- [本地启动](#本地启动)
- [Docker 启动](#docker-启动)
- [API 文档](#api-文档)
- [测试命令](#测试命令)
- [界面截图](#界面截图)
- [数据库迁移](#数据库迁移)
- [响应格式与错误码](#响应格式与错误码)
- [日志](#日志)
- [开发指南](#开发指南)
- [常见问题](#常见问题)
- [后续可扩展方向](#后续可扩展方向)
- [许可证](#许可证)

## 技术栈

| 分类 | 选型 |
|---|---|
| 语言 | Python 3.11+（开发环境实测 3.14.7，容器使用 3.11-slim） |
| Web 框架 | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2.0（`Mapped` / `mapped_column` 声明式风格） |
| 数据校验 | Pydantic v2 + pydantic-settings |
| 数据库 | SQLite（开发）/ MySQL 8（生产），由 `DATABASE_URL` 一处切换 |
| 迁移 | Alembic（autogenerate + `alembic check` 漂移检测） |
| 认证 | JWT（python-jose）+ OAuth2 Password Flow，密码 passlib[bcrypt] 哈希 |
| 缓存 | Redis 7（编排与配置已就绪，业务暂未读写） |
| 测试 | pytest + httpx（48 个用例，临时 SQLite 隔离） |
| 部署 | Dockerfile + docker-compose（app + mysql + redis） |

## 功能与权限

三种角色：`admin`（管理员）、`engineer`（工程师）、`viewer`（只读用户）。

| 模块 | 接口 | 权限 |
|---|---|---|
| 认证 | 注册 / 登录 | 公开 |
| 认证 | `me` | 登录用户 |
| 用户 | 用户列表、修改角色 | admin |
| 设备 | 列表、详情 | 登录用户 |
| 设备 | 创建、更新 | engineer、admin |
| 设备 | 删除 | admin |
| 工单 | 列表、详情、评论列表 | 登录用户 |
| 工单 | 创建（报障） | 登录用户 |
| 工单 | 指派 / 转派 | engineer、admin |
| 工单 | 状态流转 | 仅该工单负责人或 admin |
| 工单 | 新增评论 | 工单创建人、负责人或 admin |
| 告警 | 列表 | 登录用户 |
| 告警 | 上报、标记误报 | engineer、admin |
| 统计 | 总览、工单分布、告警 TOP | 登录用户 |

说明：注册接口允许直接指定角色（便于初始化第一个管理员）。生产环境建议把注册固定为 `viewer`，角色调整统一走 `PATCH /api/v1/users/{id}/role`。

## 工单状态机

状态只能单向推进一步，禁止跳级、禁止回退：

```text
pending ──► processing ──► resolved ──► closed
 待处理        处理中         已解决       已关闭
```

- 合法：`pending→processing`、`processing→resolved`、`resolved→closed`
- 非法：`pending→resolved`（跳级）、`resolved→pending`（回退）、`closed→*`（终态）
- 重复置为当前状态同样返回 400

## 目录结构

```text
deviceops/
├── alembic/                      # 数据库迁移
│   ├── env.py                    # 读取 settings.DATABASE_URL + Base.metadata
│   └── versions/936891f269e6_init.py
├── alembic.ini                   # 注意：必须保持纯 ASCII（见“常见问题”）
├── app/
│   ├── main.py                   # FastAPI 实例、CORS、异常处理、请求日志中间件
│   ├── api/
│   │   ├── deps.py               # get_db / get_current_user / require_roles
│   │   └── v1/                   # auth users devices tickets alerts stats 路由
│   ├── core/
│   │   ├── config.py             # pydantic-settings 配置（全部走环境变量）
│   │   └── security.py           # bcrypt 哈希 + JWT 签发/解析
│   ├── crud/                     # 数据访问层（user / device / ticket / alert）
│   ├── db/                       # engine / SessionLocal / Base
│   ├── models/                   # SQLAlchemy 2.0 ORM 模型（6 张表）
│   ├── schemas/                  # Pydantic v2 请求/响应模型
│   ├── services/                 # 业务服务（统计聚合）
│   └── utils/                    # 统一响应、日志
├── tests/                        # pytest 用例（conftest + 4 个模块）
├── docs/images/                  # README 截图（见“截图占位”）
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pytest.ini
└── .env.example
```

分层约定：路由只做参数校验与权限声明 → `crud` 负责数据库读写 → `services` 放跨表业务逻辑（当前只有统计）。业务异常可抛 `app.utils.response.BusinessError`，会被全局异常处理器转成统一响应。

## 环境变量

完整清单见 [.env.example](.env.example)。优先级：**环境变量 > .env > 代码默认值**（pydantic-settings 官方行为）。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PROJECT_NAME` | `DeviceOps` | 服务名（出现在文档与日志） |
| `VERSION` | `0.1.0` | 版本号 |
| `DEBUG` | `true` | 调试开关（响应体始终不返回堆栈） |
| `API_V1_PREFIX` | `/api/v1` | API 前缀 |
| `DATABASE_URL` | `sqlite:///./deviceops.db` | 数据库连接串，切库只改这一项 |
| `SQL_ECHO` | `false` | 是否打印 SQL（排查 ORM 问题时开） |
| `REDIS_URL` | 空 | Redis 地址（已预留，暂未读写） |
| `SECRET_KEY` | 内置默认值 | JWT 签名密钥，生产必须替换 |
| `ALGORITHM` | `HS256` | JWT 算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | 令牌有效期（分钟） |
| `LOG_LEVEL` | `INFO` | 日志级别 |
| `LOG_DIR` | `logs` | 日志目录 |
| `LOG_FILE_NAME` | `app.log` | 日志文件名 |
| `CORS_ORIGINS` | `*` | 允许来源，逗号分隔，`*` 表示全部 |

仅 Docker Compose 使用：`APP_PORT`、`MYSQL_PORT`、`REDIS_PORT`、`MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`PIP_INDEX_URL`。

生成随机密钥：

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

切换数据库只改 `DATABASE_URL`，代码与迁移脚本都不用动：

```dotenv
# 开发：SQLite（默认，免安装数据库）
DATABASE_URL=sqlite:///./deviceops.db

# 生产：MySQL 8（pymysql 已在 requirements.txt 中）
DATABASE_URL=mysql+pymysql://deviceops:deviceops123@127.0.0.1:3306/deviceops?charset=utf8mb4
```

切库后需要重新执行 `alembic upgrade head`（迁移版本记录不跨库）。模型中的枚举统一使用 `native_enum=False`，在 MySQL 中落成 `VARCHAR(20)`，不依赖 MySQL ENUM 类型。

## 本地启动

### 1. 克隆并准备环境

```powershell
git clone https://github.com/788777/DeviceOps.git
cd DeviceOps

python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

> 国内网络可用 Gitee 镜像：`git clone https://gitee.com/huatai788/device-ops-ticketing-system.git`（克隆出的目录名为 `device-ops-ticketing-system`）。

### 2. 配置环境变量（可选）

不配置也能跑（默认 SQLite + 默认密钥，仅适合本地）：

```powershell
Copy-Item .env.example .env
```

### 3. 建表（用 Alembic，不要再用 create_all）

```powershell
alembic upgrade head
```

默认在项目根目录生成 `deviceops.db`（SQLite），创建 6 张业务表 + `alembic_version`。

### 4. 启动服务

```powershell
uvicorn app.main:app --reload
```

| 地址 | 说明 |
|---|---|
| http://127.0.0.1:8000/docs | Swagger UI（右上角 Authorize 可直接调试） |
| http://127.0.0.1:8000/redoc | ReDoc |
| http://127.0.0.1:8000/health | 健康检查 |
| http://127.0.0.1:8000/api/v1/ping | v1 连通性检查 |

### 5. 创建第一个管理员

```powershell
curl.exe -s -X POST "http://127.0.0.1:8000/api/v1/auth/register" `
  -H "Content-Type: application/json" `
  --data-raw '{"username":"admin","password":"admin123","role":"admin"}'
```

之后在 `/docs` 的 Authorize 里用 `admin / admin123` 登录，即可调用所有受保护接口。

## Docker 启动

```powershell
docker compose up --build
```

一行命令拉起三个服务，app 容器启动时会**先执行 `alembic upgrade head`** 再启动 uvicorn：

| 服务 | 容器名 | 宿主端口 | 容器端口 | 说明 |
|---|---|---|---|---|
| app | deviceops-app | 8000 | 8000 | FastAPI + Swagger |
| mysql | deviceops-mysql | 3307 | 3306 | 默认避开本机已占用的 3306 |
| redis | deviceops-redis | 6379 | 6379 | 预留（应用已读取 `REDIS_URL`，暂未读写） |

打开 <http://127.0.0.1:8000/docs>。常用运维命令：

```powershell
docker compose ps                          # 查看状态（三个服务都应是 healthy）
docker compose logs -f app                 # 跟踪应用日志
docker compose exec app alembic current    # 查看迁移版本
docker compose exec redis redis-cli ping   # 期望输出 PONG
docker compose down                        # 停止（保留数据卷）
docker compose down -v                     # 停止并删除数据卷（彻底重来）
```

前置条件：Windows 需安装 Docker Desktop 并启用 WSL2；Linux 需 Docker Engine + Compose 插件。

两个国内网络下容易踩的坑，本项目已规避，换机器时留意：

1. **拉基础镜像超时**：Docker Hub 在部分网络下 TLS 握手超时。请在 Docker Desktop → Settings → Docker Engine 配置加速器后重启引擎：
   ```json
   { "registry-mirrors": ["https://docker.1ms.run", "https://docker.m.daocloud.io"] }
   ```
2. **构建时 pip 超时**：Dockerfile 默认使用清华 PyPI 镜像（`PIP_INDEX_URL`），需要官方源时用
   `docker compose build --build-arg PIP_INDEX_URL=https://pypi.org/simple`。

想让 app 容器改用 SQLite：把 `docker-compose.yml` 中 app 的 `DATABASE_URL` 换成 `sqlite:////data/deviceops.db`（注意 4 个斜杠表示绝对路径），并挂载一个 `/data` 数据卷；文件末尾有现成注释可参考。

## API 文档

启动后访问 <http://127.0.0.1:8000/docs>：

1. 点右上角 **Authorize**，用 `admin / admin123` 登录（走 OAuth2 password flow）；
2. 之后所有受保护接口会自动带上 `Bearer` 令牌，可直接在页面上 Try it out；
3. ReDoc 版本：<http://127.0.0.1:8000/redoc>；OpenAPI 原始文件：<http://127.0.0.1:8000/openapi.json>。

共 **26 个对外接口**，另有 1 个隐藏端点 `/api/v1/auth/token`（仅用于 Swagger 的 Authorize，返回 OAuth2 标准结构；业务登录请用 `/api/v1/auth/login`）。

### 系统

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/health` | 公开 |
| GET | `/` | 公开 |
| GET | `/api/v1/ping` | 公开 |

### 认证 `/api/v1/auth`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/register` | 公开 | 注册（可指定角色） |
| POST | `/login` | 公开 | 表单登录，返回 JWT（统一响应，token 在 `data.access_token`） |
| GET | `/me` | 登录 | 当前登录用户 |

### 用户 `/api/v1/users`

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/users?page=&size=&keyword=&role=` | admin |
| PATCH | `/users/{id}/role` | admin |

### 设备 `/api/v1/devices`

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/devices?page=&size=&keyword=&status=` | 登录用户 |
| POST | `/devices` | engineer / admin |
| GET | `/devices/{id}` | 登录用户 |
| PUT | `/devices/{id}` | engineer / admin |
| DELETE | `/devices/{id}` | admin |

`keyword` 同时模糊匹配 `device_no` 与 `model`；`status` 取值 `online/offline/fault/maintenance`。`PUT` 为部分更新语义，只修改请求体里出现的字段。

### 工单 `/api/v1/tickets`

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/tickets?status=&priority=&assignee_id=&device_id=&page=&size=` | 登录用户 |
| POST | `/tickets` | 登录用户 |
| GET | `/tickets/{id}` | 登录用户 |
| PATCH | `/tickets/{id}/assign` | engineer / admin |
| PATCH | `/tickets/{id}/status` | 工单负责人 / admin |
| POST | `/tickets/{id}/comments` | 创建人 / 负责人 / admin |
| GET | `/tickets/{id}/comments` | 登录用户 |

新建工单状态固定为 `pending`，客户端不能指定 `status`。

### 告警 `/api/v1/alerts`

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/alerts?device_id=&type=&is_false_positive=&page=&size=` | 登录用户 |
| POST | `/alerts` | engineer / admin |
| PATCH | `/alerts/{id}/false-positive` | engineer / admin |

### 统计 `/api/v1/stats`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/stats/overview` | 设备总数与在线率、工单状态分布、告警总数/误报数 |
| GET | `/stats/tickets-by-status` | 各状态数量与占比 |
| GET | `/stats/alerts-top?limit=&days=` | 告警最多的设备排行（`days` 为空表示全部时间） |

## 测试命令

```powershell
pytest -q
```

预期输出：

```text
................................................                                        [100%]
48 passed in 1.74s
```

测试特性：

- 使用**临时 SQLite 库**（系统临时目录，会话结束后自动清理），不会碰你的 `deviceops.db`；
- 每个用例结束后自动清空所有表，用例之间完全隔离；
- `conftest.py` 里把 bcrypt 轮数降到 4，48 个用例从半分钟压到 1.7 秒；
- 覆盖：注册/登录/`me`、设备 CRUD 与分页权限、工单创建/指派/状态机/评论、告警与误报标记、统一响应格式（所有响应都断言严格等于 `{code, message, data}`）。

```powershell
pytest -q tests/test_tickets.py    # 只跑某个模块
pytest -q -k "status"              # 按用例名过滤
pytest -x -vv                      # 出错即停 + 详细输出
docker compose exec app pytest -q  # 在容器里跑（镜像内已含 pytest 与 tests/）
```

## 界面截图

以下截图取自本项目**实际运行环境**（Docker + MySQL，浏览器视口 1600px 宽、2 倍像素密度采集），不是设计稿。

### 1. Swagger 接口文档（`/docs`）

![Swagger UI](docs/images/01-swagger.png)

全部 26 个接口按 `auth / users / devices / tickets / alerts / stats` 分组展示；点右上角 Authorize 登录后可直接在页面上调试。

### 2. ReDoc 文档（`/redoc`）

![ReDoc](docs/images/02-redoc.png)

同一份 OpenAPI 规格的另一种阅读视图，适合按接口逐条查阅参数与响应模型。

### 3. 设备接口（Swagger 展开）

![Devices API](docs/images/03-devices-api.png)

`GET /api/v1/devices` 支持分页、按设备编号/型号搜索与按状态过滤。

### 4. 工单详情接口（Swagger 展开）

![Tickets API](docs/images/04-tickets-api.png)

`GET /api/v1/tickets/{id}` 返回工单本体及其关联的设备、创建人、负责人与评论列表。

### 5. 统计接口（Swagger 展开）

![Stats API](docs/images/05-stats-api.png)

`GET /api/v1/stats/overview` 返回设备总数与在线率、工单状态分布、告警统计。

> 本项目为纯后端，暂未提供前端页面，接口调试请使用 `/docs`。后续若补充前端，可在此追加设备台账与运维看板的页面截图。

## 数据库迁移

```powershell
alembic upgrade head            # 升级到最新
alembic current                 # 查看当前版本
alembic history                 # 查看版本链
alembic check                   # 检测模型与数据库是否漂移（建议加进 CI）
alembic downgrade -1            # 回退一个版本
alembic downgrade base          # 回退到空库
alembic upgrade head --sql      # 只打印 SQL，不执行
```

改了模型后生成新迁移：

```powershell
alembic revision --autogenerate -m "add device remark"
alembic upgrade head
```

给一个空库生成迁移（避免与现有表 diff 得到空迁移）：

```powershell
$env:DATABASE_URL="sqlite:///./tmp_migrate.db"; alembic revision --autogenerate -m "init"; Remove-Item Env:\DATABASE_URL
```

## 响应格式与错误码

所有接口（除仅供 Swagger 使用的隐藏端点外）都返回统一结构：

```json
{"code": 0, "message": "success", "data": {}}
```

分页接口的 `data`：

```json
{"items": [], "total": 0, "page": 1, "page_size": 10, "pages": 0}
```

失败响应示例：

```json
{"code": 404, "message": "请求的资源不存在", "data": null}
{"code": 422, "message": "请求参数校验失败", "data": [{"loc": ["query", "page"], "msg": "Input should be greater than or equal to 1"}]}
{"code": 500, "message": "服务器内部错误", "data": {"request_id": "a2130957076742d6"}}
```

| code | 含义 |
|---|---|
| 0 | 成功 |
| 400 | 业务规则不满足（如非法状态流转、重复状态） |
| 401 | 未登录 / token 无效或过期 |
| 403 | 已登录但权限不足 |
| 404 | 资源不存在 |
| 405 | 请求方法不允许 |
| 409 | 资源冲突（用户名、设备编号重复） |
| 422 | 请求参数校验失败 |
| 500 | 服务器内部错误（带 `request_id`，用它在日志中定位） |

## 日志

同时输出到控制台与 `logs/app.log`（单文件 10MB，保留 5 份）。

```text
2026-10-06 16:40:01 | INFO     | deviceops.access | request_id=1e9038ff0a124cdd POST /api/v1/alerts client=172.18.0.1 -> 200 9.32ms
```

每条响应都会带 `X-Request-ID` 响应头；客户端报错时把这个 ID 发给后端，可以直接在日志里定位整条请求链路。未捕获异常会完整记录堆栈到 `logs/app.log`，但返回给客户端的只有统一格式的 500。

## 开发指南

新增一个业务模块的顺序：

1. `app/models/xxx.py` 定义 ORM 模型，并在 `app/models/__init__.py` 导入；
2. `alembic revision --autogenerate -m "add xxx"` 然后 `alembic upgrade head`；
3. `app/schemas/xxx.py` 定义 Pydantic 模型，并在 `app/schemas/__init__.py` 导出；
4. `app/crud/xxx.py` 写数据访问；
5. `app/api/v1/xxx.py` 写路由（用 `Depends(get_db)`、`Depends(get_current_user)`、`Depends(require_admin)` 等）；
6. 在 `app/api/v1/router.py` 挂载 `router`；
7. `tests/test_xxx.py` 补用例，跑 `pytest -q`。

权限依赖：

```python
from app.api.deps import get_current_user, require_admin, require_engineer, require_roles
from app.models.user import UserRole

current_user: User = Depends(get_current_user)          # 任意登录用户
admin: User = Depends(require_admin)                     # 仅 admin
engineer: User = Depends(require_engineer)               # admin / engineer
custom = require_roles(UserRole.ADMIN, UserRole.VIEWER)  # 自定义组合
```

业务异常：

```python
from app.utils.response import BusinessError

raise BusinessError("设备编号已存在", status_code=409)
```

## 常见问题

**1. 启动报 `no such table: users`**
还没建表，执行 `alembic upgrade head`。

**2. `alembic` 报 `UnicodeDecodeError: 'gbk' codec can't decode`**
`alembic.ini` 被 configparser 按系统 locale 编码读取（中文 Windows 是 GBK），该文件必须保持纯 ASCII，注释只能写英文。`env.py` 等 Python 文件不受影响。

**3. 日志里出现 `(trapped) error reading bcrypt version`**
passlib 1.7.4 与 bcrypt 4.1+ 的版本探测不兼容，只影响它打印后端版本号，不影响哈希与校验。项目已在 `app/core/security.py` 里压低该 logger。

**4. 超长密码**
bcrypt 只使用前 72 字节，代码里做了显式截断，不会抛异常。

**5. 时间为什么是 UTC**
`created_at` 由数据库 `CURRENT_TIMESTAMP` 生成，SQLite 下存 UTC 朴素时间；统计接口按 UTC 做时间窗口过滤，避免刚创建的记录被差 8 小时过滤掉。前端展示时自行转东八区。容器里 MySQL 通过 `--default-time-zone=+08:00` 与 `TZ` 对齐为东八区。

**6. `docker compose up` 报端口占用**
宿主 3306 已有 MySQL 不会冲突（compose 默认映射到 3307）。若 8000 / 6379 被占用，改 `.env` 里的 `APP_PORT` / `REDIS_PORT` 后重启。

**7. Swagger 的 Authorize 报错**
Authorize 走隐藏端点 `/api/v1/auth/token`（OAuth2 标准结构）；业务登录请用 `/api/v1/auth/login`（统一结构，token 在 `data.access_token`）。

**8. 浏览器请求被 CORS 拦截**
用 `CORS_ORIGINS` 配置允许来源（逗号分隔），例如 `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`；`*` 表示允许全部（此时不会回传 `Access-Control-Allow-Credentials`，因为浏览器禁止通配符与凭证同时使用）。

## 后续可扩展方向

- 操作日志落库：`OperationLog` 模型已就绪，可在中间件或 service 层写入；
- Redis 接入：`REDIS_URL` 已预留，可用于统计缓存、token 黑名单、异步任务队列；
- 工单重开：当前 `resolved/closed` 不可回退，如需重开可放宽状态机（建议仅 admin）；
- 设备位置轨迹：`Device.location` 目前是文本，后续可拆成定位流水表；
- 接入 CI：`pytest -q` + `alembic check` 作为流水线门禁。

## 许可证

本项目采用 [MIT License](LICENSE) 开源：可自由用于学习、修改与二次分发，保留版权声明即可。
