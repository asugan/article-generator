from fastapi import APIRouter, HTTPException
from typing import List, Dict
import time
from datetime import datetime

from models.article import (
    ParaphraseRequest, ParaphraseResponse,
    ArticleGenerationRequest, ArticleGenerationResponse,
    SEOAnalysisRequest, SEOAnalysisResponse
)
from services.paraphraser import paraphrasing_service
from services.article_generator import article_generator_service

router = APIRouter()

@router.post("/paraphrase", response_model=ParaphraseResponse)
async def paraphrase_text(request: ParaphraseRequest):
    """
    Paraphrase given text with specified parameters
    """
    try:
        variations, confidence_scores, processing_time = await paraphrasing_service.paraphrase_text(request)

        return ParaphraseResponse(
            original_text=request.text,
            paraphrased_variations=variations,
            confidence_scores=confidence_scores,
            processing_time=processing_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Paraphrasing failed: {str(e)}")

@router.post("/generate-article", response_model=ArticleGenerationResponse)
async def generate_article(request: ArticleGenerationRequest):
    """
    Generate SEO-optimized article with optional paraphrasing
    """
    try:
        print(f"Received request: {request}")
        article_content, metadata, processing_time = await article_generator_service.generate_article(request)

        # Generate variations if requested
        variations = None
        if request.include_paraphrasing and request.paraphrase_config and request.paraphrase_config.max_variations > 1:
            paraphrase_request = ParaphraseRequest(
                text=article_content,
                adequacy=request.paraphrase_config.adequacy,
                fluency=request.paraphrase_config.fluency,
                diversity=request.paraphrase_config.diversity,
                max_variations=request.paraphrase_config.max_variations - 1
            )
            variations, _, _ = await paraphrasing_service.paraphrase_text(paraphrase_request)

        return ArticleGenerationResponse(
            topic=request.topic,
            generated_article=article_content,
            word_count=metadata["word_count"],
            keyword_density=metadata["keyword_density"],
            meta_description=metadata["meta_description"],
            readability_score=metadata["readability_score"],
            variations=variations,
            processing_time=processing_time,
            created_at=datetime.now()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Article generation failed: {str(e)}")

@router.post("/seo-analysis", response_model=SEOAnalysisResponse)
async def analyze_seo(request: SEOAnalysisRequest):
    """
    Analyze SEO metrics for given text
    """
    try:
        word_count = len(request.article_text.split())

        # Calculate keyword density
        keyword_density = {}
        for keyword in request.target_keywords:
            import re
            keyword_count = len(re.findall(re.escape(keyword), request.article_text, re.IGNORECASE))
            keyword_density[keyword] = round((keyword_count / word_count) * 100, 2) if word_count > 0 else 0

        # Calculate readability score
        readability_score = article_generator_service._calculate_readability_score(request.article_text)

        # Generate meta description suggestions
        meta_description_suggestions = []
        sentences = request.article_text.split('. ')
        for i, sentence in enumerate(sentences[:3]):
            if sentence.strip():
                suggestion = sentence.strip()
                if len(suggestion) > 160:
                    suggestion = suggestion[:157] + "..."
                meta_description_suggestions.append(suggestion)

        # Calculate overall SEO score
        seo_score = _calculate_seo_score(word_count, keyword_density, readability_score)

        # Generate suggestions
        suggestions = _generate_seo_suggestions(keyword_density, readability_score, word_count)

        return SEOAnalysisResponse(
            word_count=word_count,
            keyword_density=keyword_density,
            readability_score=readability_score,
            meta_description_suggestions=meta_description_suggestions,
            seo_score=seo_score,
            suggestions=suggestions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SEO analysis failed: {str(e)}")

def _calculate_seo_score(word_count: int, keyword_density: Dict[str, float], readability_score: float) -> float:
    """Calculate overall SEO score (0-100)"""
    score = 0.0

    # Word count scoring (optimal: 300-1000 words)
    if 300 <= word_count <= 1000:
        score += 30
    elif 200 <= word_count < 300 or 1000 < word_count <= 1500:
        score += 20
    else:
        score += 10

    # Keyword density scoring (optimal: 1-3%)
    if keyword_density:
        avg_density = sum(keyword_density.values()) / len(keyword_density)
        if 1.0 <= avg_density <= 3.0:
            score += 40
        elif 0.5 <= avg_density < 1.0 or 3.0 < avg_density <= 5.0:
            score += 25
        else:
            score += 15
    else:
        score += 10

    # Readability scoring (optimal: 60-80)
    if 60 <= readability_score <= 80:
        score += 30
    elif 40 <= readability_score < 60 or 80 < readability_score <= 90:
        score += 20
    else:
        score += 10

    return round(min(100.0, score), 1)

def _generate_seo_suggestions(keyword_density: Dict[str, float], readability_score: float, word_count: int) -> List[str]:
    """Generate SEO improvement suggestions"""
    suggestions = []

    # Word count suggestions
    if word_count < 300:
        suggestions.append("Consider expanding the article to at least 300 words for better SEO performance.")
    elif word_count > 1500:
        suggestions.append("Consider condensing the article to under 1500 words for better reader engagement.")

    # Keyword density suggestions
    if keyword_density:
        for keyword, density in keyword_density.items():
            if density < 1.0:
                suggestions.append(f"Consider increasing mentions of '{keyword}' to improve keyword density.")
            elif density > 5.0:
                suggestions.append(f"Consider reducing mentions of '{keyword}' to avoid keyword stuffing.")
    else:
        suggestions.append("Add relevant keywords to improve SEO optimization.")

    # Readability suggestions
    if readability_score < 60:
        suggestions.append("Simplify sentence structure and use shorter words to improve readability.")
    elif readability_score > 90:
        suggestions.append("Consider adding more complex sentences to engage advanced readers.")

    # General suggestions
    if len(suggestions) == 0:
        suggestions.append("Your article is well-optimized for SEO!")

    return suggestions