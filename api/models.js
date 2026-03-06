import mongoose from 'mongoose';

export const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  uuid: { type: String, required: true, unique: true },
}, { timestamps: true }));

export const Room = mongoose.models.Room || mongoose.model('Room', new mongoose.Schema({
  name: { type: String, required: true },
  adminUuid: { type: String, required: true },
  memberUuids: { type: [String], default: [] },
  isPublic: { type: Boolean, default: true },
  roomUuid: { type: String, required: true, unique: true },
}, { timestamps: true }));
