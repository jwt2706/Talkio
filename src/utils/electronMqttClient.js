class ElectronMqttBridgeClient {
  constructor() {
    this._connected = false;
    this._started = false;

    this._listeners = {
      connect: new Set(),
      reconnect: new Set(),
      close: new Set(),
      offline: new Set(),
      end: new Set(),
      error: new Set(),
      message: new Set(),
    };
  }

  get connected() {
    return this._connected;
  }

  async connect() {
    if (!window.mqttAPI) {
      throw new Error("window.mqttAPI is not available. Check preload.cjs.");
    }

    if (!this._started) {
      this._started = true;

      try {
        const state = await window.mqttAPI.getState();
        this._connected = !!state?.connected;
      } catch {}

      window.mqttAPI.onEvent((evt) => {
        const type = evt?.type;
        if (!type) return;

        if (type === "connect") this._connected = true;
        if (["reconnect", "close", "offline", "end", "error"].includes(type)) {
          if (type !== "reconnect") this._connected = false;
        }

        this._emit(type, evt?.error || evt);
      });

      window.mqttAPI.onMessage(({ topic, payload }) => {
        const bytes =
          payload instanceof Uint8Array ? payload : new Uint8Array(payload || []);
        this._emit("message", topic, bytes);
      });
    }

    const res = await window.mqttAPI.connect();
    this._connected = !!res?.connected;
    return res;
  }

  async publish(topic, payload, options = {}, cb) {
    try {
      const normalizedPayload =
        payload instanceof Uint8Array
          ? payload
          : payload instanceof ArrayBuffer
          ? new Uint8Array(payload)
          : typeof payload === "string"
          ? payload
          : new Uint8Array(payload || []);

      const res = await window.mqttAPI.publish(topic, normalizedPayload, options);

      if (!res?.ok) {
        const err = new Error(res?.error || "Publish failed");
        if (cb) cb(err);
        return;
      }

      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  async subscribe(topic, options = {}, cb) {
    try {
      const res = await window.mqttAPI.subscribe(topic, options);
      if (!res?.ok) {
        const err = new Error(res?.error || "Subscribe failed");
        if (cb) cb(err);
        return;
      }
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  async unsubscribe(topic, cb) {
    try {
      const res = await window.mqttAPI.unsubscribe(topic);
      if (!res?.ok) {
        const err = new Error(res?.error || "Unsubscribe failed");
        if (cb) cb(err);
        return;
      }
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  on(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event].add(handler);
  }

  removeListener(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event].delete(handler);
  }

  end() {
    // no-op in renderer bridge
  }

  _emit(event, ...args) {
    const set = this._listeners[event];
    if (!set) return;
    for (const fn of set) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[ElectronMqttBridgeClient] listener error for ${event}`, err);
      }
    }
  }
}

let singleton = null;

export function getElectronMqttClient() {
  if (!singleton) singleton = new ElectronMqttBridgeClient();
  return singleton;
}