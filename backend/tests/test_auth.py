def login(client, password="password"):
    return client.post("/api/login", json={"username": "user", "password": password})


def test_login_success_sets_session_cookie(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert "session" in response.cookies


def test_login_wrong_password_returns_401(client):
    response = login(client, password="wrong")
    assert response.status_code == 401
    assert "session" not in response.cookies


def test_login_missing_fields_returns_422(client):
    response = client.post("/api/login", json={"username": "user"})
    assert response.status_code == 422


def test_me_without_session_returns_401(client):
    assert client.get("/api/me").status_code == 401


def test_me_with_session(client):
    login(client)
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout_clears_session(client):
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401
