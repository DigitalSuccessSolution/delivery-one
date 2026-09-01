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
    
    const ids = trackId.split(',').map(id => id.trim()).filter(Boolean);
    const awbs = ids.filter(id => /^\d+$/.test(id));
    const refIds = ids.filter(id => !/^\d+$/.test(id));
    
    let allShipments: any[] = [];
    
    if (awbs.length > 0) {
      const queryParam = `waybill=${awbs.join(',')}`;
      const response = await fetch(`https://track.delhivery.com/api/v1/packages/json/?${queryParam}`, {
        headers: {
          'Authorization': `Token ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.ShipmentData) allShipments = allShipments.concat(data.ShipmentData);
      } catch (e) {
        console.error("Failed to parse Delhivery AWB response:", text.substring(0, 100));
      }
    }

    if (refIds.length > 0) {
      const queryParam = `ref_ids=${refIds.join(',')}`;
      const response = await fetch(`https://track.delhivery.com/api/v1/packages/json/?${queryParam}`, {
        headers: {
          'Authorization': `Token ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.ShipmentData) allShipments = allShipments.concat(data.ShipmentData);
      } catch (e) {
        console.error("Failed to parse Delhivery RefId response:", text.substring(0, 100));
      }
    }

    return NextResponse.json({ ShipmentData: allShipments });
  } catch (error) {
    console.error('Error fetching from Delhivery API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Delhivery API' },
      { status: 500 }
    );
  }
}
