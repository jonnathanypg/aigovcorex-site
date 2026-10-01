"""
Text Extractor Utility
Extracts plain text from uploaded files for RAG indexing.
Supports: PDF (.pdf), Plain Text (.txt), Word (.docx),
CSV (.csv) y Excel (.xlsx, .xls) para formatos de informe.
"""
import os
import logging

logger = logging.getLogger(__name__)


class TextExtractor:
    """Extracts text content from various file formats"""

    SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.csv', '.xlsx', '.xls'}

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
        elif ext == '.csv':
            return TextExtractor._extract_csv(file_path)
        elif ext in ('.xlsx', '.xls'):
            return TextExtractor._extract_excel(file_path)

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

    @staticmethod
    def _extract_csv(file_path: str) -> str:
        """Extract text from a CSV file (formatos de informe)."""
        import csv

        for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
            try:
                with open(file_path, 'r', encoding=encoding, newline='') as f:
                    sample = f.read(2048)
                    f.seek(0)
                    try:
                        dialect = csv.Sniffer().sniff(sample, delimiters=[',', ';', '\t', '|'])
                    except Exception:
                        dialect = csv.excel
                    reader = csv.reader(f, dialect)
                    rows = [' | '.join((cell or '').strip() for cell in row) for row in reader]
                rows = [r for r in rows if r.strip(' |')]
                text = '\n'.join(rows)
                logger.info(f"Read {len(text)} chars from CSV file ({len(rows)} rows)")
                return text
            except UnicodeDecodeError:
                continue
        # Último intento tolerante
        with open(file_path, 'r', encoding='latin-1', newline='') as f:
            reader = csv.reader(f)
            rows = [' | '.join((cell or '').strip() for cell in row) for row in reader]
        rows = [r for r in rows if r.strip(' |')]
        return '\n'.join(rows)

    @staticmethod
    def _extract_excel(file_path: str) -> str:
        """Extract text from Excel (.xlsx/.xls) usando openpyxl.

        Recorre todas las hojas y concatena celdas por fila para que el
        contenido sea indexable por RAG y descargable como plantilla.
        """
        try:
            from openpyxl import load_workbook
        except ImportError:
            logger.error("openpyxl not installed. Run: pip install openpyxl")
            raise

        try:
            wb = load_workbook(file_path, read_only=True, data_only=True)
        except Exception as e:
            # .xls legacy no lo abre openpyxl: mensaje accionable
            logger.error(f"Error opening Excel file: {e}")
            raise ValueError(
                "No se pudo leer el Excel. Si es .xls antiguo, conviértalo a .xlsx y reintente."
            ) from e

        parts = []
        for sheet in wb.worksheets:
            parts.append(f"[Hoja: {sheet.title}]")
            for row in sheet.iter_rows(values_only=True):
                cells = [(str(c).strip() if c is not None else "") for c in row]
                line = " | ".join(cells).strip(" |")
                if line:
                    parts.append(line)
        text = "\n".join(parts)
        logger.info(f"Read {len(text)} chars from Excel file ({len(wb.worksheets)} sheets)")
        return text
