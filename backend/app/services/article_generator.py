import time
import random
import re
import httpx
import logging
from typing import List, Dict, Tuple
from models.article import ArticleGenerationRequest, ParaphraseRequest
from services.paraphraser import paraphrasing_service

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ArticleGeneratorService:
    """Service for generating SEO-optimized articles"""

    def __init__(self):
        self.api_url = "https://nano-gpt.com/api/v1/chat/completions"
        self.api_key = None  # API key'ini environment variable'dan alacağız

        # Templates for different article sections (fallback olarak kalacak)
        self.introduction_templates = [
            "In today's digital landscape, {topic} has become increasingly important for businesses and individuals alike.",
            "The world of {topic} is constantly evolving, bringing new challenges and opportunities.",
            "Understanding {topic} is crucial for success in today's competitive market.",
            "When it comes to {topic}, there are several key factors to consider.",
            "The importance of {topic} cannot be overstated in our modern business environment."
        ]

        self.conclusion_templates = [
            "In conclusion, {topic} plays a vital role in achieving success.",
            "To summarize, the key aspects of {topic} require careful consideration and strategic planning.",
            "Moving forward, staying updated with {topic} trends will be essential.",
            "The future of {topic} looks promising, with continuous advancements on the horizon.",
            "By implementing the strategies discussed, organizations can excel in {topic}."
        ]

    async def generate_article(self, request: ArticleGenerationRequest) -> Tuple[str, Dict, float]:
        """
        Generate an SEO-optimized article

        Args:
            request: ArticleGenerationRequest containing generation parameters

        Returns:
            Tuple of (generated_article, metadata, processing_time)
        """
        start_time = time.time()

        # Generate article content
        article_content = await self._generate_article_content(request)

        # Apply paraphrasing if requested
        if request.include_paraphrasing:
            # Create paraphrase request with the generated article content
            paraphrase_request = ParaphraseRequest(
                text=article_content,
                adequacy=request.paraphrase_config.adequacy if request.paraphrase_config else 1.2,
                fluency=request.paraphrase_config.fluency if request.paraphrase_config else 1.5,
                diversity=request.paraphrase_config.diversity if request.paraphrase_config else 1.0,
                max_variations=1
            )

            variations, _, _ = await paraphrasing_service.paraphrase_text(paraphrase_request)
            if variations:
                article_content = variations[0]

        # Calculate metadata
        word_count = len(article_content.split())
        keyword_density = self._calculate_keyword_density(
            article_content, request.keywords)
        processing_time = time.time() - start_time

        metadata = {
            "word_count": word_count,
            "keyword_density": keyword_density,
            "meta_description": self._generate_meta_description(article_content, request.topic),
            "readability_score": self._calculate_readability_score(article_content)
        }

        return article_content, metadata, processing_time

    async def _generate_article_content(self, request: ArticleGenerationRequest) -> str:
        """Generate article content based on request parameters"""
        # Try Nano-GPT API first
        try:
            logger.info(
                f"Attempting to generate article using Nano-GPT API for topic: {request.topic}")
            return await self._generate_with_nano_gpt(request)
        except Exception as e:
            logger.warning(
                f"Nano-GPT API failed: {e}, falling back to templates")
            # If API fails, use template system
            logger.info(
                f"Using template-based generation for topic: {request.topic}")
            return self._generate_with_templates(request)

    async def _generate_with_nano_gpt(self, request: ArticleGenerationRequest) -> str:
        """Generate article using Nano-GPT API"""
        import os
        self.api_key = os.getenv("NANO_GPT_API_KEY")

        if not self.api_key:
            logger.error("NANO_GPT_API_KEY not found in environment variables")
            raise Exception(
                "NANO_GPT_API_KEY not found in environment variables")

        keywords_str = ", ".join(
            request.keywords) if request.keywords else request.topic
        tone_instructions = {
            "professional": "Write in a professional, formal tone suitable for business audiences.",
            "casual": "Write in a casual, conversational tone that's friendly and accessible.",
            "formal": "Write in a very formal, academic tone with proper structure and language."
        }

        prompt = f"""Write an SEO-optimized article about "{request.topic}" with the following requirements:

- Target word count: {request.target_length} words
- Keywords to include: {keywords_str}
- Tone: {tone_instructions.get(request.tone, "professional")}
- Include proper heading structure (H1, H2, H3)
- Make it engaging and informative
- Include practical examples and actionable insights
- End with a clear conclusion and call to action

Please write a complete, well-structured article."""

        payload = {
            "model": "deepseek-ai/deepseek-v3.2-exp",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert SEO content writer who creates high-quality, engaging articles that rank well on search engines."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            # Rough estimate
            "max_tokens": min(request.target_length * 2, 4000),
            "stream": False
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            logger.info(f"Making request to Nano-GPT API: {self.api_url}")
            response = await client.post(self.api_url, json=payload, headers=headers)

            if response.status_code != 200:
                logger.error(
                    f"API request failed with status {response.status_code}: {response.text}")
                raise Exception(
                    f"API request failed with status {response.status_code}: {response.text}")

            data = response.json()

            if "choices" not in data or len(data["choices"]) == 0:
                raise Exception("Invalid API response format")

            article_content = data["choices"][0]["message"]["content"]

            # Post-process to ensure it meets length requirements
            word_count = len(article_content.split())
            if word_count < request.target_length * 0.8:  # If too short
                article_content = self._expand_article(
                    article_content, request.target_length - word_count)
            elif word_count > request.target_length * 1.2:  # If too long
                article_content = self._condense_article(
                    article_content, word_count - request.target_length)

            return article_content

    def _generate_with_templates(self, request: ArticleGenerationRequest) -> str:
        """Fallback template-based generation"""
        topic = request.topic
        keywords = request.keywords or [topic]
        target_length = request.target_length

        # Select templates
        introduction = random.choice(
            self.introduction_templates).format(topic=topic)
        conclusion = random.choice(
            self.conclusion_templates).format(topic=topic)

        # Generate body paragraphs
        body_paragraphs = self._generate_body_paragraphs(
            topic, keywords, target_length)

        # Combine sections
        article_parts = [introduction] + body_paragraphs + [conclusion]
        article = "\n\n".join(article_parts)

        # Adjust length to meet target
        current_length = len(article.split())
        if current_length < target_length:
            article = self._expand_article(
                article, target_length - current_length)
        elif current_length > target_length:
            article = self._condense_article(
                article, current_length - target_length)

        return article

    def _generate_body_paragraphs(self, topic: str, keywords: List[str], target_length: int) -> List[str]:
        """Generate body paragraphs for the article"""
        num_paragraphs = max(3, target_length //
                             100)  # Approximate number of paragraphs
        paragraphs = []

        paragraph_topics = [
            f"Key aspects of {topic}",
            f"Best practices for {topic}",
            f"Common challenges in {topic}",
            f"Future trends in {topic}",
            f"Benefits of implementing {topic} strategies"
        ]

        for i in range(min(num_paragraphs, len(paragraph_topics))):
            paragraph = self._generate_paragraph(paragraph_topics[i], keywords)
            paragraphs.append(paragraph)

        return paragraphs

    def _generate_paragraph(self, topic: str, keywords: List[str]) -> str:
        """Generate a single paragraph"""
        sentences = [
            f"{topic} requires careful consideration of various factors.",
            f"Many experts agree that {topic.lower()} deserves attention in today's market.",
            f"The implementation of {topic.lower()} can lead to significant improvements.",
            f"Research has shown that {topic.lower()} impacts multiple areas of business.",
            f"Organizations that prioritize {topic.lower()} often see better results."
        ]

        # Add keyword mentions naturally
        if keywords:
            keyword_sentence = f"Keywords such as {', '.join(keywords[:3])} are particularly relevant to this discussion."
            sentences.insert(random.randint(
                1, len(sentences)-1), keyword_sentence)

        return " ".join(sentences[:random.randint(3, 5)])

    def _expand_article(self, article: str, additional_words: int) -> str:
        """Expand article to meet target length"""
        sentences = article.split('. ')
        sentences = [s.strip() for s in sentences if s.strip()]

        # Add additional sentences to meet word count
        while additional_words > 0 and len(sentences) < 20:
            expansion_sentences = [
                "This aspect deserves further attention and consideration.",
                "It's worth noting that multiple factors contribute to this outcome.",
                "Research continues to evolve in this area, providing new insights.",
                "Practical applications of these concepts have shown promising results."
            ]

            new_sentence = random.choice(expansion_sentences)
            sentences.insert(random.randint(1, len(sentences)-1), new_sentence)
            additional_words -= len(new_sentence.split())

        return '. '.join(sentences)

    def _condense_article(self, article: str, words_to_remove: int) -> str:
        """Condense article to meet target length"""
        sentences = article.split('. ')
        sentences = [s.strip() for s in sentences if s.strip()]

        # Remove less important sentences
        while words_to_remove > 0 and len(sentences) > 5:
            # Remove sentences with fewer words first
            sentences.sort(key=len)
            removed = sentences.pop(0)
            words_to_remove -= len(removed.split())
            # Restore original order
            sentences.sort(key=lambda x: article.find(x))

        return '. '.join(sentences)

    def _calculate_keyword_density(self, text: str, keywords: List[str]) -> Dict[str, float]:
        """Calculate keyword density in the text"""
        word_count = len(text.split())
        density = {}

        for keyword in keywords:
            keyword_count = len(re.findall(
                re.escape(keyword), text, re.IGNORECASE))
            density[keyword] = round(
                (keyword_count / word_count) * 100, 2) if word_count > 0 else 0

        return density

    def _generate_meta_description(self, article: str, topic: str) -> str:
        """Generate meta description from article"""
        sentences = article.split('. ')
        # Take first 1-2 sentences and limit to 160 characters
        meta_desc = sentences[0] if sentences else ""
        if len(meta_desc) > 160:
            meta_desc = meta_desc[:157] + "..."
        return meta_desc

    def _calculate_readability_score(self, text: str) -> float:
        """Calculate mock readability score (0-100, higher is better)"""
        sentences = text.split('. ')
        words = text.split()

        if not sentences or not words:
            return 0.0

        avg_words_per_sentence = len(words) / len(sentences)
        avg_chars_per_word = sum(len(word) for word in words) / len(words)

        # Mock readability formula (simplified Flesch-Kincaid)
        readability = 100 - (1.5 * avg_words_per_sentence) - \
            (2 * avg_chars_per_word)
        return round(max(0.0, min(100.0, readability)), 1)


# Global service instance
article_generator_service = ArticleGeneratorService()
