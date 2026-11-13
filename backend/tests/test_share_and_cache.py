import io
from datetime import datetime, timedelta

from app import create_app, db
from app.models import User, StoredFile


def make_client():
    app = create_app()
    app.config.update(TESTING=True)
    with app.app_context():
        db.drop_all()
        db.create_all()
    return app.test_client()


def test_http_requests_are_logged(caplog):
    client = make_client()
    with caplog.at_level('INFO'):
        response = client.get('/api/health')

    assert response.status_code == 200
    assert 'http_request method=GET endpoint=api.health status=200' in caplog.text


def test_swagger_docs_and_openapi_spec_are_available():
    client = make_client()

    docs = client.get('/api/docs/')
    spec = client.get('/api/openapi.json')

    assert docs.status_code == 200
    assert b'SwaggerUIBundle' in docs.data
    assert spec.status_code == 200
    assert spec.get_json()['openapi'] == '3.0.3'


def test_logout_requires_csrf_token_rotated_after_register():
    client = make_client()
    initial_csrf = client.get('/api/auth/csrf').get_json()['csrfToken']
    registered = client.post(
        '/api/auth/register',
        json={'email': 'logout@example.com', 'password': 'senha123'},
        headers={'X-CSRF-Token': initial_csrf},
    )
    assert registered.status_code == 201

    stale_logout = client.post('/api/auth/logout', headers={'X-CSRF-Token': initial_csrf})
    assert stale_logout.status_code == 403

    current_csrf = client.get('/api/auth/csrf').get_json()['csrfToken']
    logout = client.post('/api/auth/logout', headers={'X-CSRF-Token': current_csrf})
    assert logout.status_code == 204


def test_share_link_and_cache_headers():
    client = make_client()

    csrf = client.get('/api/auth/csrf').get_json()['csrfToken']
    resp = client.post('/api/auth/register', json={'email': 'share@example.com', 'password': 'senha123'}, headers={'X-CSRF-Token': csrf})
    assert resp.status_code == 201, resp.get_data(as_text=True)

    csrf = client.get('/api/auth/csrf').get_json()['csrfToken']
    file_bytes = b'hello world from shared file\n'
    resp = client.post('/api/files', data={'file': (io.BytesIO(file_bytes), 'note.txt')}, content_type='multipart/form-data', headers={'X-CSRF-Token': csrf})
    assert resp.status_code == 201, resp.get_data(as_text=True)
    file_id = resp.get_json()['file']['id']

    resp = client.post(f'/api/files/{file_id}/share', json={'expiresInMinutes': 30}, headers={'X-CSRF-Token': csrf})
    assert resp.status_code == 200, resp.get_data(as_text=True)
    payload = resp.get_json()
    assert 'token' in payload and 'url' in payload
    token = payload['token']
    assert payload['url'] == f'/api/share/{token}'

    resp = client.get(f'/api/share/{token}')
    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert resp.data == file_bytes
    assert 'max-age' in resp.headers.get('Cache-Control', '').lower()


def test_expired_share_link_is_rejected():
    client = make_client()

    csrf = client.get('/api/auth/csrf').get_json()['csrfToken']
    resp = client.post('/api/auth/register', json={'email': 'expired@example.com', 'password': 'senha123'}, headers={'X-CSRF-Token': csrf})
    assert resp.status_code == 201, resp.get_data(as_text=True)

    csrf = client.get('/api/auth/csrf').get_json()['csrfToken']
    file_bytes = b'expired example\n'
    resp = client.post('/api/files', data={'file': (io.BytesIO(file_bytes), 'a.txt')}, content_type='multipart/form-data', headers={'X-CSRF-Token': csrf})
    assert resp.status_code == 201, resp.get_data(as_text=True)
    file_id = resp.get_json()['file']['id']

    share = client.post(f'/api/files/{file_id}/share', json={'expiresInMinutes': 0}, headers={'X-CSRF-Token': csrf})
    assert share.status_code == 200, share.get_data(as_text=True)
    token = share.get_json()['token']

    expired = client.get(f'/api/share/{token}')
    assert expired.status_code == 410, expired.get_data(as_text=True)
