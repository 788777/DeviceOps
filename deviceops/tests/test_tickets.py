"""工单模块测试：创建、指派、状态流转、评论."""

from fastapi.testclient import TestClient


def _create_ticket(client: TestClient, headers: dict, device_id: int, **overrides) -> dict:
    body = {
        "title": "设备离线告警",
        "description": "30分钟无定位",
        "device_id": device_id,
        "priority": "high",
    }
    body.update(overrides)
    resp = client.post("/api/v1/tickets", headers=headers, json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _patch_status(client: TestClient, headers: dict, ticket_id: int, status: str):
    return client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        headers=headers,
        json={"status": status},
    )


def test_create_ticket_defaults_to_pending(client: TestClient, viewer, device, unified):
    """新建工单状态固定 pending，创建人为当前用户."""

    resp = client.post(
        "/api/v1/tickets",
        headers=viewer["headers"],
        json={"title": "设备离线", "device_id": device["id"], "priority": "urgent"},
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["status"] == "pending"
    assert payload["data"]["creator_id"] == viewer["id"]
    assert payload["data"]["assignee_id"] is None
    assert payload["data"]["priority"] == "urgent"


def test_create_ticket_missing_device_returns_404(client: TestClient, viewer, unified):
    """关联设备不存在返回 404."""

    resp = client.post(
        "/api/v1/tickets",
        headers=viewer["headers"],
        json={"title": "坏设备", "device_id": 99999},
    )
    payload = unified(resp)

    assert resp.status_code == 404
    assert payload["message"] == "关联设备不存在"


def test_create_ticket_missing_assignee_returns_404(client: TestClient, viewer, device, unified):
    """负责人不存在返回 404."""

    resp = client.post(
        "/api/v1/tickets",
        headers=viewer["headers"],
        json={"title": "坏负责人", "device_id": device["id"], "assignee_id": 99999},
    )
    payload = unified(resp)

    assert resp.status_code == 404
    assert payload["message"] == "负责人不存在"


def test_assign_ticket_by_engineer(client: TestClient, viewer, engineer, device, unified):
    """engineer 可以指派工单."""

    ticket = _create_ticket(client, viewer["headers"], device["id"])

    resp = client.patch(
        f"/api/v1/tickets/{ticket['id']}/assign",
        headers=engineer["headers"],
        json={"assignee_id": engineer["id"]},
    )
    payload = unified(resp)

    assert resp.status_code == 200
    assert payload["data"]["assignee_id"] == engineer["id"]


def test_assign_ticket_forbidden_for_viewer(client: TestClient, viewer, device, unified):
    """viewer 不能指派工单."""

    ticket = _create_ticket(client, viewer["headers"], device["id"])

    resp = client.patch(
        f"/api/v1/tickets/{ticket['id']}/assign",
        headers=viewer["headers"],
        json={"assignee_id": viewer["id"]},
    )
    payload = unified(resp)

    assert resp.status_code == 403
    assert payload["code"] == 403


def test_assign_ticket_to_missing_user_returns_404(
    client: TestClient, viewer, engineer, device, unified
):
    """指派给不存在的用户返回 404."""

    ticket = _create_ticket(client, viewer["headers"], device["id"])

    resp = client.patch(
        f"/api/v1/tickets/{ticket['id']}/assign",
        headers=engineer["headers"],
        json={"assignee_id": 99999},
    )
    payload = unified(resp)

    assert resp.status_code == 404
    assert payload["message"] == "负责人不存在"


def test_status_flow_happy_path(client: TestClient, viewer, engineer, device, unified):
    """完整流转：pending -> processing -> resolved -> closed."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )

    for expected in ("processing", "resolved", "closed"):
        resp = _patch_status(client, engineer["headers"], ticket["id"], expected)
        payload = unified(resp)
        assert resp.status_code == 200, resp.text
        assert payload["data"]["status"] == expected


def test_status_cannot_skip_steps(client: TestClient, viewer, engineer, device, unified):
    """禁止跳级：pending -> resolved."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )

    resp = _patch_status(client, engineer["headers"], ticket["id"], "resolved")
    payload = unified(resp)

    assert resp.status_code == 400
    assert "非法状态流转" in payload["message"]
    assert "processing" in payload["message"]


def test_status_cannot_go_backwards(client: TestClient, viewer, engineer, device, unified):
    """禁止回退：processing -> pending."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )
    _patch_status(client, engineer["headers"], ticket["id"], "processing")

    resp = _patch_status(client, engineer["headers"], ticket["id"], "pending")
    payload = unified(resp)

    assert resp.status_code == 400
    assert "非法状态流转" in payload["message"]


def test_status_same_state_rejected(client: TestClient, viewer, engineer, device, unified):
    """重复置为同一状态返回 400."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )

    resp = _patch_status(client, engineer["headers"], ticket["id"], "pending")
    payload = unified(resp)

    assert resp.status_code == 400
    assert "已是" in payload["message"]


def test_status_closed_is_final(client: TestClient, viewer, engineer, device, unified):
    """终态 closed 不能再流转."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )
    for state in ("processing", "resolved", "closed"):
        _patch_status(client, engineer["headers"], ticket["id"], state)

    resp = _patch_status(client, engineer["headers"], ticket["id"], "processing")
    payload = unified(resp)

    assert resp.status_code == 400
    assert "终态" in payload["message"]


def test_status_only_assignee_or_admin(client: TestClient, viewer, engineer, device, admin, unified):
    """非负责人不能改状态；admin 可以."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )

    # 创建人（viewer）不是负责人 -> 403
    forbidden = _patch_status(client, viewer["headers"], ticket["id"], "processing")
    assert forbidden.status_code == 403
    assert unified(forbidden)["code"] == 403

    # admin 越权放行
    allowed = _patch_status(client, admin["headers"], ticket["id"], "processing")
    assert allowed.status_code == 200
    assert unified(allowed)["data"]["status"] == "processing"


def test_list_tickets_filters(client: TestClient, viewer, engineer, device, unified):
    """按 status / priority / assignee_id 过滤."""

    pending = _create_ticket(client, viewer["headers"], device["id"], priority="high")
    assigned = _create_ticket(
        client,
        viewer["headers"],
        device["id"],
        priority="low",
        assignee_id=engineer["id"],
    )
    _patch_status(client, engineer["headers"], assigned["id"], "processing")

    by_status = unified(
        client.get("/api/v1/tickets?status=processing", headers=viewer["headers"])
    )
    assert by_status["data"]["total"] == 1
    assert by_status["data"]["items"][0]["id"] == assigned["id"]

    by_priority = unified(
        client.get("/api/v1/tickets?priority=high", headers=viewer["headers"])
    )
    assert by_priority["data"]["total"] == 1
    assert by_priority["data"]["items"][0]["id"] == pending["id"]

    by_assignee = unified(
        client.get(
            f"/api/v1/tickets?assignee_id={engineer['id']}", headers=viewer["headers"]
        )
    )
    assert by_assignee["data"]["total"] == 1

    by_device = unified(
        client.get(f"/api/v1/tickets?device_id={device['id']}", headers=viewer["headers"])
    )
    assert by_device["data"]["total"] == 2


def test_ticket_detail_includes_relations(client: TestClient, viewer, engineer, device, unified):
    """详情带出设备、创建人、负责人与评论."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )
    client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        headers=viewer["headers"],
        json={"content": "现场已联系"},
    )

    payload = unified(
        client.get(f"/api/v1/tickets/{ticket['id']}", headers=viewer["headers"])
    )
    data = payload["data"]

    assert data["device"]["device_no"] == device["device_no"]
    assert data["creator"]["username"] == viewer["username"]
    assert data["assignee"]["username"] == engineer["username"]
    assert len(data["comments"]) == 1


def test_comment_by_creator_and_assignee(client: TestClient, viewer, engineer, device, unified):
    """创建人与负责人都可以评论."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )

    first = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        headers=viewer["headers"],
        json={"content": "现场已联系"},
    )
    second = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        headers=engineer["headers"],
        json={"content": "已远程复位"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert unified(second)["data"]["user_id"] == engineer["id"]

    listing = unified(
        client.get(f"/api/v1/tickets/{ticket['id']}/comments", headers=viewer["headers"])
    )
    assert listing["data"]["total"] == 2
    assert [item["content"] for item in listing["data"]["items"]] == [
        "现场已联系",
        "已远程复位",
    ]


def test_comment_forbidden_for_unrelated_user(
    client: TestClient, viewer, engineer, register, login_headers, device, unified
):
    """既非创建人也非负责人的用户不能评论."""

    ticket = _create_ticket(
        client, viewer["headers"], device["id"], assignee_id=engineer["id"]
    )
    register("outsider", "outsider12345", "engineer")
    outsider_headers = login_headers("outsider", "outsider12345")

    resp = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        headers=outsider_headers,
        json={"content": "打酱油"},
    )
    payload = unified(resp)

    assert resp.status_code == 403
    assert payload["code"] == 403
