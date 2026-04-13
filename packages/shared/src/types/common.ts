export interface Location {
  lat: number;
  lng: number;
}

export interface Address {
  location: Location;
  address: string;
  placeId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type SupportedLanguage = 'ml' | 'en' | 'hi';

export type SupportedCity =
  | 'taliparamba'
  | 'kannur'
  | 'payyanur'
  | 'thalassery'
  | 'iritty'
  | 'calicut'
  | 'kasaragod'
  | 'kochi'
  | 'thrissur'
  | 'thiruvananthapuram'
  | 'kollam';
