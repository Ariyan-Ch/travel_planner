# Travel Suggestion Generator  

This project is a **full-stack travel planning tool** that combines **Natural Language Processing (NLP)**, **routing APIs**, and **Wikipedia enrichment** to automatically generate personalized trip plans.  

Users can write natural queries like:  
> *"Hey, I want to travel from Lahore to Islamabad. Please plan me the trip!"*  

The system extracts locations, generates a travel route, suggests historical/cultural stops along the way, and visualizes the trip on an interactive map.  

---

## Features  

- **Frontend (React + Leaflet):**  
  - Simple UI to input queries.  
  - Interactive map with suggested routes and stops.  
  - Configurable backend endpoint via `.env`.  

- **Backend (FastAPI + T5 model):**  
  - Fine-tuned **T5** model extracts start, end, and optional stops from user queries.  
  - Integrates with **OSRM** for routing between locations.  
  - Dynamically enriches routes with **Wikipedia data** (summaries + nearby points of interest).  
  - Serves trip plans via REST API.  

- **Model Training Pipeline:**  
  - Fine-tune base T5 model on provided dataset (`.jsonl`).  
  - Quantize the model for efficient inference.  
  - Run inference via FastAPI service.  

---

## Repository Structure  

```
├── service/        # Backend (FastAPI + T5 model + training scripts)
│   ├── inference.py
│   ├── finetune_t5.py
│   ├── quantize_t5.py
│   ├── dataset.jsonl
│   └── ...
│
├── view/           # Frontend (React + Leaflet)
│   ├── src/
│   └── ...
│
├── screenshots/    # Example outputs and UI previews
```

---

## Setup  

### 1. Clone Repository  
```bash
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo
```

### 2. Backend Setup  

#### (a) Install Dependencies  
```bash
cd service
pip install -r requirements.txt
```

#### (b) Fine-tune & Quantize T5  
```bash
python finetune_t5.py
python quantize_t5.py
```

#### (c) Run FastAPI Service  
```bash
uvicorn inference:app --reload
```

The service will start at `http://127.0.0.1:8000` by default.  

---

### 3. Frontend Setup  

```bash
cd ../view
npm install
npm run dev
```

Make sure the backend URL is correctly set in `.env`.  

---

## How It Works  

1. **User Query → T5 Model:**  
   - Extracts `origin`, `destination`, and optional stops.  

2. **Geocoding + Routing:**  
   - Locations converted to lat/lon.  
   - **OSRM** generates route.  

3. **Stop Enrichment:**  
   - Sample points selected along route.  
   - **Wikipedia API** finds nearby landmarks.  
   - Summaries attached to stops.  

4. **Final Route:**  
   - Route re-calculated through selected stops.  
   - Returned to frontend for visualization.  

---

## Screenshots  

See [`/screenshots`](./screenshots) for examples of the UI and generated trip plans.  

---

## Roadmap / Future Improvements  

- ✅ Support for user-specified stops (currently extracted but unused).  
- ✅ Extraction of number of desired additional stops.  
- ⚡ Improved stop selection & optimization for better travel experience.  
- 🚀 Expand beyond Wikipedia to include real-time travel APIs (e.g., hotels, restaurants).  

---

## Tech Stack  

- **Frontend:** React, Leaflet  
- **Backend:** FastAPI, Transformers (T5), OSRM, Wikipedia API  
- **Training:** PyTorch, HuggingFace  
- **Deployment:** Uvicorn  
