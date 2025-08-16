import json
from datasets import load_dataset
from transformers import T5ForConditionalGeneration, T5Tokenizer, Seq2SeqTrainingArguments, Seq2SeqTrainer
import torch
torch.set_num_threads(1)
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Configuration
MODEL_NAME = "t5-base"
DATASET_PATH = "fulldata.jsonl"
OUTPUT_DIR = "t5_travel_planner"

# Load dataset
dataset = load_dataset("json", data_files=DATASET_PATH)

# Initialize model and tokenizer
tokenizer = T5Tokenizer.from_pretrained(MODEL_NAME)
model = T5ForConditionalGeneration.from_pretrained(MODEL_NAME)

# Preprocessing
def preprocess_function(examples):
    model_inputs = tokenizer(
        examples["prompt"],
        max_length=128,
        truncation=True,
        padding="max_length",
    )
    
    # Setup tokenizer for targets
    with tokenizer.as_target_tokenizer():
        labels = tokenizer(
            examples["completion"],
            max_length=64,
            truncation=True,
            padding="max_length",
        )
    
    model_inputs["labels"] = labels["input_ids"]
    return model_inputs

tokenized_dataset = dataset.map(preprocess_function, batched=True)
splits = tokenized_dataset["train"].train_test_split(test_size=0.1)  # 10% for validation
train_dataset = splits["train"]
val_dataset = splits["test"]

# Training arguments
training_args = Seq2SeqTrainingArguments(
    output_dir=OUTPUT_DIR,
    save_strategy="no",
    num_train_epochs=3,  # More epochs for overfitting
    per_device_train_batch_size=1,  # Reduced for 8GB RAM
    gradient_accumulation_steps=2,
    learning_rate=3e-4,
    weight_decay=0.01,
    save_total_limit=1,
    predict_with_generate=True,
    fp16=False,
    logging_steps=10,
    disable_tqdm=True,
    report_to="none",
    eval_strategy="epoch",
    logging_strategy="epoch",
    do_eval=True,

)

# Trainer
trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset, 
    eval_dataset=val_dataset,     # Added validation se
)

# Train and save
trainer.train()
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print("Training complete. Model saved to", OUTPUT_DIR)