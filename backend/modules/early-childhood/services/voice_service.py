import os
import asyncio
import logging
import edge_tts
from flask import current_app

logger = logging.getLogger(__name__)

class VoiceService:
    _whisper_model = None

    @classmethod
    def get_whisper_model(cls):
        """
        Lazy load local Whisper model. 
        Note: Currently disabled for Python 3.14 due to 'av' library issues.
        """
        if cls._whisper_model is None:
            try:
                from faster_whisper import WhisperModel
                model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
                logger.info(f"Loading local Whisper model: {model_size}")
                cls._whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
            except ImportError:
                logger.warning("faster-whisper not installed. Local STT will not be available.")
                return None
        return cls._whisper_model

    @classmethod
    def transcribe(cls, audio_path):
        """
        Transcribes audio to text. 
        Tries local engine first (if enabled), falls back to OpenAI API.
        """
        engine = os.getenv("VOICE_STT_ENGINE", "openai") # Default to openai for 3.14
        
        if engine == "local":
            return cls._transcribe_local(audio_path)
        else:
            return cls._transcribe_openai(audio_path)

    @classmethod
    def _transcribe_local(cls, audio_path):
        """Local transcription using faster-whisper"""
        try:
            model = cls.get_whisper_model()
            if not model:
                logger.error("Local Whisper model not available, falling back to OpenAI.")
                return cls._transcribe_openai(audio_path)
                
            segments, info = model.transcribe(audio_path, beam_size=5, language="es")
            text = " ".join([segment.text for segment in segments]).strip()
            return text
        except Exception as e:
            logger.error(f"Error in local transcription: {str(e)}")
            return cls._transcribe_openai(audio_path)

    @classmethod
    def _transcribe_openai(cls, audio_path):
        """Cloud transcription using OpenAI API"""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            with open(audio_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file,
                    language="es"
                )
            logger.info("OpenAI transcription completed.")
            return transcript.text
        except Exception as e:
            logger.error(f"Error in OpenAI transcription: {str(e)}")
            return None

    @classmethod
    async def synthesize_async(cls, text, voice, output_path):
        """Synthesizes text to speech using edge-tts (async)"""
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_path)
            return True
        except Exception as e:
            logger.error(f"Error in synthesis: {str(e)}")
            return False

    @classmethod
    def synthesize(cls, text, voice, output_path):
        """
        Synthesizes text to speech using edge-tts CLI via subprocess.
        This is more robust in multi-threaded Flask environments than manual asyncio management.
        """
        try:
            import subprocess
            import sys
            
            # Use the python executable from the current environment to find edge-tts
            # or assume it's in the PATH if we're in the venv.
            # In most cases, 'edge-tts' command is available if the package is installed.
            
            cmd = [
                "edge-tts",
                "--text", text,
                "--voice", voice,
                "--write-media", output_path
            ]
            
            logger.info(f"Running synthesis command: {' '.join(cmd)}")
            
            # Execute command
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                check=False # We'll check the file ourselves
            )
            
            if result.returncode != 0:
                logger.error(f"edge-tts CLI error (code {result.returncode}): {result.stderr}")
                # Fallback to internal async method just in case CLI is missing but lib works
                return cls._synthesize_internal_fallback(text, voice, output_path)

            # Verify file size
            if os.path.exists(output_path):
                size = os.path.getsize(output_path)
                if size > 0:
                    logger.info(f"Successfully synthesized audio via CLI: {size} bytes")
                    return True
                else:
                    logger.error(f"Synthesized file via CLI is 0 bytes: {output_path}")
            
            return False
        except Exception as e:
            logger.error(f"Error in CLI synthesis: {str(e)}")
            return cls._synthesize_internal_fallback(text, voice, output_path)

    @classmethod
    def _synthesize_internal_fallback(cls, text, voice, output_path):
        """Internal fallback using asyncio in case CLI fails"""
        try:
            logger.info("Attempting internal asyncio synthesis fallback...")
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            if loop.is_running():
                import threading
                res = [False]
                def run_in_thread():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    res[0] = new_loop.run_until_complete(cls.synthesize_async(text, voice, output_path))
                    new_loop.close()
                t = threading.Thread(target=run_in_thread)
                t.start()
                t.join()
                success = res[0]
            else:
                success = loop.run_until_complete(cls.synthesize_async(text, voice, output_path))
            
            return success and os.path.exists(output_path) and os.path.getsize(output_path) > 0
        except Exception as e:
            logger.error(f"Fallback synthesis failed: {str(e)}")
            return False

    @classmethod
    async def get_voices_async(cls):
        """Returns Spanish voices from Edge TTS"""
        try:
            voices = await edge_tts.VoicesManager.create()
            es_voices = voices.find(Language="es")
            return [
                {
                    "ShortName": v["ShortName"],
                    "FriendlyName": v["FriendlyName"],
                    "Gender": v["Gender"],
                    "Locale": v["Locale"]
                }
                for v in es_voices
            ]
        except Exception:
            return []

    @classmethod
    def get_voices(cls):
        """Synchronous wrapper for get_voices_async"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            voices = loop.run_until_complete(cls.get_voices_async())
            loop.close()
            return voices
        except Exception:
            return []
