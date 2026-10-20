import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError

# Konfigurasi DynamoDB Table
TABLE_NAME = os.environ.get('TABLE_NAME', 'todos')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

def build_response(status_code, body):
    """Membangun HTTP response yang kompatibel dengan API Gateway v2 dan CORS."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        'body': json.dumps(body)
    }

def lambda_handler(event, context):
    """
    Handler utama AWS Lambda (Python 3.12).
    Mendukung event HTTP API Gateway Payload v2.0 serta direct test event dari AWS Console.
    """
    print("Received event:", json.dumps(event))

    # Dukungan Pengujian Hari 1 (Direct Console Test Event tanpa API Gateway)
    if not event or 'routeKey' not in event:
        action = event.get('action', 'test') if isinstance(event, dict) else 'test'
        req_id = getattr(context, 'aws_request_id', 'local-test-id')
        mem_limit = getattr(context, 'memory_limit_in_mb', '128')
        
        return build_response(200, {
            'message': 'Halo dari AWS Lambda Python 3.12! Fungsi berjalan sukses.',
            'testAction': action,
            'requestId': req_id,
            'memoryLimitMB': mem_limit,
            'targetTable': TABLE_NAME,
            'status': 'READY_FOR_DYNAMODB'
        })

    route_key = event.get('routeKey', '')
    path_params = event.get('pathParameters') or {}
    
    # Parse Request Body jika ada
    body_data = {}
    raw_body = event.get('body')
    if raw_body:
        try:
            body_data = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        except json.JSONDecodeError:
            return build_response(400, {'error': 'Format body bukan JSON yang valid'})

    try:
        # 1. CREATE: POST /todos
        if route_key == 'POST /todos':
            title = body_data.get('title')
            if not title:
                return build_response(400, {'error': "Field 'title' wajib diisi"})

            todo_id = str(uuid.uuid4())
            now_iso = datetime.now(timezone.utc).isoformat()
            item = {
                'id': todo_id,
                'title': title,
                'description': body_data.get('description', ''),
                'completed': bool(body_data.get('completed', False)),
                'createdAt': now_iso,
                'updatedAt': now_iso
            }
            table.put_item(Item=item)
            return build_response(201, {'message': 'Todo berhasil dibuat', 'data': item})

        # 2. LIST: GET /todos
        elif route_key == 'GET /todos':
            response = table.scan(Limit=50)
            items = response.get('Items', [])
            return build_response(200, {'count': len(items), 'data': items})

        # 3. GET SINGLE: GET /todos/{id}
        elif route_key == 'GET /todos/{id}':
            todo_id = path_params.get('id')
            if not todo_id:
                return build_response(400, {'error': 'Parameter id diperlukan'})

            response = table.get_item(Key={'id': todo_id})
            item = response.get('Item')
            if not item:
                return build_response(404, {'error': f"Todo dengan id '{todo_id}' tidak ditemukan"})
            return build_response(200, {'data': item})

        # 4. UPDATE: PUT /todos/{id}
        elif route_key == 'PUT /todos/{id}':
            todo_id = path_params.get('id')
            if not todo_id:
                return build_response(400, {'error': 'Parameter id diperlukan'})

            # Pastikan item ada terlebih dahulu
            existing = table.get_item(Key={'id': todo_id}).get('Item')
            if not existing:
                return build_response(404, {'error': f"Todo dengan id '{todo_id}' tidak ditemukan"})

            title = body_data.get('title', existing['title'])
            description = body_data.get('description', existing.get('description', ''))
            completed = body_data.get('completed', existing.get('completed', False))
            now_iso = datetime.now(timezone.utc).isoformat()

            response = table.update_item(
                Key={'id': todo_id},
                UpdateExpression="SET title = :t, description = :d, completed = :c, updatedAt = :u",
                ExpressionAttributeValues={
                    ':t': title,
                    ':d': description,
                    ':c': completed,
                    ':u': now_iso
                },
                ReturnValues="ALL_NEW"
            )
            return build_response(200, {'message': 'Todo berhasil diperbarui', 'data': response.get('Attributes')})

        # 5. DELETE: DELETE /todos/{id}
        elif route_key == 'DELETE /todos/{id}':
            todo_id = path_params.get('id')
            if not todo_id:
                return build_response(400, {'error': 'Parameter id diperlukan'})

            table.delete_item(Key={'id': todo_id})
            return build_response(200, {'message': f"Todo '{todo_id}' berhasil dihapus"})

        else:
            return build_response(404, {'error': f"Route '{route_key}' tidak ditemukan"})

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        print(f"DynamoDB ClientError [{error_code}]: {error_msg}")
        return build_response(500, {'error': 'Database Error', 'code': error_code, 'message': error_msg})
    except Exception as e:
        print(f"Unhandled Exception: {str(e)}")
        return build_response(500, {'error': 'Internal Server Error', 'details': str(e)})
