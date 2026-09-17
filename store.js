import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const empty = { nextTicketId: 1, tickets: {}, ticketRoles: {} };

function ensureStore() {
  const full = path.resolve(config.dataPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) fs.writeFileSync(full, JSON.stringify(empty, null, 2));
  return full;
}

export function loadStore() {
  const full = ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!parsed.nextTicketId || !parsed.tickets) return structuredClone(empty);
    return parsed;
  } catch {
    return structuredClone(empty);
  }
}

export function saveStore(store) {
  const full = ensureStore();
  const tmp = `${full}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, full);
}

export function createTicketRecord(data) {
  const store = loadStore();
  const id = store.nextTicketId++;
  const record = { id, status: 'open', claimedBy: null, ...data };
  store.tickets[String(id)] = record;
  saveStore(store);
  return record;
}

export function updateTicket(id, patch) {
  const store = loadStore();
  const key = String(id);
  if (!store.tickets[key]) return null;
  store.tickets[key] = { ...store.tickets[key], ...patch };
  saveStore(store);
  return store.tickets[key];
}

export function setTicketRole(guildId, type, roleId) {
  const store = loadStore();
  if (!store.ticketRoles) store.ticketRoles = {};
  if (!store.ticketRoles[guildId]) store.ticketRoles[guildId] = {};
  store.ticketRoles[guildId][type] = roleId;
  saveStore(store);
}

export function getTicketRole(guildId, type) {
  const store = loadStore();
  return store.ticketRoles?.[guildId]?.[type] ?? null;
}

export function findTicketByChannel(channelId) {
  const store = loadStore();
  return Object.values(store.tickets).find(t => t.channelId === channelId) ?? null;
}

export function findOpenTicketByUser(guildId, userId) {
  const store = loadStore();
  return Object.values(store.tickets).find(t => t.guildId === guildId && t.userId === userId && t.status === 'open') ?? null;
}
