"""Sintetiza un "psst, psst" (susurro para llamar la atención) con ruido filtrado.
Uso: python3 generar-psst.py salida.wav   (requiere numpy y scipy)"""
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 44100
rng = np.random.default_rng(7)
def band(x, lo, hi, order=4):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def low(x, hi, order=4):
    return sosfilt(butter(order, hi, btype='low', fs=SR, output='sos'), x)
def env(n, a, d, shape=1.0):
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / d) ** shape
    return e
def psst(dur=0.34, gain=1.0):
    n = int(SR * dur); out = np.zeros(n)
    # p: breath of air / soft plosive (low noise, very short)
    npl = int(SR * 0.03); p = low(rng.standard_normal(npl), 900) * env(npl, 0.004, 0.012)
    out[:npl] += p * 1.4
    # s: sibilance 4.5-10 kHz with a shaped sweep (slightly brighter toward the end)
    s0 = int(SR * 0.025); ns = int(SR * 0.22)
    w = rng.standard_normal(ns)
    s = band(w, 4200, 9500) * 1.0 + band(w, 6500, 11000) * np.linspace(0.2, 1.0, ns)
    s *= env(ns, 0.035, 0.11) * np.hanning(ns) ** 0.35
    out[s0:s0 + ns] += s * 1.0
    # t: tiny burst after a gap of a few ms
    t0 = int(SR * 0.27); nt = int(SR * 0.04)
    tt = band(rng.standard_normal(nt), 3000, 9000) * env(nt, 0.002, 0.012)
    out[t0:t0 + nt] += tt * 0.9
    return out * gain
def build():
    total = int(SR * 3.0); y = np.zeros(total)
    for start, g in [(0.12, 0.9), (0.62, 1.0)]:
        a = psst(gain=g); i = int(SR * start); y[i:i + len(a)] += a
    # a little room: short decaying echo
    ir = np.zeros(int(SR * 0.18)); ir[0] = 1; ir[int(SR * 0.045)] = .22; ir[int(SR * 0.11)] = .1
    y = np.convolve(y, ir)[:total]
    y = y / np.max(np.abs(y)) * 0.89
    return y
if __name__ == "__main__":
    y = build()
    wavfile.write(sys.argv[1], SR, (y * 32767).astype(np.int16))
