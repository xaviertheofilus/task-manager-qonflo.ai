export const statuses = ["to_do", "pending", "in_progress", "done"] as const;
export type Status = (typeof statuses)[number];
export const priorities = ["low", "medium", "high"] as const;
export type Priority = (typeof priorities)[number];

export const priorityLabels: Record<Priority, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export const statusLabels: Record<Status, string> = {
  to_do: "To do",
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

export const actors = ["john.doe", "jane.doe", "alex.smith"] as const;

export type Task = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type AuditLog = {
  id: number;
  taskId: string;
  actor: string;
  fromStatus: Status;
  toStatus: Status;
  changedAt: string;
};

export const nextStatus = (status: Status): Status | null =>
  statuses[statuses.indexOf(status) + 1] ?? null;
