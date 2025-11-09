from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str  # 'resident', 'admin', 'worker'
    
class UserRegister(UserBase):
    password: str
    floor: Optional[str] = None
    room: Optional[str] = None
    specialization: Optional[str] = None  # for workers: electrician, plumber, cleaner, carpenter

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    role: str
    floor: Optional[str] = None
    room: Optional[str] = None
    specialization: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ComplaintCreate(BaseModel):
    complaint_type: str  # 'common_area' or 'personal_room'
    floor: str
    room: Optional[str] = None
    category: str
    subcategory: str
    description: Optional[str] = None
    media_url: Optional[str] = None

class Complaint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    resident_id: str
    complaint_type: str
    floor: str
    room: Optional[str] = None
    category: str
    subcategory: str
    description: Optional[str] = None
    status: str = "Pending"  # Pending, Approved, Assigned, In Progress, Resolved, Cannot be Resolved, Completed, RequestedChanges, Rejected
    priority: str = "Low"  # Low, Medium, High, Urgent
    assigned_to: Optional[str] = None
    representative_id: Optional[str] = None
    count: int = 1
    rejection_reason: Optional[str] = None
    resolution: Optional[str] = None
    media_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved_at: Optional[str] = None

class NotificationModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    complaint_id: str
    title: str
    message: str
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WorkerLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    worker_id: str
    complaint_id: str
    action: str
    proof_media: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def create_notification(user_id: str, complaint_id: str, title: str, message: str):
    notification = NotificationModel(
        user_id=user_id,
        complaint_id=complaint_id,
        title=title,
        message=message
    )
    await db.notifications.insert_one(notification.model_dump())

async def update_priority(complaint_id: str, count: int):
    if count < 3:
        priority = "Low"
    elif count <= 5:
        priority = "Medium"
    else:
        priority = "High"
    await db.complaints.update_one(
        {"id": complaint_id},
        {"$set": {"priority": priority}}
    )

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Admin authorization check
    if user_data.role == 'admin':
        admin_email = os.environ.get('ADMIN_EMAIL')
        admin_password = os.environ.get('ADMIN_PASSWORD')
        
        if user_data.email != admin_email or user_data.password != admin_password:
            raise HTTPException(status_code=403, detail="Unauthorized: You are not authorized to register as admin")
    
    # Create user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        floor=user_data.floor,
        room=user_data.room,
        specialization=user_data.specialization
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": user.model_dump()}

@api_router.post("/auth/login")
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Admin authorization check
    if user['role'] == 'admin':
        admin_email = os.environ.get('ADMIN_EMAIL')
        admin_password = os.environ.get('ADMIN_PASSWORD')
        
        if login_data.email != admin_email or login_data.password != admin_password:
            raise HTTPException(status_code=403, detail="Unauthorized: You are not authorized to login as admin")
    
    token = create_access_token({"sub": user['id']})
    user_copy = user.copy()
    user_copy.pop('password_hash', None)
    return {"token": token, "user": user_copy}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user_copy = current_user.copy()
    user_copy.pop('password_hash', None)
    return user_copy

# Resident Routes
@api_router.get("/resident/complaints")
async def get_resident_complaints(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'resident':
        raise HTTPException(status_code=403, detail="Access denied")
    
    complaints = await db.complaints.find({"resident_id": current_user['id']}, {"_id": 0}).to_list(1000)
    
    # For each complaint, get assigned worker info if available
    for complaint in complaints:
        if complaint.get('assigned_to'):
            worker = await db.users.find_one({"id": complaint['assigned_to']}, {"_id": 0, "full_name": 1})
            complaint['assigned_worker_name'] = worker.get('full_name') if worker else None
    
    return complaints

@api_router.post("/resident/complaints")
async def create_complaint(complaint_data: ComplaintCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'resident':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check for duplicate personal room complaints within 24 hours
    if complaint_data.complaint_type == 'personal_room':
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        existing = await db.complaints.find_one({
            "resident_id": current_user['id'],
            "complaint_type": "personal_room",
            "category": complaint_data.category,
            "created_at": {"$gte": yesterday},
            "status": {"$nin": ["Completed", "Rejected"]}
        })
        if existing:
            raise HTTPException(status_code=400, detail="You already submitted a similar complaint within 24 hours")
    
    # For common area complaints, check for representative
    representative_id = None
    if complaint_data.complaint_type == 'common_area':
        representative = await db.complaints.find_one({
            "complaint_type": "common_area",
            "category": complaint_data.category,
            "subcategory": complaint_data.subcategory,
            "floor": complaint_data.floor,
            "representative_id": None,
            "status": {"$nin": ["Completed", "Rejected"]}
        }, {"_id": 0})
        
        if representative:
            representative_id = representative['id']
            # Increment count
            new_count = representative['count'] + 1
            await db.complaints.update_one(
                {"id": representative_id},
                {"$set": {"count": new_count, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Update priority
            await update_priority(representative_id, new_count)
    
    # Create complaint
    complaint = Complaint(
        resident_id=current_user['id'],
        complaint_type=complaint_data.complaint_type,
        floor=complaint_data.floor,
        room=complaint_data.room,
        category=complaint_data.category,
        subcategory=complaint_data.subcategory,
        description=complaint_data.description,
        media_url=complaint_data.media_url,
        representative_id=representative_id
    )
    
    await db.complaints.insert_one(complaint.model_dump())
    
    # Notify admin
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        await create_notification(
            admin['id'],
            complaint.id,
            "New Complaint",
            f"New {complaint_data.complaint_type.replace('_', ' ')} complaint submitted"
        )
    
    return complaint.model_dump()

# Admin Routes
@api_router.get("/admin/complaints")
async def get_admin_complaints(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get only representative complaints (representative_id is None)
    complaints = await db.complaints.find({"representative_id": None}, {"_id": 0}).to_list(1000)
    
    # For each complaint, get resident and worker info
    for complaint in complaints:
        resident = await db.users.find_one({"id": complaint['resident_id']}, {"_id": 0, "full_name": 1, "email": 1})
        complaint['resident_name'] = resident.get('full_name') if resident else None
        complaint['resident_email'] = resident.get('email') if resident else None
        
        if complaint.get('assigned_to'):
            worker = await db.users.find_one({"id": complaint['assigned_to']}, {"_id": 0, "full_name": 1, "specialization": 1})
            complaint['assigned_worker_name'] = worker.get('full_name') if worker else None
            complaint['assigned_worker_specialization'] = worker.get('specialization') if worker else None
    
    return complaints

@api_router.get("/admin/workers")
async def get_workers(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    workers = await db.users.find({"role": "worker"}, {"_id": 0, "id": 1, "full_name": 1, "specialization": 1}).to_list(1000)
    return workers

@api_router.put("/admin/complaints/{complaint_id}/approve")
async def approve_complaint(complaint_id: str, worker_id: str = Form(...), note: Optional[str] = Form(None), current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    complaint = await db.complaints.find_one({"id": complaint_id}, {"_id": 0})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    await db.complaints.update_one(
        {"id": complaint_id},
        {"$set": {
            "status": "Assigned",
            "assigned_to": worker_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify resident and worker
    await create_notification(
        complaint['resident_id'],
        complaint_id,
        "Complaint Approved",
        f"Your complaint has been approved and assigned to a worker"
    )
    
    await create_notification(
        worker_id,
        complaint_id,
        "New Task Assigned",
        f"You have been assigned a new task: {complaint['category']}"
    )
    
    return {"message": "Complaint approved and assigned"}

@api_router.put("/admin/complaints/{complaint_id}/reject")
async def reject_complaint(complaint_id: str, rejection_reason: str = Form(...), current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    complaint = await db.complaints.find_one({"id": complaint_id}, {"_id": 0})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    await db.complaints.update_one(
        {"id": complaint_id},
        {"$set": {
            "status": "Rejected",
            "rejection_reason": rejection_reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify resident
    await create_notification(
        complaint['resident_id'],
        complaint_id,
        "Complaint Rejected",
        f"Your complaint has been rejected. Reason: {rejection_reason}"
    )
    
    return {"message": "Complaint rejected"}

@api_router.put("/admin/complaints/{complaint_id}/review")
async def review_complaint(complaint_id: str, action: str = Form(...), current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    complaint = await db.complaints.find_one({"id": complaint_id}, {"_id": 0})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if action == "Completed":
        await db.complaints.update_one(
            {"id": complaint_id},
            {"$set": {
                "status": "Completed",
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Mark all linked complaints as completed
        await db.complaints.update_many(
            {"representative_id": complaint_id},
            {"$set": {
                "status": "Completed",
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Notify resident
        await create_notification(
            complaint['resident_id'],
            complaint_id,
            "Complaint Completed",
            "Your complaint has been resolved and marked as completed"
        )
        
    elif action == "RequestedChanges":
        await db.complaints.update_one(
            {"id": complaint_id},
            {"$set": {
                "status": "RequestedChanges",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Notify worker
        if complaint.get('assigned_to'):
            await create_notification(
                complaint['assigned_to'],
                complaint_id,
                "Changes Requested",
                "Admin has requested changes to your completed task"
            )
    
    return {"message": "Review completed"}

@api_router.get("/admin/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Total complaints (representative only)
    total = await db.complaints.count_documents({"representative_id": None})
    
    # Resolved complaints
    resolved = await db.complaints.count_documents({"status": "Completed", "representative_id": None})
    
    # In Progress
    in_progress = await db.complaints.count_documents({"status": {"$in": ["Assigned", "In Progress"]}, "representative_id": None})
    
    # Pending
    pending = await db.complaints.count_documents({"status": "Pending", "representative_id": None})
    
    # Active Workers
    active_workers = await db.users.count_documents({"role": "worker", "is_active": True})
    
    # Average Resolution Time
    resolved_complaints = await db.complaints.find({
        "status": "Completed",
        "representative_id": None,
        "resolved_at": {"$exists": True}
    }, {"_id": 0, "created_at": 1, "resolved_at": 1}).to_list(1000)
    
    avg_time = 0
    if resolved_complaints:
        total_time = 0
        for c in resolved_complaints:
            try:
                created = datetime.fromisoformat(c['created_at'])
                resolved_dt = datetime.fromisoformat(c['resolved_at'])
                total_time += (resolved_dt - created).total_seconds() / 3600  # in hours
            except:
                pass
        avg_time = total_time / len(resolved_complaints) if resolved_complaints else 0
    
    return {
        "total_complaints": total,
        "resolved_complaints": resolved,
        "in_progress": in_progress,
        "pending_complaints": pending,
        "active_workers": active_workers,
        "avg_resolution_time": round(avg_time, 2)
    }

# Worker Routes
@api_router.get("/worker/tasks")
async def get_worker_tasks(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'worker':
        raise HTTPException(status_code=403, detail="Access denied")
    
    tasks = await db.complaints.find({
        "assigned_to": current_user['id'],
        "representative_id": None
    }, {"_id": 0}).to_list(1000)
    
    # Get resident info
    for task in tasks:
        resident = await db.users.find_one({"id": task['resident_id']}, {"_id": 0, "full_name": 1, "email": 1})
        task['resident_name'] = resident.get('full_name') if resident else None
        task['resident_email'] = resident.get('email') if resident else None
    
    return tasks

@api_router.put("/worker/tasks/{complaint_id}/status")
async def update_task_status(
    complaint_id: str,
    status: str = Form(...),
    resolution: Optional[str] = Form(None),
    proof_media: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'worker':
        raise HTTPException(status_code=403, detail="Access denied")
    
    complaint = await db.complaints.find_one({"id": complaint_id}, {"_id": 0})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    update_data = {
        "status": "Completed - Awaiting Admin Review" if status in ["Resolved", "Cannot be Resolved"] else status,
        "resolution": resolution,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.complaints.update_one(
        {"id": complaint_id},
        {"$set": update_data}
    )
    
    # Log worker action
    log = WorkerLog(
        worker_id=current_user['id'],
        complaint_id=complaint_id,
        action=status,
        proof_media=proof_media
    )
    await db.worker_logs.insert_one(log.model_dump())
    
    # Notify admin
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        await create_notification(
            admin['id'],
            complaint_id,
            "Task Update",
            f"Worker has marked task as {status}"
        )
    
    # Notify resident
    await create_notification(
        complaint['resident_id'],
        complaint_id,
        "Task Update",
        f"Your complaint status has been updated to: {status}"
    )
    
    return {"message": "Task updated"}

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user['id']},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # ✅ allow from anywhere
    allow_credentials=True,
    allow_methods=["*"],      # ✅ allow all methods (GET, POST, PUT, DELETE)
    allow_headers=["*"],      # ✅ allow all custom headers
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()