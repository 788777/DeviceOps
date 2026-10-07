"""认证模块测试：注册、登录、当前用户."""

from fastapi.testclient import TestClient


def test_register_success(client: TestClient, unified):
    """注册成功返回统一格式，且不泄漏密码字段."""

    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "alice", "password": "alice12345", "role": "viewer"},
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["code"] == 0
    assert payload["data"]["username"] == "alice"
    assert payload["data"]["role"] == "viewer"
    assert isinstance(payload["data"]["id"], int)
    assert "password" not in payload["data"]
    assert "hashed_password" not in payload["data"]


def test_register_duplicate_username_conflict(client: TestClient, register, unified):
    """用户名重复返回 409."""

    register("bob", "bob123456", "viewer")

    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "bob", "password": "bob123456", "role": "viewer"},
    )
    payload = unified(resp)

    assert resp.status_code == 409
    assert payload["code"] == 409
    assert payload["data"] is None


def test_register_rejects_short_password(client: TestClient, unified):
    """密码长度不足触发 422 校验错误."""

    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "carol", "password": "123", "role": "viewer"},
    )
    payload = unified(resp)

    assert resp.status_code == 422
    assert payload["code"] == 422
    assert isinstance(payload["data"], list)


def test_login_success_returns_wrapped_token(client: TestClient, register, unified):
    """登录成功：token 位于 data 中，根层级只有统一格式的三个键."""

    register("dave", "dave12345", "engineer")

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "dave", "password": "dave12345"},
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["code"] == 0
    assert payload["data"]["token_type"] == "bearer"
    assert payload["data"]["expires_in"] == 3600
    assert payload["data"]["user"]["role"] == "engineer"
    assert isinstance(payload["data"]["access_token"], str)
    # 严格统一格式：根层级不应再出现 access_token
    assert "access_token" not in payload


def test_login_wrong_password_unauthorized(client: TestClient, register, unified):
    """密码错误返回 401."""

    register("erin", "erin12345", "viewer")

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "erin", "password": "wrong-password"},
    )
    payload = unified(resp)

    assert resp.status_code == 401
    assert payload["code"] == 401
    assert payload["data"] is None
    assert resp.headers.get("WWW-Authenticate") == "Bearer"


def test_login_unknown_user_unauthorized(client: TestClient, unified):
    """用户不存在同样返回 401（不暴露用户是否存在）."""

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "nobody", "password": "nobody12345"},
    )
    payload = unified(resp)

    assert resp.status_code == 401
    assert payload["message"] == "用户名或密码错误"


def test_me_returns_current_user(client: TestClient, user_headers, unified):
    """/me 返回当前登录用户."""

    resp = client.get("/api/v1/auth/me", headers=user_headers)
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["username"] == "viewer"
    assert payload["data"]["role"] == "viewer"
    assert isinstance(payload["data"]["id"], int)


def test_me_without_token_unauthorized(client: TestClient, unified):
    """未带 token 访问 /me 返回 401."""

    resp = client.get("/api/v1/auth/me")
    payload = unified(resp)

    assert resp.status_code == 401
    assert payload["code"] == 401


def test_me_with_invalid_token_unauthorized(client: TestClient, unified):
    """伪造 token 返回 401."""

    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    payload = unified(resp)

    assert resp.status_code == 401
    assert payload["code"] == 401


def test_me_with_admin_token_role_is_admin(client: TestClient, admin_headers, unified):
    """admin token 解析出的角色为 admin."""

    resp = client.get("/api/v1/auth/me", headers=admin_headers)
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["role"] == "admin"


def test_oauth2_token_endpoint_is_swagger_bridge(client: TestClient, register):
    """隐藏的 /auth/token 保持 OAuth2 标准结构，供 Swagger Authorize 使用."""

    register("frank", "frank12345", "viewer")

    resp = client.post(
        "/api/v1/auth/token",
        data={"username": "frank", "password": "frank12345"},
    )
    body = resp.json()

    assert resp.status_code == 200
    assert set(body.keys()) == {"access_token", "token_type", "expires_in"}
