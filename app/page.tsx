import ArticleGenerator from './components/ArticleGenerator';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <ArticleGenerator />
      </div>
    </div>
  );
}
