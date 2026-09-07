import { NextResponse } from 'next/server';
import Papa from 'papaparse';

// The base ID of the spreadsheet
const SHEET_ID = '1TpEBM55z59YKsbB6k6ZWeHIfJzlpmiwU1kU0wNr22Jo';
// URL to download the 'Wallet' tab as CSV
const WALLET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Wallet`;

export async function GET(request: Request) {
  try {
    const response = await fetch(WALLET_CSV_URL, { cache: 'no-store' });
    const text = await response.text();

    if (text.includes('<!DOCTYPE html>') || text.includes('Sign in - Google Accounts')) {
      return NextResponse.json({
        success: false,
        error: 'Google Sheet is PRIVATE or Wallet tab not found.'
      }, { status: 403 });
    }

    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors.length && !result.data.length) {
      // If it fails to parse, it might mean the Wallet tab doesn't exist yet, returning empty for now
      return NextResponse.json({ success: true, balance: 0, history: [] });
    }

    const data = result.data as any[];
    
    // Calculate total balance
    let balance = 0;
    const history = data.map(row => {
      // Ensure we parse amount properly, removing any formatting like commas or currency symbols
      const amountRaw = row['Amount'] || '0';
      const amount = parseFloat(amountRaw.toString().replace(/[^0-9.-]+/g,"")) || 0;
      balance += amount;
      
      let remark = row['Admin Remark'] || row['Remark'] || '';
      const orderId = row['Order ID'] || '';
      const actionBy = row['Action By'] || '';

      if (orderId) {
        remark = `${remark ? remark + ' - ' : ''}Order: ${orderId} | By: ${actionBy}`;
      } else if (actionBy && actionBy !== 'Admin') {
        remark = `${remark} | By: ${actionBy}`;
      }

      return {
        date: row['Date'] || '',
        amount: amount,
        remark: remark
      };
    });

    // Prevent floating point arithmetic accumulation errors
    const roundedBalance = Math.round(balance * 100) / 100;

    return NextResponse.json({
      success: true,
      balance: roundedBalance,
      history
    });
    
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { amount, date, remark } = await request.json();
    
    // We expect the APPS_SCRIPT_URL to have logic to handle action="addWallet"
    const scriptUrl = process.env.APPS_SCRIPT_URL;
    if (!scriptUrl) {
      throw new Error("APPS_SCRIPT_URL is not defined in environment variables");
    }

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'addWallet',
        amount: amount,
        date: date,
        remark: remark || ''
      })
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
