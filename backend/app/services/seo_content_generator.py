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
1. ONE compelling H1 heading (under 60 characters, must include main keyword, avoid generic phrases like "How to be" or "What is")
2. SIX relevant H2 headings covering different aspects (each under 70 characters):
   - 5 main content sections covering: basics, benefits, strategies, challenges, future trends
   - 1 conclusion section (use words like "Conclusion", "Summary", "Final Thoughts", "Key Takeaways")
3. An engaging meta description (155-160 characters, includes main keyword, compelling call-to-action)
4. A URL-friendly slug (under 60 characters, lowercase, uses hyphens, keyword-rich)

Format your response exactly like this:
H1: [compelling, benefit-oriented heading here]
H2: [heading 1 - basics/fundamentals]
H2: [heading 2 - benefits/advantages]
H2: [heading 3 - strategies/how-to]
H2: [heading 4 - challenges/solutions]
H2: [heading 5 - future/trends]
H2: [conclusion/summary heading]
META: [meta description here]
SLUG: [keyword-rich-slug-here]

Guidelines:
- Make H1 action-oriented and benefit-focused (e.g., "Master {topic}: Complete Guide for Success" not "How to be {topic}")
- H2 headings should be specific and value-driven
- Include power words: Ultimate, Complete, Master, Guide, Strategies, Secrets, Proven
- Make content sound authoritative and comprehensive
- Meta description must entice clicks while accurately describing content"""

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
        if len(h2_headings) < 6:
            h2_headings = self._generate_h2_fallbacks(topic, len(h2_headings))
        if not meta_description:
            meta_description = f"Learn everything about {topic}. Discover best practices, strategies, and expert insights to succeed."
        if not slug:
            slug = self._generate_slug(topic)

        # Ensure we have exactly 6 H2 headings
        h2_headings = h2_headings[:6]

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

        # Add conclusion
        conclusion_templates = [
            f"Conclusion: Mastering {topic}",
            f"Final Thoughts on {topic}",
            f"Key Takeaways for {topic} Success",
            f"Summary: {topic} Best Practices"
        ]
        h2_headings.append(random.choice(conclusion_templates))

        # Ensure exactly 6 headings
        h2_headings = h2_headings[:6]

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
            f"Understanding {topic}: Key Fundamentals",
            f"Essential Benefits of {topic}",
            f"Proven {topic} Strategies for Success",
            f"Overcoming Common {topic} Challenges",
            f"Future Trends in {topic}",
            f"Conclusion: Key Takeaways for {topic} Mastery"
        ]
        needed = 6 - existing_count
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