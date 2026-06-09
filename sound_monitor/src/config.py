# 분석 기본 설정
SAMPLE_RATE = 16000
CHUNK_SECONDS = 1.0

# 영유아 울음소리 감지 기준
BABY_VOLUME_DB_THRESHOLD = -30.0
BABY_HIGH_FREQ_RATIO_THRESHOLD = 1.05
BABY_CRY_CONTINUE_SECONDS = 1.0

# 울음소리로 볼 주파수 대역
BABY_CRY_LOW_FREQ = 1000
BABY_CRY_HIGH_FREQ = 5000

# 독거노인 무활동 감지 기준
ELDERLY_SILENCE_DB_THRESHOLD = -45.0

# 시연용: 10초
# 실제 서비스라면 1~3시간 등으로 늘리면 됨
ELDERLY_MAX_SILENCE_SECONDS = 10

# Firebase 사용 여부
USE_FIREBASE = True

# Firebase 설정
# 사용할 경우 firebase_key.json 파일 경로와 DB URL 넣기
FIREBASE_CREDENTIAL_PATH = "/home/pi/Project/iot-project-44b26-firebase-adminsdk-fbsvc-736c6dfd91.json"
FIREBASE_DATABASE_URL = "https://iot-project-44b26-default-rtdb.firebaseio.com/"