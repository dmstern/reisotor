export interface User {
  id: number;
  username: string;
  avatar: string;
}

export interface Trip {
  id: number;
  name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
}

export interface ScheduleItem {
  id: number;
  date: string;
  time: string | null;
  title: string;
  note: string | null;
  idea_id: number | null;
}

export interface PackingItem {
  id: number;
  category: string | null;
  label: string;
  checked: 0 | 1;
  owner_id: number | null;
}

export interface Idea {
  id: number;
  title: string;
  image_url: string | null;
  link: string | null;
  maps_link: string | null;
  note: string | null;
  status: 'idea' | 'planned';
  lat: number | null;
  lng: number | null;
}

export interface Spot {
  id: number;
  name: string;
  category: string | null;
  link: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Accommodation {
  id: number;
  name: string;
  address: string | null;
  link: string | null;
  maps_link: string | null;
  start_date: string | null;
  end_date: string | null;
  checkin: string | null;
  checkout: string | null;
  contact: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
}

export interface BudgetItem {
  id: number;
  title: string;
  category: string | null;
  amount: number;
  paid_by: string | null;
  is_paid: 0 | 1;
}
