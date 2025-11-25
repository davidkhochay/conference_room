'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { Plus, Building2 } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  primary_domain: string;
  other_domains: string[];
  created_at: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    primary_domain: '',
    other_domains: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Companies | Good Life Rooms';
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/admin/companies');
      const result = await response.json();
      if (result.success) {
        setCompanies(result.data);
      } else {
        setError('Failed to load companies');
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          primary_domain: formData.primary_domain,
          other_domains: formData.other_domains
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setCompanies([...companies, result.data]);
        setFormData({ name: '', primary_domain: '', other_domains: '' });
        setShowForm(false);
      } else {
        setError(result.error?.message || 'Failed to create company');
      }
    } catch (error) {
      console.error('Failed to create company:', error);
      setError('Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="mt-2 text-gray-600">
            Manage Good Life Group companies and their domains
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Company
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">New Company</h3>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <Input
              label="Company Name"
              placeholder="e.g., Good Life Mortgage West"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Primary Domain"
              placeholder="e.g., goodlifemortgagewest.com"
              value={formData.primary_domain}
              onChange={(e) => setFormData({ ...formData, primary_domain: e.target.value })}
              required
            />

            <Input
              label="Other Domains (comma-separated)"
              placeholder="e.g., glmw.com, glmortgage.com"
              value={formData.other_domains}
              onChange={(e) => setFormData({ ...formData, other_domains: e.target.value })}
            />

            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Company'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="text-center py-8 text-gray-600">Loading companies...</div>
        </Card>
      ) : error && companies.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Load Companies
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={fetchCompanies}>Retry</Button>
          </div>
        </Card>
      ) : companies.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Companies Yet</h3>
            <p className="text-gray-600 mb-6">
              Add your first Good Life Group company to get started
            </p>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2 inline" />
                Add Your First Company
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
          <Card key={company.id}>
              <div className="flex items-start justify-between">
                <div className="p-3 bg-purple-100 rounded-lg mr-4">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{company.name}</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Primary Domain
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {company.primary_domain}
                      </p>
                    </div>
                    {company.other_domains && company.other_domains.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Other Domains
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {company.other_domains.map((domain, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                            >
                              {domain}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <Link href={`/admin/companies/${company.id}`}>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {companies.length > 0 && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Info:</strong> Companies represent the different businesses under Good Life
            Group. Each company can have one or more Google Workspace domains for user syncing.
          </p>
        </div>
      )}
    </div>
  );
}

