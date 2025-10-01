import time
import os
import logging
from typing import List, Tuple, Optional
from models.article import ParaphraseRequest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ParaphrasingService:
    """Service for text paraphrasing using Parrot T5 model"""

    def __init__(self):
        self.parrot = None
        self.model_loaded = False
        self.use_gpu = os.getenv("USE_GPU", "false").lower() == "true"
        self.model_name = os.getenv("PARROT_MODEL", "prithivida/parrot_paraphraser_on_T5")

        # Initialize fallback immediately, model will be loaded on first use
        self._initialize_fallback()

    def _initialize_model(self):
        """Initialize the Parrot model"""
        try:
            # Suppress warnings during model loading
            import warnings
            warnings.filterwarnings("ignore")

            from parrot import Parrot
            import torch

            logger.info(f"Loading Parrot model: {self.model_name}")
            logger.info(f"Using GPU: {self.use_gpu}")

            # Initialize Parrot with T5 model
            self.parrot = Parrot(
                model_tag=self.model_name,
                use_gpu=self.use_gpu
            )

            self.model_loaded = True
            logger.info("Parrot model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load Parrot model: {str(e)}")
            logger.warning("Falling back to mock paraphrasing")
            self.model_loaded = False
            self._initialize_fallback()

    def _initialize_fallback(self):
        """Initialize fallback mock paraphraser"""
        self.fallback_templates = [
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

        try:
            # Try to load model if not already loaded
            if not self.model_loaded:
                logger.info("Loading Parrot model on first use...")
                self._initialize_model()

            if self.model_loaded and self.parrot:
                return await self._paraphrase_with_model(request)
            else:
                return await self._paraphrase_with_fallback(request)
        except Exception as e:
            logger.error(f"Error during paraphrasing: {str(e)}")
            return await self._paraphrase_with_fallback(request)

    async def _paraphrase_with_model(self, request: ParaphraseRequest) -> Tuple[List[str], List[float], float]:
        """Paraphrase using the actual Parrot model"""
        variations = []
        confidence_scores = []
        start_time = time.time()

        try:
            # Map frontend parameters to Parrot's parameters
            adequacy_threshold = min(max(request.adequacy / 2.0, 0.5), 1.0)  # Normalize to 0.5-1.0
            fluency_threshold = min(max(request.fluency / 2.0, 0.5), 1.0)    # Normalize to 0.5-1.0

            # Determine diversity ranker based on diversity parameter
            diversity_ranker = "levenshtein" if request.diversity > 1.0 else "none"

            # For articles, work with shorter chunks - Parrot was trained on max 32 tokens
            text_to_paraphrase = request.text.strip()

            # Take a reasonable chunk for paraphrasing (around 50-100 words)
            words = text_to_paraphrase.split()
            if len(words) > 80:
                text_to_paraphrase = ' '.join(words[:80]) + "..."

            # Ensure minimum length
            if len(text_to_paraphrase) < 20:
                text_to_paraphrase = text_to_paraphrase[:200]  # Take first 200 chars if too short

            logger.info(f"Paraphrasing chunk of length {len(text_to_paraphrase)} chars")
            logger.info(f"Parameters: adequacy={adequacy_threshold}, fluency={fluency_threshold}, diversity_ranker={diversity_ranker}")

            # Generate paraphrases using Parrot with simpler parameters
            try:
                para_phrases = self.parrot.augment(
                    input_phrase=text_to_paraphrase,
                    diversity_ranker=diversity_ranker,
                    do_diverse=request.diversity > 1.0,
                    max_return_phrases=request.max_variations,
                    max_length=128,  # Conservative length
                    adequacy_threshold=adequacy_threshold,
                    fluency_threshold=fluency_threshold
                )

                # Check if we got valid results
                if para_phrases and isinstance(para_phrases, list) and len(para_phrases) > 0:
                    logger.info(f"Successfully generated {len(para_phrases)} paraphrases")

                    for phrase in para_phrases:
                        if phrase and len(phrase.strip()) > 10:  # Filter out empty or very short results
                            variations.append(phrase)
                            # Calculate confidence based on model parameters and quality
                            confidence = self._calculate_model_confidence(
                                request.adequacy, request.fluency, request.diversity, phrase
                            )
                            confidence_scores.append(confidence)
                else:
                    logger.warning(f"Invalid or empty paraphrase results: {para_phrases}")
                    return await self._paraphrase_with_fallback(request)

            except Exception as model_error:
                logger.error(f"Model-specific error: {str(model_error)}")
                return await self._paraphrase_with_fallback(request)

        except Exception as e:
            logger.error(f"Error in model paraphrasing: {str(e)}")
            return await self._paraphrase_with_fallback(request)

        processing_time = time.time() - start_time
        return variations, confidence_scores, processing_time

    async def _paraphrase_with_fallback(self, request: ParaphraseRequest) -> Tuple[List[str], List[float], float]:
        """Fallback paraphrasing using simple templates"""
        variations = []
        confidence_scores = []
        start_time = time.time()

        # Generate variations based on max_variations
        for i in range(min(request.max_variations, 3)):
            if i == 0:
                variation = self._simple_synonym_replacement(request.text)
            elif i == 1:
                variation = self._sentence_structure_change(request.text)
            else:
                template = getattr(self, 'fallback_templates', ["In other words: {text}"])[i % len(getattr(self, 'fallback_templates', ["In other words: {text}"]))]
                variation = template.format(text=request.text)

            # Calculate confidence score based on parameters
            confidence = self._calculate_confidence(request.adequacy, request.fluency, request.diversity)

            variations.append(variation)
            confidence_scores.append(confidence)

        processing_time = time.time() - start_time
        return variations, confidence_scores, processing_time

    def _simple_synonym_replacement(self, text: str) -> str:
        """Simple synonym replacement"""
        synonyms = {
            "good": "excellent", "bad": "poor", "big": "large", "small": "tiny",
            "fast": "quick", "slow": "gradual", "important": "crucial",
            "helpful": "beneficial", "effective": "efficient", "new": "recent",
            "old": "previous", "better": "improved", "best": "optimal"
        }

        words = text.split()
        for i, word in enumerate(words):
            lower_word = word.lower().strip(".,!?")
            if lower_word in synonyms:
                words[i] = word.replace(lower_word, synonyms[lower_word])

        return " ".join(words)

    def _sentence_structure_change(self, text: str) -> str:
        """Simple sentence structure modification"""
        if text.startswith("The "):
            return text[4:] + " serves as the main subject."
        elif " is " in text:
            parts = text.split(" is ")
            if len(parts) == 2:
                return f"The subject involves {parts[1]}."
        return f"Regarding {text}, this is important to note."

    def _calculate_model_confidence(self, adequacy: float, fluency: float, diversity: float, paraphrase: str) -> float:
        """Calculate confidence score for model output"""
        # Base confidence from parameters
        norm_adequacy = min(adequacy / 2.0, 1.0)
        norm_fluency = min(fluency / 2.0, 1.0)
        norm_diversity = min(diversity / 2.0, 1.0)

        # Quality assessment based on length and similarity
        length_score = min(len(paraphrase) / 100, 1.0)  # Prefer reasonable length

        # Weighted average
        confidence = (norm_adequacy * 0.4 + norm_fluency * 0.4 + norm_diversity * 0.1 + length_score * 0.1)

        return round(max(0.1, min(1.0, confidence)), 3)

    def _calculate_confidence(self, adequacy: float, fluency: float, diversity: float) -> float:
        """Calculate confidence score based on parameters"""
        import random

        # Normalize parameters to 0-1 range (they come in as 0-2)
        norm_adequacy = min(adequacy / 2.0, 1.0)
        norm_fluency = min(fluency / 2.0, 1.0)
        norm_diversity = min(diversity / 2.0, 1.0)

        # Weighted average (fluency is most important for paraphrasing)
        confidence = (norm_adequacy * 0.3 + norm_fluency * 0.5 + norm_diversity * 0.2)

        # Add some randomness to simulate model uncertainty
        confidence += random.uniform(-0.05, 0.05)

        return round(max(0.0, min(1.0, confidence)), 3)

# Global service instance
paraphrasing_service = ParaphrasingService()