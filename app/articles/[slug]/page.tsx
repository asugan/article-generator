'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { getClientArticleBySlug } from '../../lib/clientStorage';
import { articleAPI } from '../../services/api';
import type { ClientArticleMetadata } from '../../lib/clientStorage';

const ArticleViewPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [article, setArticle] = useState<ClientArticleMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Burada toast notification ekleyebilirsiniz
  };

  const getReadabilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSEOColor = (score?: number) => {
    if (!score) return 'text-gray-600 bg-gray-50';
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
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
          <div className="max-w-4xl mx-auto">
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <Link
                    href="/articles"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Articles
                  </Link>
                  <span className="text-gray-400">•</span>
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    {article.topic}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{article.title}</h1>
                <p className="text-gray-600">Created: {formatDate(article.createdAt)}</p>
                {article.updatedAt !== article.createdAt && (
                  <p className="text-gray-500 text-sm">Updated: {formatDate(article.updatedAt)}</p>
                )}
              </div>
              <div className="flex space-x-2 ml-6">
                <Link
                  href={`/articles/${article.slug}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Edit Article
                </Link>
              </div>
            </div>

            {/* Meta Description */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">Meta Description:</h3>
              <p className="text-sm text-gray-600">{article.metaDescription}</p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Keywords:</span>
                <div className="flex flex-wrap gap-1">
                  {article.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Tone:</span>
                <span className="text-sm font-medium text-gray-700 capitalize">{article.tone}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Words:</span>
                <span className="text-sm font-medium text-gray-700">{article.wordCount}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getReadabilityColor(article.readabilityScore)}`}>
                  Readability: {article.readabilityScore}/100
                </span>
              </div>
              {article.seoScore && (
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSEOColor(article.seoScore)}`}>
                    SEO: {article.seoScore}/100
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Article Content */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="prose max-w-none">
              <ReactMarkdown>{article.content}</ReactMarkdown>
            </div>

            {/* Actions */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center">
              <Link
                href="/articles"
                className="text-gray-500 hover:text-gray-700 font-medium"
              >
                ← Back to Articles
              </Link>
              <div className="flex space-x-2">
                <button
                  onClick={() => copyToClipboard(article.content)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                >
                  Copy Content
                </button>
                <Link
                  href={`/articles/${article.slug}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Article
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleViewPage;