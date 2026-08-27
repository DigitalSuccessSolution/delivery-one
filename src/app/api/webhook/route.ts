import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Order } from '@/models/Order';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Received Webhook Payload:', JSON.stringify(payload, null, 2));

    await connectToDatabase();

    // Delhivery webhook structure can vary, but generally contains Shipment details
    // We will try to extract AWB and Status from standard possible fields
    const shipment = payload.Shipment || payload.ShipmentData?.[0]?.Shipment || payload;
    
    if (!shipment || !shipment.AWB) {
      return NextResponse.json(
        { error: 'Invalid payload, missing AWB' },
        { status: 400 }
      );
    }

    const awb = shipment.AWB;
    const status = shipment.Status?.Status || shipment.status || 'Unknown';
    const destination = shipment.Destination || 'Unknown';
    const orderId = shipment.ReferenceNo || payload.ref_ids || 'N/A';

    // Update or insert the order
    await Order.findOneAndUpdate(
      { awb },
      {
        awb,
        orderId,
        status,
        destination,
        rawPayload: payload,
        // Executive and payment mapping can be refined based on exact Delhivery payload
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
