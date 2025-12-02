import sys
import os
import json

# Adiciona o diretório atual ao path para encontrar o backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.main import handler
except Exception as e:
    def handler(event, context):
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e),
                "type": str(type(e)),
                "sys_path": sys.path,
                "cwd": os.getcwd(),
                "files": os.listdir(".")
            })
        }
