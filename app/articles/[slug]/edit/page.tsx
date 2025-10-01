'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ArticleEditor from '../../../components/ArticleEditor';
import { getClientArticleBySlug, updateClientArticle } from '../../../lib/clientStorage';
import { articleAPI } from '../../../services/api';
import type { ClientArticleMetadata } from '../../../lib/clientStorage';

const ArticleEditPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [article, setArticle] = useState<ClientArticleMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slug) {
      loadArticle();
    }
  }, [slug]);

  const loadArticle = async () => {
    try {
      setLoading(true);
      setError(null);

      // Önce backend'den deneyelim, eğer çalışmazsa local'den okuyalım
      try {
        const response = await articleAPI.getArticleBySlug(slug);
        setArticle(response);
      } catch (backendError) {
        // Backend'e ulaşılamazsa client storage'dan oku
        const clientArticle = getClientArticleBySlug(slug);
        if (clientArticle) {
          setArticle(clientArticle);
        } else {
          setError('Article not found');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates: { content?: string; title?: string; metaDescription?: string }) => {
    if (!article) return;

    try {
      setSaving(true);
      setError(null);

      // Önce backend'e deneyelim
      try {
        await articleAPI.updateArticle(slug, updates);
      } catch (backendError) {
        // Backend çalışmazsa client storage'da güncelle
        const success = updateClientArticle(slug, updates);
        if (!success) {
          throw new Error('Failed to update article');
        }
      }

      // Güncellenmiş makaleyi yeniden yükle
      await loadArticle();

      // Başarı mesajı gösterebiliriz
      alert('Article saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
      alert('Error saving article: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading article...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p className="font-medium">Error:</p>
              <p>{error || 'Article not found'}</p>
            </div>
            <div className="mt-6">
              <Link
                href="/articles"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Articles
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <Link
                    href="/articles"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Articles
                  </Link>
                  <span className="text-gray-400">•</span>
                  <Link
                    href={`/articles/${article.slug}`}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    View Article
                  </Link>
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Edit Article</h1>
                <p className="text-gray-600">Make changes to your article and use AI paraphrasing tools</p>
              </div>
              <div className="flex items-center space-x-2">
                {saving && (
                  <span className="text-sm text-green-600 font-medium">Saving...</span>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Editor */}
          <ArticleEditor
            article={article}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
};

export default ArticleEditPage;