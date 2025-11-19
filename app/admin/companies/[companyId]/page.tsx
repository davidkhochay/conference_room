'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Company {
  id: string;
  name: string;
  primary_domain: string;
  other_domains: string[];
}

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    primary_domain: '',
    other_domains: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/companies/${companyId}`);
        const result = await res.json();
        if (result.success) {
          const data: Company = result.data;
          setCompany(data);
          setFormData({
            name: data.name,
            primary_domain: data.primary_domain,
            other_domains: (data.other_domains || []).join(', '),
          });
        } else {
          setError(result.error?.message || 'Company not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load company');
      } finally {
        setLoading(false);
      }
    };

    if (companyId) load();
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'PUT',
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
      const result = await res.json();

      if (result.success) {
        router.push('/admin/companies');
      } else {
        setError(result.error?.message || 'Failed to update company');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this company?')) return;
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/admin/companies');
      }
    } catch (err) {
      console.error('Failed to delete company', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading company...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <div className="text-center py-8 px-8">
            <p className="text-gray-600 mb-4">{error || 'Company not found'}</p>
            <Link href="/admin/companies">
              <Button>Back to Companies</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/admin/companies">
          <button className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium shadow-sm transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Companies
          </button>
        </Link>
      </div>

      <Card title="Edit Company">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Input
            label="Company Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Primary Domain"
            value={formData.primary_domain}
            onChange={(e) => setFormData({ ...formData, primary_domain: e.target.value })}
            required
          />

          <Input
            label="Other Domains (comma separated)"
            value={formData.other_domains}
            onChange={(e) => setFormData({ ...formData, other_domains: e.target.value })}
          />

          <div className="flex justify-between pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}


