import os
import time
import json
import socket
import subprocess
import numpy as np
from scipy.signal import resample


class AIAudioDetector:
    def __init__(
        self,
        mode="baby",
        trigger_callback=None,
        project_root="/home/pi/Project",
    ):
        self.mode = mode
        self.trigger_callback = trigger_callback
        self.running = False

        self.last_sound_time = time.time()
        self.SILENCE_THRESHOLD_SEC = 10

        self.last_alert_time = 0
        self.ALERT_COOLDOWN = 3.0

        self.project_root = project_root
        self.model_path = os.path.join(
            self.project_root,
            "sound_monitor",
            "data",
            "audio_model.eim",
        )

        self.runner_proc = None
        self.sock = None
        self.model_info = None
        self.input_features = None
        self.audio_buffer = None

        self.last_inference_time = time.time()
        self.INFERENCE_INTERVAL = 0.25

        self.cry_count = 0

        if os.path.exists(self.model_path):
            try:
                self._load_model_info()
                self._start_runner()

                self.audio_buffer = np.zeros(
                    self.input_features,
                    dtype=np.float32,
                )

                print("✅ AI 모델(.eim) 준비 완료")

            except Exception as e:
                print(f"⚠️ AI 모델 초기화 실패: {e}")
                self.model_info = None

    def _load_model_info(self):
        out = subprocess.check_output(
            [self.model_path, "--print-info"],
            stderr=subprocess.STDOUT,
        )

        info = (
            json.loads(out.decode("utf-8").split("\n", 1)[1])
            if b"{" in out
            else json.loads(out.decode("utf-8"))
        )

        self.model_info = info

        mp = info.get("model_parameters", {})
        self.input_features = int(
            mp.get("input_features_count", 0)
        )

    def _start_runner(self):
        socket_path = f"/tmp/ei_runner_{os.getpid()}.sock"

        try:
            if os.path.exists(socket_path):
                os.unlink(socket_path)
        except Exception:
            pass

        self.runner_proc = subprocess.Popen(
            [self.model_path, socket_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        timeout = 5.0
        start = time.time()

        while not os.path.exists(socket_path):
            if time.time() - start > timeout:
                raise RuntimeError(
                    "Edge Impulse runner socket 생성 시간 초과"
                )
            time.sleep(0.05)

        self.sock = socket.socket(
            socket.AF_UNIX,
            socket.SOCK_STREAM,
        )
        self.sock.connect(socket_path)

        hello_msg = {
            "id": 1,
            "hello": 1,
        }

        self.sock.sendall(
            (json.dumps(hello_msg) + "\n").encode("utf-8")
        )

        data = self.sock.recv(4096)
        print("HELLO 응답:", data.decode())

    def start(self):
        self.running = True
        self.last_sound_time = time.time()

    def stop(self):
        self.running = False

        try:
            if self.sock:
                self.sock.close()

            if self.runner_proc:
                self.runner_proc.terminate()

        except Exception:
            pass

    def set_mode(self, new_mode):
        self.mode = new_mode
        self.last_sound_time = time.time()
        print(f"🔄 모드 변경됨: {self.mode}")

    def _classify_with_runner(self, audio_array):
        if not self.sock or self.input_features is None:
            return None

        a = np.asarray(audio_array, dtype=np.float32)

        payload = {
            "classify": a.tolist(),
            "id": 1,
        }

        msg = (
            json.dumps(payload) + "\n"
        ).encode("utf-8")

        try:
            self.sock.sendall(msg)

            data = b""
            start = time.time()

            while True:
                chunk = self.sock.recv(4096)

                if not chunk:
                    break

                data += chunk

                try:
                    text = (
                        data.decode("utf-8")
                        .replace("\x00", "")
                        .strip()
                    )
                    return json.loads(text)

                except Exception:
                    pass

                if time.time() - start > 2.0:
                    break

        except Exception as e:
            print(f"⚠️ Runner 통신 오류: {e}")
            return None

        return None

    def observe(self, sound_db_or_audio, sample_rate=None):
        if not self.running:
            return

        now = time.time()

        if isinstance(sound_db_or_audio, (np.ndarray, list)):
            audio_1d = np.asarray(sound_db_or_audio, dtype=np.float32)

            if sample_rate == 48000:
                target_len = int(len(audio_1d) * 44100 / 48000)
                audio_1d = resample(audio_1d, target_len).astype(np.float32)

            current_volume = np.sqrt(np.mean(audio_1d**2)) * 1000

            # ==========================
            # 독거노인 모드 (무음 감지)
            # ==========================
            if self.mode == "elderly":
                if current_volume > 15.0:
                    self.last_sound_time = now

                elapsed_silence = now - self.last_sound_time

                print(f"⏳ [독거노인] 볼륨: {current_volume:.1f} | 무음: {elapsed_silence:.1f}초 / 10초")

                if elapsed_silence > self.SILENCE_THRESHOLD_SEC:
                    if now - self.last_alert_time > self.ALERT_COOLDOWN:
                        self.last_alert_time = now
                        if self.trigger_callback:
                            self.trigger_callback(
                                "elderly_silent",
                                {"message": f"어르신 활동 감지 안 됨! ({self.SILENCE_THRESHOLD_SEC}초간 무음)"}
                            )
                        self.last_sound_time = now

            # ==========================
            # AI 추론 (버퍼 채우기 및 예측)
            # ==========================
            if self.audio_buffer is not None:
                chunk_len = len(audio_1d)

                if chunk_len <= self.input_features:
                    self.audio_buffer[:-chunk_len] = self.audio_buffer[chunk_len:]
                    self.audio_buffer[-chunk_len:] = audio_1d

                if now - self.last_inference_time >= self.INFERENCE_INTERVAL:
                    self.last_inference_time = now
                    result = self._classify_with_runner(self.audio_buffer)

                    if result and "result" in result:
                        cls = result.get("result", {})
                        if isinstance(cls, dict) and "classification" in cls:
                            scores = cls.get("classification", {})

                            # 💡 [수정 포인트 1] 모드별로 로그 출력을 분기합니다.
                            if self.mode == "baby":
                                print("🧠 [아기모드] AI 결과:", scores)
                                print("👶 baby_cry =", scores.get("baby_cry", 0))
                                print("🔊 noise =", scores.get("noise", 0))
                            elif self.mode == "elderly":
                                print("🧠 [독거노인] AI 결과:", scores)
                                print("🧓 groan =", scores.get("groan", 0))
                                print("🔊 noise =", scores.get("noise", 0))

                            # 💡 [수정 포인트 2] 아기 모드 알림 처리
                            baby_score = scores.get("baby_cry", 0)
                            if self.mode == "baby" and baby_score >= 0.60:
                                if now - self.last_alert_time > self.ALERT_COOLDOWN:
                                    self.last_alert_time = now
                                    print(f"🚨 아기 울음 발생 (확률: {baby_score * 100:.1f}%)")
                                    if self.trigger_callback:
                                        self.trigger_callback(
                                            "baby_cry",
                                            {
                                                "message": "👶 아기 울음 감지",
                                                "score": round(baby_score * 100, 1),
                                            },
                                        )

                            # 💡 [수정 포인트 3] 독거노인 모드 알림 처리
                            groan_score = scores.get("groan", 0)
                            if self.mode == "elderly" and groan_score > 0.60:
                                if now - self.last_alert_time > self.ALERT_COOLDOWN:
                                    self.last_alert_time = now
                                    print(f"🚨 어르신 신음 감지! (확률: {groan_score * 100:.0f}%)")
                                    if self.trigger_callback:
                                        # 기존 코드의 문자열 전달 방식을 아기 모드와 동일하게 dict 형태로 맞춰주면 일관성이 생깁니다.
                                        self.trigger_callback(
                                            "sos",
                                            {
                                                "message": f"🚨 어르신 소리 감지! (확률: {groan_score * 100:.0f}%)"
                                            }
                                        )
                                    self.last_sound_time = now