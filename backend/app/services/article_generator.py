import time
import random
import re
import httpx
import logging
from typing import List, Dict, Tuple
from models.article import ArticleGenerationRequest, ParaphraseRequest
from services.paraphraser import paraphrasing_service
from services.seo_content_generator import seo_content_generator, SEOContent

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

        # Generate SEO content first
        seo_content = await seo_content_generator.generate_seo_content(
            request.topic, request.keywords
        )

        # Generate article content with SEO structure
        article_content = await self._generate_article_content(request, seo_content)

        # Note: Paraphrasing disabled for article generation - only available in editor

        # Calculate metadata
        word_count = len(article_content.split())
        keyword_density = self._calculate_keyword_density(
            article_content, request.keywords)
        processing_time = time.time() - start_time

        metadata = {
            "word_count": word_count,
            "keyword_density": keyword_density,
            "meta_description": seo_content.meta_description,
            "readability_score": self._calculate_readability_score(article_content),
            "seo_content": {
                "h1_heading": seo_content.h1_heading,
                "h2_headings": seo_content.h2_headings,
                "slug": seo_content.slug
            }
        }

        return article_content, metadata, processing_time

    async def generate_article_headings(self, request: ArticleGenerationRequest) -> Tuple[SEOContent, float]:
        """
        Generate only SEO-optimized headings (H1 and H2) for an article

        Args:
            request: ArticleGenerationRequest containing generation parameters

        Returns:
            Tuple of (seo_content, processing_time)
        """
        start_time = time.time()

        # Generate SEO content (headings, meta, slug)
        seo_content = await seo_content_generator.generate_seo_content(
            request.topic, request.keywords
        )

        processing_time = time.time() - start_time

        return seo_content, processing_time

    async def generate_h2_content(self, request: ArticleGenerationRequest, seo_content: SEOContent,
                                 h2_heading: str, previous_content: str = "") -> Tuple[str, float]:
        """
        Generate content for a specific H2 heading with context from previous sections

        Args:
            request: ArticleGenerationRequest containing generation parameters
            seo_content: SEO content with headings
            h2_heading: The specific H2 heading to generate content for
            previous_content: Content from previous sections for context

        Returns:
            Tuple of (generated_content, processing_time)
        """
        start_time = time.time()

        try:
            # Try Nano-GPT API first
            content = await self._generate_h2_content_with_ai(request, seo_content, h2_heading, previous_content)
        except Exception as e:
            logger.warning(f"AI generation failed for H2 '{h2_heading}': {e}, using templates")
            content = self._generate_h2_content_with_templates(h2_heading, request.keywords, request.topic)

        # Note: Paraphrasing disabled for H2 content generation - only available in editor

        processing_time = time.time() - start_time
        return content, processing_time

    async def _generate_h2_content_with_ai(self, request: ArticleGenerationRequest, seo_content: SEOContent,
                                         h2_heading: str, previous_content: str = "") -> str:
        """Generate H2 content using Nano-GPT API with context"""
        import os
        self.api_key = os.getenv("NANO_GPT_API_KEY")

        if not self.api_key:
            logger.error("NANO_GPT_API_KEY not found in environment variables")
            raise Exception("NANO_GPT_API_KEY not found in environment variables")

        keywords_str = ", ".join(request.keywords) if request.keywords else request.topic
        tone_instructions = {
            "professional": "Write in a professional, formal tone suitable for business audiences.",
            "casual": "Write in a casual, conversational tone that's friendly and accessible.",
            "formal": "Write in a very formal, academic tone with proper structure and language."
        }

        # Build context from previous content
        context_section = ""
        if previous_content:
            # Take last 200 characters of previous content for context
            context_snippet = previous_content[-200:] if len(previous_content) > 200 else previous_content
            context_section = f"""
Previous section context:
{context_snippet}

Make sure this new section flows naturally from the previous content."""

        prompt = f"""Write a detailed section for the H2 heading: "{h2_heading}"

Article context:
- Main topic: {request.topic}
- H1 title: {seo_content.h1_heading}
- Keywords to include: {keywords_str}
- Tone: {tone_instructions.get(request.tone, "professional")}
{context_section}

Requirements:
- Write 150-250 words for this section
- Include practical examples and actionable insights
- Make it engaging and informative
- Include relevant keywords naturally
- Ensure it flows logically from previous sections
- Focus specifically on the H2 topic: {h2_heading}

Write the content for this section (without the H2 heading itself):"""

        payload = {
            "model": "deepseek-ai/deepseek-v3.2-exp",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert SEO content writer who creates high-quality, engaging sections that flow naturally and provide value to readers."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 800,
            "stream": False
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            logger.info(f"Making H2 content request to Nano-GPT API: {self.api_url}")
            response = await client.post(self.api_url, json=payload, headers=headers)

            if response.status_code != 200:
                logger.error(f"API request failed with status {response.status_code}: {response.text}")
                raise Exception(f"API request failed with status {response.status_code}: {response.text}")

            data = response.json()

            if "choices" not in data or len(data["choices"]) == 0:
                raise Exception("Invalid API response format")

            return data["choices"][0]["message"]["content"].strip()

    def _generate_h2_content_with_templates(self, h2_heading: str, keywords: List[str], topic: str) -> str:
        """Fallback template-based H2 content generation"""
        h2_lower = h2_heading.lower()

        # Template sentences based on H2 content patterns
        templates = {
            "what": [
                f"{h2_heading} refers to the fundamental concepts and principles that form the foundation of modern {topic.lower()} strategies.",
                f"Understanding {h2_heading} is essential for anyone looking to implement effective {topic.lower()} solutions.",
                f"The core aspects of {h2_heading} include various methodologies and approaches that have proven successful in recent years."
            ],
            "why": [
                f"{h2_heading} plays a crucial role in achieving success with {topic.lower()} initiatives.",
                f"The importance of {h2_heading} cannot be overstated when implementing comprehensive {topic.lower()} strategies.",
                f"Organizations that prioritize {h2_heading} typically see significant improvements in their overall {topic.lower()} performance."
            ],
            "how": [
                f"Implementing {h2_heading} requires careful planning and strategic execution.",
                f"The process of {h2_heading} involves several key steps that must be followed systematically.",
                f"Successfully {h2_lower.replace('how to ', '')} demands attention to detail and adherence to best practices."
            ],
            "benefits": [
                f"{h2_heading} offers numerous advantages for organizations seeking to optimize their {topic.lower()} efforts.",
                f"The positive impact of {h2_heading} extends across multiple areas of business operations.",
                f"Organizations that leverage {h2_heading} report significant improvements in efficiency and effectiveness."
            ],
            "challenges": [
                f"{h2_heading} presents several obstacles that organizations must overcome to achieve success.",
                f"Common difficulties in {h2_lower.replace('challenges', '')} require strategic thinking and innovative solutions.",
                f"Addressing {h2_heading} proactively helps organizations avoid potential pitfalls and setbacks."
            ]
        }

        # Select appropriate template based on H2 content
        selected_templates = templates.get("how", templates["what"])  # Default to "how" templates

        for key, template_list in templates.items():
            if key in h2_lower:
                selected_templates = template_list
                break

        # Build paragraph
        sentences = [random.choice(selected_templates)]

        # Add keyword mentions naturally
        if keywords:
            keyword_sentence = f"Keywords such as {', '.join(keywords[:3])} are particularly relevant to this discussion."
            sentences.insert(1, keyword_sentence)

        # Add more context sentences
        sentences.extend([
            "This aspect deserves careful consideration and strategic planning.",
            "Research has shown that organizations implementing these approaches achieve better results.",
            "It's important to consider both short-term benefits and long-term implications."
        ])

        return " ".join(sentences[:4])  # Limit to 4 sentences for concise H2 sections

    async def _generate_article_content(self, request: ArticleGenerationRequest, seo_content: SEOContent = None) -> str:
        """Generate article content based on request parameters"""
        # Try Nano-GPT API first
        try:
            logger.info(
                f"Attempting to generate article using Nano-GPT API for topic: {request.topic}")
            return await self._generate_with_nano_gpt(request, seo_content)
        except Exception as e:
            logger.warning(
                f"Nano-GPT API failed: {e}, falling back to templates")
            # If API fails, use template system
            logger.info(
                f"Using template-based generation for topic: {request.topic}")
            return self._generate_with_templates(request, seo_content)

    async def _generate_with_nano_gpt(self, request: ArticleGenerationRequest, seo_content: SEOContent = None) -> str:
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

        # Build SEO structure if available
        seo_structure = ""
        if seo_content:
            h2_list = "\n".join([f"- {h2}" for h2 in seo_content.h2_headings])
            seo_structure = f"""

Use this structure:
H1: {seo_content.h1_heading}

H2 Headings to cover:
{h2_list}"""

        prompt = f"""Write an SEO-optimized article about "{request.topic}" with the following requirements:

- Target word count: {request.target_length} words
- Keywords to include: {keywords_str}
- Tone: {tone_instructions.get(request.tone, "professional")}
- Use proper heading structure (H1, H2, H3)
- Make it engaging and informative
- Include practical examples and actionable insights
- End with a clear conclusion and call to action
{seo_structure}

Please write a complete, well-structured article following the provided SEO structure."""

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

    def _generate_with_templates(self, request: ArticleGenerationRequest, seo_content: SEOContent = None) -> str:
        """Fallback template-based generation"""
        topic = request.topic
        keywords = request.keywords or [topic]
        target_length = request.target_length

        # Select templates - use SEO content if available
        if seo_content:
            # Create structured article with SEO headings
            article_parts = [f"# {seo_content.h1_heading}"]

            # Add introduction
            introduction = random.choice(self.introduction_templates).format(topic=topic)
            article_parts.append(introduction)

            # Add H2 sections
            for h2 in seo_content.h2_headings:
                article_parts.append(f"## {h2}")
                # Generate content for this H2
                paragraph = self._generate_paragraph(h2.replace(topic.lower(), topic), keywords)
                article_parts.append(paragraph)

            # Add conclusion
            conclusion = random.choice(self.conclusion_templates).format(topic=topic)
            article_parts.append(f"## Conclusion")
            article_parts.append(conclusion)
        else:
            # Fallback to original template structure
            introduction = random.choice(self.introduction_templates).format(topic=topic)
            conclusion = random.choice(self.conclusion_templates).format(topic=topic)

            # Generate body paragraphs
            body_paragraphs = self._generate_body_paragraphs(topic, keywords, target_length)

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
