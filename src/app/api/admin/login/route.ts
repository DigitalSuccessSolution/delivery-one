import { NextResponse } from 'next/server';
import Papa from 'papaparse';

const SHEET_ID = '1TpEBM55z59YKsbB6k6ZWeHIfJzlpmiwU1kU0wNr22Jo';
const ADMINS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Admins`;

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    let isValid = false;

    try {
      // Attempt to fetch from Google Sheets "Admins" tab
      const response = await fetch(ADMINS_CSV_URL, { cache: 'no-store' });
      const text = await response.text();
      
      if (!text.includes('<!DOCTYPE html>') && !text.includes('Sign in - Google Accounts')) {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const admins = result.data as any[];
        
        for (const admin of admins) {
          if (admin.Username === username && admin.Password === password) {
            isValid = true;
            break;
          }
        }
      }
    } catch (sheetError) {
      console.error("Error reading Admins sheet:", sheetError);
    }

    // Fallback to .env if not validated by sheet (good for initial setup)
    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.ADMIN_PASSWORD;
    if (!isValid && envUsername && envPassword && username === envUsername && password === envPassword) {
      isValid = true;
    }

    if (isValid) {
      const response = NextResponse.json({ success: true });
      response.cookies.set({
        name: 'admin_session',
        value: 'authenticated',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      return response;
    }

    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
