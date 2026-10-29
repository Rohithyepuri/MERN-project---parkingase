import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ROLES = ['user', 'staff', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    staffFacilities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }],
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notifications: { type: Boolean, default: true },
    },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    status: this.status,
    favorites: this.favorites,
    staffFacilities: this.staffFacilities,
    preferences: this.preferences,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

export { ROLES };
export default mongoose.model('User', userSchema);
