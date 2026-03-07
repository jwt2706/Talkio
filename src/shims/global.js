// src/shims/global.js
// Make Node-ish "global" exist in browser/Electron
if (typeof globalThis.global === "undefined") {
  globalThis.global = globalThis;
}