'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/lib/components/ui/DropdownMenu';
import { UserImportModal } from '@/lib/components/admin/UserImportModal';
import { Pencil, Plus, Search, Building2, Upload, RefreshCw, ChevronDown, UserPlus, Filter, X } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  company?: {
    name: string;
  };
  created_at: string;
  status?: 'active' | 'inactive' | 'deleted';
}

interface Company {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('all');
  const [companyFilters, setCompanyFilters] = useState<string[]>([]);
  const [duplicateFilter, setDuplicateFilter] = useState<'none' | 'name' | 'email'>('none');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Update URL with current filters
  const updateURL = useCallback((
    status: string,
    companyIds: string[],
    duplicate: string,
    search: string
  ) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (companyIds.length > 0) params.set('companies', companyIds.join(','));
    if (duplicate !== 'none') params.set('duplicates', duplicate);
    if (search) params.set('search', search);
    
    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : '/admin/users', { scroll: false });
  }, [router]);

  // Initialize filters from URL on mount
  useEffect(() => {
    const status = searchParams.get('status') as 'active' | 'inactive' | null;
    const companiesParam = searchParams.get('companies');
    const duplicatesParam = searchParams.get('duplicates') as 'name' | 'email' | null;
    const searchParam = searchParams.get('search');
    
    if (status) setStatusFilter(status);
    if (companiesParam) setCompanyFilters(companiesParam.split(',').filter(Boolean));
    if (duplicatesParam) setDuplicateFilter(duplicatesParam);
    if (searchParam) setSearchTerm(searchParam);
    
    setInitialized(true);
  }, [searchParams]);

  // Update URL when filters change (after initialization)
  useEffect(() => {
    if (initialized) {
      updateURL(statusFilter, companyFilters, duplicateFilter, searchTerm);
    }
  }, [statusFilter, companyFilters, duplicateFilter, searchTerm, initialized, updateURL]);

  useEffect(() => {
    document.title = 'Users | Good Life Rooms';
    fetchUsers();
    fetchCompanies();
  }, []);

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

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + companyFilters.length + (duplicateFilter !== 'none' ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('all');
    setCompanyFilters([]);
    setDuplicateFilter('none');
  };

  // Find duplicate names and emails
  const duplicateNames = new Set<string>();
  const duplicateEmails = new Set<string>();
  
  const nameCount: Record<string, number> = {};
  const emailCount: Record<string, number> = {};
  
  users.forEach(user => {
    const nameLower = user.name.toLowerCase().trim();
    const emailLower = user.email.toLowerCase().trim();
    nameCount[nameLower] = (nameCount[nameLower] || 0) + 1;
    emailCount[emailLower] = (emailCount[emailLower] || 0) + 1;
  });
  
  Object.entries(nameCount).forEach(([name, count]) => {
    if (count > 1) duplicateNames.add(name);
  });
  
  Object.entries(emailCount).forEach(([email, count]) => {
    if (count > 1) duplicateEmails.add(email);
  });

  const toggleCompanyFilter = (companyId: string) => {
    setCompanyFilters(prev => 
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const removeCompanyFilter = (companyId: string) => {
    setCompanyFilters(prev => prev.filter(id => id !== companyId));
  };

  const fetchUsers = async () => {
    try {
      // Fetch all users, we'll filter on the client side
      const response = await fetch('/api/admin/users?status=all');
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromGoogle = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/users/sync', {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        alert(result.error?.message || 'Failed to sync users from Google');
        return;
      }
      // Refresh current view after sync completes
      await fetchUsers();
      alert('User directory synced from Google.');
    } catch (error) {
      console.error('Failed to sync users from Google:', error);
      alert('Failed to sync users from Google');
    } finally {
      setSyncing(false);
    }
  };

  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.company?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || (user.status || 'active') === statusFilter;
    
    // Company filter (multi-select)
    const matchesCompany = companyFilters.length === 0 || (user.company_id && companyFilters.includes(user.company_id));
    
    // Duplicate filter
    let matchesDuplicate = true;
    if (duplicateFilter === 'name') {
      matchesDuplicate = duplicateNames.has(user.name.toLowerCase().trim());
    } else if (duplicateFilter === 'email') {
      matchesDuplicate = duplicateEmails.has(user.email.toLowerCase().trim());
    }
    
    return matchesSearch && matchesStatus && matchesCompany && matchesDuplicate;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <Link href="/admin">
              <Button variant="secondary" size="sm">
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 ${
                    activeFilterCount > 0
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem 
                  onClick={() => setStatusFilter('all')}
                  className={statusFilter === 'all' ? 'bg-gray-100' : ''}
                >
                  <span className="flex-1">All Statuses</span>
                  {statusFilter === 'all' && <span className="text-blue-600">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setStatusFilter('active')}
                  className={statusFilter === 'active' ? 'bg-gray-100' : ''}
                >
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                  <span className="flex-1">Active</span>
                  {statusFilter === 'active' && <span className="text-blue-600">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setStatusFilter('inactive')}
                  className={statusFilter === 'inactive' ? 'bg-gray-100' : ''}
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                  <span className="flex-1">Inactive</span>
                  {statusFilter === 'inactive' && <span className="text-blue-600">✓</span>}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Company</span>
                  {companyFilters.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompanyFilters([]);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </DropdownMenuLabel>
                {companies.map((company) => (
                  <DropdownMenuItem 
                    key={company.id}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleCompanyFilter(company.id);
                    }}
                    className={companyFilters.includes(company.id) ? 'bg-blue-50' : ''}
                  >
                    <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${
                      companyFilters.includes(company.id) 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'border-gray-300'
                    }`}>
                      {companyFilters.includes(company.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1 truncate">{company.name}</span>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                
                <DropdownMenuLabel>Find Duplicates</DropdownMenuLabel>
                <DropdownMenuItem 
                  onClick={() => setDuplicateFilter('none')}
                  className={duplicateFilter === 'none' ? 'bg-gray-100' : ''}
                >
                  <span className="flex-1">No duplicate filter</span>
                  {duplicateFilter === 'none' && <span className="text-blue-600">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDuplicateFilter('name')}
                  className={duplicateFilter === 'name' ? 'bg-gray-100' : ''}
                >
                  <span className="flex-1">Duplicate Names</span>
                  {duplicateNames.size > 0 && (
                    <span className="text-xs text-orange-600 mr-2">({duplicateNames.size})</span>
                  )}
                  {duplicateFilter === 'name' && <span className="text-blue-600">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDuplicateFilter('email')}
                  className={duplicateFilter === 'email' ? 'bg-gray-100' : ''}
                >
                  <span className="flex-1">Duplicate Emails</span>
                  {duplicateEmails.size > 0 && (
                    <span className="text-xs text-orange-600 mr-2">({duplicateEmails.size})</span>
                  )}
                  {duplicateFilter === 'email' && <span className="text-blue-600">✓</span>}
                </DropdownMenuItem>

                {activeFilterCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearFilters} className="text-red-600">
                      <X className="w-4 h-4 mr-2" />
                      Clear all filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 flex items-center gap-2"
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync'}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSyncFromGoogle} disabled={syncing}>
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google Sync
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-50">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#0078D4" d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12s5.373 12 12 12 12-5.373 12-12zM10.5 6h3v3h3v3h-3v3h-3v-3h-3V9h3V6z"/>
                  </svg>
                  Outlook Sync
                  <span className="ml-auto text-xs text-gray-400">Coming soon</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/admin/users/new" className="flex items-center">
                    <Plus className="w-4 h-4 mr-2" />
                    New User
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Users
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Active Filter Badges */}
        {activeFilterCount > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Active filters:</span>
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {companyFilters.map(companyId => {
              const company = companies.find(c => c.id === companyId);
              return company ? (
                <span 
                  key={companyId}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm"
                >
                  <Building2 className="w-3 h-3" />
                  {company.name}
                  <button
                    onClick={() => removeCompanyFilter(companyId)}
                    className="ml-1 hover:text-blue-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
            {duplicateFilter !== 'none' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm">
                Duplicates: {duplicateFilter === 'name' ? 'Names' : 'Emails'}
                <button
                  onClick={() => setDuplicateFilter('none')}
                  className="ml-1 hover:text-orange-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}

        {loading ? (
          <Card>
            <div className="text-center py-8 text-gray-600">Loading users...</div>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'No users found matching your search' : 'No users yet'}
              </p>
              {!searchTerm && (
                <Link href="/admin/users/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2 inline" />
                    Add First User
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.company ? (
                        <div className="flex items-center text-sm text-gray-600">
                          <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                          {user.company.name}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No company</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.status === 'inactive'
                            ? 'bg-yellow-100 text-yellow-800'
                            : user.status === 'deleted'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {user.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="secondary" size="sm">
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-600">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </main>

      <UserImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => fetchUsers()}
      />
    </div>
  );
}

