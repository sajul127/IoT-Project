import time
from datetime import datetime

from config import (
    USE_FIREBASE,
    FIREBASE_CREDENTIAL_PATH,
    FIREBASE_DATABASE_URL,
)

firebase_initialized = False
db = None


def init_firebase():
    """
    Firebase 초기화.
    USE_FIREBASE가 False면 실제 연결하지 않음.
    """
    global firebase_initialized
    global db

    if not USE_FIREBASE:
        print("[Firebase] USE_FIREBASE=False 상태입니다. 실제 전송은 하지 않습니다.")
        return False

    if firebase_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials
        from firebase_admin import db as firebase_db

        cred = credentials.Certificate(FIREBASE_CREDENTIAL_PATH)

        firebase_admin.initialize_app(cred, {
            "databaseURL": FIREBASE_DATABASE_URL
        })

        db = firebase_db
        firebase_initialized = True

        print("[Firebase] 초기화 완료")
        return True

    except Exception as e:
        print("[Firebase] 초기화 실패:", e)
        return False


def add_timestamp(result):
    """
    결과 데이터에 시간 정보 추가.
    """
    result = dict(result)

    result["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    result["timestampMs"] = int(time.time() * 1000)
    result["deviceId"] = "pi-001"

    return result


def send_event(result):
    """
    분석 결과를 Firebase로 전송.
    Firebase를 안 쓰는 상태면 콘솔에만 출력.
    """
    result = add_timestamp(result)

    if not USE_FIREBASE:
        print("[EVENT]", result)
        return True

    if not init_firebase():
        print("[Firebase] 연결 실패로 콘솔 출력만 수행")
        print("[EVENT]", result)
        return False

    try:
        # 현재 상태 저장
        db.reference("deviceStatus").set({
            "deviceId": result["deviceId"],
            "mode": result.get("mode"),
            "status": result.get("status"),
            "lastEvent": result.get("event"),
            "message": result.get("message"),
            "soundLevelDb": result.get("soundLevelDb"),
            "updatedAt": result.get("timestamp"),
        })

        # 이벤트 기록 저장
        if result.get("status") in ["warning", "danger"]:
            db.reference("events").push(result)

        print("[Firebase] 전송 완료:", result)
        return True

    except Exception as e:
        print("[Firebase] 전송 실패:", e)
        print("[EVENT]", result)
        return False