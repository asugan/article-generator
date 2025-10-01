'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import {
  articleAPI,
  ArticleGenerationRequest,
  ArticleGenerationResponse,
  SEOAnalysisRequest,
  SEOAnalysisResponse
} from '../services/api';

interface ArticleGeneratorFormData {
  topic: string;
  target_length: number;
  keywords: string;
  tone: 'professional' | 'casual' | 'formal';
  include_paraphrasing: boolean;
  adequacy: number;
  fluency: number;
  diversity: number;
  max_variations: number;
}

const ArticleGenerator: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<ArticleGenerationResponse | null>(null);
  const [seoAnalysis, setSeoAnalysis] = useState<SEOAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'article' | 'variations' | 'seo'>('article');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ArticleGeneratorFormData>({
    defaultValues: {
      topic: '',
      target_length: 500,
      keywords: '',
      tone: 'professional',
      include_paraphrasing: true,
      adequacy: 1.2,
      fluency: 1.5,
      diversity: 1.0,
      max_variations: 3,
    },
  });

  const includeParaphrasing = watch('include_paraphrasing');

  const onSubmit = async (data: ArticleGeneratorFormData) => {
    setIsGenerating(true);
    setError(null);

    try {
      const keywords = data.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const request: ArticleGenerationRequest = {
        topic: data.topic,
        target_length: data.target_length,
        keywords,
        tone: data.tone,
        include_paraphrasing: data.include_paraphrasing,
        paraphrase_config: data.include_paraphrasing ? {
          adequacy: data.adequacy,
          fluency: data.fluency,
          diversity: data.diversity,
          max_variations: data.max_variations,
        } : undefined,
      };

      const articleResponse = await articleAPI.generateArticle(request);
      setGeneratedArticle(articleResponse);

      // Also perform SEO analysis
      const seoRequest: SEOAnalysisRequest = {
        article_text: articleResponse.generated_article,
        target_keywords: keywords,
      };
      const seoResponse = await articleAPI.analyzeSEO(seoRequest);
      setSeoAnalysis(seoResponse);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate article');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const downloadAsText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">SEO Article Generator</h1>

      {/* Generation Form */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Topic Input */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic / Main Keyword
              </label>
              <input
                {...register('topic', { required: 'Topic is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the main topic or keyword for your article"
              />
              {errors.topic && (
                <p className="text-red-500 text-sm mt-1">{errors.topic.message}</p>
              )}
            </div>

            {/* Target Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Length (words)
              </label>
              <input
                {...register('target_length', {
                  required: 'Target length is required',
                  min: { value: 100, message: 'Minimum 100 words' },
                  max: { value: 2000, message: 'Maximum 2000 words' }
                })}
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.target_length && (
                <p className="text-red-500 text-sm mt-1">{errors.target_length.message}</p>
              )}
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Writing Tone
              </label>
              <select
                {...register('tone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
            </div>

            {/* Keywords */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Keywords (comma-separated)
              </label>
              <input
                {...register('keywords')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>

            {/* Include Paraphrasing */}
            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  {...register('include_paraphrasing')}
                  type="checkbox"
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Apply AI paraphrasing for enhanced uniqueness
                </span>
              </label>
            </div>
          </div>

          {/* Paraphrasing Settings */}
          {includeParaphrasing && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Paraphrasing Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adequacy ({watch('adequacy')})
                  </label>
                  <input
                    {...register('adequacy', {
                      min: { value: 0, message: 'Minimum 0' },
                      max: { value: 2, message: 'Maximum 2' }
                    })}
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">How well the meaning is preserved</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fluency ({watch('fluency')})
                  </label>
                  <input
                    {...register('fluency', {
                      min: { value: 0, message: 'Minimum 0' },
                      max: { value: 2, message: 'Maximum 2' }
                    })}
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">Grammar and readability quality</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diversity ({watch('diversity')})
                  </label>
                  <input
                    {...register('diversity', {
                      min: { value: 0, message: 'Minimum 0' },
                      max: { value: 2, message: 'Maximum 2' }
                    })}
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">How different from the original</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Variations
                </label>
                <input
                  {...register('max_variations', {
                    min: { value: 1, message: 'Minimum 1' },
                    max: { value: 10, message: 'Maximum 10' }
                  })}
                  type="number"
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isGenerating}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating Article...' : 'Generate Article'}
            </button>
          </div>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Results */}
      {generatedArticle && (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('article')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'article'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Generated Article
              </button>
              {generatedArticle.variations && generatedArticle.variations.length > 0 && (
                <button
                  onClick={() => setActiveTab('variations')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'variations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Variations ({generatedArticle.variations.length})
                </button>
              )}
              <button
                onClick={() => setActiveTab('seo')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'seo'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                SEO Analysis
              </button>
            </nav>
          </div>

          {/* Article Content */}
          {activeTab === 'article' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{generatedArticle.topic}</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyToClipboard(generatedArticle.generated_article)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => downloadAsText(generatedArticle.generated_article, `${generatedArticle.topic}.txt`)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Download
                  </button>
                </div>
              </div>

              <div className="mb-4 text-sm text-gray-600">
                <span className="mr-4">Words: {generatedArticle.word_count}</span>
                <span className="mr-4">Readability: {generatedArticle.readability_score}/100</span>
                <span>Generated in: {generatedArticle.processing_time.toFixed(2)}s</span>
              </div>

              <div className="prose max-w-none">
                <ReactMarkdown>{generatedArticle.generated_article}</ReactMarkdown>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold text-gray-700 mb-2">Meta Description:</h3>
                <p className="text-sm text-gray-600">{generatedArticle.meta_description}</p>
              </div>

              {Object.keys(generatedArticle.keyword_density).length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="font-semibold text-gray-700 mb-2">Keyword Density:</h3>
                  <div className="space-y-1">
                    {Object.entries(generatedArticle.keyword_density).map(([keyword, density]) => (
                      <div key={keyword} className="flex justify-between text-sm">
                        <span className="text-gray-600">{keyword}:</span>
                        <span className="font-medium">{density}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Variations */}
          {activeTab === 'variations' && generatedArticle.variations && (
            <div className="space-y-4">
              {generatedArticle.variations.map((variation, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Variation {index + 1}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => copyToClipboard(variation)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => downloadAsText(variation, `${generatedArticle.topic}_variation_${index + 1}.txt`)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none">
                    <ReactMarkdown>{variation}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SEO Analysis */}
          {activeTab === 'seo' && seoAnalysis && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">SEO Analysis</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">SEO Score</h3>
                  <p className="text-3xl font-bold text-blue-600">{seoAnalysis.seo_score}/100</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Word Count</h3>
                  <p className="text-3xl font-bold text-green-600">{seoAnalysis.word_count}</p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">Readability</h3>
                  <p className="text-3xl font-bold text-purple-600">{seoAnalysis.readability_score}/100</p>
                </div>
              </div>

              {Object.keys(seoAnalysis.keyword_density).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Keyword Density Analysis</h3>
                  <div className="space-y-2">
                    {Object.entries(seoAnalysis.keyword_density).map(([keyword, density]) => (
                      <div key={keyword} className="flex items-center justify-between">
                        <span className="text-gray-700">{keyword}</span>
                        <div className="flex items-center">
                          <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className={`h-2 rounded-full ${
                                density >= 1 && density <= 3 ? 'bg-green-500' :
                                density >= 0.5 && density < 1 ? 'bg-yellow-500' :
                                density > 3 && density <= 5 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(density * 20, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-600">{density}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {seoAnalysis.meta_description_suggestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Meta Description Suggestions</h3>
                  <div className="space-y-2">
                    {seoAnalysis.meta_description_suggestions.map((suggestion, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {seoAnalysis.suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">SEO Improvement Suggestions</h3>
                  <ul className="space-y-2">
                    {seoAnalysis.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span className="text-gray-700">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArticleGenerator;