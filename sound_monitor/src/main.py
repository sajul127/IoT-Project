import argparse
import time

import numpy as np

from config import SAMPLE_RATE, CHUNK_SECONDS
from sound_analyzer import load_audio_file, split_audio_chunks
from detector import BabyCryDetector, ElderlyNoActivityDetector
from firebase_sender import init_firebase, send_event


def create_detector(mode):
    if mode == "baby":
        return BabyCryDetector()

    if mode == "elderly":
        return ElderlyNoActivityDetector()

    raise ValueError("mode는 baby 또는 elderly만 가능합니다.")


def run_wav_mode(file_path, mode):
    """
    마이크가 없을 때 WAV 파일로 테스트하는 모드.
    """
    print("========== WAV 테스트 모드 시작 ==========")
    print("파일:", file_path)
    print("모드:", mode)

    sample_rate, audio = load_audio_file(file_path)
    chunks = split_audio_chunks(audio, sample_rate, CHUNK_SECONDS)

    detector = create_detector(mode)

    for index, chunk in enumerate(chunks):
        result = detector.analyze_chunk(sample_rate, chunk)

        print(f"\n[{index + 1}/{len(chunks)}] 분석 결과")
        send_event(result)

        # 실제 시간처럼 보이게 1초 대기
        time.sleep(CHUNK_SECONDS)

    print("========== WAV 테스트 모드 종료 ==========")


def run_mic_mode(mode):
    """
    마이크 연결 후 실시간으로 분석하는 모드.
    INMP441이 라즈베리파이에서 오디오 입력 장치로 잡혀 있어야 함.
    """
    print("========== 실시간 마이크 모드 시작 ==========")
    print("모드:", mode)
    print("종료하려면 Ctrl + C")

    try:
        import sounddevice as sd
    except ImportError:
        print("sounddevice가 설치되어 있지 않습니다.")
        print("pip install sounddevice 명령어로 설치하세요.")
        return

    detector = create_detector(mode)

    chunk_size = int(SAMPLE_RATE * CHUNK_SECONDS)

    try:
        while True:
            audio = sd.rec(
                frames=chunk_size,
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="float32",
            )

            sd.wait()

            audio = np.squeeze(audio)

            result = detector.analyze_chunk(SAMPLE_RATE, audio)

            send_event(result)

    except KeyboardInterrupt:
        print("\n사용자가 종료했습니다.")

    except Exception as e:
        print("마이크 입력 중 오류 발생:", e)
        print("마이크가 아직 연결되지 않았거나, 오디오 장치 설정이 안 되었을 수 있습니다.")


def main():
    parser = argparse.ArgumentParser(
        description="음향 분석 기반 취약계층 안심 모니터링 시스템"
    )

    parser.add_argument(
        "--input",
        choices=["wav", "mic"],
        required=True,
        help="wav: 파일 테스트, mic: 실시간 마이크 입력",
    )

    parser.add_argument(
        "--mode",
        choices=["baby", "elderly"],
        required=True,
        help="baby: 영유아 울음 감지, elderly: 독거노인 무활동 감지",
    )

    parser.add_argument(
        "--file",
        type=str,
        help="WAV 테스트 파일 경로",
    )

    args = parser.parse_args()

    init_firebase()

    if args.input == "wav":
        if not args.file:
            print("WAV 모드에서는 --file 옵션이 필요합니다.")
            return

        run_wav_mode(args.file, args.mode)

    elif args.input == "mic":
        run_mic_mode(args.mode)


if __name__ == "__main__":
    main()