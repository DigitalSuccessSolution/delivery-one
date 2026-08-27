import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Order } from '@/models/Order';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    
    // Fetch all active orders (you can filter by status later if needed)
    // Sorting by updatedAt descending to show latest updates first
    const orders = await Order.find().sort({ updatedAt: -1 }).limit(100);
    
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders from database' },
      { status: 500 }
    );
  }
}
