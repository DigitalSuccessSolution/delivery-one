import { NextResponse } from 'next/server';
import Papa from 'papaparse';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1TpEBM55z59YKsbB6k6ZWeHIfJzlpmiwU1kU0wNr22Jo/export?format=csv';

export async function GET(request: Request) {
  try {
    const response = await fetch(SHEET_URL, { cache: 'no-store' });
    const text = await response.text();

    if (text.includes('<!DOCTYPE html>') || text.includes('Sign in - Google Accounts')) {
      return NextResponse.json({
        success: false,
        error: 'Google Sheet is PRIVATE. Please make it public: Share -> Anyone with the link (Viewer).'
      }, { status: 403 });
    }

    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors.length && !result.data.length) {
      return NextResponse.json({ success: false, error: 'Failed to parse CSV' }, { status: 500 });
    }

    const data = result.data as any[];
    const headers = result.meta.fields || [];
    
    // First 8 columns for the table, the rest for the popup
    const tableHeaders = headers.slice(0, 8);
    const popupHeaders = headers.slice(8);

    const cleanedData = data.map(row => {
      const newRow: any = { _popupData: {} };
      let orderId = '';
      
      tableHeaders.forEach((col, idx) => {
        newRow[col] = row[col] || '';
        if (idx === 0) {
          orderId = row[col];
          newRow._orderId = orderId; 
        }
      });
      
      popupHeaders.forEach(col => {
         newRow._popupData[col] = row[col] || '';
      });
      
      // Get the existing Internal Status if any
      newRow._internalStatus = row['Status'] || row['Internal Status'] || '';
      
      // Explicitly map Discount, Remark and DB Payment so they show up in inputs
      newRow.discount = row['Discount'] || '';
      newRow.remark = row['Remark'] || '';
      newRow.dbPayment = row['DB Payment'] || row['DB payment'] || row['db_payment'] || '';

      return newRow;
    }).filter(row => row._orderId && row._orderId.trim() !== ''); 

    return NextResponse.json({
      success: true,
      tableHeaders: tableHeaders,
      data: cleanedData
    });
    
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
