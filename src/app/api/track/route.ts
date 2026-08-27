import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const waybill = searchParams.get('waybill');

  if (!waybill) {
    return NextResponse.json(
      { error: 'Waybill parameter is required' },
      { status: 400 }
    );
  }

  try {
    const API_KEY = process.env.DELHIVERY_API_KEY || '046c1dda9a9bfb410a973b7fc24d583d65850f98';
    
    const response = await fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${waybill}`, {
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
