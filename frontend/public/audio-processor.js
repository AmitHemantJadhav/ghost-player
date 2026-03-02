/**
 * AudioWorklet processor for capturing mic input as PCM16 at 16kHz.
 * Batches 4 worklet frames (512 samples = 32ms) before posting to reduce
 * WebSocket message rate from ~125/sec to ~31/sec without perceptible latency.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._batchSize = 512; // 4 frames × 128 samples = 32ms at 16kHz
    this._buffer = new Int16Array(this._batchSize);
    this._offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const float32 = input[0];
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        this._buffer[this._offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this._offset >= this._batchSize) {
          this.port.postMessage(this._buffer.buffer, [this._buffer.buffer]);
          this._buffer = new Int16Array(this._batchSize);
          this._offset = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
