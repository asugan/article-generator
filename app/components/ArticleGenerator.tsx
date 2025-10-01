"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import {
  articleAPI,
  ArticleGenerationRequest,
  ArticleGenerationResponse,
  SEOAnalysisRequest,
  SEOAnalysisResponse,
  SaveArticleRequest,
  SEOContent,
  HeadingsGenerationRequest,
  HeadingsGenerationResponse,
  H2ContentRequest,
} from "../services/api";
import { saveClientArticle } from "../lib/clientStorage";
import { useRouter } from "next/navigation";

interface ArticleGeneratorFormData {
  topic: string;
  target_length: number;
  keywords: string;
  tone: "professional" | "casual" | "formal";
  include_paraphrasing: boolean;
  adequacy: number;
  fluency: number;
  diversity: number;
  max_variations: number;
}

interface H2ContentData {
  heading: string;
  content: string;
  wordCount: number;
  isGenerated: boolean;
  isGenerating: boolean;
  error?: string;
}

const ArticleGenerator: React.FC = () => {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] =
    useState<ArticleGenerationResponse | null>(null);
  const [seoAnalysis, setSeoAnalysis] = useState<SEOAnalysisResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "article" | "variations" | "seo" | "seo-content" | "step-by-step"
  >("step-by-step");
  const [editableSEOContent, setEditableSEOContent] =
    useState<SEOContent | null>(null);
  const [saving, setSaving] = useState(false);

  // New state for step-by-step generation
  const [generationStep, setGenerationStep] = useState<
    "setup" | "headings" | "content"
  >("setup");
  const [headingsResponse, setHeadingsResponse] =
    useState<HeadingsGenerationResponse | null>(null);
  const [h2Contents, setH2Contents] = useState<H2ContentData[]>([]);
  const [isGeneratingHeadings, setIsGeneratingHeadings] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Use refs to prevent infinite loops
  const isGeneratingAllRef = useRef(false);
  const generationInProgressRef = useRef(false);
  const h2ContentsRef = useRef<H2ContentData[]>([]);
  const headingsResponseRef = useRef<HeadingsGenerationResponse | null>(null);

  // Create the complete article content using useMemo to avoid infinite loops
  const completeArticle = useMemo(() => {
    if (!headingsResponse) return "";

    const sections = [
      `# ${headingsResponse.seo_content.h1_heading}`,
      ...h2Contents
        .filter((h2) => h2.isGenerated && h2.content)
        .map((h2) => `## ${h2.heading}\n\n${h2.content}`),
    ];

    return sections.join("\n\n");
  }, [headingsResponse, h2Contents]);

  // Sync refs with state
  useEffect(() => {
    h2ContentsRef.current = h2Contents;
  }, [h2Contents]);

  useEffect(() => {
    headingsResponseRef.current = headingsResponse;
  }, [headingsResponse]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ArticleGeneratorFormData>({
    defaultValues: {
      topic: "",
      target_length: 500,
      keywords: "",
      tone: "professional",
      include_paraphrasing: false,
      adequacy: 1.2,
      fluency: 1.5,
      diversity: 1.0,
      max_variations: 3,
    },
  });

  const includeParaphrasing = watch("include_paraphrasing");

  const onSubmit = async (data: ArticleGeneratorFormData) => {
    setIsGenerating(true);
    setError(null);

    try {
      const keywords = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const request: ArticleGenerationRequest = {
        topic: data.topic,
        target_length: data.target_length,
        keywords,
        tone: data.tone,
        include_paraphrasing: data.include_paraphrasing,
        paraphrase_config: data.include_paraphrasing
          ? {
              adequacy: data.adequacy,
              fluency: data.fluency,
              diversity: data.diversity,
              max_variations: data.max_variations,
            }
          : undefined,
      };

      const articleResponse = await articleAPI.generateArticle(request);
      setGeneratedArticle(articleResponse);

      if (articleResponse.seo_content) {
        setEditableSEOContent({ ...articleResponse.seo_content });
      }

      const seoRequest: SEOAnalysisRequest = {
        article_text: articleResponse.generated_article,
        target_keywords: keywords,
      };
      const seoResponse = await articleAPI.analyzeSEO(seoRequest);
      setSeoAnalysis(seoResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate article"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const generateHeadings = async (data: ArticleGeneratorFormData) => {
    setIsGeneratingHeadings(true);
    setError(null);

    try {
      const keywords = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const request: HeadingsGenerationRequest = {
        topic: data.topic,
        keywords,
        tone: data.tone,
      };

      const response = await articleAPI.generateHeadings(request);
      setHeadingsResponse(response);
      setEditableSEOContent({ ...response.seo_content });

      const initialH2Contents: H2ContentData[] =
        response.seo_content.h2_headings.map((heading) => ({
          heading,
          content: "",
          wordCount: 0,
          isGenerated: false,
          isGenerating: false,
        }));
      setH2Contents(initialH2Contents);
      setGenerationStep("headings");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate headings"
      );
    } finally {
      setIsGeneratingHeadings(false);
    }
  };

  const generateH2Content = async (h2Index: number) => {
    if (generationInProgressRef.current) return;

    generationInProgressRef.current = true;

    try {
      const formData = watch();
      setError(null);

      setH2Contents((prev) =>
        prev.map((h2, idx) =>
          idx === h2Index ? { ...h2, isGenerating: true, error: undefined } : h2
        )
      );

      const keywords = formData.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const currentH2Contents = h2ContentsRef.current;
      const currentHeadings = headingsResponseRef.current;

      const previousContent = currentH2Contents
        .slice(0, h2Index)
        .filter((h2) => h2.isGenerated)
        .map((h2) => `## ${h2.heading}\n\n${h2.content}`)
        .join("\n\n");

      const request: H2ContentRequest = {
        topic: formData.topic,
        keywords,
        tone: formData.tone,
        include_paraphrasing: false,
        paraphrase_config: undefined,
        seo_content: currentHeadings!.seo_content,
        h2_heading: currentH2Contents[h2Index].heading,
        previous_content: previousContent,
      };

      const response = await articleAPI.generateH2Content(request);

      setH2Contents((prev) =>
        prev.map((h2, idx) =>
          idx === h2Index
            ? {
                ...h2,
                content: response.generated_content,
                wordCount: response.word_count,
                isGenerated: true,
                isGenerating: false,
              }
            : h2
        )
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate H2 content";
      setH2Contents((prev) =>
        prev.map((h2, idx) =>
          idx === h2Index
            ? { ...h2, isGenerating: false, error: errorMessage }
            : h2
        )
      );
      setError(errorMessage);
    } finally {
      generationInProgressRef.current = false;
    }
  };

  const generateAllH2Contents = async () => {
    if (
      isGeneratingAllRef.current ||
      isGeneratingAll ||
      generationInProgressRef.current
    ) {
      return;
    }

    isGeneratingAllRef.current = true;
    generationInProgressRef.current = true;
    setIsGeneratingAll(true);

    try {
      const formData = watch();
      const keywords = formData.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const currentHeadings = headingsResponseRef.current;
      const currentH2Contents = [...h2ContentsRef.current];

      if (!currentHeadings) {
        throw new Error("No headings found");
      }

      if (currentH2Contents.every((h2) => h2.isGenerated)) {
        setGenerationStep("content");
        return;
      }

      for (let i = 0; i < currentH2Contents.length; i++) {
        if (!currentH2Contents[i].isGenerated) {
          setH2Contents((prev) =>
            prev.map((h2, idx) =>
              idx === i ? { ...h2, isGenerating: true, error: undefined } : h2
            )
          );

          try {
            const previousContent = currentH2Contents
              .slice(0, i)
              .filter((h2) => h2.isGenerated)
              .map((h2) => `## ${h2.heading}\n\n${h2.content}`)
              .join("\n\n");

            const request: H2ContentRequest = {
              topic: formData.topic,
              keywords,
              tone: formData.tone,
              include_paraphrasing: false,
              paraphrase_config: undefined,
              seo_content: currentHeadings.seo_content,
              h2_heading: currentH2Contents[i].heading,
              previous_content: previousContent,
            };

            const response = await articleAPI.generateH2Content(request);

            setH2Contents((prev) =>
              prev.map((h2, idx) =>
                idx === i
                  ? {
                      ...h2,
                      content: response.generated_content,
                      wordCount: response.word_count,
                      isGenerated: true,
                      isGenerating: false,
                    }
                  : h2
              )
            );

            currentH2Contents[i] = {
              ...currentH2Contents[i],
              content: response.generated_content,
              wordCount: response.word_count,
              isGenerated: true,
              isGenerating: false,
            };
          } catch (err) {
            const errorMessage =
              err instanceof Error
                ? err.message
                : "Failed to generate H2 content";
            setH2Contents((prev) =>
              prev.map((h2, idx) =>
                idx === i
                  ? { ...h2, isGenerating: false, error: errorMessage }
                  : h2
              )
            );
            throw err;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setGenerationStep("content");
    } catch (error) {
      console.error("Error in generateAllH2Contents:", error);
      setError("Failed to generate all content. Please try again.");
    } finally {
      isGeneratingAllRef.current = false;
      generationInProgressRef.current = false;
      setIsGeneratingAll(false);
    }
  };

  const saveStepByStepArticle = async () => {
    if (!completeArticle || !headingsResponse) return;

    try {
      setSaving(true);
      setError(null);

      const data = watch();
      const keywords = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const saveRequest: SaveArticleRequest = {
        title: headingsResponse.seo_content.h1_heading,
        content: completeArticle,
        topic: data.topic,
        keywords,
        tone: data.tone,
        wordCount: h2Contents.reduce((sum, h2) => sum + h2.wordCount, 0),
        readabilityScore: 70, // Mock score - could be calculated
        metaDescription: headingsResponse.seo_content.meta_description,
      };

      try {
        const response = await articleAPI.saveArticle(saveRequest);
        if (response.success) {
          alert("Article saved successfully!");
          router.push(`/articles/${response.slug}/edit`);
        }
      } catch (backendError) {
        const slug = saveClientArticle(
          headingsResponse.seo_content.h1_heading,
          completeArticle,
          {
            topic: data.topic,
            keywords,
            tone: data.tone,
            wordCount: saveRequest.wordCount,
            readabilityScore: saveRequest.readabilityScore,
            metaDescription: saveRequest.metaDescription,
          }
        );

        alert("Article saved successfully!");
        router.push(`/articles/${slug}/edit`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save article";
      setError(errorMessage);
      alert("Error saving article: " + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadAsText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const updateSEOContent = (
    field: keyof SEOContent,
    value: string | string[]
  ) => {
    if (editableSEOContent) {
      setEditableSEOContent({
        ...editableSEOContent,
        [field]: value,
      });
    }
  };

  const saveArticleToStorage = async () => {
    if (!generatedArticle) return;

    try {
      setSaving(true);
      setError(null);

      const saveRequest: SaveArticleRequest = {
        title: generatedArticle.topic,
        content: generatedArticle.generated_article,
        topic: generatedArticle.topic,
        keywords: Object.keys(generatedArticle.keyword_density),
        tone: "professional",
        wordCount: generatedArticle.word_count,
        readabilityScore: generatedArticle.readability_score,
        seoScore: seoAnalysis?.seo_score,
        metaDescription:
          editableSEOContent?.meta_description ||
          generatedArticle.meta_description,
      };

      try {
        const response = await articleAPI.saveArticle(saveRequest);
        if (response.success) {
          alert("Article saved successfully!");
          router.push(`/articles/${response.slug}/edit`);
        }
      } catch (backendError) {
        const slug = saveClientArticle(
          generatedArticle.topic,
          generatedArticle.generated_article,
          {
            topic: generatedArticle.topic,
            keywords: Object.keys(generatedArticle.keyword_density),
            tone: "professional",
            wordCount: generatedArticle.word_count,
            readabilityScore: generatedArticle.readability_score,
            seoScore: seoAnalysis?.seo_score,
            metaDescription:
              editableSEOContent?.meta_description ||
              generatedArticle.meta_description,
          }
        );

        alert("Article saved successfully!");
        router.push(`/articles/${slug}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
      alert(
        "Error saving article: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          SEO Article Generator
        </h1>
        <Link
          href="/articles"
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm font-medium"
        >
          My Articles
        </Link>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("step-by-step")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "step-by-step"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Step-by-Step Generation
            </button>
            <button
              onClick={() => setActiveTab("article")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "article"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Quick Generation
            </button>
          </nav>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic / Main Keyword
              </label>
              <input
                {...register("topic", { required: "Topic is required" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the main topic or keyword for your article"
              />
              {errors.topic && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.topic.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Length (words)
              </label>
              <input
                {...register("target_length", {
                  required: "Target length is required",
                  min: { value: 100, message: "Minimum 100 words" },
                  max: { value: 2000, message: "Maximum 2000 words" },
                })}
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.target_length && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.target_length.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Writing Tone
              </label>
              <select
                {...register("tone")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Keywords (comma-separated)
              </label>
              <input
                {...register("keywords")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  {...register("include_paraphrasing")}
                  type="checkbox"
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Apply AI paraphrasing for enhanced uniqueness
                </span>
              </label>
            </div>
          </div>

          {includeParaphrasing && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Paraphrasing Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adequacy ({watch("adequacy")})
                  </label>
                  <input
                    {...register("adequacy", {
                      min: { value: 0, message: "Minimum 0" },
                      max: { value: 2, message: "Maximum 2" },
                    })}
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">
                    How well the meaning is preserved
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fluency ({watch("fluency")})
                  </label>
                  <input
                    {...register("fluency", {
                      min: { value: 0, message: "Minimum 0" },
                      max: { value: 2, message: "Maximum 2" },
                    })}
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">
                    Grammar and readability quality
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diversity ({watch("diversity")})
                  </label>
                  <input
                    {...register("diversity", {
                      min: { value: 0, message: "Minimum 0" },
                      max: { value: 2, message: "Maximum 2" },
                    })}
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">
                    How different from the original
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Variations
                </label>
                <input
                  {...register("max_variations", {
                    min: { value: 1, message: "Minimum 1" },
                    max: { value: 10, message: "Maximum 10" },
                  })}
                  type="number"
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex justify-center space-x-4">
            {activeTab === "step-by-step" ? (
              <button
                type="button"
                onClick={handleSubmit(generateHeadings)}
                disabled={isGeneratingHeadings}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingHeadings
                  ? "Generating Headings..."
                  : "Generate Headings First"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isGenerating}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? "Generating Article..." : "Generate Article"}
              </button>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {activeTab === "step-by-step" && headingsResponse && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-800">
                Generation Progress
              </h3>
              <span className="text-sm text-blue-600">
                Step{" "}
                {generationStep === "setup"
                  ? 1
                  : generationStep === "headings"
                  ? 2
                  : 3}{" "}
                of 3
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`flex-1 h-2 rounded-full ${
                  generationStep === "setup" ? "bg-blue-500" : "bg-green-500"
                }`}
              ></div>
              <div
                className={`flex-1 h-2 rounded-full ${
                  generationStep === "setup"
                    ? "bg-gray-300"
                    : generationStep === "headings"
                    ? "bg-blue-500"
                    : "bg-green-500"
                }`}
              ></div>
              <div
                className={`flex-1 h-2 rounded-full ${
                  generationStep === "content" ? "bg-blue-500" : "bg-gray-300"
                }`}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Setup</span>
              <span>Headings</span>
              <span>Content</span>
            </div>
          </div>

          {generationStep === "headings" && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Generated Headings
                </h2>
                <div className="flex space-x-2">
                  {!h2Contents.every((h2) => h2.isGenerated) && (
                    <button
                      onClick={generateAllH2Contents}
                      disabled={isGeneratingAll}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isGeneratingAll
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {isGeneratingAll
                        ? "Generating All Content..."
                        : "Generate All Content"}
                    </button>
                  )}
                  <button
                    onClick={() => setGenerationStep("setup")}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Back to Setup
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    H1 Heading (Main Title)
                  </label>
                  <div className="text-xl font-bold text-gray-800 p-3 bg-white rounded">
                    {headingsResponse.seo_content.h1_heading}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      H2 Headings
                    </h3>
                    {isGeneratingAll && (
                      <div className="text-sm text-blue-600 font-medium">
                        Generating content for all sections...
                      </div>
                    )}
                    {h2Contents.every((h2) => h2.isGenerated) &&
                      !isGeneratingAll && (
                        <div className="text-sm text-green-600 font-medium">
                          ✓ All sections generated
                        </div>
                      )}
                  </div>
                  <div className="space-y-3">
                    {h2Contents.map((h2, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            <h4 className="text-lg font-medium text-gray-800">
                              {h2.heading}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            {h2.isGenerated && (
                              <span className="text-sm text-green-600 font-medium">
                                ✓ {h2.wordCount} words
                              </span>
                            )}
                            <button
                              onClick={() => generateH2Content(index)}
                              disabled={h2.isGenerating || isGeneratingAll}
                              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                h2.isGenerated
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : h2.isGenerating || isGeneratingAll
                                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              {h2.isGenerating
                                ? "Generating..."
                                : isGeneratingAll
                                ? "Processing..."
                                : h2.isGenerated
                                ? "Regenerate"
                                : "Generate Content"}
                            </button>
                          </div>
                        </div>

                        {h2.error && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{h2.error}</p>
                          </div>
                        )}

                        {h2.isGenerated && h2.content && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-md">
                            <div className="prose max-w-none">
                              <ReactMarkdown>{h2.content}</ReactMarkdown>
                            </div>
                            <div className="mt-3 flex space-x-2">
                              <button
                                onClick={() => copyToClipboard(h2.content)}
                                className="text-sm text-gray-600 hover:text-gray-800"
                              >
                                Copy Section
                              </button>
                              <span className="text-sm text-gray-400">•</span>
                              <span className="text-sm text-gray-500">
                                {h2.wordCount} words
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Description
                  </label>
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <p className="text-sm text-gray-700">
                      {headingsResponse.seo_content.meta_description}
                    </p>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {headingsResponse.seo_content.meta_description.length}/160
                    characters
                  </div>
                </div>

                {h2Contents.every((h2) => h2.isGenerated) &&
                  !isGeneratingAll && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-blue-800">
                            All content generated!
                          </h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Your article is ready. Click the button below to
                            view and edit the complete article.
                          </p>
                        </div>
                        <button
                          onClick={() => setGenerationStep("content")}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                        >
                          View Complete Article
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {generationStep === "content" && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Complete Article
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={saveStepByStepArticle}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save & Edit"}
                  </button>
                  <button
                    onClick={() => setGenerationStep("headings")}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Back to Headings
                  </button>
                </div>
              </div>

              <div className="prose max-w-none mb-6">
                <ReactMarkdown>{completeArticle}</ReactMarkdown>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Article Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Words</p>
                    <p className="text-xl font-bold text-gray-800">
                      {h2Contents.reduce((sum, h2) => sum + h2.wordCount, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Sections</p>
                    <p className="text-xl font-bold text-gray-800">
                      {h2Contents.filter((h2) => h2.isGenerated).length}
                    </p>
                  </div>
                  {headingsResponse && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600">H1 Title</p>
                        <p className="text-lg font-bold text-blue-600 truncate">
                          {headingsResponse.seo_content.h1_heading}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">URL Slug</p>
                        <p className="text-sm text-gray-700 truncate">
                          {headingsResponse.seo_content.slug}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {generatedArticle && (
        <div className="space-y-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("article")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "article"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Generated Article
              </button>
              {generatedArticle.variations &&
                generatedArticle.variations.length > 0 && (
                  <button
                    onClick={() => setActiveTab("variations")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "variations"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Variations ({generatedArticle.variations.length})
                  </button>
                )}
              {generatedArticle.seo_content && (
                <button
                  onClick={() => setActiveTab("seo-content")}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "seo-content"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  SEO Content
                </button>
              )}
              <button
                onClick={() => setActiveTab("seo")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "seo"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                SEO Analysis
              </button>
            </nav>
          </div>

          {activeTab === "article" && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  {generatedArticle.topic}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      copyToClipboard(generatedArticle.generated_article)
                    }
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() =>
                      downloadAsText(
                        generatedArticle.generated_article,
                        `${generatedArticle.topic}.txt`
                      )
                    }
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Download
                  </button>
                  <button
                    onClick={saveArticleToStorage}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save & Edit"}
                  </button>
                </div>
              </div>

              <div className="mb-4 text-sm text-gray-600">
                <span className="mr-4">
                  Words: {generatedArticle.word_count}
                </span>
                <span className="mr-4">
                  Readability: {generatedArticle.readability_score}/100
                </span>
                <span>
                  Generated in: {generatedArticle.processing_time.toFixed(2)}s
                </span>
              </div>

              <div className="prose max-w-none">
                <ReactMarkdown>
                  {generatedArticle.generated_article}
                </ReactMarkdown>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Meta Description:
                </h3>
                <p className="text-sm text-gray-600">
                  {generatedArticle.meta_description}
                </p>
              </div>

              {Object.keys(generatedArticle.keyword_density).length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="font-semibold text-gray-700 mb-2">
                    Keyword Density:
                  </h3>
                  <div className="space-y-1">
                    {Object.entries(generatedArticle.keyword_density).map(
                      ([keyword, density]) => (
                        <div
                          key={keyword}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-gray-600">{keyword}:</span>
                          <span className="font-medium">{density}%</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "variations" && generatedArticle.variations && (
            <div className="space-y-4">
              {generatedArticle.variations.map((variation, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Variation {index + 1}
                    </h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => copyToClipboard(variation)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() =>
                          downloadAsText(
                            variation,
                            `${generatedArticle.topic}_variation_${
                              index + 1
                            }.txt`
                          )
                        }
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

          {activeTab === "seo-content" && editableSEOContent && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  SEO Content
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      copyToClipboard(editableSEOContent.h1_heading)
                    }
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                  >
                    Copy H1
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(editableSEOContent.h2_headings.join("\n"))
                    }
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                  >
                    Copy H2s
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(editableSEOContent.meta_description)
                    }
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                  >
                    Copy Meta
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    H1 Heading (Main Title)
                  </label>
                  <input
                    type="text"
                    value={editableSEOContent.h1_heading}
                    onChange={(e) =>
                      updateSEOContent("h1_heading", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                    maxLength={60}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {editableSEOContent.h1_heading.length}/60 characters
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    H2 Headings (Subheadings)
                  </label>
                  <div className="space-y-2">
                    {editableSEOContent.h2_headings.map((h2, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500 w-6">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={h2}
                          onChange={(e) => {
                            const newH2s = [...editableSEOContent.h2_headings];
                            newH2s[index] = e.target.value;
                            updateSEOContent("h2_headings", newH2s);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          maxLength={70}
                        />
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {h2.length}/70
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Description
                  </label>
                  <textarea
                    value={editableSEOContent.meta_description}
                    onChange={(e) =>
                      updateSEOContent("meta_description", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    maxLength={160}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {editableSEOContent.meta_description.length}/160 characters
                  </div>
                  <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                    This is what appears in Google search results. Include your
                    main keyword and a compelling call-to-action.
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      yourwebsite.com/
                    </span>
                    <input
                      type="text"
                      value={editableSEOContent.slug}
                      onChange={(e) => {
                        const slug = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, "")
                          .replace(/[\s-]+/g, "-")
                          .replace(/^-+|-+$/g, "");
                        updateSEOContent("slug", slug);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={60}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {editableSEOContent.slug.length}/60 characters
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google Search Preview
                  </label>
                  <div className="bg-white border rounded p-3 max-w-lg">
                    <div className="text-blue-700 text-sm hover:underline cursor-pointer mb-1">
                      {editableSEOContent.h1_heading}
                    </div>
                    <div className="text-green-700 text-xs mb-2">
                      yourwebsite.com/{editableSEOContent.slug}
                    </div>
                    <div className="text-gray-600 text-sm">
                      {editableSEOContent.meta_description}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "seo" && seoAnalysis && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                SEO Analysis
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">
                    SEO Score
                  </h3>
                  <p className="text-3xl font-bold text-blue-600">
                    {seoAnalysis.seo_score}/100
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">
                    Word Count
                  </h3>
                  <p className="text-3xl font-bold text-green-600">
                    {seoAnalysis.word_count}
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">
                    Readability
                  </h3>
                  <p className="text-3xl font-bold text-purple-600">
                    {seoAnalysis.readability_score}/100
                  </p>
                </div>
              </div>

              {Object.keys(seoAnalysis.keyword_density).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    Keyword Density Analysis
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(seoAnalysis.keyword_density).map(
                      ([keyword, density]) => (
                        <div
                          key={keyword}
                          className="flex items-center justify-between"
                        >
                          <span className="text-gray-700">{keyword}</span>
                          <div className="flex items-center">
                            <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                              <div
                                className={`h-2 rounded-full ${
                                  density >= 1 && density <= 3
                                    ? "bg-green-500"
                                    : density >= 0.5 && density < 1
                                    ? "bg-yellow-500"
                                    : density > 3 && density <= 5
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{
                                  width: `${Math.min(density * 20, 100)}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                              {density}%
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {seoAnalysis.meta_description_suggestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    Meta Description Suggestions
                  </h3>
                  <div className="space-y-2">
                    {seoAnalysis.meta_description_suggestions.map(
                      (suggestion, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-700">{suggestion}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {seoAnalysis.suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">
                    SEO Improvement Suggestions
                  </h3>
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
