# DeviceOps 设备运维工单管理系统

面向**车载定位终端**的运维管理平台，前后端分离、同仓管理。

后端是 FastAPI + SQLAlchemy 2.0 的接口服务，负责设备台账、工单流转、告警跟踪与运维统计；
前端是 Next.js 14 控制台，提供登录、看板、设备/告警/工单/设置等页面，直接对接后端 `/api/v1` 接口。

## 仓库结构

| 目录 | 说明 | 技术栈 | 文档 |
| --- | --- | --- | --- |
| [`deviceops/`](deviceops/) | 后端服务（REST API + 数据库迁移 + 测试 + 容器编排） | FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Alembic · MySQL/SQLite · Redis | [deviceops/README.md](deviceops/README.md) |
| [`web/`](web/) | 前端控制台 | Next.js 14.2（App Router）· TypeScript · Tailwind CSS · shadcn/ui 风格组件 · Recharts | [web/README.md](web/README.md) |

## 快速开始

### 后端

```powershell
cd deviceops
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head                  # 建表，默认生成 SQLite: deviceops.db
uvicorn app.main:app --reload         # http://127.0.0.1:8000/docs
```

首次使用需在 `/docs` 里注册管理员，或用 `curl.exe` 调用 `/api/v1/auth/register` 创建 `admin / admin123`。

### 前端

```powershell
cd web
npm install
npm run dev                           # http://localhost:3000，自动跳转 /login
```

前端默认请求 `http://localhost:8000`（前缀 `/api/v1`），可在 `web/.env.local` 中通过 `NEXT_PUBLIC_API_BASE_URL` 覆盖。
演示账号：`admin / admin123`。

> 也可以只跑后端：`cd deviceops && docker compose up`（app + MySQL + Redis）。

## 界面截图

| 登录 | 运维看板 |
| --- | --- |
| ![登录](web/docs/screenshots/01-login-dark.png) | ![看板](web/docs/screenshots/02-dashboard-top.png) |

| 设备台账 | 工单管理 |
| --- | --- |
| ![设备](web/docs/screenshots/04-devices.png) | ![工单](web/docs/screenshots/06-tickets.png) |

## 许可证

[MIT](deviceops/LICENSE)
