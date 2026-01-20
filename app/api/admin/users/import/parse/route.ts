import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { error: 'NO_FILE', message: 'No file provided' } },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'INVALID_FILE_TYPE',
            message: 'Only CSV (.csv) and Excel (.xlsx, .xls) files are supported',
          },
        },
        { status: 400 }
      );
    }

    let headers: string[] = [];
    let rows: Record<string, string>[] = [];

    if (isCSV) {
      // Parse CSV using PapaParse
      const text = await file.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (result.errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error: 'PARSE_ERROR',
              message: `Failed to parse CSV: ${result.errors[0].message}`,
            },
          },
          { status: 400 }
        );
      }

      headers = result.meta.fields || [];
      rows = result.data;
    } else {
      // Parse Excel using XLSX
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error: 'EMPTY_FILE',
              message: 'The Excel file has no sheets',
            },
          },
          { status: 400 }
        );
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: '',
      }) as string[][];

      if (jsonData.length < 2) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error: 'INSUFFICIENT_DATA',
              message: 'The file must have at least a header row and one data row',
            },
          },
          { status: 400 }
        );
      }

      // First row is headers
      headers = jsonData[0].map((h) => String(h).trim());
      
      // Rest are data rows
      rows = jsonData.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] !== undefined ? String(row[index]) : '';
        });
        return obj;
      });
    }

    // Filter out completely empty rows
    rows = rows.filter((row) =>
      Object.values(row).some((value) => value && value.trim() !== '')
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'NO_DATA',
            message: 'No data rows found in the file',
          },
        },
        { status: 400 }
      );
    }

    // Return headers, preview rows (first 5), and total count
    const previewRows = rows.slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        headers,
        previewRows,
        allRows: rows,
        totalRows: rows.length,
      },
    });
  } catch (error: unknown) {
    console.error('Parse error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      {
        success: false,
        error: {
          error: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    );
  }
}
