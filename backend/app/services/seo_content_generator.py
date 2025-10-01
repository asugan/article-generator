import re
import time
import random
import httpx
import logging
from typing import Dict, List, Tuple
from dataclasses import dataclass

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SEOContent:
    """Data class for SEO content generation results"""
    h1_heading: str
    h2_headings: List[str]
    meta_description: str
    slug: str


class SEOContentGenerator:
    """Service for generating SEO-optimized content like headings, meta descriptions, and slugs"""

    def __init__(self):
        self.api_url = "https://nano-gpt.com/api/v1/chat/completions"
        self.api_key = None

        # Templates for fallback generation
        self.h1_templates = [
            "The Ultimate Guide to {topic}",
            "Mastering {topic}: Best Practices and Strategies",
            "{topic}: Everything You Need to Know",
            "A Comprehensive Guide to {topic}",
            "Understanding {topic}: Key Insights and Tips"
        ]

        self.h2_templates = {
            "basics": [
                "What is {topic} and Why Does it Matter?",
                "Understanding the Fundamentals of {topic}",
                "Getting Started with {topic}"
            ],
            "benefits": [
                "Key Benefits of {topic}",
                "Why {topic} is Essential for Success",
                "The Advantages of Implementing {topic}"
            ],
            "strategies": [
                "Effective {topic} Strategies",
                "Best Practices for {topic}",
                "How to Implement {topic} Successfully"
            ],
            "challenges": [
                "Common {topic} Challenges and Solutions",
                "Overcoming Obstacles in {topic}",
                "Pitfalls to Avoid in {topic}"
            ],
            "future": [
                "The Future of {topic}",
                "Emerging Trends in {topic}",
                "What's Next for {topic}"
            ]
        }

    async def generate_seo_content(self, topic: str, keywords: List[str] = None) -> SEOContent:
        """
        Generate comprehensive SEO content for a given topic

        Args:
            topic: Main topic/keyword
            keywords: Additional target keywords

        Returns:
            SEOContent object with H1, H2s, meta description, and slug
        """
        start_time = time.time()

        try:
            # Try AI generation first
            logger.info(f"Attempting AI SEO content generation for topic: {topic}")
            seo_content = await self._generate_with_ai(topic, keywords)
        except Exception as e:
            logger.warning(f"AI SEO generation failed: {e}, using templates")
            seo_content = self._generate_with_templates(topic, keywords)

        generation_time = time.time() - start_time
        logger.info(f"SEO content generated in {generation_time:.2f}s")

        return seo_content

    async def _generate_with_ai(self, topic: str, keywords: List[str] = None) -> SEOContent:
        """Generate SEO content using AI"""
        import os
        self.api_key = os.getenv("NANO_GPT_API_KEY")

        if not self.api_key:
            logger.error("NANO_GPT_API_KEY not found in environment variables")
            raise Exception("NANO_GPT_API_KEY not found in environment variables")

        keywords_str = ", ".join(keywords) if keywords else topic

        prompt = f"""Generate SEO-optimized content for the topic: "{topic}"

Target keywords: {keywords_str}

Please generate:
1. ONE compelling H1 heading (under 60 characters, must include main keyword)
2. FIVE relevant H2 headings covering different aspects (each under 70 characters)
3. An engaging meta description (155-160 characters, includes main keyword)
4. A URL-friendly slug (under 60 characters, lowercase, uses hyphens)

Format your response exactly like this:
H1: [heading here]
H2: [heading 1]
H2: [heading 2]
H2: [heading 3]
H2: [heading 4]
H2: [heading 5]
META: [meta description here]
SLUG: [slug here]

Make sure all content is professional, engaging, and optimized for search engines."""

        payload = {
            "model": "deepseek-ai/deepseek-v3.2-exp",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert SEO specialist who creates optimized content that ranks well on search engines."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 500,
            "stream": False
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.api_url, json=payload, headers=headers)

            if response.status_code != 200:
                raise Exception(f"API request failed: {response.status_code} - {response.text}")

            data = response.json()
            if "choices" not in data or len(data["choices"]) == 0:
                raise Exception("Invalid API response format")

            content = data["choices"][0]["message"]["content"]
            return self._parse_ai_response(content, topic)

    def _parse_ai_response(self, content: str, topic: str) -> SEOContent:
        """Parse AI response to extract SEO components"""
        lines = content.strip().split('\n')

        h1_heading = ""
        h2_headings = []
        meta_description = ""
        slug = ""

        for line in lines:
            line = line.strip()
            if line.startswith('H1:'):
                h1_heading = line.replace('H1:', '').strip()
            elif line.startswith('H2:'):
                h2_heading = line.replace('H2:', '').strip()
                if h2_heading:
                    h2_headings.append(h2_heading)
            elif line.startswith('META:'):
                meta_description = line.replace('META:', '').strip()
            elif line.startswith('SLUG:'):
                slug = line.replace('SLUG:', '').strip()

        # Validate and fallback if needed
        if not h1_heading:
            h1_heading = f"The Ultimate Guide to {topic}"
        if len(h2_headings) < 5:
            h2_headings = self._generate_h2_fallbacks(topic, len(h2_headings))
        if not meta_description:
            meta_description = f"Learn everything about {topic}. Discover best practices, strategies, and expert insights to succeed."
        if not slug:
            slug = self._generate_slug(topic)

        # Ensure we have exactly 5 H2 headings
        h2_headings = h2_headings[:5]

        return SEOContent(
            h1_heading=h1_heading,
            h2_headings=h2_headings,
            meta_description=meta_description,
            slug=slug
        )

    def _generate_with_templates(self, topic: str, keywords: List[str] = None) -> SEOContent:
        """Generate SEO content using templates"""
        # Generate H1
        h1_heading = random.choice(self.h1_templates).format(topic=topic)
        if len(h1_heading) > 60:
            h1_heading = h1_heading[:57] + "..."

        # Generate H2 headings
        h2_headings = []
        categories = list(self.h2_templates.keys())
        selected_categories = random.sample(categories, min(5, len(categories)))

        for category in selected_categories:
            template = random.choice(self.h2_templates[category])
            h2 = template.format(topic=topic)
            if len(h2) > 70:
                h2 = h2[:67] + "..."
            h2_headings.append(h2)

        # Generate meta description
        meta_description = self._generate_meta_description_template(topic, keywords)

        # Generate slug
        slug = self._generate_slug(topic)

        return SEOContent(
            h1_heading=h1_heading,
            h2_headings=h2_headings,
            meta_description=meta_description,
            slug=slug
        )

    def _generate_h2_fallbacks(self, topic: str, existing_count: int) -> List[str]:
        """Generate fallback H2 headings if AI didn't provide enough"""
        fallbacks = [
            f"What is {topic} and Why Does it Matter?",
            f"Key Benefits of {topic}",
            f"Effective {topic} Strategies",
            f"Common {topic} Challenges and Solutions",
            f"The Future of {topic}"
        ]
        needed = 5 - existing_count
        return fallbacks[:needed]

    def _generate_meta_description_template(self, topic: str, keywords: List[str] = None) -> str:
        """Generate meta description using templates"""
        templates = [
            f"Discover comprehensive insights about {topic}. Learn best practices, strategies, and expert tips to achieve success.",
            f"Everything you need to know about {topic}. Explore proven techniques and actionable advice for optimal results.",
            f"Master {topic} with our in-depth guide. Find practical solutions, expert recommendations, and valuable resources.",
            f"Learn about {topic} and its key benefits. Get professional insights and strategies to implement effectively."
        ]

        meta_desc = random.choice(templates)
        if len(meta_desc) > 160:
            meta_desc = meta_desc[:157] + "..."
        elif len(meta_desc) < 140:
            # Add keyword if too short
            if keywords and len(keywords) > 0:
                meta_desc += f" Essential {keywords[0]} tips and tricks included."

        return meta_desc

    def _generate_slug(self, topic: str) -> str:
        """Generate URL-friendly slug from topic"""
        # Convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r'[^\w\s-]', '', topic.lower())
        slug = re.sub(r'[-\s]+', '-', slug)

        # Remove leading/trailing hyphens
        slug = slug.strip('-')

        # Limit length
        if len(slug) > 60:
            words = slug.split('-')
            result = []
            current_length = 0
            for word in words:
                if current_length + len(word) + 1 <= 60:
                    result.append(word)
                    current_length += len(word) + 1
                else:
                    break
            slug = '-'.join(result)

        return slug if slug else "untitled"


# Global service instance
seo_content_generator = SEOContentGenerator()