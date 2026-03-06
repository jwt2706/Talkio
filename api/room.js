import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const Room = mongoose.models.Room || mongoose.model('Room', new mongoose.Schema({
  name: { type: String, required: true },
  adminUuid: { type: String, required: true },
  memberUuids: { type: [String], default: [] },
  isPublic: { type: Boolean, default: true },
  roomUuid: { type: String, required: true, unique: true },
}, { timestamps: true }));

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

  if (req.method === 'POST') {
    if (req.url.endsWith('/add')) {
      const { userUuid } = req.body;
      const room = await Room.findOne({ roomUuid: req.query.roomUuid });
      if (!room) return res.status(404).json({ error: 'Room not found' });
      if (!room.memberUuids.includes(userUuid)) {
        room.memberUuids.push(userUuid);
        await room.save();
      }
      return res.json(room);
    } else {
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
