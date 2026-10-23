import { downloadLink } from "../../shared/games";
import { api } from "./api";

export async function downloadSnapshotZip(seriesNumber: number, trainerId: string, milestone: string): Promise<void> {
  const { url } = await api(
    `/series/${seriesNumber}/trainers/${encodeURIComponent(trainerId)}/snapshots/${encodeURIComponent(milestone)}/zip`,
    downloadLink,
  );
  window.location.assign(url);
}
