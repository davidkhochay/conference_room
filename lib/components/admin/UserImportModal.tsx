'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/lib/components/ui/Button';
import { X, Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

interface ParsedData {
  headers: string[];
  previewRows: Record<string, string>[];
  allRows: Record<string, string>[];
  totalRows: number;
}

interface DuplicateInfo {
  rowIndex: number;
  newData: {
    name: string;
    email: string;
    role: string;
    company_id: string | null;
    company_name: string | null;
    status: string;
  };
  existingUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    company_id: string | null;
    company_name: string | null;
    status: string;
  };
}

interface UserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'duplicates' | 'complete';

const USER_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'role', label: 'Role', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'status', label: 'Status', required: false },
];

export function UserImportModal({ isOpen, onClose, onImportComplete }: UserImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [defaultCompanyId, setDefaultCompanyId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Duplicate resolution state
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);
  const [readyToInsert, setReadyToInsert] = useState<Array<{
    name: string;
    email: string;
    role: string;
    company_id: string | null;
    status: string;
  }>>([]);
  const [toUpdate, setToUpdate] = useState<Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    company_id: string | null;
    status: string;
  }>>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  
  // Import results
  const [importResult, setImportResult] = useState<{
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: Array<{ email: string; error: string }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
    }
  }, [isOpen]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/admin/companies');
      const result = await response.json();
      if (result.success) {
        setCompanies(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedData(null);
    setMapping({});
    setDefaultCompanyId('');
    setError('');
    setLoading(false);
    setDuplicates([]);
    setCurrentDuplicateIndex(0);
    setReadyToInsert([]);
    setToUpdate([]);
    setSkippedCount(0);
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/users/import/parse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to parse file');
        setFile(null);
        return;
      }

      setParsedData(result.data);
      
      // Auto-map headers that match field names
      const autoMapping: Record<string, string> = {};
      for (const field of USER_FIELDS) {
        const matchingHeader = result.data.headers.find(
          (h: string) => h.toLowerCase() === field.key.toLowerCase()
        );
        if (matchingHeader) {
          autoMapping[field.key] = matchingHeader;
        }
      }
      setMapping(autoMapping);
      
      setStep('mapping');
    } catch (error) {
      console.error('Failed to parse file:', error);
      setError('Failed to parse file');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (fieldKey: string, headerValue: string) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: headerValue,
    }));
  };

  const isMappingValid = () => {
    return mapping.name && mapping.email;
  };

  const handleProceedToPreview = () => {
    if (!isMappingValid()) {
      setError('Name and Email fields are required');
      return;
    }
    setError('');
    setStep('preview');
  };

  const getMappedRows = () => {
    if (!parsedData) return [];
    
    return parsedData.allRows.map((row) => ({
      name: row[mapping.name] || '',
      email: row[mapping.email] || '',
      role: mapping.role ? row[mapping.role] : undefined,
      company: mapping.company ? row[mapping.company] : undefined,
      status: mapping.status ? row[mapping.status] : undefined,
    })).filter((row) => row.name && row.email);
  };

  const handleStartImport = async () => {
    setLoading(true);
    setError('');

    try {
      const mappedRows = getMappedRows();
      
      const response = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: mappedRows,
          defaultCompanyId: defaultCompanyId || null,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        // Show more detailed error info if available
        let errorMsg = result.error?.message || 'Failed to check duplicates';
        if (result.error?.details?.fieldErrors) {
          const fieldErrors = result.error.details.fieldErrors;
          const errorDetails = Object.entries(fieldErrors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('; ');
          if (errorDetails) {
            errorMsg += ` (${errorDetails})`;
          }
        }
        setError(errorMsg);
        console.error('Import validation error:', result.error);
        return;
      }

      const { duplicates: foundDuplicates, readyToInsert: ready } = result.data;
      
      setReadyToInsert(ready);
      
      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        setCurrentDuplicateIndex(0);
        setStep('duplicates');
      } else {
        // No duplicates, proceed with import
        await executeImport(ready, []);
      }
    } catch (error) {
      console.error('Import error:', error);
      setError('Failed to start import');
    } finally {
      setLoading(false);
    }
  };

  const handleOverwrite = () => {
    const duplicate = duplicates[currentDuplicateIndex];
    const newUpdateItem = {
      id: duplicate.existingUser.id,
      name: duplicate.newData.name,
      email: duplicate.newData.email,
      role: duplicate.newData.role as 'user' | 'admin',
      company_id: duplicate.newData.company_id,
      status: duplicate.newData.status as 'active' | 'inactive' | 'deleted',
    };
    
    const updatedToUpdate = [...toUpdate, newUpdateItem];
    setToUpdate(updatedToUpdate);
    
    // Check if this is the last duplicate
    if (currentDuplicateIndex < duplicates.length - 1) {
      setCurrentDuplicateIndex((prev) => prev + 1);
    } else {
      // All duplicates resolved, execute import with the updated list
      executeImport(readyToInsert, updatedToUpdate);
    }
  };

  const handleKeepOld = () => {
    setSkippedCount((prev) => prev + 1);
    
    // Check if this is the last duplicate
    if (currentDuplicateIndex < duplicates.length - 1) {
      setCurrentDuplicateIndex((prev) => prev + 1);
    } else {
      // All duplicates resolved, execute import
      executeImport(readyToInsert, toUpdate);
    }
  };

  const executeImport = async (
    insertList: typeof readyToInsert,
    updateList: typeof toUpdate
  ) => {
    setStep('importing');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toInsert: insertList,
          toUpdate: updateList,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Import failed');
        return;
      }

      setImportResult({
        insertedCount: result.data.insertedCount,
        updatedCount: result.data.updatedCount,
        skippedCount: skippedCount,
        errors: result.data.errors,
      });
      setStep('complete');
    } catch (error) {
      console.error('Execute import error:', error);
      setError('Failed to execute import');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onImportComplete();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'upload' && 'Import Users from Spreadsheet'}
            {step === 'mapping' && 'Map Columns to Fields'}
            {step === 'preview' && 'Preview Import'}
            {step === 'duplicates' && `Resolve Duplicate (${currentDuplicateIndex + 1} of ${duplicates.length})`}
            {step === 'importing' && 'Importing Users...'}
            {step === 'complete' && 'Import Complete'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  {loading ? 'Parsing file...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-500">
                  Supports CSV (.csv) and Excel (.xlsx, .xls) files
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Expected Columns</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>Name</strong> (required) - Full name of the user</li>
                  <li><strong>Email</strong> (required) - Email address</li>
                  <li><strong>Role</strong> (optional) - "user" or "admin"</li>
                  <li><strong>Company</strong> (optional) - Company name (must match existing)</li>
                  <li><strong>Status</strong> (optional) - "active", "inactive", or "deleted"</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step: Mapping */}
          {step === 'mapping' && parsedData && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Map your spreadsheet columns to user fields. Found <strong>{parsedData.totalRows}</strong> rows.
              </p>

              <div className="space-y-4">
                {USER_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <label className="w-32 text-sm font-medium text-gray-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="">-- Select column --</option>
                      {parsedData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Company (for users without a company column)
                </label>
                <select
                  value={defaultCompanyId}
                  onChange={(e) => setDefaultCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="">-- No default company --</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview of first few rows */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-800 mb-2">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        {parsedData.headers.map((header) => (
                          <th key={header} className="px-3 py-2 text-left border-b text-gray-700">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {parsedData.headers.map((header) => (
                            <td key={header} className="px-3 py-2 border-b text-gray-600">
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && parsedData && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Ready to import <strong>{getMappedRows().length}</strong> users.
              </p>

              <div className="overflow-x-auto max-h-96 border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left border-b text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left border-b text-gray-700">Email</th>
                      <th className="px-3 py-2 text-left border-b text-gray-700">Role</th>
                      <th className="px-3 py-2 text-left border-b text-gray-700">Company</th>
                      <th className="px-3 py-2 text-left border-b text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getMappedRows().slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b text-gray-900">{row.name}</td>
                        <td className="px-3 py-2 border-b text-gray-600">{row.email}</td>
                        <td className="px-3 py-2 border-b text-gray-600">{row.role || 'user'}</td>
                        <td className="px-3 py-2 border-b text-gray-600">
                          {row.company || (defaultCompanyId ? companies.find(c => c.id === defaultCompanyId)?.name : '-')}
                        </td>
                        <td className="px-3 py-2 border-b text-gray-600">{row.status || 'active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {getMappedRows().length > 50 && (
                  <p className="text-center text-gray-500 py-2">
                    ... and {getMappedRows().length - 50} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step: Duplicates */}
          {step === 'duplicates' && duplicates.length > 0 && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  A user with email <strong>{duplicates[currentDuplicateIndex].existingUser.email}</strong> already exists.
                  What would you like to do?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Existing User */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                    Existing User
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Name</dt>
                      <dd className="text-gray-900 font-medium">{duplicates[currentDuplicateIndex].existingUser.name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Email</dt>
                      <dd className="text-gray-900">{duplicates[currentDuplicateIndex].existingUser.email}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Role</dt>
                      <dd className="text-gray-900">{duplicates[currentDuplicateIndex].existingUser.role}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Company</dt>
                      <dd className="text-gray-900">{duplicates[currentDuplicateIndex].existingUser.company_name || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Status</dt>
                      <dd className="text-gray-900">{duplicates[currentDuplicateIndex].existingUser.status}</dd>
                    </div>
                  </dl>
                </div>

                {/* New Data */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <h4 className="font-medium text-blue-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    New Data (from spreadsheet)
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Name</dt>
                      <dd className="text-gray-900 font-medium">
                        {duplicates[currentDuplicateIndex].newData.name}
                        {duplicates[currentDuplicateIndex].newData.name !== duplicates[currentDuplicateIndex].existingUser.name && (
                          <span className="ml-2 text-xs text-blue-600">(changed)</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Email</dt>
                      <dd className="text-gray-900">{duplicates[currentDuplicateIndex].newData.email}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Role</dt>
                      <dd className="text-gray-900">
                        {duplicates[currentDuplicateIndex].newData.role}
                        {duplicates[currentDuplicateIndex].newData.role !== duplicates[currentDuplicateIndex].existingUser.role && (
                          <span className="ml-2 text-xs text-blue-600">(changed)</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Company</dt>
                      <dd className="text-gray-900">
                        {duplicates[currentDuplicateIndex].newData.company_name || '-'}
                        {duplicates[currentDuplicateIndex].newData.company_name !== duplicates[currentDuplicateIndex].existingUser.company_name && (
                          <span className="ml-2 text-xs text-blue-600">(changed)</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Status</dt>
                      <dd className="text-gray-900">
                        {duplicates[currentDuplicateIndex].newData.status}
                        {duplicates[currentDuplicateIndex].newData.status !== duplicates[currentDuplicateIndex].existingUser.status && (
                          <span className="ml-2 text-xs text-blue-600">(changed)</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleKeepOld}
                  variant="secondary"
                  className="flex-1"
                >
                  Keep Old
                </Button>
                <Button
                  onClick={handleOverwrite}
                  className="flex-1"
                >
                  Overwrite with New
                </Button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-lg text-gray-700">Importing users...</p>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Import Complete!</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{importResult.insertedCount}</div>
                  <div className="text-sm text-green-700">Created</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{importResult.updatedCount}</div>
                  <div className="text-sm text-blue-700">Updated</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-600">{importResult.skippedCount}</div>
                  <div className="text-sm text-gray-700">Skipped</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Errors ({importResult.errors.length})</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>
                        <strong>{err.email}</strong>: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          {step === 'upload' && (
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="secondary" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleProceedToPreview} disabled={!isMappingValid()}>
                Continue
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="secondary" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleStartImport} disabled={loading}>
                {loading ? 'Checking...' : `Import ${getMappedRows().length} Users`}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleComplete}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
