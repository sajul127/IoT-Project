import atexit
import datetime as dt
import os
import threading
import time
import uuid
from collections import deque

import numpy as np
import sounddevice as sd
import soundfile as sf
import RPi.GPIO as GPIO
from flask import Flask, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit

# sound_monitor/src 경로를 추가하여 AIAudioDetector를 불러옵니다.
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "sound_monitor", "src"))
try:
    from detector import AIAudioDetector
except Exception as exc:
    AIAudioDetector = None
    print(f"⚠️ AIAudioDetector import 실패: {exc}")

try:
    import firebase_admin
    from firebase_admin import credentials
    from firebase_admin import db
except ImportError:
    firebase_admin = None
    credentials = None
    db = None


app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

BUZZER = 21
BUTTON = 17
WARNING_DISTANCE_CM = 30

FIREBASE_KEY_PATH = os.path.join(
    os.path.dirname(__file__),
    "serviceAccountKey.json",
)
FIREBASE_DB_URL = "https://iot-project-44b26-default-rtdb.firebaseio.com/"
FIREBASE_REF_PATH = "monitoring/device_10조_01"
FIREBASE_SETTINGS_MODE_PATH = "monitoring/settings/mode"

firebase_ref = None
firebase_settings_mode_ref = None
firebase_ready = False

state_lock = threading.Lock()
state = {
      "status": "safe",
      "sos": False,
      "alertSource": None,
      "soundStatus": "Normal",
      "soundMessage": "",
      "soundLevelDb": 0,
      "mode": "baby",
      "acknowledged": True,
      "message": "초기화 중",
      "updatedAt": None,
      "babyCryDetected": False,
      "babyCryScore": 0, 
      "elderlySilent": False,
  }
pwm = None
alarm_on = False
running = True
last_published_snapshot = None
last_emitted_snapshot = None

# Microphone settings
MIC_DEVICE = 0  # Google Voice HAT (hw:2,0)
MIC_SAMPLE_RATE = 48000
MIC_CHANNELS = 2  # 스테레오 (두 개의 채널)
MIC_BLOCK_SIZE = 4096

mic_stream = None
sound_level_buffer = deque(maxlen=10)  # 최근 10개 샘플의 평균

# 소리 기반 SOS 감지를 사용할지 여부
USE_SOUND_SOS = True

detector = None


def get_device_id_from_mac():
    mac_address = uuid.getnode()
    return f"rpi_mac_{mac_address:x}"


DEVICE_ID = get_device_id_from_mac()


def setup_gpio():
    global pwm

    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)

        GPIO.setup(BUZZER, GPIO.OUT)
        GPIO.setup(BUTTON, GPIO.IN, pull_up_down=GPIO.PUD_UP)

        pwm = GPIO.PWM(BUZZER, 1000)
        time.sleep(0.2)

        print("✅ GPIO 초기화 완료")
        return True

    except Exception as e:
        print(f"⚠️ GPIO 초기화 실패: {e}")
        pwm = None
        return False


def setup_firebase():
    global firebase_ref, firebase_settings_mode_ref, firebase_ready

    if firebase_admin is None:
        firebase_ready = False
        firebase_ref = None
        firebase_settings_mode_ref = None
        print("Firebase Admin SDK가 설치되어 있지 않습니다.")
        return

    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(FIREBASE_KEY_PATH)
            firebase_admin.initialize_app(cred, {
                "databaseURL": FIREBASE_DB_URL,
            })

        firebase_ref = db.reference(FIREBASE_REF_PATH)
        firebase_settings_mode_ref = db.reference(FIREBASE_SETTINGS_MODE_PATH)
        firebase_ready = True
    except Exception as exc:
        firebase_ready = False
        firebase_ref = None
        firebase_settings_mode_ref = None
        print(f"Firebase 초기화 실패: {exc}")





def set_buzzer(on):
    global alarm_on

    if pwm is None:
        return

    if on and not alarm_on:
        pwm.start(50)
        alarm_on = True
    elif not on and alarm_on:
        pwm.stop()
        alarm_on = False


def update_state():
    with state_lock:

        if state["sos"]:

            if state.get("alertSource") == "button":
                state["status"] = "sos"
                state["message"] = "SOS 버튼이 눌렸습니다."

            elif state.get("alertSource") == "baby_cry":
                state["status"] = "Emergency"
                # AI가 넣은 message 유지
                # ex) "👶 아기 울음 감지!"

            else:
                state["status"] = "sos"

        else:
            state["status"] = "safe"
            state["message"] = "안전 상태입니다."
            state["alertSource"] = None

        state["updatedAt"] = dt.datetime.now().isoformat(timespec="seconds")

def snapshot_state():
    with state_lock:
        return dict(state)


def emit_status(force=False):
    global last_emitted_snapshot

    current_state = snapshot_state()
    if not force and current_state == last_emitted_snapshot:
        return

    socketio.emit("status", current_state)
    last_emitted_snapshot = current_state


def refresh_firebase_state():
    if not firebase_ready or firebase_ref is None:
        return

    try:
        firebase_data = firebase_ref.get()
        current_mode = (
            firebase_settings_mode_ref.get()
            if firebase_settings_mode_ref is not None
            else None
        )

        if not firebase_data and current_mode is None:
            return

        with state_lock:
            if current_mode in {"baby", "elderly"}:
                state["mode"] = current_mode
    except Exception as exc:
        print(f"Firebase 상태 조회 실패: {exc}")


def publish_to_firebase():
    global last_published_snapshot

    if not firebase_ready or firebase_ref is None:
        return

    current_state = snapshot_state()
    firebase_status = "Normal"
    if current_state["status"] in {"sos", "warning", "error"}:
        firebase_status = "Emergency"

    publish_payload = {
    "status": firebase_status,
    "mode": "Active" if current_state["status"] != "safe" else "Standby",
    "message": current_state["message"],
    "timestamp": current_state["updatedAt"],
    "sos": current_state["sos"],
    "acknowledged": current_state["acknowledged"],
    "deviceId": DEVICE_ID,

    # 추가
    "soundLevelDb": current_state["soundLevelDb"],
    "soundStatus": current_state["soundStatus"],
    "soundMessage": current_state["soundMessage"],
    "alertSource": current_state["alertSource"],
    }

    if publish_payload == last_published_snapshot:
        return

    firebase_ref.update(publish_payload)
    last_published_snapshot = publish_payload


def handle_ai_event(status_code, payload):
      with state_lock:
          current_mode = state["mode"]

          if current_mode != "baby" and status_code in {"baby_cry", "warning"}:
              return

          if status_code == "baby_cry":
              state["babyCryDetected"] = True
              state["message"] = payload["message"]
              state["babyCryScore"] = payload["score"]
              state["acknowledged"] = False
              state["alertSource"] = "baby_cry"
              state["status"] = "Emergency"

          elif status_code == "warning":
              state["babyCryDetected"] = True
              state["status"] = "warning"
              state["message"] = payload["message"]

          elif status_code in {"sos", "elderly_silent"}:
              state["sos"] = True
              state["acknowledged"] = False
              state["alertSource"] = "elderly_silence" if status_code == "elderly_silent" else "button"
              state["status"] = "Emergency"
              state["message"] = payload["message"]

          state["updatedAt"] = dt.datetime.now().isoformat(timespec="seconds")


def firebase_loop():
    while running:
        try:
            if not firebase_ready:
                setup_firebase()

            publish_to_firebase()
            refresh_firebase_state()
            emit_status()
        except Exception as exc:
            print(f"Firebase 처리 중 오류 발생: {exc}")

        socketio.sleep(5)


def hardware_loop():
    global running

    gpio_available = setup_gpio()

    if not gpio_available:
        print("⚠️ GPIO 기능 없이 진행합니다...")
        

    last_button_state = GPIO.HIGH if gpio_available else None

    while running:
        try:
            if gpio_available:
                try:
                    current_button_state = GPIO.input(BUTTON)

                    if last_button_state == GPIO.HIGH and current_button_state == GPIO.LOW:
                        with state_lock:
                            state["sos"] = True
                            state["acknowledged"] = False
                            state["alertSource"] = "button"
                            state["status"] = "sos"
                            state["message"] = "SOS 버튼이 눌렸습니다."

                        print("SOS 버튼 눌림")

                    last_button_state = current_button_state
                except Exception as gpio_err:
                    print(f"⚠️ GPIO 읽기 오류: {gpio_err}")
                    gpio_available = False
            
            update_state()

            with state_lock:
                should_alarm = state["sos"] and not state["acknowledged"]

            if gpio_available:
                try:
                    set_buzzer(should_alarm)
                except Exception as buzzer_err:
                    print(f"⚠️ Buzzer 제어 오류: {buzzer_err}")
                    gpio_available = False
            
            emit_status()
            socketio.sleep(0.5)
        except Exception as e:
            print(f"⚠️ 하드웨어 루프 오류: {e}")
            time.sleep(1)


def audio_callback(indata, frames, time_info, status):
    if status.input_overflow:
        return

    # 🌟 [핵심 수정] 2채널(스테레오)로 들어온 데이터를 하나로 합칩니다.
    # INMP441은 한쪽 채널(L 또는 R)로만 소리가 들어오기 때문에, 
    # 이렇게 두 채널을 더해주면 무조건 소리가 있는 쪽의 데이터를 살릴 수 있습니다.
    mono_data = np.sum(indata, axis=1)

    # 1채널로 합쳐진 mono_data를 사용하여 RMS와 dB를 계산합니다.
    rms = np.sqrt(np.mean(mono_data**2))
    db = 20 * np.log10(max(rms, 1e-10))

    with state_lock:
        state["soundLevelDb"] = round(float(db), 2)

        if db > -20:
            state["soundStatus"] = "High"
            state["soundMessage"] = f"큰 소리: {db:.1f} dB"
        elif db > -40:
            state["soundStatus"] = "Normal"
            state["soundMessage"] = f"보통 소리: {db:.1f} dB"
        else:
            state["soundStatus"] = "Low"
            state["soundMessage"] = f"작은 소리: {db:.1f} dB"

    try:
        if USE_SOUND_SOS and detector is not None:
            # AI 감지기에도 합쳐진 mono_data를 전달합니다.
            detector.observe(mono_data, sample_rate=MIC_SAMPLE_RATE)
    except Exception as e:
        print(f"⚠️ detector.observe 호출 오류: {e}")
def setup_microphone():
    """
    Google Voice HAT + INMP441 마이크 초기화
    sounddevice 라이브러리 사용
    """
    global mic_stream
    try:
        print("\n=== 마이크 초기화 ===")
        print(f"디바이스: {MIC_DEVICE} (Google Voice HAT)")
        print(f"샘플레이트: {MIC_SAMPLE_RATE}Hz")
        print(f"채널: {MIC_CHANNELS}")
        
        # sounddevice 마이크 스트림 생성
        try:
            mic_stream = sd.InputStream(
                device=MIC_DEVICE,
                samplerate=MIC_SAMPLE_RATE,
                channels=MIC_CHANNELS,
                blocksize=MIC_BLOCK_SIZE,
                callback=audio_callback,
                latency='high'
            )
            mic_stream.start()
            print(f"✅ 마이크 스트림 준비 완료")
            return True
        except Exception as e:
            if "busy" in str(e).lower() or "cannot connect" in str(e).lower():
                print(f"⚠️ 마이크를 사용할 수 없음: {e}")
                print("   마이크 없이 다른 기능으로 진행합니다...")
                mic_stream = None
                return False
            else:
                raise
    except Exception as e:
        print(f"❌ 마이크 초기화 실패: {e}")
        import traceback
        traceback.print_exc()
        mic_stream = None
        return False


def microphone_loop():
    """
    마이크 입력 루프 (별도 스레드에서 실행)
    마이크가 점유 중이면 10초마다 재시도
    """
    mic_initialized = False
    retry_count = 0
    
    while running:
        try:
            # 마이크 미초기화 상태일 때
            if not mic_initialized:
                if setup_microphone():
                    mic_initialized = True
                    print("✅ 마이크 초기화 완료")
                    retry_count = 0
                else:
                    retry_count += 1
                    print(f"⚠️ 마이크 초기화 실패 (재시도: {retry_count}/...) - 10초 후 재시도")
                    time.sleep(10)
                    continue
            
            # 마이크 초기화됨 - 상태 발광
            if mic_stream is not None:
                emit_status()
            
            time.sleep(0.5)
        except Exception as e:
            print(f"마이크 루프 오류: {e}")
            mic_initialized = False
            time.sleep(0.5)


def cleanup_gpio():
    global running, mic_stream

    running = False

    if pwm is not None:
        pwm.stop()
    
    if mic_stream is not None:
        try:
            # sounddevice 스트림 종료
            mic_stream.stop()
            mic_stream.close()
        except Exception as e:
            print(f"마이크 스트림 종료 오류: {e}")

    GPIO.cleanup()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    refresh_firebase_state()
    return jsonify(snapshot_state())


@app.route("/api/acknowledge", methods=["POST"])
def acknowledge_api():
    acknowledge_alert()
    return jsonify({
        "success": True,
        "message": "SOS 확인 완료",
        "state": snapshot_state(),
    })


def acknowledge_alert():
    with state_lock:
        state["sos"] = False
        state["acknowledged"] = True
        state["alertSource"] = None
        state["status"] = "safe"
        state["message"] = "사용자가 경고를 확인했습니다."

    set_buzzer(False)
    emit_status(force=True)


def change_mode(new_mode):
    global detector

    if new_mode not in {"baby", "elderly"}:
        return False, "지원하지 않는 모드입니다."

    with state_lock:
        state["mode"] = new_mode

    # detector 내부 모드도 변경
    if detector is not None:
        detector.set_mode(new_mode)

    if firebase_ready and firebase_settings_mode_ref is not None:
        try:
            firebase_settings_mode_ref.set(new_mode)
        except Exception as exc:
            print(f"Firebase 모드 변경 실패: {exc}")
            return False, "Firebase 모드 변경에 실패했습니다."

    emit_status(force=True)
    return True, "모드 변경 완료"



@socketio.on("connect")
def handle_connect():
    refresh_firebase_state()
    emit("status", snapshot_state())


@socketio.on("acknowledge")
def handle_acknowledge():
    acknowledge_alert()
    emit("acknowledged", {
        "success": True,
        "message": "SOS 확인 완료",
    })


@socketio.on("change_mode")
def handle_change_mode(data):
    new_mode = data.get("mode") if isinstance(data, dict) else None
    success, message = change_mode(new_mode)
    emit("mode_changed", {
        "success": success,
        "message": message,
        "mode": new_mode,
    })


if __name__ == "__main__":
    # AIAudioDetector 초기화 (마이크 기반 AI 감지)
    if USE_SOUND_SOS and AIAudioDetector is not None:
        detector = AIAudioDetector(
        mode=state["mode"],
        trigger_callback=handle_ai_event,
        project_root="/home/pi/myvenv/Project"
        )
        detector.start()
        print("✅ AIAudioDetector가 활성화되었습니다.")
    elif USE_SOUND_SOS:
        print("⚠️ AIAudioDetector를 불러오지 못했습니다. AI 감지는 비활성화됩니다.")

    sensor_thread = threading.Thread(target=hardware_loop, daemon=True)
    firebase_thread = threading.Thread(target=firebase_loop, daemon=True)
    microphone_thread = threading.Thread(target=microphone_loop, daemon=True)
    sensor_thread.start()
    firebase_thread.start()
    microphone_thread.start()

    atexit.register(cleanup_gpio)
    
    socketio.run(
        app,
        host="100.114.255.109",
        port=5002,
        debug=False,
        allow_unsafe_werkzeug=True,
    )