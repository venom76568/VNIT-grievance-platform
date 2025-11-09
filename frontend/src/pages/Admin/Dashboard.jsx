import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LogOut, Building2, TrendingUp, CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Assigned: 'bg-purple-100 text-purple-800 border-purple-200',
  'Completed - Awaiting Admin Review': 'bg-blue-100 text-blue-800 border-blue-200',
  Completed: 'bg-green-100 text-green-800 border-green-200',
  Rejected: 'bg-red-100 text-red-800 border-red-200'
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: '' });
  const [selectedWorker, setSelectedWorker] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [complaintsRes, workersRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/admin/complaints`),
        axios.get(`${API}/admin/workers`),
        axios.get(`${API}/admin/analytics`)
      ]);
      setComplaints(complaintsRes.data);
      setWorkers(workersRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedWorker) {
      toast.error('Please select a worker');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('worker_id', selectedWorker);
      await axios.put(`${API}/admin/complaints/${selectedComplaint.id}/approve`, formData);
      toast.success('Complaint approved and assigned');
      setActionDialog({ open: false, type: '' });
      setSelectedWorker('');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve complaint');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('rejection_reason', rejectionReason);
      await axios.put(`${API}/admin/complaints/${selectedComplaint.id}/reject`, formData);
      toast.success('Complaint rejected');
      setActionDialog({ open: false, type: '' });
      setRejectionReason('');
      fetchData();
    } catch (error) {
      toast.error('Failed to reject complaint');
    }
  };

  const handleReview = async (action) => {
    try {
      const formData = new FormData();
      formData.append('action', action);
      await axios.put(`${API}/admin/complaints/${selectedComplaint.id}/review`, formData);
      toast.success(`Complaint marked as ${action}`);
      setActionDialog({ open: false, type: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to review complaint');
    }
  };

  const filterComplaints = (status) => {
    if (status === 'all') return complaints;
    if (status === 'review') return complaints.filter(c => c.status === 'Completed - Awaiting Admin Review');
    return complaints.filter(c => c.status === status);
  };

  const chartData = [
    { name: 'Pending', value: analytics?.pending_complaints || 0 },
    { name: 'In Progress', value: analytics?.in_progress || 0 },
    { name: 'Resolved', value: analytics?.resolved_complaints || 0 },
  ];

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
                <h1 className="text-2xl font-bold text-gray-900">Hostel Grievance</h1>
                <p className="text-sm text-gray-600">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-600">Administrator</p>
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
        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Complaints</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.total_complaints}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Resolved</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{analytics.resolved_complaints}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{analytics.pending_complaints}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">In Progress</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{analytics.in_progress}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Active Workers</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">{analytics.active_workers}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Avg Resolution Time</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{analytics.avg_resolution_time}h</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Complaint Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Complaint Statistics</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaints Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-white rounded-xl shadow-md p-1 border border-gray-100">
            <TabsTrigger value="pending" className="rounded-lg" data-testid="pending-tab">Pending</TabsTrigger>
            <TabsTrigger value="assigned" className="rounded-lg" data-testid="assigned-tab">Assigned</TabsTrigger>
            <TabsTrigger value="review" className="rounded-lg" data-testid="review-tab">Review</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg" data-testid="completed-tab">Completed</TabsTrigger>
            <TabsTrigger value="rejected" className="rounded-lg" data-testid="rejected-tab">Rejected</TabsTrigger>
          </TabsList>

          {['pending', 'assigned', 'review', 'completed', 'rejected'].map((tab) => (
            <TabsContent key={tab} value={tab === 'review' ? 'review' : tab.toLowerCase()}>
              <div className="grid gap-6">
                {filterComplaints(tab === 'review' ? 'review' : tab.charAt(0).toUpperCase() + tab.slice(1)).map((complaint) => (
                  <div
                    key={complaint.id}
                    className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300"
                    data-testid={`complaint-card-${complaint.id}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{complaint.category}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[complaint.status] || 'bg-gray-100 text-gray-800'}`}>
                            {complaint.status}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            complaint.priority === 'High' || complaint.priority === 'Urgent'
                              ? 'bg-red-100 text-red-800'
                              : complaint.priority === 'Medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {complaint.priority} Priority
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-1">{complaint.subcategory}</p>
                        <p className="text-gray-700 mt-2">{complaint.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mb-4">
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <span>Floor {complaint.floor}</span>
                        {complaint.count > 1 && (
                          <span className="font-semibold text-blue-600">{complaint.count} similar complaints</span>
                        )}
                        <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      {tab === 'pending' && (
                        <>
                          <Button
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              setActionDialog({ open: true, type: 'approve' });
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-xl"
                            data-testid={`approve-button-${complaint.id}`}
                          >
                            Approve & Assign
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              setActionDialog({ open: true, type: 'reject' });
                            }}
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                            data-testid={`reject-button-${complaint.id}`}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {tab === 'review' && (
                        <>
                          <Button
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              handleReview('Completed');
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-xl"
                            data-testid={`complete-button-${complaint.id}`}
                          >
                            Mark Complete
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              handleReview('RequestedChanges');
                            }}
                            variant="outline"
                            className="border-orange-200 text-orange-600 hover:bg-orange-50 rounded-xl"
                            data-testid={`request-changes-button-${complaint.id}`}
                          >
                            Request Changes
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filterComplaints(tab === 'review' ? 'review' : tab.charAt(0).toUpperCase() + tab.slice(1)).length === 0 && (
                  <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                    <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No complaints found</h3>
                    <p className="text-gray-600">No complaints in this category yet</p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* Action Dialogs */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {actionDialog.type === 'approve' ? 'Approve & Assign Complaint' : 'Reject Complaint'}
            </DialogTitle>
          </DialogHeader>
          {actionDialog.type === 'approve' ? (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Worker</Label>
                <Select onValueChange={setSelectedWorker}>
                  <SelectTrigger className="rounded-xl" data-testid="worker-select">
                    <SelectValue placeholder="Choose a worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.full_name} - {worker.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleApprove}
                className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl h-11"
                data-testid="confirm-approve-button"
              >
                Approve & Assign
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Provide a reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="rounded-xl min-h-[100px]"
                  data-testid="rejection-reason-textarea"
                />
              </div>
              <Button
                onClick={handleReject}
                className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl h-11"
                data-testid="confirm-reject-button"
              >
                Confirm Rejection
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}