import os
from pathlib import Path
import logging

from config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RVCInferenceWrapper:
    _instance = None
    
    def __init__(self):
        self.rvc = None
        self.model_loaded = False
        self.current_model_path = None
        self.current_index_path = None
        
        try:
            from rvc_python.infer import RVCInference
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.rvc = RVCInference(device=device)
            logger.info(f"RVCInference initialized on {device}")
        except ImportError:
            logger.error("rvc-python not found. Please install it with: pip install rvc-python")
        except Exception as e:
            logger.error(f"Failed to initialize RVCInference: {e}")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self, model_path: Path, index_path: Path = None):
        if not self.rvc:
            logger.warning("RVC library not available. Skipping model load.")
            return False

        if not model_path.exists():
            logger.warning(f"RVC model not found at {model_path}")
            return False
            
        try:
            # Avoid reloading if same model AND same index
            if (self.model_loaded and
                self.current_model_path == model_path and
                self.current_index_path == index_path):
                return True

            logger.info(f"Loading RVC model from {model_path}")
            # rvc_python's load_model expects a model name, not a path.
            # Call vc.get_vc() directly with the absolute path instead,
            # and register the model in self.rvc.models so infer_file can find the index.
            abs_model = str(model_path.resolve())
            abs_index = str(index_path.resolve()) if index_path and index_path.exists() else ""
            self.rvc.vc.get_vc(abs_model, "v2")
            model_key = model_path.stem
            self.rvc.models[model_key] = {"pth": abs_model, "index": abs_index}
            self.rvc.current_model = model_key

            self.model_loaded = True
            self.current_model_path = model_path
            self.current_index_path = index_path
            return True
        except Exception as e:
            logger.error(f"Error loading RVC model: {e}")
            self.model_loaded = False
            return False

    def infer(self, input_audio_path: Path, output_audio_path: Path, pitch_change: int = 0, f0_method: str = "rmvpe", index_rate: float = 0.75):
        """
        Perform RVC inference.
        """
        if not self.rvc or not self.model_loaded:
            logger.error("RVC model not loaded or library missing.")
            return False
            
        if not input_audio_path.exists():
            logger.error(f"Input audio not found: {input_audio_path}")
            return False
            
        try:
            logger.info(f"Starting RVC inference on {input_audio_path}")
            logger.info(f"Pitch: {pitch_change}, Method: {f0_method}")
            
            # Ensure output dir exists
            output_audio_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Set parameters
            self.rvc.set_params(
                f0up_key=pitch_change,
                f0method=f0_method,
                index_rate=index_rate
            )
            
            self.rvc.infer_file(
                input_path=str(input_audio_path),
                output_path=str(output_audio_path)
            )
            
            if output_audio_path.exists():
                logger.info(f"RVC inference successful: {output_audio_path}")
                return True
            else:
                logger.error("Output file was not created.")
                return False
                
        except Exception as e:
            logger.error(f"Error during RVC inference: {e}")
            import traceback
            traceback.print_exc()
            return False

# Global accessor
def get_rvc_wrapper():
    return RVCInferenceWrapper.get_instance()
