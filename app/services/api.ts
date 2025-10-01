import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types for API responses
export interface ParaphraseRequest {
  text?: string;
  adequacy: number;
  fluency: number;
  diversity: number;
  max_variations: number;
}

export interface ParaphraseResponse {
  original_text: string;
  paraphrased_variations: string[];
  confidence_scores: number[];
  processing_time: number;
}

export interface ArticleGenerationRequest {
  topic: string;
  target_length: number;
  keywords: string[];
  tone: 'professional' | 'casual' | 'formal';
  include_paraphrasing: boolean;
  paraphrase_config?: ParaphraseRequest;
}

export interface ArticleGenerationResponse {
  topic: string;
  generated_article: string;
  word_count: number;
  keyword_density: Record<string, number>;
  meta_description: string;
  readability_score: number;
  variations?: string[];
  processing_time: number;
  created_at: string;
}

export interface SEOAnalysisRequest {
  article_text: string;
  target_keywords: string[];
}

export interface SEOAnalysisResponse {
  word_count: number;
  keyword_density: Record<string, number>;
  readability_score: number;
  meta_description_suggestions: string[];
  seo_score: number;
  suggestions: string[];
}

// API functions
export const articleAPI = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/api/health');
    return response.data;
  },

  // Paraphrase text
  paraphrase: async (request: ParaphraseRequest): Promise<ParaphraseResponse> => {
    const response = await api.post('/api/paraphrase', request);
    return response.data;
  },

  // Generate article
  generateArticle: async (request: ArticleGenerationRequest): Promise<ArticleGenerationResponse> => {
    const response = await api.post('/api/generate-article', request);
    return response.data;
  },

  // Analyze SEO
  analyzeSEO: async (request: SEOAnalysisRequest): Promise<SEOAnalysisResponse> => {
    const response = await api.post('/api/seo-analysis', request);
    return response.data;
  },
};

export default api;