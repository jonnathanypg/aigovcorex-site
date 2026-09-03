"""
Text Extractor Utility
Extracts plain text from uploaded files for RAG indexing.
Supports: PDF (.pdf), Plain Text (.txt)
"""
import os
import logging

logger = logging.getLogger(__name__)


class TextExtractor:
    """Extracts text content from various file formats"""

    SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.docx'}

    @staticmethod
    def extract(file_path: str) -> str:
        """
        Extract text from a file based on its extension.

        Args:
            file_path: Absolute path to the file

        Returns:
            Extracted text string

        Raises:
            ValueError: If file type is not supported
            FileNotFoundError: If file does not exist
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()

        if ext not in TextExtractor.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type: {ext}. "
                f"Supported: {', '.join(TextExtractor.SUPPORTED_EXTENSIONS)}"
            )

        if ext == '.pdf':
            return TextExtractor._extract_pdf(file_path)
        elif ext == '.docx':
            return TextExtractor._extract_docx(file_path)
        elif ext == '.txt':
            return TextExtractor._extract_txt(file_path)

        return ""

    @staticmethod
    def _extract_pdf(file_path: str) -> str:
        """Extract text from a PDF file using pypdf"""
        try:
            from pypdf import PdfReader

            reader = PdfReader(file_path)
            pages_text = []

            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text.strip())

            full_text = "\n\n".join(pages_text)
            logger.info(f"Extracted {len(full_text)} chars from PDF ({len(reader.pages)} pages)")
            return full_text

        except ImportError:
            logger.error("pypdf not installed. Run: pip3 install pypdf")
            raise
        except Exception as e:
            logger.error(f"Error extracting PDF text: {e}")
            raise

    @staticmethod
    def _extract_docx(file_path: str) -> str:
        """Extract text from a DOCX file using python-docx"""
        try:
            import docx

            doc = docx.Document(file_path)
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text.strip())
            
            text = "\n\n".join(full_text)
            logger.info(f"Extracted {len(text)} chars from DOCX")
            return text

        except ImportError:
            logger.error("python-docx not installed. Run: pip3 install python-docx")
            raise
        except Exception as e:
            logger.error(f"Error extracting DOCX text: {e}")
            raise

    @staticmethod
    def _extract_txt(file_path: str) -> str:
        """Extract text from a plain text file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            logger.info(f"Read {len(text)} chars from TXT file")
            return text
        except UnicodeDecodeError:
            # Fallback to latin-1
            with open(file_path, 'r', encoding='latin-1') as f:
                text = f.read()
            return text
