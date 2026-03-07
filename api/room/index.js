import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { Room } from '../models.js';

function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const token = auth.split(' ')[1];
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Missing or invalid token' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { name, isPublic } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name required' });
    const room = await Room.create({
      name,
      adminUuid: user.uuid,
      memberUuids: [user.uuid],
      isPublic: !!isPublic,
      roomUuid: uuidv4()
    });
    return res.status(201).json(room);
  }
  if (req.method === 'GET') {
    const rooms = await Room.find({ $or: [
      { isPublic: true },
      { memberUuids: user.uuid }
    ] });
    return res.json(rooms);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
