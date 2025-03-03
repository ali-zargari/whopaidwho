export interface Politician {
  id: string;
  name: string;
  cid: string;
  party: string;
  state: string;
  position: string;
  isIncumbent: boolean;
  isCandidate: boolean;
  district?: string;
  profileUrl: string;
}

export interface DonorData {
  name: string;
  amount: number;
  industry?: string;
}

export interface ApiResponse {
  donors: DonorData[];
  isMockData: boolean;
  error?: string;
} 