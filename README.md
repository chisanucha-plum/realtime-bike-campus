# Helmet Compliance & Traffic Violation Detection System

Real-time AI system for detecting helmet violations and motorcycle overcrowding 

![Homepage](docs/images/homepage.png)

## Overview

Two-stage YOLO pipeline for automatic traffic violation detection:
- **Motorcycle Detection & Tracking** with YOLOv8 + ByteTrack
- **Helmet Detection** using custom YOLO model
- **Violation Analysis** for non-compliance monitoring

![Architecture](docs/images/architecture.png)

## Features

- ✅ Real-time motorcycle detection & tracking
- ✅ Helmet compliance monitoring
- ✅ Overcrowding detection (>2 passengers)
- ✅ Live MJPEG video streaming
- ✅ SSE-based real-time events
- ✅ Historical record storage (PostgreSQL)
- ✅ Multi-language support (TH/EN)
- ✅ Role-based access control

## Detection Workflow

```
Video Input → Motorcycle Detection → Helmet Detection → Violation Analysis → Database
```

## Violation Rules

A violation is recorded when:
- Rider/passenger not wearing helmet
- More than 2 people on motorcycle

```json
{
  "motorcycle_track_id": 19,
  "helmet_status": true,
  "passenger_count": 2,
  "over_capacity": false,
  "violation": false
}
```

## Tech Stack

**Backend**
- Python 3.12+, FastAPI, SQLAlchemy, PostgreSQL
- OpenCV, Ultralytics YOLOv8, ByteTrack

**Frontend**
- Next.js, TypeScript, Tailwind CSS
- SSE, Recharts

**Infrastructure**
- Docker, Docker Compose

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 14+ or a Supabase project

### Backend
```bash
cd backend
pip install -r requirements.txt
# Set DATABASE_URL to the Supabase connection string from Project Settings > Database
export DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend also accepts `SUPABASE_DB_URL`. For component-based configuration,
use `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, and
`DATABASE_NAME`. The legacy lowercase names in `.env` remain supported.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker
```bash
docker-compose up --build
```

### Model & Video Assets
Trained models (.pt) and sample videos (.mp4) are excluded from git to reduce repo size. Place them in:
- `backend/train/` - YOLO model checkpoints
- `src/case/` - Test case videos
- `src/image/` - Additional test videos

Download from releases or external storage as documented in deployment guide.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /helmet/stream` | Live MJPEG stream |
| `GET /helmet/events` | Real-time events (SSE) |
| `GET /helmet/history` | Detection history |
| `POST /user/login` | Authentication |

## Configuration

Detection thresholds live in the `detection` section of `config.{SITE}.json`.
Each model uses its own confidence key:

```json
{
  "detection": {
    "bike_id": 3,
    "bike_confidence": 0.5,
    "tracker": "bytetrack.yaml",
    "helmet_confidence": 0.20,
    "helmet_imgsz": 640,
    "roi_side_pad": 2.0,
    "roi_top_pad": 3.0,
    "roi_bottom_pad": 1.0,
    "line_position_percent": 0.5
  }
}
```

## Project Structure

```
backend/
├── app/
│   ├── core/          # Config & security
│   ├── database/      # DB session
│   ├── models/        # SQLAlchemy models
│   ├── routers/       # API endpoints
│   ├── schemas/       # Pydantic schemas
│   └── services/      # Business logic
└── main.py

frontend/
├── app/               # Next.js pages
├── components/        # React components
│   ├── pages/         # Page components
│   ├── real-time/     # Real-time components
│   └── ui/            # UI components
├── hooks/             # Custom hooks
├── services/          # API services
└── stores/            # State management
```

## Screenshots

![Login](docs/images/login.png)
![Dashboard](docs/images/sample.png)
![Logs](docs/images/logs.png)
