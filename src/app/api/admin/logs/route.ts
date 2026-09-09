import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';

export async function GET(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();
    const logs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(500);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
