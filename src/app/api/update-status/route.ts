import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const bodyData = await request.json();
    const { orderId } = bodyData;
    
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const scriptUrl = process.env.APPS_SCRIPT_URL;
    if (!scriptUrl) {
      return NextResponse.json({ error: 'Apps Script URL not configured in .env.local yet.' }, { status: 500 });
    }

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Apps Script requires this to bypass CORS preflight often
      },
      body: JSON.stringify(bodyData)
    });

    const result = await response.json();
    
    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update Google Sheet' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Update Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
