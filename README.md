# MaiSpec
MaiSpec is a browser-based requirements management tool that helps users generate, edit, and export requirements.  
It consists of a *React frontend* and a *FastAPI backend*.

# Prerequisites

installed:

- [Python 3.10+](https://www.python.org/)  
- [Node.js & npm](https://nodejs.org/)  
- [pip](https://pip.pypa.io/) or [Poetry](https://python-poetry.org/)  

##  Project Structure
 New Folder/
├── backend/ 
│ ├── main.py # Entry point for API
│ ├── routers/ # API routes
│ ├── services/ # Business logic (LLM, generation, exporting)
│ ├── exporters/ # PDF, DOCX, Markdown export
│ └── utils/ # Helper modules
│
├── frontend/ # React frontend
│ ├── src/ # React components, pages, services
│ └── public/ # Static assets
│
└── README.md

## Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend

Create a virtual environment:
python -m venv venv
venv\Scripts\activate     

Install dependencies:
pip install -r requirements.txt

Start the FastAPI server:
uvicorn main:app --reload
Backend will run at: http://localhost:8000
Frontend Setup

Navigate to the frontend folder:
cd frontend

Install dependencies:
npm install

Start the development server:
npm start
Frontend will run at: http://localhost:3000

 How to Use

Start both backend (FastAPI) and frontend (React) servers.
Open the app in your browser at http://localhost:3000.

Enter or dictate requirements.
The system will generate structured requirements using LLM.
Edit requirements directly in the browser.
Export requirements as PDF, DOCX, or Markdown.

# Production Build
To build the frontend for production:

cd frontend
npm run build


Serve the built files with a static server or integrate them with the backend.

# Troubleshooting

If the backend does not start, ensure all Python dependencies are installed.
If the frontend fails, try removing node_modules and reinstalling:

rm -rf node_modules package-lock.json
npm install