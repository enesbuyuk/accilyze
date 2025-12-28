from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from risk_model import AccidentRiskModel
from typing import Optional
import os 

app = FastAPI(title="Accident Risk Prediction API", description="API to predict road accident risk using XGBoost.")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL")],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize the model
try:
    model = AccidentRiskModel()
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

class RiskInput(BaseModel):
    # Road Characteristics
    num_lanes: int = Field(..., description="Number of lanes")
    curvature: float = Field(..., description="Road curvature (e.g., 0 to 1)")
    speed_limit: int = Field(..., description="Speed limit in km/h")
    
    # Booleans (0 or 1)
    road_signs_present: int = Field(..., description="Road signs present (0=No, 1=Yes)")
    public_road: int = Field(..., description="Is it a public road (0=No, 1=Yes)")
    holiday: int = Field(..., description="Is it a holiday (0=No, 1=Yes)")
    school_season: int = Field(..., description="Is it school season (0=No, 1=Yes)")
    
    # Historical
    num_reported_accidents: int = Field(..., description="Number of reported accidents in this area")

    # Categorical One-Hot / Flags
    road_type_rural: int = Field(0, description="Road type Rural (0/1)")
    road_type_urban: int = Field(0, description="Road type Urban (0/1)")
    
    lighting_dim: int = Field(0, description="Lighting Dim (0/1)")
    lighting_night: int = Field(0, description="Lighting Night (0/1)")
    
    weather_foggy: int = Field(0, description="Weather Foggy (0/1)")
    weather_rainy: int = Field(0, description="Weather Rainy (0/1)")
    
    time_of_day_evening: int = Field(0, description="Time Evening (0/1)")
    time_of_day_morning: int = Field(0, description="Time Morning (0/1)")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Accident Risk Prediction API. Use /predict to get risk assessments."}

@app.post("/predict")
def predict_risk(input_data: RiskInput):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")
    
    # Convert Pydantic model to dict
    data_dict = input_data.model_dump()
    
    # Get prediction
    result = model.predict(data_dict)
    
    return {
        "input": data_dict,
        "prediction": result
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
