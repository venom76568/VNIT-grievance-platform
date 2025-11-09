import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../App";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { LogOut, Building2, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusColors = {
  Assigned: "bg-purple-100 text-purple-800 border-purple-200",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  "Completed - Awaiting Admin Review":
    "bg-green-100 text-green-800 border-green-200",
  RequestedChanges: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function WorkerDashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, action: "" });
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API}/worker/tasks`);
      setTasks(response.data);
    } catch (error) {
      toast.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    try {
      const formData = new FormData();
      formData.append("status", status);
      formData.append("resolution", resolution);
      await axios.put(
        `${API}/worker/tasks/${selectedTask.id}/status`,
        formData
      );
      toast.success(`Task marked as ${status}`);
      setActionDialog({ open: false, action: "" });
      setResolution("");
      fetchTasks();
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const pendingTasks = tasks.filter((t) =>
    ["Assigned", "In Progress", "RequestedChanges"].includes(t.status)
  );
  const completedTasks = tasks.filter((t) =>
    [
      "Resolved",
      "Cannot be Resolved",
      "Completed - Awaiting Admin Review",
      "Completed",
    ].includes(t.status)
  );

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
                <p className="text-sm text-gray-600">Worker Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.full_name}
                </p>
                <p className="text-xs text-gray-600 capitalize">
                  {user?.specialization}
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">
                  Pending Tasks
                </p>
                <p className="text-4xl font-bold text-blue-600 mt-2">
                  {pendingTasks.length}
                </p>
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                <Wrench className="w-7 h-7 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">
                  Completed Tasks
                </p>
                <p className="text-4xl font-bold text-green-600 mt-2">
                  {completedTasks.length}
                </p>
              </div>
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-white rounded-xl shadow-md p-1 border border-gray-100">
            <TabsTrigger
              value="pending"
              className="rounded-lg"
              data-testid="pending-tasks-tab"
            >
              Pending ({pendingTasks.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="rounded-lg"
              data-testid="completed-tasks-tab"
            >
              Completed ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="grid gap-6">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300"
                  data-testid={`task-card-${task.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {task.category}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            statusColors[task.status] ||
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {task.status}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            task.priority === "High" ||
                            task.priority === "Urgent"
                              ? "bg-red-100 text-red-800"
                              : task.priority === "Medium"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {task.priority} Priority
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-1">
                        {task.subcategory}
                      </p>
                      <p className="text-gray-700 mt-2">{task.description}</p>
                      {task.count > 1 && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800 font-semibold">
                            This task represents {task.count} similar complaints
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 mb-4">
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span>Floor {task.floor}</span>
                      {task.room && <span>Room {task.room}</span>}
                      <span>
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      onClick={() => {
                        setSelectedTask(task);
                        setActionDialog({ open: true, action: "Resolved" });
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-xl"
                      data-testid={`resolve-button-${task.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark Resolved
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedTask(task);
                        setActionDialog({
                          open: true,
                          action: "Cannot be Resolved",
                        });
                      }}
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                      data-testid={`cannot-resolve-button-${task.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cannot Resolve
                    </Button>
                  </div>
                </div>
              ))}
              {pendingTasks.length === 0 && (
                <div
                  className="text-center py-16 bg-white rounded-2xl shadow-lg"
                  data-testid="no-pending-tasks"
                >
                  <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No pending tasks
                  </h3>
                  <p className="text-gray-600">You're all caught up!</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="grid gap-6">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 opacity-80"
                  data-testid={`completed-task-card-${task.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {task.category}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                          {task.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-1">
                        {task.subcategory}
                      </p>
                      <p className="text-gray-700 mt-2">{task.description}</p>
                      {task.resolution && (
                        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-sm text-gray-700 font-semibold">
                            Resolution:
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {task.resolution}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span>Floor {task.floor}</span>
                      {task.room && <span>Room {task.room}</span>}
                      <span>
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {completedTasks.length === 0 && (
                <div
                  className="text-center py-16 bg-white rounded-2xl shadow-lg"
                  data-testid="no-completed-tasks"
                >
                  <CheckCircle2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No completed tasks yet
                  </h3>
                  <p className="text-gray-600">
                    Complete tasks to see them here
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Action Dialog */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}
      >
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {actionDialog.action === "Resolved"
                ? "Mark Task as Resolved"
                : "Mark Task as Cannot be Resolved"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="Describe what was done or why it cannot be resolved..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="rounded-xl min-h-[120px]"
                data-testid="resolution-textarea"
              />
            </div>
            <Button
              onClick={() => handleUpdateStatus(actionDialog.action)}
              className={`w-full rounded-xl h-11 ${
                actionDialog.action === "Resolved"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-red-500 hover:bg-red-600"
              } text-white`}
              data-testid="confirm-action-button"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
