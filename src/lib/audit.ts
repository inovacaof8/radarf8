import { updateData, generateId } from "./mock-data";
import type { AuditLog } from "@/types";

export function addAuditLog(log: Omit<AuditLog, "id" | "createdAt">) {
  updateData((data) => ({
    ...data,
    auditLogs: [
      { ...log, id: generateId("log"), createdAt: new Date().toISOString() },
      ...data.auditLogs,
    ],
  }));
}
