import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { User } from '../models.js';

export default async function handler(req, res) {
  await mongoose.connect(process.env.MONGODB_URI);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, uuid: uuidv4() });
  return res.status(201).json({ email: user.email, uuid: user.uuid });
}
