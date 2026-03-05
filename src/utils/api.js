// src/utils/api.js
// API utility for Skylink device


// Support switching between Skylink and system API
let API_BASE = 'http://192.168.111.1:3000'; // Default: Skylink
export function setApiBase(url) {
  API_BASE = url;
}
// --- System User/Room API ---
// Set API_BASE to your backend, e.g. http://localhost:4000/api

export async function register(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Registration failed');
  return res.json();
}

export async function userLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  setJwt(data.token);
  return data;
}

export async function getRooms() {
  const res = await fetch(`${API_BASE}/rooms`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function createRoom(name, isPublic = true) {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ name, isPublic })
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function addUserToRoom(roomUuid, userUuid) {
  const res = await fetch(`${API_BASE}/rooms/${roomUuid}/add`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ userUuid })
  });
  if (!res.ok) throw new Error('Failed to add user to room');
  return res.json();
}

let jwt = null;

function setJwt(token) {
  jwt = token;
}

function getJwt() {
  return jwt;
}

function getHeaders(auth = false, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (auth && jwt) headers['Authorization'] = `Bearer ${jwt}`;
  return headers;
}

async function ping() {
  const res = await fetch(`${API_BASE}/ping`);
  if (!res.ok) throw new Error('Ping failed');
  return res.json();
}

async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  setJwt(data.jwt);
  return data;
}

// Example: GET /diagnostics/status
async function getDiagnosticsStatus() {
  const res = await fetch(`${API_BASE}/diagnostics/status`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get diagnostics status');
  return res.json();
}

// Example: GET /device/info
async function getDeviceInfo() {
  const res = await fetch(`${API_BASE}/device/info`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get device info');
  return res.json();
}


// --- Auth ---
async function changePassword({ username, oldpassword, newpassword }) {
  const res = await fetch(`${API_BASE}/auth/changepassword`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ username, oldpassword, newpassword })
  });
  if (!res.ok) throw new Error('Change password failed');
  return res.json();
}

// --- DHCP Reservations ---
async function getDhcpReservations() {
  const res = await fetch(`${API_BASE}/dhcp/reservations`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get DHCP reservations');
  return res.json();
}

async function createDhcpReservation({ mac, ip, hostname }) {
  const res = await fetch(`${API_BASE}/dhcp/reservations`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify({ mac, ip, hostname })
  });
  if (!res.ok) throw new Error('Failed to create DHCP reservation');
  return res.json();
}

async function updateDhcpReservation(mac, data) {
  const res = await fetch(`${API_BASE}/dhcp/reservations/${encodeURIComponent(mac)}`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update DHCP reservation');
  return res.json();
}

async function deleteDhcpReservation(mac) {
  const res = await fetch(`${API_BASE}/dhcp/reservations/${encodeURIComponent(mac)}`, {
    method: 'DELETE',
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to delete DHCP reservation');
  return res.json();
}

// --- Device Info ---
async function getDeviceState() {
  const res = await fetch(`${API_BASE}/device/state`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get device state');
  return res.json();
}

async function getDeviceStatus() {
  const res = await fetch(`${API_BASE}/device/status`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get device status');
  return res.json();
}

async function getDeviceDataUsage(period = '24h') {
  const res = await fetch(`${API_BASE}/device/data-usage?period=${encodeURIComponent(period)}`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get device data usage');
  return res.json();
}

async function getDeviceName() {
  const res = await fetch(`${API_BASE}/device/name`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get device name');
  return res.json();
}

async function setDeviceName(name) {
  const res = await fetch(`${API_BASE}/device/name`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to set device name');
  return res.json();
}

// --- Network Status ---
async function getWifiStatus() {
  const res = await fetch(`${API_BASE}/network/status/wifi`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get WiFi status');
  return res.json();
}

async function getCellStatus() {
  const res = await fetch(`${API_BASE}/network/status/cell`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get cell status');
  return res.json();
}

async function getCertusStatus() {
  const res = await fetch(`${API_BASE}/network/status/certus`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get certus status');
  return res.json();
}

// --- Network Settings ---
async function getWifiSettings() {
  const res = await fetch(`${API_BASE}/network/wifi`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get WiFi settings');
  return res.json();
}

async function setWifiSettings(data) {
  const res = await fetch(`${API_BASE}/network/wifi`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to set WiFi settings');
  return res.json();
}

async function getLanSettings() {
  const res = await fetch(`${API_BASE}/network/lan`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get LAN settings');
  return res.json();
}

async function setLanSettings(data) {
  const res = await fetch(`${API_BASE}/network/lan`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to set LAN settings');
  return res.json();
}

async function getRoutingPreferences() {
  const res = await fetch(`${API_BASE}/network/routing`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get routing preferences');
  return res.json();
}

async function setRoutingPreferences(prefer) {
  const res = await fetch(`${API_BASE}/network/routing`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify({ prefer })
  });
  if (!res.ok) throw new Error('Failed to set routing preferences');
  return res.json();
}

async function getFirewallConfig() {
  const res = await fetch(`${API_BASE}/network/firewall`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get firewall config');
  return res.json();
}

async function setFirewallConfig(profile) {
  const res = await fetch(`${API_BASE}/network/firewall`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify({ profile })
  });
  if (!res.ok) throw new Error('Failed to set firewall config');
  return res.json();
}

// --- Cellular APN ---
async function getCellApn() {
  const res = await fetch(`${API_BASE}/cell/apn`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get cell APN');
  return res.json();
}

async function setCellApn(apn) {
  const res = await fetch(`${API_BASE}/cell/apn`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify({ apn })
  });
  if (!res.ok) throw new Error('Failed to set cell APN');
  return res.json();
}

// --- Diagnostics ---
async function diagnosticsPing({ ip, count, interfaceType }) {
  const res = await fetch(`${API_BASE}/diagnostics/ping`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ ip, count, interface: interfaceType })
  });
  if (!res.ok) throw new Error('Diagnostics ping failed');
  return res.json();
}

// --- Network Toggle ---
async function networkToggle({ type, enabled }) {
  const res = await fetch(`${API_BASE}/network/toggle`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ type, enabled })
  });
  if (!res.ok) throw new Error('Network toggle failed');
  return res.json();
}

// --- Logs ---
async function getLogTypes() {
  const res = await fetch(`${API_BASE}/logs`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get log types');
  return res.json();
}

async function getLog(logType, start, end) {
  let url = `${API_BASE}/logs/${encodeURIComponent(logType)}`;
  const params = [];
  if (start) params.push(`start=${encodeURIComponent(start)}`);
  if (end) params.push(`end=${encodeURIComponent(end)}`);
  if (params.length) url += `?${params.join('&')}`;
  const res = await fetch(url, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get log');
  return res.text();
}

// --- GPS ---
async function getGps() {
  const res = await fetch(`${API_BASE}/location/gps`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get GPS');
  return res.json();
}

async function toggleGps(enabled) {
  const res = await fetch(`${API_BASE}/location/gps/toggle`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) throw new Error('Failed to toggle GPS');
  return res.json();
}

async function getGpsInterval() {
  const res = await fetch(`${API_BASE}/location/gps/interval`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get GPS interval');
  return res.json();
}

async function setGpsInterval(interval) {
  const res = await fetch(`${API_BASE}/location/gps/interval`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ interval })
  });
  if (!res.ok) throw new Error('Failed to set GPS interval');
  return res.json();
}

// --- Config ---
async function getConfig() {
  const res = await fetch(`${API_BASE}/config`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get config');
  return res;
}

async function setConfig(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData
  });
  if (!res.ok) throw new Error('Failed to set config');
  return res.json();
}

async function resetConfig() {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'DELETE',
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to reset config');
  return res.json();
}

// --- System Update ---
async function systemUpdate(bundle) {
  const formData = new FormData();
  formData.append('bundle', bundle);
  const res = await fetch(`${API_BASE}/system/update`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData
  });
  if (!res.ok) throw new Error('Failed to update system');
  return res.json();
}

// --- Users ---
async function getUsers() {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get users');
  return res.json();
}

async function createUser({ username, password, role, permissions }) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify({ username, password, role, permissions })
  });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
}

async function getUser(username) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to get user');
  return res.json();
}

async function updateUser(username, data) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
}

async function deleteUser(username) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
}

export default {
  setApiBase,
  ping,
  login,
  setJwt,
  getJwt,
  getDiagnosticsStatus,
  getDeviceInfo,
  changePassword,
  getDhcpReservations,
  createDhcpReservation,
  updateDhcpReservation,
  deleteDhcpReservation,
  getDeviceState,
  getDeviceStatus,
  getDeviceDataUsage,
  getDeviceName,
  setDeviceName,
  getWifiStatus,
  getCellStatus,
  getCertusStatus,
  getWifiSettings,
  setWifiSettings,
  getLanSettings,
  setLanSettings,
  getRoutingPreferences,
  setRoutingPreferences,
  getFirewallConfig,
  setFirewallConfig,
  getCellApn,
  setCellApn,
  diagnosticsPing,
  networkToggle,
  getLogTypes,
  getLog,
  getGps,
  toggleGps,
  getGpsInterval,
  setGpsInterval,
  getConfig,
  setConfig,
  resetConfig,
  systemUpdate,
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
};
