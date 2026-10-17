from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"

def test_expenses_endpoint_returns_list():
    response = client.get("/expenses")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_unknown_expense_returns_404():
    response = client.get("/expenses/99999999")
    assert response.status_code == 404
