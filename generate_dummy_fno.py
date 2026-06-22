import torch
import torch.nn as nn
import os

# Ensure directory exists
os.makedirs("models", exist_ok=True)

# Create a simple state dict that looks like a model
# Since strict=False is often used, the exact structure might not matter for the FileNotFoundError
# But let's make it look like a placeholder
model = nn.Sequential(nn.Linear(1, 1))
torch.save(model.state_dict(), "models/fno_model.pt")
print("Dummy fno_model.pt created.")
