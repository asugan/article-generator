import type { ArticleMetadata, ArticleListItem } from './articleUtils';

export interface ClientArticleMetadata {
  title: string;
  slug: string;
  topic: string;
  keywords: string[];
  tone: string;
  wordCount: number;
  readabilityScore: number;
  seoScore?: number;
  createdAt: string;
  updatedAt: string;
  content: string;
  metaDescription: string;
}

export interface ClientArticleListItem {
  title: string;
  slug: string;
  topic: string;
  wordCount: number;
  readabilityScore: number;
  seoScore?: number;
  createdAt: string;
  metaDescription: string;
}

// Slug oluşturma fonksiyonu
export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // özel karakterleri kaldır
    .replace(/[\s_-]+/g, '-') // boşlukları ve alt çizgileri tireye çevir
    .replace(/^-+|-+$/g, ''); // baştaki ve sondaki tireleri kaldır
}

// Client-side storage (localStorage) için yardımcı fonksiyonlar
const STORAGE_KEY = 'seo-articles';

// Tüm makaleleri getir
export function getClientArticles(): ClientArticleListItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const articles: ClientArticleMetadata[] = JSON.parse(stored);
    return articles.map(article => ({
      title: article.title,
      slug: article.slug,
      topic: article.topic,
      wordCount: article.wordCount,
      readabilityScore: article.readabilityScore,
      seoScore: article.seoScore,
      createdAt: article.createdAt,
      metaDescription: article.metaDescription
    })).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error reading articles from localStorage:', error);
    return [];
  }
}

// Makaleyi slug ile getir
export function getClientArticleBySlug(slug: string): ClientArticleMetadata | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const articles: ClientArticleMetadata[] = JSON.parse(stored);
    return articles.find(article => article.slug === slug) || null;
  } catch (error) {
    console.error('Error reading article from localStorage:', error);
    return null;
  }
}

// Makale kaydet
export function saveClientArticle(
  title: string,
  content: string,
  metadata: Partial<ClientArticleMetadata>
): string {
  try {
    const slug = createSlug(title);
    const now = new Date().toISOString();

    const article: ClientArticleMetadata = {
      title,
      slug,
      topic: metadata.topic || '',
      keywords: metadata.keywords || [],
      tone: metadata.tone || 'professional',
      wordCount: metadata.wordCount || 0,
      readabilityScore: metadata.readabilityScore || 0,
      seoScore: metadata.seoScore,
      createdAt: metadata.createdAt || now,
      updatedAt: now,
      content,
      metaDescription: metadata.metaDescription || ''
    };

    // Mevcut makaleleri getir
    const stored = localStorage.getItem(STORAGE_KEY);
    let articles: ClientArticleMetadata[] = stored ? JSON.parse(stored) : [];

    // Eğer bu slug ile makale varsa güncelle, yoksa ekle
    const existingIndex = articles.findIndex(a => a.slug === slug);
    if (existingIndex >= 0) {
      articles[existingIndex] = article;
    } else {
      articles.push(article);
    }

    // Kaydet
    localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
    return slug;
  } catch (error) {
    console.error('Error saving article to localStorage:', error);
    throw error;
  }
}

// Makale güncelle
export function updateClientArticle(
  slug: string,
  updates: Partial<Pick<ClientArticleMetadata, 'content' | 'title' | 'metaDescription'>>
): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const articles: ClientArticleMetadata[] = JSON.parse(stored);
    const index = articles.findIndex(article => article.slug === slug);

    if (index < 0) return false;

    articles[index] = {
      ...articles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
    return true;
  } catch (error) {
    console.error('Error updating article in localStorage:', error);
    return false;
  }
}

// Makale sil
export function deleteClientArticle(slug: string): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const articles: ClientArticleMetadata[] = JSON.parse(stored);
    const filteredArticles = articles.filter(article => article.slug !== slug);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredArticles));
    return true;
  } catch (error) {
    console.error('Error deleting article from localStorage:', error);
    return false;
  }
}