import time
import random
from typing import List, Tuple
from models.article import ParaphraseRequest

class ParaphrasingService:
    """Service for text paraphrasing using various techniques"""

    def __init__(self):
        # In a real implementation, this would load the actual Parrot model
        # For now, we'll create a simple mock paraphraser
        self.paraphrasing_templates = [
            "Another way to say this is: {text}",
            "This can also be expressed as: {text}",
            "Alternatively, we could say: {text}",
            "In other words: {text}",
            "To put it differently: {text}"
        ]

    async def paraphrase_text(self, request: ParaphraseRequest) -> Tuple[List[str], List[float], float]:
        """
        Paraphrase the given text with specified parameters

        Args:
            request: ParaphraseRequest containing text and parameters

        Returns:
            Tuple of (paraphrased_variations, confidence_scores, processing_time)
        """
        if not request.text or len(request.text.strip()) < 10:
            return [], [], 0.0

        start_time = time.time()

        # Mock paraphrasing - in real implementation, this would use Parrot
        variations = []
        confidence_scores = []

        # Generate variations based on max_variations
        for i in range(min(request.max_variations, 3)):
            # Simple variation generation (mock)
            if i == 0:
                variation = self._simple_synonym_replacement(request.text)
            elif i == 1:
                variation = self._sentence_structure_change(request.text)
            else:
                template = random.choice(self.paraphrasing_templates)
                variation = template.format(text=request.text)

            # Calculate mock confidence score based on parameters
            confidence = self._calculate_confidence(request.adequacy, request.fluency, request.diversity)

            variations.append(variation)
            confidence_scores.append(confidence)

        processing_time = time.time() - start_time
        return variations, confidence_scores, processing_time

    def _simple_synonym_replacement(self, text: str) -> str:
        """Simple synonym replacement (mock implementation)"""
        synonyms = {
            "good": "excellent",
            "bad": "poor",
            "big": "large",
            "small": "tiny",
            "fast": "quick",
            "slow": "gradual"
        }

        words = text.split()
        for i, word in enumerate(words):
            lower_word = word.lower().strip(".,!?")
            if lower_word in synonyms:
                words[i] = word.replace(lower_word, synonyms[lower_word])

        return " ".join(words)

    def _sentence_structure_change(self, text: str) -> str:
        """Simple sentence structure modification (mock implementation)"""
        if text.startswith("The "):
            return text[4:] + " is the subject."
        elif " is " in text:
            parts = text.split(" is ")
            if len(parts) == 2:
                return f"The subject is {parts[1]}."
        return f"Regarding {text}, this is worth noting."

    def _calculate_confidence(self, adequacy: float, fluency: float, diversity: float) -> float:
        """Calculate confidence score based on parameters"""
        # Normalize parameters to 0-1 range (they come in as 0-2)
        norm_adequacy = min(adequacy / 2.0, 1.0)
        norm_fluency = min(fluency / 2.0, 1.0)
        norm_diversity = min(diversity / 2.0, 1.0)

        # Weighted average (fluency is most important for paraphrasing)
        confidence = (norm_adequacy * 0.3 + norm_fluency * 0.5 + norm_diversity * 0.2)

        # Add some randomness to simulate model uncertainty
        confidence += random.uniform(-0.1, 0.1)

        return round(max(0.0, min(1.0, confidence)), 3)

# Global service instance
paraphrasing_service = ParaphrasingService()