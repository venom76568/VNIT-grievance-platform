import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../App";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  LogOut,
  Plus,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusColors = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Approved: "bg-blue-100 text-blue-800 border-blue-200",
  Assigned: "bg-purple-100 text-purple-800 border-purple-200",
  "In Progress": "bg-indigo-100 text-indigo-800 border-indigo-200",
  Resolved: "bg-green-100 text-green-800 border-green-200",
  Completed: "bg-green-100 text-green-800 border-green-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  "Cannot be Resolved": "bg-gray-100 text-gray-800 border-gray-200",
};

const subcategoryOptions = {
  Electrical: [
    "Fan not working",
    "Light not working",
    "AC not working",
    "Switch/Socket issue",
    "Power outage",
    "Wiring problem",
  ],
  Plumbing: [
    "Leaking tap",
    "Clogged drain",
    "Toilet not flushing",
    "No water supply",
    "Broken pipe",
    "Water heater issue",
  ],
  Cleaning: [
    "Garbage not collected",
    "Dirty common area",
    "Pest control needed",
    "Washroom uncleaned",
    "Floor needs mopping",
  ],
  Carpentry: [
    "Broken door",
    "Window not closing",
    "Broken furniture",
    "Loose hinges",
    "Cabinet repair needed",
  ],
  Other: ["General maintenance", "Security issue", "Noise complaint", "Other"],
};

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    complaint_type: "",
    floor: user?.floor || "",
    room: user?.room || "",
    category: "",
    subcategory: "",
  });

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await axios.get(`${API}/resident/complaints`);
      setComplaints(response.data);
    } catch (error) {
      toast.error("Failed to fetch complaints");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/resident/complaints`, formData);
      toast.success("Complaint submitted successfully!");
      setOpen(false);
      setFormData({
        complaint_type: "",
        floor: user?.floor || "",
        room: user?.room || "",
        category: "",
        subcategory: "",
      });
      fetchComplaints();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit complaint");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Hostel Grievance
                </h1>
                <p className="text-sm text-gray-600">Student Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.full_name}
                </p>
                <p className="text-xs text-gray-600">
                  Room {user?.room}, Floor {user?.floor}
                </p>
              </div>
              <Button
                onClick={logout}
                variant="outline"
                className="rounded-xl border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Bar */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">My Complaints</h2>
            <p className="text-gray-600 mt-1">
              Track and manage your submitted issues
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl shadow-lg hover:shadow-xl px-6"
                data-testid="add-complaint-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Complaint
              </Button>
            </DialogTrigger>
            <DialogContent
              className="sm:max-w-[600px] rounded-2xl"
              data-testid="complaint-dialog"
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">
                  Submit New Complaint
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label>Complaint Type</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData({ ...formData, complaint_type: value })
                    }
                    required
                  >
                    <SelectTrigger
                      className="rounded-xl"
                      data-testid="complaint-type-select"
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common_area">Common Area</SelectItem>
                      <SelectItem value="personal_room">
                        Personal Room
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.complaint_type === "common_area" && (
                  <div className="space-y-2">
                    <Label>Floor</Label>
                    <Input
                      placeholder="Enter floor number"
                      value={formData.floor}
                      onChange={(e) =>
                        setFormData({ ...formData, floor: e.target.value })
                      }
                      className="rounded-xl"
                      required
                      data-testid="floor-input"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        category: value,
                        subcategory: "",
                      })
                    }
                    required
                  >
                    <SelectTrigger
                      className="rounded-xl"
                      data-testid="category-select"
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electrical">Electrical</SelectItem>
                      <SelectItem value="Plumbing">Plumbing</SelectItem>
                      <SelectItem value="Cleaning">Cleaning</SelectItem>
                      <SelectItem value="Carpentry">Carpentry</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.category && (
                  <div className="space-y-2">
                    <Label>Issue Type</Label>
                    <Select
                      onValueChange={(value) =>
                        setFormData({ ...formData, subcategory: value })
                      }
                      required
                      value={formData.subcategory}
                    >
                      <SelectTrigger
                        className="rounded-xl"
                        data-testid="subcategory-select"
                      >
                        <SelectValue placeholder="Select specific issue" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategoryOptions[formData.category]?.map(
                          (option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl h-11"
                  data-testid="submit-complaint-button"
                >
                  Submit Complaint
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Complaints List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : complaints.length === 0 ? (
          <div
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
            data-testid="no-complaints"
          >
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No complaints yet
            </h3>
            <p className="text-gray-600">
              Submit your first complaint to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-6" data-testid="complaints-list">
            {complaints.map((complaint) => (
              <div
                key={complaint.id}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300"
                data-testid={`complaint-card-${complaint.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {complaint.category}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          statusColors[complaint.status] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {complaint.status}
                      </span>
                      {complaint.priority !== "Low" && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            complaint.priority === "High" ||
                            complaint.priority === "Urgent"
                              ? "bg-red-100 text-red-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {complaint.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-1">
                      {complaint.subcategory}
                    </p>
                    {complaint.representative_id && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          This complaint is grouped with similar issues
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <span>Floor {complaint.floor}</span>
                    {complaint.room && <span>Room {complaint.room}</span>}
                    <span>
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {complaint.assigned_worker_name && (
                    <div className="text-sm text-gray-600">
                      Worker:{" "}
                      <span className="font-semibold">
                        {complaint.assigned_worker_name}
                      </span>
                    </div>
                  )}
                </div>

                {complaint.rejection_reason && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800 font-semibold">
                      Rejection Reason:
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {complaint.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
