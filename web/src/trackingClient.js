/** One frame in flight, including capture: never accumulate stale camera frames. */
export class TrackingClient {
  constructor(worker, { capture = (video) => createImageBitmap(video), timeoutMs = 30000 } = {}) {
    this.worker = worker;
    this.capture = capture;
    this.timeoutMs = timeoutMs;
    this.pending = null;
    this.busy = false;
    this.closed = false;
    worker.onmessage = ({ data }) => {
      if (!this.pending) return;
      if (data.type === "error") this.fail(new Error(data.message));
      else if (data.type === "ready" || data.type === "result") {
        const { resolve, timer } = this.pending;
        this.pending = null;
        clearTimeout(timer);
        resolve(data);
      }
    };
    worker.onerror = (event) => { event.preventDefault?.(); this.fail(new Error(event.message || "Tracking worker failed")); };
    worker.onmessageerror = () => this.fail(new Error("Tracking result could not be received"));
  }

  request(message, transfer = []) {
    if (this.closed) return Promise.reject(new Error("Tracking worker closed"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error("Tracking worker timed out")), this.timeoutMs);
      this.pending = { resolve, reject, timer };
      try { this.worker.postMessage(message, transfer); }
      catch (error) { this.fail(error); }
    });
  }

  async init(modelPath) {
    const ready = await this.request({ type: "init", modelPath });
    this.delegate = ready.delegate;
    return this;
  }

  async detect(video, timestamp) {
    if (this.busy || this.closed) return null;
    this.busy = true;
    let bitmap;
    try {
      bitmap = await this.capture(video);
      if (this.closed) throw new Error("Tracking worker closed");
      return await this.request({ type: "frame", bitmap, timestamp }, [bitmap]);
    } finally {
      // Transferred bitmaps are detached here; close also covers capture/post failures.
      bitmap?.close();
      this.busy = false;
    }
  }

  fail(error) {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
    this.closed = true;
    this.worker.terminate();
  }

  close() { this.fail(new Error("Tracking stopped")); }
}
