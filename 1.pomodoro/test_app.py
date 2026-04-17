import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index_route(client):
    """Test the root route returns the index.html template."""
    response = client.get('/')
    assert response.status_code == 200
    assert b'<title>Pomodoro Timer</title>' in response.data