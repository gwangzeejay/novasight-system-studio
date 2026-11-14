// CaneSync v1 concept model. Inputs are synthetic, not a perception pipeline.
export const DEFAULTS = Object.freeze({ probability: 0.9, margin: 0.5, urgent: 1.2, linkMs: 300, range: 2 });
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function caneGeometry({ length = 1.26, handHeight = 0.78, handX = 0.18, yaw = 0 }) {
  const reach = Math.sqrt(Math.max(0, length * length - handHeight * handHeight));
  return { reach, x: handX + reach * Math.cos(yaw), y: reach * Math.sin(yaw), z: 0 };
}

export class SweepHistory {
  constructor() { this.reset(); }
  reset() { this.halves = []; this.cycles = []; this.last = null; this.direction = 0; this.turn = null; }
  add(time, yaw) {
    if (!Number.isFinite(time) || !Number.isFinite(yaw)) return;
    if (!this.last) { this.last = { time, yaw }; return; }
    const delta = yaw - this.last.yaw;
    const direction = Math.abs(delta) > 1e-6 ? Math.sign(delta) : this.direction;
    if (direction && this.direction && direction !== this.direction) {
      const reversal = this.last;
      if (this.turn) {
        const duration = (reversal.time - this.turn.time) / 1000;
        if (duration >= 0.15 && duration <= 1.5 && Math.abs(reversal.yaw - this.turn.yaw) > 0.08) {
          const half = { time: reversal.time, lo: Math.min(reversal.yaw, this.turn.yaw), hi: Math.max(reversal.yaw, this.turn.yaw), duration };
          this.halves.push(half);
          if (this.halves.length % 2 === 0) {
            const prev = this.halves.at(-2);
            this.cycles.push({ lo: Math.max(half.lo, prev.lo), hi: Math.min(half.hi, prev.hi), time: half.time });
            this.cycles = this.cycles.slice(-8);
          }
          if (this.halves.length > 32) this.halves.splice(0, 2);
        }
      }
      this.turn = reversal;
    }
    this.direction = direction; this.last = { time, yaw };
  }
  snapshot(now) {
    const fresh = this.halves.filter(h => now - h.time <= 3000);
    const recent = this.halves.slice(-4);
    return { valid: fresh.length >= 4, halfCount: fresh.length,
      cycles: this.cycles.slice(-8), halfPeriod: recent.length ? recent.reduce((s, h) => s + h.duration, 0) / recent.length : null };
  }
}

export function decide(input, requestedMode = 'canesync') {
  const { hazard: h, speed, quality, geometry, observationGap = false } = input;
  const fallback = !quality.connected || quality.linkAgeMs > DEFAULTS.linkMs || !quality.sweepValid || quality.turning || quality.saturated;
  const mode = requestedMode === 'tunnel' || fallback ? 'tunnel' : 'canesync';
  const fallbackReason = !quality.connected ? 'Clip chưa kết nối' : quality.linkAgeMs > 300 ? 'BLE quá 300 ms' : quality.saturated ? 'IMU bão hòa' : quality.turning ? 'Đang đổi hướng thân' : !quality.sweepValid ? 'Chưa đủ 4 nửa chu kỳ trong 3 giây' : '';
  const out = { code: '—', mode, fallback: requestedMode !== 'tunnel' && fallback, fallbackReason,
    reason: 'Chưa có vật cản trong vùng quan sát.', p: null, lateral: null, longitudinal: null, vertical: null, tBody: null, tCane: null, side: 'both', hazard: h };
  if (!h) return observationGap ? { ...out, code: 'D', reason: 'Không đủ dữ liệu mặt đường. Camera không thay thế phép đo độ sâu.' } : out;
  if (!h.onPath) return { ...out, reason: 'Vật nằm ngoài hành lang thân người.' };
  if (!h.observed || !Number.isFinite(h.x) || h.x <= 0) return { ...out, code: 'D', reason: 'Không đủ bằng chứng hình học; không suy ra hố từ mất tín hiệu.' };
  const moving = h.kind === 'moving';
  const closure = moving ? Math.max(0.2, h.closingSpeed) : Math.max(speed, 0.2);
  out.tBody = Math.max(0, (h.x - 0.15) / closure);
  out.side = h.y - h.width / 2 > 0.08 ? 'left' : h.y + h.width / 2 < -0.08 ? 'right' : 'both';
  if (speed < 0.05 && !moving) return { ...out, reason: 'Đứng yên: không phát cảnh báo tĩnh mới.' };
  const grounded = h.kind === 'grounded';
  const cycles = quality.cycles || [];
  if (geometry && grounded && cycles.length && Number.isFinite(quality.halfPeriod)) {
    out.lateral = cycles.filter(c => geometry.reach * Math.sin(c.lo) <= h.y - h.width / 2 && geometry.reach * Math.sin(c.hi) >= h.y + h.width / 2).length / cycles.length;
    out.longitudinal = clamp(((h.depth ?? 0.1) + 0.04) / (Math.max(speed, 0.2) * quality.halfPeriod), 0, 1);
    out.vertical = 1;
    out.p = out.lateral * out.longitudinal * out.vertical;
    const center = cycles.reduce((s, c) => s + (c.lo + c.hi) / 2, 0) / cycles.length;
    out.tCane = Math.max(0, (h.x - geometry.handX - geometry.reach * Math.cos(center)) / Math.max(speed, 0.2));
  }
  if (out.tBody < DEFAULTS.urgent) return { ...out, code: 'C', reason: 'TTC thân < 1,2 s: cảnh báo khẩn, không được giữ im lặng.' };
  if (!grounded) return { ...out, code: 'B', reason: 'Tầm đầu/ngực, mép hụt và vật di chuyển không được gậy triệt cảnh báo.' };
  if (mode === 'tunnel') return { ...out, code: 'B', reason: fallback && requestedMode !== 'tunnel' ? `${fallbackReason} → lọc đường hầm, không triệt cảnh báo.` : 'Lọc đường hầm: vật trong hướng đi → cảnh báo.' };
  if (h.x > DEFAULTS.range) return { ...out, code: 'B', reason: 'Ngoài giới hạn 2 m của dự đoán gậy v1.' };
  if (out.p >= DEFAULTS.probability && out.tCane + DEFAULTS.margin <= out.tBody)
    return { ...out, code: 'A', reason: 'P gậy ≥ 90% và gậy dự kiến chạm trước thân ít nhất 0,5 s. Im lặng, tiếp tục theo dõi.' };
  return { ...out, code: 'B', reason: out.p === null ? 'Chưa đủ lịch sử để dự đoán tiếp xúc gậy.' : out.p < 0.9 ? 'Vùng quét hoặc nhịp quét chưa đủ bao phủ vật cản.' : 'Gậy không có đủ biên thời gian 0,5 s trước thân.' };
}

export function haptic(code, elapsed, side = 'both') {
  let amplitude = 0;
  if (code === 'B') amplitude = elapsed % 900 < 130 ? 0.7 : 0;
  if (code === 'C') amplitude = elapsed % 300 < 160 ? 1 : 0;
  if (code === 'D') { const t = elapsed % 6000; amplitude = t < 900 ? 0.5 * Math.sin(Math.PI * t / 900) : 0; }
  return { L: side !== 'right' ? amplitude : 0, R: side !== 'left' ? amplitude : 0, C: 0 };
}
