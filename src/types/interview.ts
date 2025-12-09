/**
 * Interview-related types and interfaces
 */

export type InterviewStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type InterviewStage =
  | 'introduction'
  | 'experience_review'
  | 'technical_assessment'
  | 'behavioral_questions'
  | 'candidate_questions'
  | 'closing';

export interface Candidate {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobPosition {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  location: string;
  isRemote: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Interview {
  id: string;
  candidateId: string;
  positionId: string;
  status: InterviewStatus;
  currentStage: InterviewStage;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  calendarEventId?: string;
  notes?: string;
  score?: InterviewScore;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewScore {
  overall: number;
  technicalSkills: number;
  communication: number;
  problemSolving: number;
  cultureFit: number;
  enthusiasm: number;
  notes: string;
}

export interface InterviewQuestion {
  id: string;
  category: InterviewStage;
  question: string;
  expectedAnswer?: string;
  followUpQuestions?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  isRequired: boolean;
}

export interface InterviewResponse {
  questionId: string;
  question: string;
  answer: string;
  timestamp: Date;
  score?: number;
  feedback?: string;
}

export interface InterviewSession {
  interviewId: string;
  candidateId: string;
  positionId: string;
  currentStage: InterviewStage;
  responses: InterviewResponse[];
  startedAt: Date;
  lastActivityAt: Date;
  context: InterviewContext;
}

export interface InterviewContext {
  candidateName: string;
  positionTitle: string;
  companyName: string;
  questionsAsked: number;
  currentTopic?: string;
  candidateMood?: 'positive' | 'neutral' | 'nervous' | 'frustrated';
  keyPoints: string[];
  redFlags: string[];
  highlights: string[];
}

export interface ConversationMessage {
  id: string;
  interviewId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface InterviewSummary {
  interviewId: string;
  candidateName: string;
  positionTitle: string;
  duration: number;
  questionsAnswered: number;
  overallScore: number;
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
  strengths: string[];
  areasOfImprovement: string[];
  summary: string;
  nextSteps: string[];
  generatedAt: Date;
}
