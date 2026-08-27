import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('waybill'); // We keep the param name 'waybill' so frontend doesn't break

  if (!trackId) {
    return NextResponse.json(
      { error: 'Tracking ID parameter is required' },
      { status: 400 }
    );
  }

  try {
    const API_KEY = process.env.DELHIVERY_API_KEY || '046c1dda9a9bfb410a973b7fc24d583d65850f98';
    
    // Delhivery uses 'waybill' for pure AWB numbers, and 'ref_ids' for Order IDs (like ORD008078).
    // If the input is only numbers, it's an AWB. If it has letters, it's an Order ID.
    const isAwb = /^\d+$/.test(trackId.trim());
    const queryParam = isAwb ? `waybill=${trackId.trim()}` : `ref_ids=${trackId.trim()}`;
    
    const response = await fetch(`https://track.delhivery.com/api/v1/packages/json/?${queryParam}`, {
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching from Delhivery API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Delhivery API' },
      { status: 500 }
    );
  }
}
