import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';

export async function POST(request: Request) {
  try {
    const username = request.headers.get('x-user-username') || 'system';
    const bodyData = await request.json();
    const { orderId, status } = bodyData;
    
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
      try {
        await dbConnect();
        await AuditLog.create({
          username,
          action: status ? `Updated status to ${status}` : 'Updated order',
          targetId: orderId,
          details: JSON.stringify(bodyData)
        });
      } catch (logErr) {
        console.error('Audit log failed:', logErr);
      }
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update Google Sheet' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Update Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
