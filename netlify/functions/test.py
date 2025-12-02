import json

def handler(event, context):
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "message": "Hello from Python!",
            "event_path": event.get("path", ""),
            "event_method": event.get("httpMethod", "")
        })
    }
