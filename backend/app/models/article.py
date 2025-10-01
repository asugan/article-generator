from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ParaphraseRequest(BaseModel):
    text: Optional[str] = Field(None, description="Text to paraphrase")
    adequacy: float = Field(default=1.0, ge=0.0, le=2.0, description="Adequacy level (0-2)")
    fluency: float = Field(default=1.0, ge=0.0, le=2.0, description="Fluency level (0-2)")
    diversity: float = Field(default=1.0, ge=0.0, le=2.0, description="Diversity level (0-2)")
    max_variations: int = Field(default=3, ge=1, le=10, description="Maximum number of variations")

class ParaphraseResponse(BaseModel):
    original_text: str
    paraphrased_variations: List[str]
    confidence_scores: List[float]
    processing_time: float

class ArticleGenerationRequest(BaseModel):
    topic: str = Field(..., min_length=5, description="Article topic or main keyword")
    target_length: int = Field(default=500, ge=100, le=2000, description="Target article length in words")
    keywords: List[str] = Field(default=[], description="Target keywords to include")
    tone: str = Field(default="professional", description="Writing tone (professional, casual, formal)")
    include_paraphrasing: bool = Field(default=True, description="Whether to apply paraphrasing")
    paraphrase_config: Optional[ParaphraseRequest] = Field(default=None, description="Paraphrasing configuration")

class ArticleGenerationResponse(BaseModel):
    topic: str
    generated_article: str
    word_count: int
    keyword_density: dict
    meta_description: str
    readability_score: float
    variations: Optional[List[str]] = None
    processing_time: float
    created_at: datetime

class SEOAnalysisRequest(BaseModel):
    article_text: str = Field(..., min_length=50, description="Article text to analyze")
    target_keywords: List[str] = Field(default=[], description="Target keywords for analysis")

class SEOAnalysisResponse(BaseModel):
    word_count: int
    keyword_density: dict
    readability_score: float
    meta_description_suggestions: List[str]
    seo_score: float
    suggestions: List[str]