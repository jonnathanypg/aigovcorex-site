"""
LLM Interface - Abstraction layer for different LLM providers
"""
import os
import logging
from typing import List, Dict, Optional
from config import get_config

logger = logging.getLogger(__name__)

config = get_config()


class LLMInterface:
    """Base interface for LLM providers"""
    
    def __init__(self, provider='openai'):
        self.provider = provider
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the appropriate LLM client"""
        if self.provider == 'openai':
            self._init_openai()
        elif self.provider == 'gemini':
            self._init_gemini()
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
    
    def _init_openai(self):
        """Initialize OpenAI client"""
        try:
            from openai import OpenAI
            api_key = config.OPENAI_API_KEY
            if not api_key:
                raise ValueError("OPENAI_API_KEY not configured")
            self.client = OpenAI(api_key=api_key)
            self.model = config.OPENAI_MODEL
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")
    
    def _init_gemini(self):
        """Initialize Google Gemini client"""
        try:
            import google.generativeai as genai
            api_key = config.GOOGLE_API_KEY
            if not api_key:
                raise ValueError("GOOGLE_API_KEY not configured")
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(config.GEMINI_MODEL)
            self.model = config.GEMINI_MODEL
        except ImportError:
            raise ImportError("google-generativeai package not installed. Run: pip install google-generativeai")
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> str:
        """
        Get chat completion from LLM
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
        
        Returns:
            Generated text response
        """
        if self.provider == 'openai':
            return self._openai_completion(messages, temperature, max_tokens)
        elif self.provider == 'gemini':
            return self._gemini_completion(messages, temperature, max_tokens)
    
    def _openai_completion(self, messages, temperature, max_tokens):
        """OpenAI completion"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    def _gemini_completion(self, messages, temperature, max_tokens):
        """Gemini completion"""
        try:
            # Convert messages to Gemini format
            prompt = self._convert_messages_to_prompt(messages)
            
            response = self.client.generate_content(
                prompt,
                generation_config={
                    'temperature': temperature,
                    'max_output_tokens': max_tokens
                }
            )
            return response.text
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    def _convert_messages_to_prompt(self, messages):
        """Convert OpenAI-style messages to single prompt"""
        prompt_parts = []
        for msg in messages:
            role = msg['role']
            content = msg['content']
            if role == 'system':
                prompt_parts.append(f"INSTRUCCIONES DEL SISTEMA:\n{content}\n")
            elif role == 'user':
                prompt_parts.append(f"USUARIO:\n{content}\n")
            elif role == 'assistant':
                prompt_parts.append(f"ASISTENTE:\n{content}\n")
        return "\n".join(prompt_parts)
    
    def extract_json(self, text: str, schema: Optional[Dict] = None) -> Dict:
        """
        Extract JSON from LLM response
        
        Args:
            text: LLM response text
            schema: Optional JSON schema for validation
        
        Returns:
            Extracted JSON dict
        """
        import json
        import re
        
        # Try to find JSON in code blocks
        json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find JSON object directly
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                raise ValueError("No JSON found in response")
        
        try:
            data = json.loads(json_str)
            return data
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {str(e)}")

    # ================================================================
    # Embedding Generation (for RAG)
    # ================================================================

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts using the configured provider.
        
        Args:
            texts: List of strings to embed
            
        Returns:
            List of embedding vectors
        """
        if self.provider == 'openai':
            return self._openai_embeddings(texts)
        elif self.provider == 'gemini':
            return self._gemini_embeddings(texts)
        else:
            raise ValueError(f"Embeddings not supported for provider: {self.provider}")

    def _openai_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings via OpenAI API"""
        try:
            embedding_model = config.EMBEDDING_MODEL or 'text-embedding-3-small'
            embedding_dim = getattr(config, 'EMBEDDING_DIMENSION', 512)

            kwargs = {
                'model': embedding_model,
                'input': texts,
            }
            # OpenAI text-embedding-3-* supports the 'dimensions' parameter
            # to reduce output dimensions (e.g., 1536 -> 512) to match Pinecone index
            if embedding_dim and 'text-embedding-3' in embedding_model:
                kwargs['dimensions'] = embedding_dim

            response = self.client.embeddings.create(**kwargs)
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise Exception(f"OpenAI embedding error: {str(e)}")

    def _gemini_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings via Google Gemini API"""
        try:
            import google.generativeai as genai
            
            embeddings = []
            for text in texts:
                result = genai.embed_content(
                    model='models/embedding-001',
                    content=text,
                    task_type='retrieval_document'
                )
                embeddings.append(result['embedding'])
            return embeddings
        except Exception as e:
            logger.error(f"Gemini embedding error: {e}")
            raise Exception(f"Gemini embedding error: {str(e)}")


# Singleton instance
_llm_instance = None


def get_llm(provider=None):
    """Get LLM instance (singleton)"""
    global _llm_instance
    
    if provider is None:
        # Auto-detect based on available API keys
        if config.OPENAI_API_KEY:
            provider = 'openai'
        elif config.GOOGLE_API_KEY:
            provider = 'gemini'
        else:
            raise ValueError("No LLM API key configured")
    
    if _llm_instance is None or _llm_instance.provider != provider:
        _llm_instance = LLMInterface(provider)
    
    return _llm_instance
