'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/Button';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  onPreview?: (url: string) => void;
}

export function ImageUpload({ value, onChange, label, onPreview }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onChange(result.data.url);
      } else {
        setError(result.error?.message || 'Upload failed');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    } else {
      setError('Please drop an image file');
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {value ? (
        <div className="space-y-3">
          <div 
            className="relative rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => onPreview?.(value)}
          >
            <img
              src={value}
              alt="Room preview"
              className="w-full h-64 object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Click image to view fullscreen • Click X to remove
          </p>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <div className="space-y-4">
            <div className="flex justify-center">
              {uploading ? (
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {uploading ? (
              <p className="text-gray-600">Uploading...</p>
            ) : (
              <>
                <div>
                  <p className="text-gray-700 font-medium mb-1">
                    Drag and drop an image here, or
                  </p>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    variant="secondary"
                    size="sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  JPG, PNG or WebP • Max 5MB • Recommended: 1200x800px
                </p>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-2">
        <button
          type="button"
          onClick={() => {
            const url = prompt('Or paste an image URL:');
            if (url) onChange(url);
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Or paste image URL instead
        </button>
      </div>
    </div>
  );
}

