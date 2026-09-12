# Carbon-Aware Supply Chain Dashboard

A comprehensive platform to monitor and reduce **Scope 3 supply-chain carbon emissions** across multi-tier suppliers.

---

## 🏗️ Architecture

```
React.js Frontend (Vite)
       │ HTTP REST (Port 5173)
       ▼
Node.js + Express.js API Gateway
       │ HTTP REST (Port 5000)
       ▼
Django + Django REST Framework
       │ ORM (Port 8000)
       ▼
Single SQLite Database (db.sqlite3)
```

### 🔒 Strict Database Policy
- **SQLite ONLY**: Exactly one database file (`django_service/db.sqlite3`) serves the entire system.
- **Managed Exclusively by Django**: Migrations, schema evolution, and models are handled via Django ORM.
- **Node.js**: Operates strictly as a stateless application API layer / gateway. Node does **NOT** create, maintain, or connect to any secondary database.
- **No Other Databases**: MongoDB, Mongoose, MySQL, PostgreSQL, Firebase, etc., are strictly excluded.

---

## 📁 Project Structure

```
carbon-aware-supply-chain/
│
├── frontend/             # React.js web client (Vite)
│   ├── src/              # React components & styles
│   ├── package.json
│   └── vite.config.js
│
├── backend/              # Node.js + Express API Gateway
│   ├── src/
│   │   └── index.js      # Main Express server & Django proxy
│   ├── .env.example
│   ├── .env
│   └── package.json
│
├── django_service/       # Django + Django REST Framework service
│   ├── core/             # Django project settings & health endpoints
│   ├── db.sqlite3        # Single SQLite database
│   ├── manage.py
│   └── requirements.txt
│
├── ml/                   # ML models & training pipelines (scikit-learn, joblib)
│   └── README.md
│
├── data/                 # Raw & processed emission datasets
│   └── README.md
│
├── docs/                 # Architectural specifications
│   └── architecture.md
│
├── .gitignore
└── README.md
```

---

## 🚀 How to Run the Services

### 1. Start Django Intelligence Service (Port 8000)

```bash
cd django_service

# Install dependencies (first time only)
pip install -r requirements.txt

# Run migrations to initialize SQLite database
python manage.py migrate

# Start the Django server
python manage.py runserver 8000
```
- Health Check: `http://127.0.0.1:8000/api/health/`

---

### 2. Start Node.js Express Backend (Port 5000)

```bash
cd backend

# Install dependencies (first time only)
npm install

# Start Express server
npm start
# or for live watch mode:
npm run dev
```
- Health Check: `http://localhost:5000/api/health`

---

### 3. Start React Frontend (Port 5173)

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start Vite dev server
npm run dev
```
- Open your browser at: `http://localhost:5173`

---

## 🧪 Verification & Health Check

When both backend services are running, opening `http://localhost:5000/api/health` or `http://localhost:5173` verifies the full communication chain:
```
React (Port 5173) ──> Node.js (Port 5000) ──> Django (Port 8000) ──> SQLite (db.sqlite3)
```
