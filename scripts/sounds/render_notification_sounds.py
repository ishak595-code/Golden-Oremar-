"""Golden Oremar signature notification sounds (v2).

Self-generated (no samples): physical/modal synthesis, layered filtered noise,
natural envelopes and a light convolution reverb, 44.1 kHz mono 16-bit WAV,
normalised to about -16 LUFS with true peak <= -1 dBTP.
Writes identical files to public/sounds/ (web, PWA) and
android/app/src/main/res/raw/ (Android notification channels).

  python3 -m venv .venv && .venv/bin/pip install numpy scipy pyloudnorm
  .venv/bin/python scripts/sounds/render_notification_sounds.py
"""
import json, os, sys, wave
import numpy as np
import pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 44100
TARGET_LUFS = -16.0
CEILING_DBTP = -1.0
OUT_DIRS = ['public/sounds', 'android/app/src/main/res/raw']


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def place(buf, sig, at):
    i = int(at * SR)
    n = min(len(sig), len(buf) - i)
    if n > 0:
        seg = sig[:n].copy()
        k = min(n, int(0.004 * SR))
        seg[-k:] *= np.linspace(1, 0, k)   # never end a layer on a step
        buf[i:i + n] += seg


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


def modal(freqs, amps, decays, dur, rng, detune=0.0):
    """Struck resonant body: sum of exponentially decaying modes; optional
    detuned twin per mode gives the slow beating of real metal/glass."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    attack = np.clip(t / 0.0008, 0, 1) ** 2   # 0.8 ms onset: a strike, never a step
    for f, a, d in zip(freqs, amps, decays):
        ph = rng.uniform(0, 2 * np.pi)
        out += a * np.sin(2 * np.pi * f * t + ph) * np.exp(-t / d)
        if detune:
            out += 0.6 * a * np.sin(2 * np.pi * (f + detune * rng.uniform(0.5, 1.5)) * t + ph) * np.exp(-t / (d * 0.9))
    return out * attack


def chirp_tone(f0, f1, glide, tau, dur, attack=0.001):
    """Sine whose pitch glides f0->f1 (exponential) over `glide` s, then holds."""
    t = t_axis(dur)
    k = np.clip(t / glide, 0, 1)
    f = f0 * (f1 / f0) ** k
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / attack) * np.exp(-t / tau)
    return np.sin(ph) * env


def burst(rng, dur, lo, hi, tau):
    t = t_axis(dur)
    return bandpass(rng.standard_normal(len(t)), lo, hi) * np.exp(-t / tau)


def reverb(x, rng, rt=0.5, wet=0.15, predelay=0.012, tone=5000):
    n = int(rt * 1.2 * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
    ir = lowpass(ir, tone)
    ir[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    ir /= np.sqrt(np.sum(ir ** 2))
    tail = fftconvolve(x, ir)[: len(x)]
    d = int(predelay * SR)
    tail = np.concatenate([np.zeros(d), tail[: len(x) - d]])
    return (1 - wet) * x + wet * tail * 2.0


# --- the five sounds -------------------------------------------------------

def damla(rng):
    """A clear water drop falling into a copper bowl (default)."""
    dur = 1.45
    x = np.zeros(int(dur * SR))
    place(x, 0.10 * highpass(burst(rng, 0.006, 1200, 7000, 0.0015), 900), 0.0)       # impact
    place(x, 0.55 * chirp_tone(1150, 2050, 0.045, 0.030, 0.25), 0.002)                 # bubble 'plink'
    bowl = modal([612, 1689, 3305, 5447], [0.30, 0.17, 0.07, 0.025], [0.70, 0.42, 0.24, 0.11], dur, rng, detune=1.1)
    place(x, bowl, 0.001)                                                                # copper bowl ring
    place(x, 0.26 * chirp_tone(1650, 2700, 0.035, 0.022, 0.2), 0.205)                    # small second droplet
    place(x, 0.06 * modal([612, 1689], [0.6, 0.3], [0.5, 0.3], dur - 0.205, rng), 0.205)
    return reverb(x, rng, rt=0.55, wet=0.16)


def kaval(rng):
    """A soft, wooden kaval (shepherd's flute) phrase: grace note into a held note."""
    dur = 1.4
    t = t_axis(dur)
    glide = np.clip((t - 0.13) / 0.03, 0, 1)
    f = np.where(t < 0.13, 440.0, 440.0 + (587.33 - 440.0) * glide)
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.45) / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + 0.32 * np.sin(2 * ph + 0.3) + 0.11 * np.sin(3 * ph + 0.7) + 0.04 * np.sin(4 * ph)
    env = np.clip(t / 0.07, 0, 1) * np.clip((dur - 0.04 - t) / 0.32, 0, 1) ** 1.5
    env *= 1 - 0.25 * np.exp(-((t - 0.14) / 0.03) ** 2)                                # tongue-less legato dip
    breath = lowpass(highpass(rng.standard_normal(len(t)), 300), 5000)
    breath_res = bandpass(rng.standard_normal(len(t)), 560, 620, order=2) * 6
    chiff = np.exp(-t / 0.05) + 0.7 * np.exp(-np.clip(t - 0.13, 0, None) / 0.04) * (t >= 0.13)
    x = 0.42 * tone * env + 0.030 * breath * (0.35 * env + chiff * 0.6) + 0.02 * breath_res * env
    return reverb(lowpass(x, 7000), rng, rt=0.85, wet=0.22, tone=4000)


def ocak(rng):
    """Crackling wood fire with a warm, glowing tone."""
    dur = 1.45
    t = t_axis(dur)
    x = np.zeros(len(t))
    swell = np.clip(t / 0.18, 0, 1) * np.exp(-np.clip(t - 0.18, 0, None) / 0.55)
    for f, a in [(174.61, 0.26), (261.63, 0.20), (440.0, 0.13), (523.25, 0.06)]:
        ph = rng.uniform(0, 6.28)
        x += a * (np.sin(2 * np.pi * f * t + ph) + 0.18 * np.sin(4 * np.pi * f * t + ph)) * swell
    x = lowpass(x, 1800)
    hiss = lowpass(highpass(rng.standard_normal(len(t)), 900), 3500) * 0.012 * np.clip(t / 0.1, 0, 1) * np.exp(-t / 0.9)
    x += hiss
    times = np.sort(rng.uniform(0.02, 1.05, 11))
    for i, at in enumerate(times):
        lo = rng.uniform(1500, 3500)
        amp = rng.uniform(0.10, 0.30) * (1.0 if i % 3 else 1.5)
        place(x, amp * burst(rng, 0.012, lo, lo * 2.2, rng.uniform(0.0008, 0.002)), at)
        if i % 4 == 0:                                                                   # deeper wood 'pop'
            place(x, 0.22 * burst(rng, 0.03, 350, 900, 0.006), at + 0.001)
    return reverb(x, rng, rt=0.45, wet=0.12, tone=4500)


def suru_cani(rng):
    """A small bell from a highland flock, two gentle swings."""
    dur = 1.5
    ratios = [1.0, 1.59, 2.14, 2.30, 2.65, 2.92, 3.50]
    base = 1180.0
    def strike(scale, tilt):
        amps = [0.30, 0.16 * tilt, 0.11, 0.08 * tilt, 0.06, 0.035, 0.02]
        decays = [0.55, 0.38, 0.30, 0.25, 0.19, 0.14, 0.09]
        body = modal([base * r for r in ratios], amps, decays, dur, rng, detune=2.3)
        click = 0.05 * burst(rng, 0.004, 3500, 9000, 0.0008)
        body[: len(click)] += click
        return scale * body
    x = np.zeros(int(dur * SR))
    place(x, strike(1.0, 1.0), 0.0)
    place(x, strike(0.62, 1.3), 0.24)
    place(x, strike(0.30, 0.8), 0.52)
    x = x + 0.12 * np.concatenate([np.zeros(int(0.085 * SR)), lowpass(x, 3000)[: len(x) - int(0.085 * SR)]])  # hillside echo
    return reverb(x, rng, rt=0.5, wet=0.12, tone=6000)


def bal(rng):
    """A drop of honey into a glass jar: glass tap, then a thick, sweet drip."""
    dur = 1.3
    x = np.zeros(int(dur * SR))
    glass = [1850, 4292, 7862, 12265]
    place(x, 0.04 * burst(rng, 0.003, 2500, 7000, 0.0007), 0.0)
    place(x, modal(glass, [0.30, 0.10, 0.035, 0.008], [0.38, 0.17, 0.08, 0.04], dur, rng, detune=1.6), 0.0)
    drip = chirp_tone(430, 255, 0.085, 0.065, 0.3, attack=0.004)
    place(x, 0.50 * lowpass(drip, 1600), 0.36)
    place(x, 0.05 * lowpass(burst(rng, 0.05, 200, 900, 0.012), 1200), 0.36)
    place(x, modal(glass, [0.10, 0.04, 0.012, 0.0], [0.30, 0.14, 0.07, 0.04], dur - 0.365, rng, detune=1.6), 0.365)
    return reverb(x, rng, rt=0.5, wet=0.15, tone=5000)


SOUNDS = [
    ('oremar-drop', 'go_sound_damla_v2.wav', damla, 101),
    ('mountain-birds', 'go_sound_kaval_v2.wav', kaval, 202),
    ('dawn-rooster', 'go_sound_ocak_v2.wav', ocak, 303),
    ('partridge-call', 'go_sound_suru_cani_v2.wav', suru_cani, 404),
    ('highland-bell', 'go_sound_bal_v2.wav', bal, 505),
]

# --- mastering -------------------------------------------------------------

def true_peak(x):
    return np.max(np.abs(resample_poly(x, 4, 1)))


def limit(x, ceiling):
    """Look-ahead peak limiter (5 ms look-ahead, 60 ms release)."""
    look = int(0.005 * SR)
    over = np.maximum(1.0, np.abs(x) / ceiling)
    peak = np.array([over[max(0, i - look): i + look].max() for i in range(len(x))])
    gain = 1.0 / peak
    rel = np.exp(-1 / (0.06 * SR))
    g = np.empty_like(gain)
    cur = 1.0
    for i, v in enumerate(gain):
        cur = v if v < cur else v + (cur - v) * rel
        g[i] = cur
    return x * g


def master(x):
    x = highpass(x, 60)
    meter = pyln.Meter(SR, block_size=0.4)
    ceiling = 10 ** (CEILING_DBTP / 20) * 0.97
    for _ in range(4):
        x = x * 10 ** ((TARGET_LUFS - meter.integrated_loudness(x)) / 20)
        if true_peak(x) > ceiling:
            x = limit(x, ceiling)
    x = x * min(1.0, ceiling / true_peak(x))
    # 1.5 ms fade-in; the last 0.35 s is damped like a hand on the bowl/bell,
    # so every file decays to silence instead of being cut off.
    fade_in, fade_out = int(0.0015 * SR), int(0.35 * SR)
    x[:fade_in] *= np.linspace(0, 1, fade_in)
    x[-fade_out:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade_out))
    return x


def write_wav(path, x):
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def main():
    report = {}
    for sid, fname, fn, seed in SOUNDS:
        x = master(fn(np.random.default_rng(seed)))
        for d in OUT_DIRS:
            os.makedirs(d, exist_ok=True)
            write_wav(os.path.join(d, fname), x)
        meter = pyln.Meter(SR, block_size=0.4)
        report[sid] = {
            'file': fname, 'seconds': round(len(x) / SR, 3),
            'lufs': round(meter.integrated_loudness(x), 2),
            'peak_dbfs': round(20 * np.log10(np.max(np.abs(x))), 2),
            'true_peak_dbtp': round(20 * np.log10(true_peak(x)), 2),
            'rms_dbfs': round(20 * np.log10(np.sqrt(np.mean(x ** 2))), 2),
            'first_last_sample': [round(float(x[0]), 5), round(float(x[-1]), 5)],
        }
    json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
    print()


if __name__ == '__main__':
    main()
