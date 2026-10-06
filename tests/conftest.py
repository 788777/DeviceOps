"""pytest 全局配置与公共 fixture.

要点：
1. 在导入 app 之前设置环境变量，保证 settings / engine 指向**临时 SQLite 库**，
   绝不碰开发用的 deviceops.db。
2. 日志目录也指向临时目录，避免测试污染项目 logs/。
3. bcrypt 轮数在测试中降到 4，否则每次注册/登录都要 ~300ms，
   40 多个用例会跑很久。
"""

import os
import logging
import shutil
import sys
import tempfile
from collections.abc import Callable, Generator, Iterator
from pathlib import Path
from typing import Any

import pytest

# 保证 `pytest -q` 在项目根目录下能 import app（pytest.ini 里也配了 pythonpath = .）
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ===== 必须在 import app 之前设置 =====
_TMP_DIR = Path(tempfile.mkdtemp(prefix="deviceops-tests-"))
_TEST_DB_PATH = _TMP_DIR / "deviceops_test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH.as_posix()}"
os.environ["LOG_DIR"] = str(_TMP_DIR / "logs")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from fastapi.testclient import TestClient  # noqa: E402
from passlib.context import CryptContext  # noqa: E402

from app.core import security as security_module  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine, get_db  # noqa: E402
from app.main import app  # noqa: E402

# 降低 bcrypt 计算成本（测试中只关心逻辑，不关心哈希强度）
security_module.pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=4,
)

# 临时库建表
Base.metadata.create_all(bind=engine)


def _override_get_db() -> Generator[Any, None, None]:
    """让接口使用临时库的会话."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


# ==================== 基础 fixture ====================


@pytest.fixture(autouse=True)
def _isolate_database() -> Iterator[None]:
    """每个用例结束后清空所有表，保证用例之间互不影响."""

    yield
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture(scope="session", autouse=True)
def _cleanup_temp_files() -> Iterator[None]:
    """整个测试会话结束后删除临时目录（含临时库与临时日志）."""

    yield
    engine.dispose()
    # 关闭 logging handler，否则 Windows 下 logs/app.log 句柄未释放，目录删不掉
    logging.shutdown()
    shutil.rmtree(_TMP_DIR, ignore_errors=True)


@pytest.fixture
def client() -> Iterator[TestClient]:
    """FastAPI 测试客户端（会触发 lifespan）."""

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db() -> Iterator[Any]:
    """直连临时库的 Session，用于断言落库结果."""

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def unified() -> Callable[[Any], dict]:
    """断言响应体严格为 {code, message, data} 并返回该字典."""

    def _check(response: Any) -> dict:
        payload = response.json()
        assert isinstance(payload, dict), payload
        assert set(payload.keys()) == {"code", "message", "data"}, payload
        return payload

    return _check


# ==================== 用户 / 令牌 fixture ====================


@pytest.fixture
def register(client: TestClient) -> Callable[..., dict]:
    """注册用户并返回 data 字段."""

    def _register(
        username: str,
        password: str = "pass12345",
        role: str = "viewer",
    ) -> dict:
        resp = client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": password, "role": role},
        )
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]

    return _register


@pytest.fixture
def login_headers(client: TestClient) -> Callable[..., dict]:
    """登录并返回可直接用于请求的 Authorization 头."""

    def _login(username: str, password: str = "pass12345") -> dict:
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["data"]["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login


@pytest.fixture
def admin(client: TestClient, register, login_headers) -> dict:
    """管理员（admin）."""

    data = register("admin", "admin12345", "admin")
    return {
        "id": data["id"],
        "username": "admin",
        "role": "admin",
        "headers": login_headers("admin", "admin12345"),
    }


@pytest.fixture
def engineer(client: TestClient, register, login_headers) -> dict:
    """工程师（engineer）."""

    data = register("engineer", "engineer12345", "engineer")
    return {
        "id": data["id"],
        "username": "engineer",
        "role": "engineer",
        "headers": login_headers("engineer", "engineer12345"),
    }


@pytest.fixture
def viewer(client: TestClient, register, login_headers) -> dict:
    """普通用户（viewer）."""

    data = register("viewer", "viewer12345", "viewer")
    return {
        "id": data["id"],
        "username": "viewer",
        "role": "viewer",
        "headers": login_headers("viewer", "viewer12345"),
    }


@pytest.fixture
def admin_headers(admin: dict) -> dict:
    """admin 令牌."""

    return admin["headers"]


@pytest.fixture
def engineer_headers(engineer: dict) -> dict:
    """engineer 令牌."""

    return engineer["headers"]


@pytest.fixture
def user_headers(viewer: dict) -> dict:
    """普通用户令牌."""

    return viewer["headers"]


# ==================== 业务数据 fixture ====================


@pytest.fixture
def device(client: TestClient, engineer: dict) -> dict:
    """一台在线设备."""

    resp = client.post(
        "/api/v1/devices",
        headers=engineer["headers"],
        json={
            "device_no": "DEV-1001",
            "model": "GT06N",
            "status": "online",
            "location": "京A12345",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]
