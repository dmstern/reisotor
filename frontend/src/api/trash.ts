import { api } from './client';

export async function restoreTrashItem(type: string, id: number): Promise<void> {
  await api.post(`/trash/${type}/${id}/restore`);
}
