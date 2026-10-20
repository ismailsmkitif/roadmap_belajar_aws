import os
import json
import pytest
import boto3
from moto import mock_aws

# Set environment variable sebelum impor handler
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['TABLE_NAME'] = 'todos-test'

from src.app import lambda_handler, table

@pytest.fixture
def dynamodb_setup():
    """Setup mock DynamoDB table menggunakan moto."""
    with mock_aws():
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        mock_table = dynamodb.create_table(
            TableName='todos-test',
            KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST'
        )
        import src.app
        src.app.table = mock_table
        yield mock_table

def test_console_direct_test_event():
    """Uji event langsung dari AWS Console (Hari 1)."""
    event = {'action': 'ping'}
    class MockContext:
        aws_request_id = 'test-request-id-123'
        memory_limit_in_mb = '128'

    response = lambda_handler(event, MockContext())
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'Halo dari AWS Lambda Python 3.12!' in body['message']
    assert body['requestId'] == 'test-request-id-123'

def test_create_and_get_todo(dynamodb_setup):
    """Uji membuat Todo (POST /todos) dan mengambilnya kembali (GET /todos/{id})."""
    create_event = {
        'routeKey': 'POST /todos',
        'body': json.dumps({
            'title': 'Belajar Serverless AWS',
            'description': 'Praktik Lambda dan DynamoDB di Learner Lab'
        })
    }
    create_res = lambda_handler(create_event, None)
    assert create_res['statusCode'] == 201
    created_item = json.loads(create_res['body'])['data']
    todo_id = created_item['id']
    assert created_item['title'] == 'Belajar Serverless AWS'
    assert created_item['completed'] is False

    get_event = {
        'routeKey': 'GET /todos/{id}',
        'pathParameters': {'id': todo_id}
    }
    get_res = lambda_handler(get_event, None)
    assert get_res['statusCode'] == 200
    fetched_item = json.loads(get_res['body'])['data']
    assert fetched_item['id'] == todo_id
    assert fetched_item['title'] == 'Belajar Serverless AWS'

def test_list_todos(dynamodb_setup):
    """Uji listing semua Todos (GET /todos)."""
    for title in ['Tugas 1', 'Tugas 2']:
        lambda_handler({
            'routeKey': 'POST /todos',
            'body': json.dumps({'title': title})
        }, None)

    list_event = {'routeKey': 'GET /todos'}
    res = lambda_handler(list_event, None)
    assert res['statusCode'] == 200
    body = json.loads(res['body'])
    assert body['count'] >= 2

def test_update_todo(dynamodb_setup):
    """Uji memperbarui Todo (PUT /todos/{id})."""
    create_res = lambda_handler({
        'routeKey': 'POST /todos',
        'body': json.dumps({'title': 'Belum Selesai', 'completed': False})
    }, None)
    todo_id = json.loads(create_res['body'])['data']['id']

    update_event = {
        'routeKey': 'PUT /todos/{id}',
        'pathParameters': {'id': todo_id},
        'body': json.dumps({'completed': True, 'title': 'Sudah Selesai'})
    }
    update_res = lambda_handler(update_event, None)
    assert update_res['statusCode'] == 200
    updated_data = json.loads(update_res['body'])['data']
    assert updated_data['completed'] is True
    assert updated_data['title'] == 'Sudah Selesai'

def test_delete_todo(dynamodb_setup):
    """Uji menghapus Todo (DELETE /todos/{id})."""
    create_res = lambda_handler({
        'routeKey': 'POST /todos',
        'body': json.dumps({'title': 'Item untuk dihapus'})
    }, None)
    todo_id = json.loads(create_res['body'])['data']['id']

    del_event = {
        'routeKey': 'DELETE /todos/{id}',
        'pathParameters': {'id': todo_id}
    }
    del_res = lambda_handler(del_event, None)
    assert del_res['statusCode'] == 200

    get_res = lambda_handler({'routeKey': 'GET /todos/{id}', 'pathParameters': {'id': todo_id}}, None)
    assert get_res['statusCode'] == 404

def test_create_todo_validation_error():
    """Uji validasi ketika field title tidak disertakan."""
    res = lambda_handler({
        'routeKey': 'POST /todos',
        'body': json.dumps({'description': 'Tanpa judul'})
    }, None)
    assert res['statusCode'] == 400
    body = json.loads(res['body'])
    assert "Field 'title' wajib diisi" in body['error']
