import { create } from "zustand";

export interface ProjectMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export interface ProjectTaskItem {
  id: string;
  title: string;
  status: string;
  assigned_role?: string;
}

export interface ProjectState {
  currentProjectId: string | null;
  activeAgent: string | null;
  status: string;
  messages: ProjectMessage[];
  tasks: ProjectTaskItem[];
  setProjectId: (id: string | null) => void;
  setActiveAgent: (agent: string | null) => void;
  setStatus: (status: string) => void;
  addMessage: (msg: ProjectMessage) => void;
  setTasks: (tasks: ProjectTaskItem[]) => void;
  reset: () => void;
}

const initialState = {
  currentProjectId: null,
  activeAgent: null,
  status: "idle",
  messages: [],
  tasks: [],
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,
  setProjectId: (id) => set({ currentProjectId: id }),
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  setStatus: (status) => set({ status }),
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),
  setTasks: (tasks) => set({ tasks }),
  reset: () => set(initialState),
}));
