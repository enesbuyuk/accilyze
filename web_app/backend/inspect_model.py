import joblib
import pandas as pd
import xgboost as xgb
import sys

try:
    print("Loading model...")
    model = joblib.load('models/model_xgboost.pkl')
    print(f"Model type: {type(model)}")
    
    if hasattr(model, 'feature_names_in_'):
        print("Feature names found:")
        print(model.feature_names_in_)
    else:
        print("No feature_names_in_ attribute. Trying to predict with dummy to fail with meaningful error...")
        # Try a dummy prediction to see if it complains about feature mismatch
        try:
            model.predict(pd.DataFrame({'dummy': [0]}))
        except Exception as e:
            print(f"Prediction error (might reveal features): {e}")
            
except Exception as e:
    print(f"Error: {e}")
