"""设备模块测试：CRUD、分页搜索、权限."""

from fastapi.testclient import TestClient


def _create_device(client: TestClient, headers: dict, device_no: str, **overrides) -> dict:
    body = {"device_no": device_no, "model": "GT06N", "status": "online"}
    body.update(overrides)
    resp = client.post("/api/v1/devices", headers=headers, json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def test_create_device_success(client: TestClient, engineer_headers, unified):
    """工程师创建设备成功."""

    resp = client.post(
        "/api/v1/devices",
        headers=engineer_headers,
        json={
            "device_no": "DEV-2001",
            "model": "JT808",
            "status": "online",
            "location": "沪B88888",
        },
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["device_no"] == "DEV-2001"
    assert payload["data"]["status"] == "online"
    assert payload["data"]["location"] == "沪B88888"
    assert "created_at" in payload["data"]


def test_create_device_duplicate_no_conflict(client: TestClient, engineer_headers, device, unified):
    """设备编号重复返回 409."""

    resp = client.post(
        "/api/v1/devices",
        headers=engineer_headers,
        json={"device_no": device["device_no"], "model": "OTHER"},
    )
    payload = unified(resp)

    assert resp.status_code == 409
    assert payload["code"] == 409


def test_create_device_forbidden_for_viewer(client: TestClient, user_headers, unified):
    """viewer 无权创建设备."""

    resp = client.post(
        "/api/v1/devices",
        headers=user_headers,
        json={"device_no": "DEV-3001"},
    )
    payload = unified(resp)

    assert resp.status_code == 403
    assert payload["code"] == 403


def test_create_device_requires_authentication(client: TestClient, unified):
    """未登录不能创建设备."""

    resp = client.post("/api/v1/devices", json={"device_no": "DEV-3002"})
    payload = unified(resp)

    assert resp.status_code == 401
    assert payload["code"] == 401


def test_list_devices_pagination(client: TestClient, engineer_headers, user_headers, unified):
    """分页参数 size 生效，返回 total/pages."""

    for index in range(3):
        _create_device(client, engineer_headers, f"DEV-10{index}")

    resp = client.get("/api/v1/devices?page=1&size=2", headers=user_headers)
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["total"] == 3
    assert payload["data"]["page_size"] == 2
    assert payload["data"]["pages"] == 2
    assert len(payload["data"]["items"]) == 2

    resp2 = client.get("/api/v1/devices?page=2&size=2", headers=user_headers)
    assert len(unified(resp2)["data"]["items"]) == 1


def test_list_devices_keyword_search(client: TestClient, engineer_headers, user_headers, unified):
    """keyword 同时匹配 device_no 与 model."""

    _create_device(client, engineer_headers, "DEV-1001", model="GT06N")
    _create_device(client, engineer_headers, "DEV-2002", model="JT808")

    by_model = unified(client.get("/api/v1/devices?keyword=GT06N", headers=user_headers))
    assert by_model["data"]["total"] == 1
    assert by_model["data"]["items"][0]["device_no"] == "DEV-1001"

    by_no = unified(client.get("/api/v1/devices?keyword=2002", headers=user_headers))
    assert by_no["data"]["total"] == 1
    assert by_no["data"]["items"][0]["model"] == "JT808"


def test_list_devices_status_filter(client: TestClient, engineer_headers, user_headers, unified):
    """status 过滤生效."""

    _create_device(client, engineer_headers, "DEV-1001", status="online")
    _create_device(client, engineer_headers, "DEV-1002", status="fault")

    payload = unified(client.get("/api/v1/devices?status=fault", headers=user_headers))

    assert payload["data"]["total"] == 1
    assert payload["data"]["items"][0]["status"] == "fault"


def test_list_devices_invalid_status_rejected(client: TestClient, user_headers, unified):
    """非法 status 触发 422."""

    resp = client.get("/api/v1/devices?status=not-a-status", headers=user_headers)
    payload = unified(resp)

    assert resp.status_code == 422
    assert payload["code"] == 422


def test_get_device_detail_and_not_found(client: TestClient, user_headers, device, unified):
    """详情接口正常返回；不存在的 ID 返回 404."""

    payload = unified(client.get(f"/api/v1/devices/{device['id']}", headers=user_headers))
    assert payload["data"]["device_no"] == device["device_no"]

    missing = client.get("/api/v1/devices/99999", headers=user_headers)
    assert missing.status_code == 404
    assert unified(missing)["code"] == 404


def test_update_device_partial_fields(client: TestClient, engineer_headers, device, unified):
    """PUT 只更新传入字段，未传字段保持原值."""

    resp = client.put(
        f"/api/v1/devices/{device['id']}",
        headers=engineer_headers,
        json={"status": "maintenance", "location": "冀A00001"},
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["status"] == "maintenance"
    assert payload["data"]["location"] == "冀A00001"
    assert payload["data"]["device_no"] == device["device_no"]
    assert payload["data"]["model"] == device["model"]


def test_update_device_duplicate_no_conflict(client: TestClient, engineer_headers, device, unified):
    """改成已存在的设备编号返回 409."""

    other = _create_device(client, engineer_headers, "DEV-2002")

    resp = client.put(
        f"/api/v1/devices/{other['id']}",
        headers=engineer_headers,
        json={"device_no": device["device_no"]},
    )
    payload = unified(resp)

    assert resp.status_code == 409
    assert payload["code"] == 409


def test_delete_device_requires_admin(client: TestClient, engineer_headers, admin_headers, device, unified):
    """删除设备仅 admin 可操作，且删除后再查为 404."""

    forbidden = client.delete(f"/api/v1/devices/{device['id']}", headers=engineer_headers)
    assert forbidden.status_code == 403
    assert unified(forbidden)["code"] == 403

    ok = client.delete(f"/api/v1/devices/{device['id']}", headers=admin_headers)
    payload = unified(ok)
    assert ok.status_code == 200
    assert payload["data"]["id"] == device["id"]

    again = client.delete(f"/api/v1/devices/{device['id']}", headers=admin_headers)
    assert again.status_code == 404
