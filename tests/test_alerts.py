"""告警模块测试：创建、列表过滤、误报标记."""

from fastapi.testclient import TestClient


def _create_alert(client: TestClient, headers: dict, device_id: int, alert_type: str = "offline") -> dict:
    resp = client.post(
        "/api/v1/alerts",
        headers=headers,
        json={"device_id": device_id, "type": alert_type, "content": "测试告警"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def test_create_alert_success(client: TestClient, engineer_headers, device, unified):
    """engineer 可以上报告警，默认非误报."""

    resp = client.post(
        "/api/v1/alerts",
        headers=engineer_headers,
        json={"device_id": device["id"], "type": "overspeed", "content": "车速120km/h"},
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["type"] == "overspeed"
    assert payload["data"]["is_false_positive"] is False
    assert payload["data"]["device_id"] == device["id"]


def test_create_alert_missing_device_returns_404(client: TestClient, engineer_headers, unified):
    """设备不存在返回 404."""

    resp = client.post(
        "/api/v1/alerts",
        headers=engineer_headers,
        json={"device_id": 99999, "type": "offline"},
    )
    payload = unified(resp)

    assert resp.status_code == 404
    assert payload["message"] == "关联设备不存在"


def test_create_alert_forbidden_for_viewer(client: TestClient, user_headers, device, unified):
    """viewer 不能上报告警."""

    resp = client.post(
        "/api/v1/alerts",
        headers=user_headers,
        json={"device_id": device["id"], "type": "offline"},
    )
    payload = unified(resp)

    assert resp.status_code == 403
    assert payload["code"] == 403


def test_create_alert_invalid_type_rejected(client: TestClient, engineer_headers, device, unified):
    """非法告警类型触发 422."""

    resp = client.post(
        "/api/v1/alerts",
        headers=engineer_headers,
        json={"device_id": device["id"], "type": "not-a-type"},
    )
    payload = unified(resp)

    assert resp.status_code == 422
    assert payload["code"] == 422
    assert isinstance(payload["data"], list)


def test_list_alerts_filters(client: TestClient, engineer_headers, user_headers, device, unified):
    """按 device_id / type / is_false_positive 过滤."""

    _create_alert(client, engineer_headers, device["id"], "offline")
    _create_alert(client, engineer_headers, device["id"], "overspeed")

    all_alerts = unified(client.get("/api/v1/alerts", headers=user_headers))
    assert all_alerts["data"]["total"] == 2

    by_type = unified(
        client.get("/api/v1/alerts?type=offline", headers=user_headers)
    )
    assert by_type["data"]["total"] == 1
    assert by_type["data"]["items"][0]["type"] == "offline"

    by_device = unified(
        client.get(f"/api/v1/alerts?device_id={device['id']}", headers=user_headers)
    )
    assert by_device["data"]["total"] == 2

    effective = unified(
        client.get("/api/v1/alerts?is_false_positive=false", headers=user_headers)
    )
    assert effective["data"]["total"] == 2

    by_missing_device = unified(
        client.get("/api/v1/alerts?device_id=99999", headers=user_headers)
    )
    assert by_missing_device["data"]["total"] == 0


def test_list_alerts_pagination(client: TestClient, engineer_headers, user_headers, device, unified):
    """分页参数生效."""

    for _ in range(3):
        _create_alert(client, engineer_headers, device["id"])

    payload = unified(
        client.get("/api/v1/alerts?page=1&size=2", headers=user_headers)
    )

    assert payload["data"]["total"] == 3
    assert payload["data"]["pages"] == 2
    assert len(payload["data"]["items"]) == 2


def test_mark_false_positive_and_rollback(
    client: TestClient, engineer_headers, user_headers, device, unified
):
    """标记误报后可撤销."""

    alert = _create_alert(client, engineer_headers, device["id"])

    marked = client.patch(
        f"/api/v1/alerts/{alert['id']}/false-positive",
        headers=engineer_headers,
        json={"is_false_positive": True},
    )
    assert marked.status_code == 200
    assert unified(marked)["data"]["is_false_positive"] is True

    filtered = unified(
        client.get("/api/v1/alerts?is_false_positive=true", headers=user_headers)
    )
    assert filtered["data"]["total"] == 1

    # 请求体省略 is_false_positive 时默认标记为误报
    default_body = client.patch(
        f"/api/v1/alerts/{alert['id']}/false-positive",
        headers=engineer_headers,
        json={},
    )
    assert unified(default_body)["data"]["is_false_positive"] is True

    rolled_back = client.patch(
        f"/api/v1/alerts/{alert['id']}/false-positive",
        headers=engineer_headers,
        json={"is_false_positive": False},
    )
    assert unified(rolled_back)["data"]["is_false_positive"] is False


def test_mark_false_positive_forbidden_for_viewer(
    client: TestClient, engineer_headers, user_headers, device, unified
):
    """viewer 不能标记误报."""

    alert = _create_alert(client, engineer_headers, device["id"])

    resp = client.patch(
        f"/api/v1/alerts/{alert['id']}/false-positive",
        headers=user_headers,
        json={"is_false_positive": True},
    )
    payload = unified(resp)

    assert resp.status_code == 403
    assert payload["code"] == 403


def test_mark_false_positive_missing_alert_returns_404(
    client: TestClient, engineer_headers, unified
):
    """告警不存在返回 404."""

    resp = client.patch(
        "/api/v1/alerts/99999/false-positive",
        headers=engineer_headers,
        json={"is_false_positive": True},
    )
    payload = unified(resp)

    assert resp.status_code == 404
    assert payload["message"] == "告警不存在"
