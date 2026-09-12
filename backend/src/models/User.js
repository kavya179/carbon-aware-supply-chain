const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * User Model
 *
 * Roles:
 *  - company_manager : Full control — suppliers, dashboard, emissions, recommendations
 *  - supplier        : Submit & manage their own emission data only
 *  - auditor         : Read-only access to all supply chain data and reports
 */
const userSchema = new mongoose.Schema(
  {
    // ─── Basic Info ───────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries by default
    },

    // ─── Role & Permissions ───────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ['company_manager', 'supplier', 'auditor'],
        message: 'Role must be company_manager, supplier, or auditor',
      },
      required: [true, 'User role is required'],
    },

    // ─── Organisation Info ────────────────────────────────────────────
    companyName: {
      type: String,
      trim: true,
      required: [true, 'Company name is required'],
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: [100, 'Job title cannot exceed 100 characters'],
    },

    // ─── Supplier-specific: links this user to a Supplier document ────
    // Only populated when role === 'supplier'
    linkedSupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },

    // ─── Account Status ───────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ─── Token Management ─────────────────────────────────────────────
    // Hashed refresh token (null when logged out)
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    // Password reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ─── Audit Fields ─────────────────────────────────────────────────
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ linkedSupplierId: 1 });

// ─── Pre-save Hook: Hash password before saving ─────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if the password field was modified
  if (!this.isModified('password')) return next();

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────

/**
 * Compare a plain-text password with the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate a password reset token (raw) and store its hash on the document.
 * Returns the raw token to be sent via email.
 * @returns {string} rawToken
 */
userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return rawToken;
};

/**
 * Returns a sanitised user object safe to send to the client.
 * Strips sensitive fields.
 */
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    companyName: this.companyName,
    jobTitle: this.jobTitle,
    linkedSupplierId: this.linkedSupplierId,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

// ─── Virtual: Human-readable role label ────────────────────────────────────
userSchema.virtual('roleLabel').get(function () {
  const labels = {
    company_manager: 'Company / Sustainability Manager',
    supplier: 'Supplier',
    auditor: 'Auditor',
  };
  return labels[this.role] || this.role;
});

const User = mongoose.model('User', userSchema);
module.exports = User;
