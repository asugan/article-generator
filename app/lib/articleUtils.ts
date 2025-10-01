import fs from 'fs';
import path from 'path';

export interface ArticleMetadata {
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

export interface ArticleListItem {
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

// Markdown formatında makale oluşturma
export function createMarkdownContent(
  title: string,
  content: string,
  metadata: Partial<ArticleMetadata>
): string {
  const frontMatter = [
    '---',
    `title: "${title}"`,
    `topic: "${metadata.topic || ''}"`,
    `keywords: [${metadata.keywords?.map(k => `"${k}"`).join(', ') || ''}]`,
    `tone: "${metadata.tone || 'professional'}"`,
    `wordCount: ${metadata.wordCount || 0}`,
    `readabilityScore: ${metadata.readabilityScore || 0}`,
    `seoScore: ${metadata.seoScore || 0}`,
    `createdAt: "${metadata.createdAt || new Date().toISOString()}"`,
    `updatedAt: "${new Date().toISOString()}"`,
    `metaDescription: "${metadata.metaDescription || ''}"`,
    '---',
    '',
    content
  ].join('\n');

  return frontMatter;
}

// Makaleyi dosya olarak kaydetme
export function saveArticle(
  title: string,
  content: string,
  metadata: Partial<ArticleMetadata>
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const slug = createSlug(title);
      const articlesDir = path.join(process.cwd(), 'app', 'articles');
      const filePath = path.join(articlesDir, `${slug}.md`);

      // Articles dizinini kontrol et ve yoksa oluştur
      if (!fs.existsSync(articlesDir)) {
        fs.mkdirSync(articlesDir, { recursive: true });
      }

      const markdownContent = createMarkdownContent(title, content, metadata);

      fs.writeFileSync(filePath, markdownContent, 'utf8');
      resolve(slug);
    } catch (error) {
      reject(error);
    }
  });
}

// Makaleleri listeleme
export function getArticlesList(): ArticleListItem[] {
  try {
    const articlesDir = path.join(process.cwd(), 'app', 'articles');

    if (!fs.existsSync(articlesDir)) {
      return [];
    }

    const files = fs.readdirSync(articlesDir).filter(file => file.endsWith('.md'));
    const articles: ArticleListItem[] = [];

    for (const file of files) {
      const filePath = path.join(articlesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const metadata = parseArticleMetadata(content);

      if (metadata) {
        articles.push({
          title: metadata.title,
          slug: metadata.slug,
          topic: metadata.topic,
          wordCount: metadata.wordCount,
          readabilityScore: metadata.readabilityScore,
          seoScore: metadata.seoScore,
          createdAt: metadata.createdAt,
          metaDescription: metadata.metaDescription
        });
      }
    }

    // En yeni makaleler önce gelecek şekilde sırala
    return articles.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error reading articles:', error);
    return [];
  }
}

// Makaleyi slug ile getirme
export function getArticleBySlug(slug: string): ArticleMetadata | null {
  try {
    const articlesDir = path.join(process.cwd(), 'app', 'articles');
    const filePath = path.join(articlesDir, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return parseArticleMetadata(content);
  } catch (error) {
    console.error('Error reading article:', error);
    return null;
  }
}

// Front matter'dan metadata parse etme
function parseArticleMetadata(content: string): ArticleMetadata | null {
  try {
    // Front matter'ı ayır
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontMatterMatch) {
      return null;
    }

    const frontMatter = frontMatterMatch[1];
    const articleContent = frontMatterMatch[2];

    // Front matter'dan verileri çıkar
    const metadata: any = {};
    const lines = frontMatter.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value = match[2].replace(/^["']|["']$/g, ''); // tırnakları kaldır

        // Keywords dizisini parse et
        if (key === 'keywords') {
          try {
            value = JSON.parse(value);
          } catch {
            value = [];
          }
        } else if (key === 'wordCount' || key === 'readabilityScore' || key === 'seoScore') {
          value = parseFloat(value) || 0;
        }

        metadata[key] = value;
      }
    }

    // Dosya adından slug oluştur
    const slugMatch = content.match(/slug:\s*(.+)/);
    const slug = slugMatch ? slugMatch[1].replace(/^["']|["']$/g, '') : '';

    return {
      title: metadata.title || '',
      slug: slug || createSlug(metadata.title || ''),
      topic: metadata.topic || '',
      keywords: metadata.keywords || [],
      tone: metadata.tone || 'professional',
      wordCount: metadata.wordCount || 0,
      readabilityScore: metadata.readabilityScore || 0,
      seoScore: metadata.seoScore,
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: metadata.updatedAt || new Date().toISOString(),
      content: articleContent,
      metaDescription: metadata.metaDescription || ''
    };
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return null;
  }
}

// Makaleyi güncelleme
export function updateArticle(
  slug: string,
  updates: Partial<Pick<ArticleMetadata, 'content' | 'title' | 'metaDescription'>>
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const article = getArticleBySlug(slug);
      if (!article) {
        reject(new Error('Article not found'));
        return;
      }

      const updatedMetadata = {
        ...article,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const articlesDir = path.join(process.cwd(), 'app', 'articles');
      const filePath = path.join(articlesDir, `${slug}.md`);

      const markdownContent = createMarkdownContent(
        updates.title || article.title,
        updates.content || article.content,
        updatedMetadata
      );

      fs.writeFileSync(filePath, markdownContent, 'utf8');
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

// Makale silme
export function deleteArticle(slug: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const articlesDir = path.join(process.cwd(), 'app', 'articles');
      const filePath = path.join(articlesDir, `${slug}.md`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        resolve(true);
      } else {
        reject(new Error('Article not found'));
      }
    } catch (error) {
      reject(error);
    }
  });
}