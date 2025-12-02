import sys
import os

# Adiciona o diretório atual ao path para encontrar o backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.main import handler
