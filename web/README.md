# DeviceOps Web 控制台

DeviceOps 设备运维工单管理系统的前端，Next.js 14（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 风格组件，
对接同级的 FastAPI 后端 `../deviceops`（默认 `http://localhost:8000`，接口前缀 `/api/v1`）。

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 框架 | Next.js 14.2（App Router）+ React 18 + TypeScript |
| 样式 | Tailwind CSS 3 + shadcn/ui 风格组件（Radix UI 原语，组件源码位于 `src/components/ui`） |
| 图标 | Lucide React |
| 图表 | Recharts |
| 请求 | Axios（统一实例 + 请求/响应拦截器） |
| 主题 | next-themes（默认深色，支持深色/明亮/跟随系统） |
| 提示 | Sonner（toast） |

## 快速开始

```bash
# 1. 进入前端目录
cd web

# 2. 安装依赖（首次）
npm install

# 3. 确认后端地址（默认已配置好）
#    .env.local -> NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 4. 启动开发服务器
npm run dev
```

浏览器打开 <http://localhost:3000>，会自动跳转到 `/login`。

演示账号（后端 README 中的初始化账号）：

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `admin123` | 管理员 |

> 如果后端数据库中还没有账号，先调用注册接口创建：
> ```bash
> curl -X POST http://localhost:8000/api/v1/auth/register \
>   -H "Content-Type: application/json" \
>   -d '{"username":"admin","password":"admin123","role":"admin"}'
> ```

### 生产构建

```bash
npm run build   # 产物在 .next/
npm run start   # 以生产模式启动（默认 3000 端口）
npm run lint    # ESLint 检查
```

## 环境变量（`.env.local`）

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 后端地址，浏览器端直接访问（`NEXT_PUBLIC_` 前缀会被内联进客户端 bundle） |
| `NEXT_PUBLIC_APP_NAME` | `DeviceOps 设备运维平台` | 预留的站点名称 |

修改 `.env.local` 后需要重启 `npm run dev` 才会生效。

## 目录结构

```
web/
├─ .env.local                     # 后端地址配置
├─ components.json                # shadcn/ui 配置（后续可 npx shadcn@latest add xxx）
├─ tailwind.config.ts             # 设计令牌（颜色/圆角/阴影/动画）
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               # 根布局：字体 + 全局 Providers + Toaster
│  │  ├─ globals.css              # 深色优先的设计令牌与玻璃拟态工具类
│  │  ├─ page.tsx                 # / -> 重定向到 /dashboard
│  │  ├─ login/page.tsx           # 登录页
│  │  └─ (app)/                   # 需要登录的路由组（带侧边栏 + Header 外壳）
│  │     ├─ layout.tsx            # 登录态校验 + 布局
│  │     ├─ dashboard/page.tsx    # 概览仪表盘
│  │     ├─ devices/page.tsx      # 设备管理
│  │     ├─ alerts/page.tsx       # 告警管理
│  │     ├─ tickets/page.tsx      # 工单管理
│  │     └─ settings/page.tsx     # 系统设置
│  ├─ components/
│  │  ├─ charts/                  # Recharts 图表封装
│  │  ├─ layout/                  # 侧边栏、Header、主题切换、用户菜单
│  │  ├─ providers/               # 主题、登录态、全局 Providers
│  │  └─ ui/                      # shadcn/ui 风格基础组件
│  ├─ hooks/use-api.ts            # 数据请求 / 提交封装（loading、error、竞态、刷新）
│  └─ lib/
│     ├─ api.ts                   # Axios 实例、拦截器、Token 存储、401 处理
│     ├─ endpoints.ts             # 所有后端接口的 TypeScript 封装
│     ├─ format.ts                # 时间格式化、枚举字典、状态配色
│     ├─ types.ts                 # 与后端 schemas 对应的类型
│     └─ utils.ts                 # cn() 等工具函数
└─ docs/screenshots/              # 页面截图
```

## 接口对接说明

后端所有业务接口统一返回 `{ code, message, data }`，`code === 0` 表示成功。
`src/lib/api.ts` 的 `request<T>()` 会自动解包 `data` 并把 `code !== 0` 转成 `ApiError`。

| 页面 | 方法 | 接口 | 说明 |
| --- | --- | --- | --- |
| 登录 | POST | `/api/v1/auth/login` | **表单提交**（`application/x-www-form-urlencoded`，字段 `username`/`password`），返回 `access_token` 存 localStorage |
| 全局 | GET | `/api/v1/auth/me` | 启动时校验 Token 是否有效，同步用户信息 |
| 仪表盘 | GET | `/api/v1/stats/overview` | 设备/工单/告警总览 |
| 仪表盘 | GET | `/api/v1/stats/tickets-by-status` | 工单状态分布柱状图 |
| 仪表盘 | GET | `/api/v1/stats/alerts-top` | 告警 TOP 设备（近 30 天） |
| 仪表盘 | GET | `/api/v1/alerts?page=1&size=100` | 告警明细，前端按天聚合出「近 14 天告警趋势」 |
| 设备 | GET | `/api/v1/devices` | 分页 / `keyword` 搜索 / `status` 过滤 |
| 设备 | POST / PUT / DELETE | `/api/v1/devices`、`/api/v1/devices/{id}` | 新增 / 编辑（engineer、admin）、删除（admin） |
| 告警 | GET | `/api/v1/alerts` | 分页 / `type` / `is_false_positive` 过滤 |
| 告警 | PATCH | `/api/v1/alerts/{id}/false-positive` | 标记 / 撤销误报 |
| 告警 | POST | `/api/v1/alerts` | 上报告警（engineer、admin） |
| 工单 | GET | `/api/v1/tickets` | 分页 / `status` / `priority` 过滤 |
| 工单 | GET | `/api/v1/tickets/{id}` | 详情（含设备、创建人、负责人、评论） |
| 工单 | POST | `/api/v1/tickets` | 新建工单（状态固定 `pending`） |
| 工单 | PATCH | `/api/v1/tickets/{id}/status` | 状态流转，前端按 `pending → processing → resolved → closed` 只暴露合法下一步 |
| 工单 | PATCH | `/api/v1/tickets/{id}/assign` | 指派 / 转派（engineer、admin） |
| 工单 | GET / POST | `/api/v1/tickets/{id}/comments` | 评论列表 / 新增评论 |
| 设置 | GET | `/health`、`/api/v1/ping` | 后端连通性检测 |
| 设置 | GET | `/api/v1/users` | 仅 admin，用于工单指派下拉框 |

### 与后端模型的差异说明

- 设备模型（`app/models/device.py`）没有 IP 字段，设备表展示的是 **设备编号 / 型号 / 安装位置 / 状态 / 最后在线时间**。
  如果后续需要按 IP 管理，需要后端先加字段。
- 告警模型没有独立的 `severity` 字段，「级别」列由告警类型映射得到：
  `offline`/`fault` → 严重，`overspeed`/`low_battery` → 警告，`other` → 提示。
- 后端没有提供「告警趋势」接口，仪表盘的趋势图由 `/api/v1/alerts` 明细（最多最近 100 条）在前端按天聚合，
  卡片副标题中已注明口径。

## 登录态与 401 处理

- 登录成功后 `access_token` 与用户信息写入 `localStorage`（键：`deviceops.access_token`、`deviceops.user`）。
- Axios 请求拦截器自动附加 `Authorization: Bearer <token>`。
- 响应拦截器遇到 **401**（且不是登录接口本身）会：清除本地 Token → 跳转
  `/login?next=<原路径>&reason=expired`；登录成功后再回到原页面。
- 路由组 `(app)` 在客户端校验登录态，未登录访问受保护页面会重定向到 `/login`。
- Token 默认有效期 60 分钟（后端 `ACCESS_TOKEN_EXPIRE_MINUTES`），过期即走上面的 401 流程。

## 跨域（CORS）

前端在浏览器里直连 `http://localhost:8000`，属于跨域请求，需要后端允许来源 `http://localhost:3000`。

后端 `app/core/config.py` 的 `CORS_ORIGINS` 默认值是 `*`（允许全部来源），**默认配置下无需修改后端**。
docker-compose 没有注入该变量，因此容器化部署时同样使用默认值 `*`。

如果后端把 `CORS_ORIGINS` 收紧了（例如 `.env` 里写死成 `http://localhost:5173`），需要把前端来源加上：

```env
# deviceops/.env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

改完后重启后端（`docker compose up -d --force-recreate app` 或本地重启 uvicorn）即可。

> 注意：`CORS_ORIGINS=*` 时后端会关闭 `allow_credentials`（浏览器禁止通配符与携带凭证同时使用）。
> 本项目认证走 `Authorization` 请求头而不是 Cookie，因此不受影响。

## 常见问题

**1. 页面提示「网络请求失败，请确认后端服务已启动」**
检查后端是否在 `http://localhost:8000` 运行：`curl http://localhost:8000/health`。

**2. 登录返回 401 用户名或密码错误**
用户名或密码不对，或数据库里还没有账号，先调用 `/api/v1/auth/register` 注册。

**3. 浏览器控制台报 CORS 错误**
把 `http://localhost:3000` 加入后端 `CORS_ORIGINS` 并重启后端。

**4. 工单「开始处理」按钮点不动或报 403**
后端规定只有**工单负责人本人或 admin** 能流转状态；未指派的工单只有 admin 能操作。

**5. 修改 `.env.local` 不生效**
`NEXT_PUBLIC_*` 变量在构建时内联，必须重启 `npm run dev` / 重新 `npm run build`。

**6. 时间显示与数据库不一致**
后端返回的是不带时区的朴素时间字符串（容器化部署时 MySQL 已按 `Asia/Shanghai` 写入），
前端按本地时间解析展示（见 `src/lib/format.ts` 的 `parseServerDate`）。
