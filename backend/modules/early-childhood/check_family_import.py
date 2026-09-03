import sys
import os

# Set up path to include the project root
sys.path.append('/Users/macbook/Desktop/kindicoreai/kindicore-py')

try:
    from api.children import Family
    print(f"✅ Family successfully imported from api.children: {Family}")
except ImportError as e:
    print(f"❌ ImportError when importing Family from api.children: {e}")
except Exception as e:
    print(f"❌ Unexpected error when importing Family from api.children: {e}")

try:
    from models.child import Family as FamilyModel
    print(f"✅ Family successfully imported from models.child: {FamilyModel}")
except ImportError as e:
    print(f"❌ ImportError when importing Family from models.child: {e}")

# Check if there's any shadowing in api.children
import api.children
if hasattr(api.children, 'Family'):
    print(f"✅ api.children has attribute 'Family': {api.children.Family}")
else:
    print("❌ api.children does NOT have attribute 'Family'")
