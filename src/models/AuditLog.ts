import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  username: string;
  action: string;
  targetId?: string;
  details?: string;
  timestamp: Date;
}

const AuditLogSchema: Schema = new Schema({
  username: { type: String, required: true },
  action: { type: String, required: true },
  targetId: { type: String },
  details: { type: String },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
