import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import time
import datetime

# 1. Firebase 서비스 계정 키 (비공개 키) 로드
cred = credentials.Certificate("/home/pi/Project/iot-project-44b26-firebase-adminsdk-fbsvc-736c6dfd91.json")

# 2. Firebase 앱 초기화
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://iot-project-44b26-default-rtdb.firebaseio.com/'
})

# 3. 데이터를 전송할 정확한 경로(Node) 지정

ref = db.reference('monitoring/device_10조_01')

print("🚨 [테스트] 클라우드로 긴급(Emergency) 데이터를 전송합니다...")

# 4. 전송할 가짜(Mock) 데이터 생성
# status가 'Emergency'여야 웹 브라우저 알림이 작동합니다.
mock_data = {
    'status': 'Emergency',
    'mode': 'Active',
    'message': '고주파 울음소리 감지됨 (테스트)',
    'timestamp': str(datetime.datetime.now())
}

# 5. 파이어베이스로 데이터 덮어쓰기(업데이트)
ref.update(mock_data)

print("✅ 전송 완료! 웹 브라우저 대시보드를 확인하세요.")