const { contextBridge, ipcRenderer } = require("electron");

console.log("[PRELOAD] loaded");

contextBridge.exposeInMainWorld("mqttAPI", {
  connect: () => ipcRenderer.invoke("mqtt:connect"),
  getState: () => ipcRenderer.invoke("mqtt:getState"),

  publish: (topic, payload, options) =>
    ipcRenderer.invoke("mqtt:publish", { topic, payload, options }),

  subscribe: (topic, options) =>
    ipcRenderer.invoke("mqtt:subscribe", { topic, options }),

  unsubscribe: (topic) =>
    ipcRenderer.invoke("mqtt:unsubscribe", { topic }),

  onMessage: (handler) => {
    const wrapped = (_event, data) => handler(data);
    ipcRenderer.on("mqtt:message", wrapped);
    return () => ipcRenderer.removeListener("mqtt:message", wrapped);
  },

  onEvent: (handler) => {
    const wrapped = (_event, data) => handler(data);
    ipcRenderer.on("mqtt:event", wrapped);
    return () => ipcRenderer.removeListener("mqtt:event", wrapped);
  },
});