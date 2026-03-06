import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  uuid: { type: String, required: true, unique: true },
}, { timestamps: true }));

export default async function handler(req, res) {
  await mongoose.connect(process.env.MONGODB_URI);

  if (req.method === 'POST') {
    if (req.url.endsWith('/register')) {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'Email already registered' });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ email, passwordHash, uuid: uuidv4() });
      return res.status(201).json({ email: user.email, uuid: user.uuid });
    }
    if (req.url.endsWith('/login')) {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ uuid: user.uuid, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, uuid: user.uuid, email: user.email });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
