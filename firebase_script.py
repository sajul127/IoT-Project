import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import time
import datetime
import uuid
import soundfile as sf
import numpy as np
import sys
import os

# --- 경로 및 모듈 설정 ---
current_dir = os.path.dirname(os.path.abspath(__file__))
target_path = os.path.join(current_dir, 'sound_monitor', 'src')
sys.path.append(target_path)
from detector import BabyCryDetector, ElderlyNoActivityDetector

def get_device_id_from_mac():
    mac_address = uuid.getnode()
    return f"rpi_mac_{mac_address:x}"

DEVICE_ID = get_device_id_from_mac()

# --- 파이어베이스 초기화 ---
cred = credentials.Certificate("/home/pi/Project/iot-project-44b26-firebase-adminsdk-fbsvc-736c6dfd91.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://iot-project-44b26-default-rtdb.firebaseio.com/'
})

ref_realtime = db.reference('monitoring/device_10조_01')
ref_events = db.reference('device_events')
ref_settings = db.reference('monitoring/settings/mode')

baby_detector = BabyCryDetector()
elderly_detector = ElderlyNoActivityDetector()

print("🎙️ 실시간 음향 모니터링 및 파이어베이스 전송을 시작합니다...")

# =====================================================================
# 🌟 [추가됨] 모드별 테스트 오디오 파일 맵핑
# 실제 data 폴더에 있는 파일명으로 수정해 주세요.
# =====================================================================
MODE_AUDIO_FILES = {
    "baby": "baby_crying.wav",   # 영유아 모드일 때 틀어줄 시끄러운 파일
    "elderly": "silence.wav"  # 독거노인 모드일 때 틀어줄 조용한 파일
}

current_playing_mode = None
audio_data = None
sample_rate = 44100
chunk_size = 1024
chunk_index = 0
total_chunks = 0

while True:
    try:
        # 1. 매 순간 웹에서 설정한 모드 확인
        current_mode = ref_settings.get()
        if current_mode is None:
            current_mode = "baby"
            ref_settings.set(current_mode)

        # 2. 웹에서 모드를 변경했다면? -> 오디오 파일을 즉각 교체!
        if current_playing_mode != current_mode:
            wav_file_name = MODE_AUDIO_FILES.get(current_mode, "silence.wav")
            wav_path = os.path.join(current_dir, 'sound_monitor', 'data', wav_file_name)
            
            print(f"\n🔄 [웹 제어 감지] 모드 전환: {current_playing_mode} ➔ {current_mode}")
            
            try:
                # 새 오디오 파일 로드
                audio_data, sample_rate = sf.read(wav_path)
                total_chunks = len(audio_data) // chunk_size
                chunk_index = 0 # 파일 처음부터 다시 재생
                current_playing_mode = current_mode
                print(f"✅ 테스트 사운드 교체 완료: {wav_file_name}\n")
            except FileNotFoundError:
                print(f"❌ 에러: {wav_path} 파일이 없습니다. data 폴더를 확인하세요.")
                # 파일이 없을 경우 강제로 무음 배열 생성 (에러 방지용)
                audio_data = np.zeros(chunk_size * 10)
                total_chunks = 10
                chunk_index = 0
                current_playing_mode = current_mode

        # 3. 현재 로드된 파일에서 1024개씩 소리 조각(Chunk) 가져오기
        audio_chunk = audio_data[chunk_index * chunk_size : (chunk_index + 1) * chunk_size]
        if len(audio_chunk.shape) > 1:
            audio_chunk = audio_chunk[:, 0]

        # 4. 분석기 실행
        if current_mode == "baby":
            result = baby_detector.analyze_chunk(sample_rate, audio_chunk)
        else:
            result = elderly_detector.analyze_chunk(sample_rate, audio_chunk)
        
        # 5. 상태값 통역
        if result["status"] == "danger":
            current_status = "Emergency"
        elif result["status"] == "warning":
            current_status = "Warning"
        else:
            current_status = "Normal"

        current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 6. 파이어베이스 전송 (웹 대시보드 반영)
        realtime_data = {
            "status": current_status,
            "mode": result["mode"],
            "message": result["message"],
            "timestamp": current_time,
            "soundLevelDb": result.get("soundLevelDb", 0)
        }
        ref_realtime.update(realtime_data) 

        # 로그 출력 (너무 빠르게 올라가는 것을 방지하기 위해 Emergency일 때나 특정 주기로 출력 가능)
        print(f"[{current_time}] [모드: {current_mode}] 상태: {current_status} | {result['message']} | {result.get('soundLevelDb', 0)}dB")

        # 7. 파일의 끝에 도달하면 무한 반복 재생하도록 인덱스 리셋
        chunk_index += 1
        if chunk_index >= total_chunks:
            chunk_index = 0

        # 실제 재생 속도 동기화
        time.sleep(chunk_size / sample_rate)

    except Exception as e:
        print(f"❌ 실행 중 오류 발생: {e}")
        time.sleep(2)