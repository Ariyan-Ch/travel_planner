
import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer
from torch.quantization import quantize_dynamic

# Configuration
MODEL_DIR = "t5_travel_planner"

# Load tokenizer
tokenizer = T5Tokenizer.from_pretrained(MODEL_DIR)

# Load and quantize model
model = T5ForConditionalGeneration.from_pretrained(MODEL_DIR)

# Apply dynamic quantization to linear layers
quantized_model = quantize_dynamic(
    model,
    {torch.nn.Linear},  # Quantize only linear layers
    dtype=torch.qint8
)

# Optimize for inference
quantized_model.eval()


torch.save(quantized_model, "t5_quantized.pt")
tokenizer.save_pretrained("t5_tokenizer_only")
