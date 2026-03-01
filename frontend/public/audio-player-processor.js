/**
 * AudioWorklet processor for playing PCM16 audio chunks at 24kHz.
 * Receives Int16 PCM buffers from the main thread, converts to Float32,
 * and outputs to speakers via a ring buffer for smooth streaming playback.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ring buffer: ~2 seconds at 24kHz
    this._bufferSize = 48000;
    this._buffer = new Float32Array(this._bufferSize);
    this._writePos = 0;
    this._readPos = 0;
    this._samplesAvailable = 0;

    this.port.onmessage = (event) => {
      if (event.data === "clear") {
        this._writePos = 0;
        this._readPos = 0;
        this._samplesAvailable = 0;
        return;
      }

      const int16 = new Int16Array(event.data);
      for (let i = 0; i < int16.length; i++) {
        this._buffer[this._writePos] = int16[i] / 32768;
        this._writePos = (this._writePos + 1) % this._bufferSize;
        if (this._samplesAvailable < this._bufferSize) {
          this._samplesAvailable++;
        } else {
          // Buffer overflow — advance read pointer
          this._readPos = (this._readPos + 1) % this._bufferSize;
        }
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    for (let i = 0; i < channel.length; i++) {
      if (this._samplesAvailable > 0) {
        channel[i] = this._buffer[this._readPos];
        this._readPos = (this._readPos + 1) % this._bufferSize;
        this._samplesAvailable--;
      } else {
        channel[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
