# Load .env if it exists
ifneq (,$(wildcard .env))
	include .env
	export
endif

# Define paths
VENV_DIR := venv
PIP := $(VENV_DIR)/bin/pip

# Create the virtual environment if it doesn't exist
$(VENV_DIR):
	python3 -m venv $(VENV_DIR)
	source $(VENV_DIR)/bin/activate

# Install dependencies (Frontend & Backend)
local-install: $(VENV_DIR)
	cd web_app/backend && $(PIP) install -r requirements.txt
	cd web_app/frontend && npm install

# Start Backend
start-backend: $(VENV_DIR)
	cd web_app/backend && python3 main.py

# Start Frontend
start-frontend:
	cd web_app/frontend && npm run dev

# Start both in parallel (requires make -j2)
local-start:
	$(MAKE) -j2 start-backend start-frontend