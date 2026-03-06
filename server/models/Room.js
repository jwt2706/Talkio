import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  adminUuid: { type: String, required: true },
  memberUuids: { type: [String], default: [] },
  isPublic: { type: Boolean, default: true },
  roomUuid: { type: String, required: true, unique: true },
}, { timestamps: true });

export default mongoose.model('Room', roomSchema);
