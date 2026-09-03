import requests
import sys
import os
sys.path.append(os.getcwd())
from app import create_app
from models.license import License

# The user can change this if the domain is different
NEW_DOMAIN = os.getenv('APP_URL', 'https://app.kindicoreai.sbs')
WEBHOOK_PATH = "/webhooks/telegram"
WEBHOOK_URL = f"{NEW_DOMAIN}{WEBHOOK_PATH}"

app = create_app()

with app.app_context():
    licenses = License.query.filter_by(telegram_connected=True).all()
    print(f'Updating webhooks to: {WEBHOOK_URL}')
    
    for l in licenses:
        token = l.telegram_bot_token
        print(f"Updating webhook for @{l.telegram_bot_username}...")
        
        url = f"https://api.telegram.org/bot{token}/setWebhook"
        try:
            response = requests.post(url, json={'url': WEBHOOK_URL}, timeout=10)
            print(f"Result: {response.json()}")
        except Exception as e:
            print(f"Error for @{l.telegram_bot_username}: {e}")
