import os
import sys
from pathlib import Path

# Add current directory to path so we can import config
sys.path.append(str(Path(__file__).parent))

from config import settings

def check_rvc_setup():
    print("=== RVC Setup Check ===")
    
    # 1. Check Libraries
    print("\n[1] Checking Libraries...")
    try:
        import rvc_python
        print("✅ rvc_python found")
    except ImportError:
        print("❌ rvc_python NOT found. Run: pip install rvc-python --no-deps")
    except Exception as e:
        print(f"❌ Error importing rvc_python: {e}")

    # Check for fairseq
    try:
        import fairseq
        print("✅ fairseq found")
    except ImportError as e:
        print(f"❌ fairseq NOT found: {e}")
        print("   Run: pip install git+https://github.com/facebookresearch/fairseq.git")
    except Exception as e:
        print(f"❌ Error importing fairseq: {e}")

    try:
        import faiss
        print("✅ faiss found")
    except ImportError:
        print("❌ faiss NOT found. Run: pip install faiss-cpu")

    # 2. Check Model Directories
    print("\n[2] Checking Model Directories...")
    rvc_model_dir = settings.rvc_model_path.parent
    print(f"RVC Model Directory: {rvc_model_dir}")
    
    if rvc_model_dir.exists():
        print("✅ Directory exists")
    else:
        print("❌ Directory does NOT exist. Creating...")
        rvc_model_dir.mkdir(parents=True, exist_ok=True)
        print("✅ Directory created")

    # 3. Check Model Files
    print("\n[3] Checking Model Files...")
    model_path = settings.rvc_model_path
    index_path = settings.rvc_index_path
    
    if model_path.exists():
        print(f"✅ Model file found: {model_path.name}")
    else:
        print(f"❌ Model file NOT found: {model_path.name}")
        print(f"   PLEASE PLACE YOUR .pth MODEL HERE: {model_path}")
    
    if index_path.exists():
        print(f"✅ Index file found: {index_path.name}")
    else:
        print(f"⚠️ Index file NOT found: {index_path.name} (Optional but recommended)")
        print(f"   You can place your .index file here: {index_path}")

    # 4. Check Output Directory
    print("\n[4] Checking Output Directory...")
    if settings.rvc_output_dir.exists():
        print(f"✅ Output directory exists: {settings.rvc_output_dir}")
    else:
        print(f"❌ Output directory missing. It will be created automatically.")

    print("\n=== Check Complete ===")

if __name__ == "__main__":
    check_rvc_setup()
