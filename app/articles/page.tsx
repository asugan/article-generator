'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { articleAPI } from '../services/api';
import { getClientArticles } from '../lib/clientStorage';
import type { ClientArticleListItem } from '../lib/clientStorage';

const ArticlesListPage: React.FC = () => {
  const [articles, setArticles] = useState<ClientArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Önce backend'den deneyelim, eğer çalışmazsa local'den okuyalım
      try {
        const response = await articleAPI.getArticles();
        setArticles(response.articles || []);
      } catch (backendError) {
        // Backend'e ulaşılamazsa client storage'dan oku
        const clientArticles = getClientArticles();
        setArticles(clientArticles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
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
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading articles...</p>
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
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">My Articles</h1>
                <p className="text-gray-600 mt-2">Manage and edit your SEO articles</p>
              </div>
              <Link
                href="/"
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
              >
                Create New Article
              </Link>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Articles Grid */}
          {articles.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No articles yet</h3>
              <p className="text-gray-600 mb-6">Start by creating your first SEO article</p>
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Article
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <div
                  key={article.slug}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="p-6">
                    {/* Title */}
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 line-clamp-2">
                      {article.title}
                    </h3>

                    {/* Topic */}
                    <div className="mb-3">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {article.topic}
                      </span>
                    </div>

                    {/* Meta Description */}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {article.metaDescription}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <div className="flex items-center space-x-3">
                        <span>{article.wordCount} words</span>
                        <span>•</span>
                        <span>{formatDate(article.createdAt)}</span>
                      </div>
                    </div>

                    {/* Score Badges */}
                    <div className="flex space-x-2 mb-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getReadabilityColor(article.readabilityScore)}`}>
                        Readability: {article.readabilityScore}
                      </span>
                      {article.seoScore && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSEOColor(article.seoScore)}`}>
                          SEO: {article.seoScore}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Link
                        href={`/articles/${article.slug}/edit`}
                        className="flex-1 text-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/articles/${article.slug}`}
                        className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticlesListPage;