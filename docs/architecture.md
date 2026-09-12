# Architecture Documentation

## Carbon-Aware Supply Chain Dashboard

### System Architecture Flow

```
+-------------------------------------------------------------+
|                   React.js Frontend                         |
|                   (Vite Dev Server: Port 5173)              |
+-------------------------------------------------------------+
                              │ HTTP REST
                              ▼
+-------------------------------------------------------------+
|               Node.js + Express.js Backend                  |
|               (Application API Gateway: Port 5000)          |
|               * No Database on Node.js layer *              |
+-------------------------------------------------------------+
                              │ HTTP REST
                              ▼
+-------------------------------------------------------------+
|                 Django REST Framework                       |
|                 (Python Intelligence Service: Port 8000)    |
+-------------------------------------------------------------+
                              │ ORM
                              ▼
+-------------------------------------------------------------+
|                   Single SQLite Database                    |
|                   (django_service/db.sqlite3)               |
+-------------------------------------------------------------+
```

### Core Architecture Rules

1. **Single SQLite Database Rule**:
   - The entire platform is backed by exactly **ONE SQLite database** managed exclusively through Django ORM migrations.
   - Node.js functions as the client-facing API gateway and proxy, and must NEVER create or connect to any other database.
   - MongoDB, Mongoose, MySQL, PostgreSQL, Firebase, etc., are strictly prohibited.

2. **Multi-Tier Responsibilities**:
   - **Frontend (React)**: User interface, visualizations, supply chain multi-tier network views, Scope 3 dashboard.
   - **Backend (Node/Express)**: Client authentication, routing, and business gateway proxying to the Python service.
   - **Service (Django/DRF)**: Scope 3 emission models, carbon calculation logic, machine learning integration, and SQLite database persistence.
