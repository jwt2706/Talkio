import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Room from '../models/Room.js';
import User from '../models/User.js';

const router = express.Router();

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Create room
router.post('/', authMiddleware, async (req, res) => {
  const { name, isPublic } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name required' });
  try {
    const room = await Room.create({
      name,
      adminUuid: req.user.uuid,
      memberUuids: [req.user.uuid],
      isPublic: !!isPublic,
      roomUuid: uuidv4()
    });
    res.status(201).json(room);
  } catch (e) {
    res.status(500).json({ error: 'Room creation failed' });
  }
});

// List rooms (public or joined)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find({ $or: [
      { isPublic: true },
      { memberUuids: req.user.uuid }
    ] });
    res.json(rooms);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Add user to room
router.post('/:roomUuid/add', authMiddleware, async (req, res) => {
  const { userUuid } = req.body;
  try {
    const room = await Room.findOne({ roomUuid: req.params.roomUuid });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.memberUuids.includes(userUuid)) {
      room.memberUuids.push(userUuid);
      await room.save();
    }
    res.json(room);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add user' });
  }
});

export default router;
