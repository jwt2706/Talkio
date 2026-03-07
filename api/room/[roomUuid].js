import jwt from 'jsonwebtoken';
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

  if (req.method === 'POST' && req.url.endsWith('/add')) {
    const { userUuid } = req.body;
    const room = await Room.findOne({ roomUuid: req.query.roomUuid });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.memberUuids.includes(userUuid)) {
      room.memberUuids.push(userUuid);
      await room.save();
    }
    return res.json(room);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
