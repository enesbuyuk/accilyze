import joblib
import pandas as pd
import os

class AccidentRiskModel:
    def __init__(self):
        self.model_path = "models/model_xgboost.pkl"
        self.feature_names = [
            'num_lanes', 'curvature', 'speed_limit', 'road_signs_present', 'public_road',
            'holiday', 'school_season', 'num_reported_accidents', 'road_type_rural',
            'road_type_urban', 'lighting_dim', 'lighting_night', 'weather_foggy',
            'weather_rainy', 'time_of_day_evening', 'time_of_day_morning'
        ]
        self.model = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                print(f"Successfully loaded XGBoost model from {self.model_path}")
            except Exception as e:
                print(f"Error loading model: {e}")
        else:
            print(f"Model file {self.model_path} not found.")

    def predict(self, data: dict) -> dict:
        """
        Predicts accident risk using the loaded XGBoost model.
        """
        if self.model:
            try:
                # Create DataFrame with exact column order
                df = pd.DataFrame([data])
                
                # Ensure all columns exist and are in order
                # (The input data should match, but this enforces order)
                df = df[self.feature_names] 
                
                # Predict
                prediction = self.model.predict(df)[0]
                
                # Handle potential negative or out-of-bounds predictions from regression
                final_risk = max(0.0, min(1.0, float(prediction)))
                
                return {
                    "risk_score": round(final_risk, 2),
                    "risk_level": self._get_risk_level(final_risk),
                    "factors": data
                }
            except Exception as e:
                print(f"Prediction error: {e}")
                return {"error": str(e)}
        else:
            return {"error": "Model not loaded"}

    def _get_risk_level(self, score):
        if score < 0.3:
            return "Low"
        elif score < 0.7:
            return "Medium"
        else:
            return "High"
