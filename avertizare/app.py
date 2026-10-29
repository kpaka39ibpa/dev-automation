from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

app = FastAPI(title="Meteoalarm Warning API")

# Разрешаем запросы из веб-интерфейса (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "data/meteo_warning_active.json"

@app.get("/api/warning")
def get_active_warnings():
    """Возвращает текущий активный JSON предупреждений"""
    if not os.path.exists(DATA_FILE):
        return {"warnings": [], "updated_at": None}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения файла: {str(e)}")

@app.post("/api/warning")
def save_warning(data: dict):
    """Сохраняет новый JSON предупреждений из редактора"""
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "Avertizare salvată cu succes!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {str(e)}")
