/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// Database table types
export type Role = "Admin" | "Teacher" | "Parent" | "Student";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
}

export interface Student {
  id: string;
  userId: string;
  guardianId?: string; // Parent userId
  classId?: string;
}

export interface Teacher {
  id: string;
  userId: string;
  subjects: string[];
}

export interface ClassTable {
  id: string;
  name: string; // e.g., Grade 7 - A
  subjectId?: string;
  teacherId?: string;
}

export interface Subject {
  id: string;
  name: string;
}

export type InvoiceStatus = "Pending" | "Paid" | "Under Review";
export interface Invoice {
  id: string;
  studentId: string;
  title: string;
  amount: number;
  status: InvoiceStatus;
  proofUrl?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string; // direct message
  body: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface School {
  id: string;
  name: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
}
