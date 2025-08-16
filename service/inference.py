from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import time
import sys
import requests
import urllib.parse
import webbrowser
import json
import time
import torch
from transformers import T5Tokenizer
import re
import polyline
from geopy.distance import distance

# Configuration
MAX_LENGTH = 64

# Load tokenizer
tokenizer = T5Tokenizer.from_pretrained("t5_tokenizer_only")

quantized_model = torch.load("t5_quantized.pt", map_location="cpu", weights_only=False)
quantized_model.eval()


# WORKAROUND: avoid NoneType in generate()
if getattr(quantized_model.config, "_attn_implementation", None) is None:
    quantized_model.config._attn_implementation = []

torch.set_num_threads(4)  # Use 4 CPU cores


load_dotenv() 
# --- CONFIG ---------------------------------------------------
GEOCODE_API_ENV = os.getenv("GEOCODE_API_KEY","-")
OSRM_PROFILE     = "driving"   # or "walking", "cycling", etc.
OUTPUT_HTML      = "map.html"
# -------------------------------------------------------------
BACKEND_URL = os.getenv("BACKEND_URL")

app = FastAPI()


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # or ["*"] to allow all 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_response(prompt: str) -> str:

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        max_length=128,
        truncation=True,
        padding="max_length"
    )
    
    
    # Timed inference
    start_time = time.time()
    print("WORKED TILL HERE!")

    outputs = quantized_model.generate(
        **inputs,
        max_length=MAX_LENGTH,
        num_beams=1,  # Disable beam search for speed
        do_sample=False,
        early_stopping=True,
        forced_bos_token_id=tokenizer.convert_tokens_to_ids("{")
    )



    gen_time = time.time() - start_time
    return tokenizer.decode(outputs[0], skip_special_tokens=True), gen_time


def repair_json(json_str: str) -> str:
    """Automatically fix common JSON formatting issues"""
    # Add missing quotes around keys
    json_str = re.sub(r'(\w+):', r'"\1":', json_str)
    
    # Replace single quotes with double quotes
    json_str = json_str.replace("'", '"')
    
    # Fix trailing commas
    json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
    
    # Fix missing commas
    json_str = re.sub(r'"\s*([^"])', '", \1', json_str)
    
    return json_str


def extract_json(text: str) -> dict:
    json_str = text
    # Find first { and last }
    start_idx = json_str.find('{')
    
    if start_idx == -1:
        json_str = "{" + json_str
    
    end_idx = json_str.rfind('}')

    if end_idx == -1:
        json_str = json_str + "}"

    try:
        # Attempt direct parse
        return json.loads(json_str)
    except json.JSONDecodeError:
        try:
            # Try fixing common issues
            json_str = json_str.replace("True", "true").replace("False", "false")
            repaired = repair_json(json_str)
            return json.loads(repaired)
        except:
            return {"error": "JSON parsing failed", "raw": text}



def geocode(address):
    """Return (lat, lon, display_name) of the FIRST result for this address."""
    q = urllib.parse.quote_plus(address)
    url = f"https://geocode.maps.co/search?q={q}&api_key={GEOCODE_API_ENV}"
    resp = requests.get(url)
    resp.raise_for_status()
    data = resp.json()
    if not data:
        print(f"No geocoding result for “{address}”")
        return None, None, None
        #sys.exit(1)
    place = data[0]
    return float(place["lat"]), float(place["lon"]), place.get("display_name", address)



@app.get("/getmap")
async def read_root(query: str = Query(...), model: str = Query(...)):
    #print(query)
    #print(model)

    response, gen_time = generate_response(query)
    parsed = extract_json(response)
    if "error" in parsed:
        print(parsed)
        return {}
    print("Model Response time: ", gen_time)

    t0 = time.time()
    # start_lat, start_lon, start_name = geocode("Androon Lahore, Lahore, Pakistan")
    start_lat, start_lon, start_name = geocode(parsed["start"])
    elapsed = time.time() - t0
    if elapsed < 1.2:
        time.sleep(1.2 - elapsed)
    
    end_lat, end_lon, end_name = geocode(parsed["end"])
    if any(var is None for var in [start_lat, start_lon, start_name,end_lat,end_lon,end_name]):
        return {} # meaning the query was invalid/couldn't be processed.


    # Get direct route from OSRM
    direct_osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?steps=true&geometries=polyline&overview=full"
    try:
        response = requests.get(direct_osrm_url, timeout=10)
        response.raise_for_status()
        direct_route_data = response.json()
        if direct_route_data.get('code') != 'Ok' or 'routes' not in direct_route_data:
            raise ValueError("No direct route found by OSRM")
    except requests.RequestException as e:
        raise ValueError(f"OSRM direct route request failed: {e}")

    # Extract direct route data
    direct_route_geometry = direct_route_data['routes'][0]['geometry']
    total_distance = direct_route_data['routes'][0]['distance']  # in meters

    # Decode polyline to coordinates
    points = polyline.decode(direct_route_geometry)

    # Compute cumulative distances
    cum_distances = [0.0]
    for i in range(1, len(points)):
        dist = distance(points[i-1], points[i]).meters
        cum_distances.append(cum_distances[-1] + dist)

    # Sample points for stops (up to 5)
    num_samples = 5
    sample_distances = [total_distance * (i + 1) / (num_samples + 1) for i in range(num_samples)]
    sample_points = []
    for sd in sample_distances:
        for i, cd in enumerate(cum_distances):
            if cd >= sd:
                sample_points.append((points[i], cd))
                break
    result = {"start": start_name, "end": end_name, "start_lat": start_lat, "end_lat": end_lat,
            "start_lon": start_lon, "end_lon":end_lon, "points": points, "sample_points": sample_points}
    print(result)
    return result 
    return {"start": start_name, "end": end_name, "start_lat": start_lat, "end_lat": end_lat,
            "start_lon": start_lon, "end_lon":end_lon, "points": points, "sample_points": sample_points}


@app.get("/")
async def read_root():
    print("Pinged")
    return {"message": "Hello, World!"}