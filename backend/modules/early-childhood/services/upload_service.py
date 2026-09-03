import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

class FileService:
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'}
    UPLOAD_FOLDER = 'static/uploads'

    @staticmethod
    def allowed_file(filename):
        return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in FileService.ALLOWED_EXTENSIONS

    @staticmethod
    def save_file(file, folder='general'):
        """
        Save a file to the configured upload folder.
        Returns the public URL path to the file.
        """
        if not file or file.filename == '':
            return None

        if not FileService.allowed_file(file.filename):
            raise ValueError("Tipo de archivo no permitido. Solo imágenes.")

        filename = secure_filename(file.filename)
        # Generate unique filename to prevent collisions
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        
        # Ensure upload subfolder exists
        base_path = os.path.join(current_app.root_path, FileService.UPLOAD_FOLDER, folder)
        os.makedirs(base_path, exist_ok=True)
        
        file_path = os.path.join(base_path, unique_filename)
        file.save(file_path)
        
        # Return URL path relative to API root (assuming static folder is served)
        # Assuming app is serving static files from /static
        return f"/static/uploads/{folder}/{unique_filename}"

    @staticmethod
    def delete_file(file_url):
        """
        Delete a file given its URL path.
        """
        if not file_url:
            return
            
        try:
            # Extract relative path from URL (remove leading /)
            clean_path = file_url.lstrip('/')
            full_path = os.path.join(current_app.root_path, clean_path)
            
            if os.path.exists(full_path):
                os.remove(full_path)
        except Exception as e:
            print(f"Error deleting file {file_url}: {e}")
