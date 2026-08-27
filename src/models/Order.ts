import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOrder extends Document {
  awb: string;
  orderId: string;
  status: string;
  destination: string;
  executive: string;
  payment: string;
  product: string;
  updatedAt: Date;
  rawPayload: any; // Storing the raw webhook payload for debugging
}

const OrderSchema = new Schema<IOrder>({
  awb: { type: String, required: true, unique: true },
  orderId: { type: String, default: 'N/A' },
  status: { type: String, required: true },
  destination: { type: String, default: 'N/A' },
  executive: { type: String, default: 'Not Assigned' },
  payment: { type: String, default: 'Prepaid' },
  product: { type: String, default: 'Unknown Product' },
  rawPayload: { type: Schema.Types.Mixed }, // Store arbitrary JSON
}, { timestamps: true });

// Prevent mongoose from compiling the model multiple times in Next.js development
export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
