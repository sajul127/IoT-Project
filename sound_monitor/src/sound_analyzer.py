import numpy as np
import soundfile as sf


def normalize_audio(audio):
    """source .venv/bin/activate
    오디오 데이터를 -1.0 ~ 1.0 범위로 정규화한다.
    """
    audio = np.asarray(audio, dtype=np.float32)

    if audio.ndim > 1:
        audio = audio[:, 0]

    max_value = np.max(np.abs(audio))

    if max_value > 0:
        audio = audio / max_value

    return audio


def load_audio_file(file_path):
    """
    WAV 파일을 읽어서 sample_rate와 audio 데이터를 반환한다.
    조용한 소리의 실제 크기를 유지하기 위해 여기서는 정규화하지 않는다.
    """
    audio, sample_rate = sf.read(file_path)

    # 스테레오면 한 채널만 사용
    if audio.ndim > 1:
        audio = audio[:, 0]

    audio = np.asarray(audio, dtype=np.float32)

    return sample_rate, audio


def calculate_rms(audio):
    """
    RMS 기반 소리 크기 계산.
    값이 클수록 소리가 큼.
    """
    audio = np.asarray(audio, dtype=np.float32)

    if len(audio) == 0:
        return 0.0

    return float(np.sqrt(np.mean(audio ** 2)))


def calculate_db(audio):
    """
    RMS 값을 dB 형태로 변환한다.
    실제 소음계 dB는 아니고 비교용 dB 값이다.
    """
    rms = calculate_rms(audio)

    if rms <= 0:
        return -100.0

    return float(20 * np.log10(rms))


def calculate_frequency_energy_ratio(sample_rate, audio, low_freq, high_freq):
    """
    특정 주파수 대역의 에너지 비율을 계산한다.

    예:
    1000Hz ~ 5000Hz 대역 에너지가 전체 평균보다 얼마나 강한지 확인.
    """
    audio = normalize_audio(audio)

    if len(audio) == 0:
        return 0.0

    n = len(audio)

    # 해밍 윈도우 적용: FFT 노이즈 완화
    window = np.hamming(n)
    windowed_audio = audio * window

    fft_result = np.fft.rfft(windowed_audio)
    fft_freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)

    magnitude = np.abs(fft_result)

    target_indices = np.where(
        (fft_freqs >= low_freq) & (fft_freqs <= high_freq)
    )[0]

    if len(target_indices) == 0:
        return 0.0

    target_energy = np.mean(magnitude[target_indices])
    total_energy = np.mean(magnitude)

    if total_energy <= 0:
        return 0.0

    return float(target_energy / total_energy)


def split_audio_chunks(audio, sample_rate, chunk_seconds=1.0):
    """
    긴 오디오를 일정 시간 단위로 자른다.
    예: 10초짜리 wav를 1초 단위 10개로 나눔.
    """
    chunk_size = int(sample_rate * chunk_seconds)

    chunks = []

    for start in range(0, len(audio), chunk_size):
        end = start + chunk_size
        chunk = audio[start:end]

        if len(chunk) == chunk_size:
            chunks.append(chunk)

    return chunks